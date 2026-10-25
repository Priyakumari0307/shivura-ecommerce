import "server-only";
import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ==========================================
// TYPES & RESULT INTERFACES
// ==========================================

export interface RateLimitSuccess {
  allowed: true;
  limit?: number;
  remaining?: number;
  reset?: number;
}

export interface RateLimitFailure {
  allowed: false;
  status: 429 | 503;
  response: Response;
  reason?: string;
}

export type RateLimitResult = RateLimitSuccess | RateLimitFailure;

// ==========================================
// RESPONSE BUILDERS
// ==========================================

export function createTooManyRequestsResponse(res: {
  limit: number;
  remaining: number;
  reset: number;
}): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
  return Response.json(
    {
      success: false,
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please try again later.",
      },
    },
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(res.limit),
        "X-RateLimit-Remaining": String(res.remaining),
        "X-RateLimit-Reset": String(Math.ceil(res.reset / 1000)),
      },
    }
  );
}

export function createServiceUnavailableResponse(
  message = "Security service unavailable. Please retry shortly."
): Response {
  return Response.json(
    {
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message,
      },
    },
    {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "30",
      },
    }
  );
}

// ==========================================
// CLIENT IP EXTRACTION & TRUST BOUNDARIES
// ==========================================

// Forbidden headers that cannot be configured as TRUSTED_PROXY_HEADER in production
const FORBIDDEN_TRUSTED_HEADERS = new Set([
  "x-test-client-ip",
  "test-client-ip",
  "cookie",
  "authorization",
  "set-cookie",
  "host",
]);

/**
 * Validates and normalizes candidate IP strings (IPv4 or IPv6).
 * Strips surrounding quotes, IPv4 port suffixes (e.g. 192.0.2.1:8080),
 * and IPv6 bracketed wrappers (e.g. [2001:db8::1]:443 or [2001:db8::1]).
 * Rejects malformed strings, private octal ambiguation (leading zeros),
 * non-IP strings, and CIDR ranges via node:net isIP.
 */
export function cleanAndValidateIp(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let candidate = raw.trim();
  if (!candidate) return null;

  // Strip wrapping quotes if added by intermediate proxies
  if (
    (candidate.startsWith('"') && candidate.endsWith('"')) ||
    (candidate.startsWith("'") && candidate.endsWith("'"))
  ) {
    candidate = candidate.slice(1, -1).trim();
  }

  // Bracketed IPv6 with optional port: [2001:db8::1]:443 or [2001:db8::1]
  const ipv6BracketMatch = candidate.match(/^\[([a-fA-F0-9:]+)\](?::\d+)?$/);
  if (ipv6BracketMatch) {
    const ip = ipv6BracketMatch[1];
    return isIP(ip) === 6 ? ip : null;
  }

  // IPv4 with optional port suffix: 198.51.100.1:8080
  const ipv4PortMatch = candidate.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/);
  if (ipv4PortMatch) {
    const ip = ipv4PortMatch[1];
    return isIP(ip) === 4 ? ip : null;
  }

  // Standard raw IPv4 or IPv6
  const version = isIP(candidate);
  if (version === 4 || version === 6) {
    return candidate;
  }

  return null;
}

/**
 * Resolves the client IP address strictly from verified trusted proxy sources.
 *
 * Trust Model & Security Principles:
 * 1. ZERO DEFAULT HEADER TRUST: In production, client-supplied headers (including
 *    `CF-Connecting-IP`, `X-Real-IP`, `X-Vercel-Forwarded-For`, and `X-Forwarded-For`)
 *    are NEVER blindly trusted. Any client can forge these headers if the origin server
 *    is directly reachable or if an upstream proxy does not overwrite them.
 * 2. EXPLICIT TRUST BOUNDARY: A proxy header is ONLY inspected if the operator has
 *    explicitly configured `TRUSTED_PROXY_HEADER` in the environment.
 *    CRITICAL DEPLOYMENT PREREQUISITE:
 *    Configuring `TRUSTED_PROXY_HEADER` does NOT inherently make a proxy trustworthy.
 *    The operator MUST ensure at the infrastructure/network level that:
 *    a) Direct access to the origin port is blocked (e.g. firewall, AWS VPC Security
 *       Group, or Cloudflare Authenticated Origin Pulls) so clients cannot bypass the proxy.
 *    b) The upstream reverse proxy strips or overwrites any incoming client-supplied
 *       value for this header before forwarding the request to the application.
 * 3. FRAMEWORK-VERIFIED IP: If the runtime platform provides a verified direct IP
 *    property on NextRequest (such as NextRequest.ip on Vercel Edge runtime), it is
 *    accepted after strict IP format validation.
 * 4. SAFE FAILURE (FAIL-CLOSED): In production, if neither an explicitly configured
 *    `TRUSTED_PROXY_HEADER` nor a framework-verified direct IP can be established,
 *    this function returns `null`. High-risk unauthenticated routes (e.g. CRM login,
 *    customer login, customer signup) fail closed with HTTP 503 to prevent unthrottled
 *    brute-force attacks.
 * 5. STRICT NON-PRODUCTION RESTRICTION: Test-only IP headers (`x-test-client-ip`) and the
 *    localhost fallback (`127.0.0.1`) are strictly restricted to `NODE_ENV !== "production"`.
 *    Attempting to configure test headers in production is rejected and returns `null`.
 */
export function getTrustedClientIp(request: NextRequest): string | null {
  // 1. Explicitly configured trusted proxy header
  const configuredHeader = process.env.TRUSTED_PROXY_HEADER?.trim().toLowerCase();
  if (configuredHeader) {
    // Validate header name format
    if (!/^[a-z0-9_-]+$/.test(configuredHeader)) {
      console.error(
        `[RateLimit Security] Malformed TRUSTED_PROXY_HEADER name: "${configuredHeader}". Rejecting.`
      );
      return null;
    }

    // Strictly forbid test or sensitive headers in production
    if (process.env.NODE_ENV === "production" && FORBIDDEN_TRUSTED_HEADERS.has(configuredHeader)) {
      console.error(
        `[RateLimit Security] Forbidden header "${configuredHeader}" configured as TRUSTED_PROXY_HEADER in production. Rejecting.`
      );
      return null;
    }

    const rawVal = request.headers.get(configuredHeader)?.trim();
    if (rawVal) {
      // In headers supporting lists (e.g. X-Forwarded-For), take the first (client) entry
      const firstEntry = rawVal.split(",")[0].trim();
      const validatedIp = cleanAndValidateIp(firstEntry);
      if (validatedIp) {
        return validatedIp;
      }
      // Header present but contains invalid IP: fail closed, do not fall back
      return null;
    }

    // Configured header is missing on this request: fail closed, do not guess
    return null;
  }

  // 2. Framework-verified IP (NextRequest.ip on trusted hosting platforms)
  const directIp = (request as unknown as { ip?: string }).ip;
  if (directIp && typeof directIp === "string") {
    const validatedDirect = cleanAndValidateIp(directIp);
    if (validatedDirect) {
      return validatedDirect;
    }
  }

  // 2b. Automatically resolve Vercel edge proxy header when deployed on Vercel platform
  if (process.env.VERCEL === "1") {
    const vercelIp = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    if (vercelIp) {
      const validated = cleanAndValidateIp(vercelIp);
      if (validated) return validated;
    }
  }

  // 3. Non-production / test fallback (strictly disabled in production)
  if (process.env.NODE_ENV !== "production") {
    const testIp = request.headers.get("x-test-client-ip")?.trim();
    if (testIp) {
      const validatedTestIp = cleanAndValidateIp(testIp);
      if (validatedTestIp) return validatedTestIp;
    }
    return "127.0.0.1";
  }

  // In production with no established trusted proxy, return null (fail closed)
  return null;
}

// ==========================================
// REDIS CONNECTION & MOCK TEST INJECTION
// ==========================================

let testRedisOverride: unknown = null;

export function _setTestRedisClient(client: unknown) {
  testRedisOverride = client;
}

export function _resetTestRedisClient() {
  testRedisOverride = null;
}

export function isUpstashConfigured(): boolean {
  if (testRedisOverride !== null) return true;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return Boolean(url && token);
}

function getRedisClient(): Redis | null {
  if (testRedisOverride !== null) {
    return testRedisOverride as Redis;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    return null;
  }
  return new Redis({ url, token });
}

// ==========================================
// LIMITER FACTORY & POLICIES
// ==========================================

type LimiterCache = Map<string, Ratelimit>;
const limiterCache: LimiterCache = new Map();

function getLimiter(
  policyName: string,
  createLimiterFn: () => Ratelimit
): Ratelimit {
  if (testRedisOverride !== null) {
    return createLimiterFn();
  }
  const existing = limiterCache.get(policyName);
  if (existing) return existing;

  const instance = createLimiterFn();
  limiterCache.set(policyName, instance);
  return instance;
}

/**
 * Generic policy runner executing a shared sliding window check against Upstash Redis.
 */
async function executeLimit(
  policyName: string,
  identifier: string,
  limiterFactory: (redis: Redis) => Ratelimit,
  options: { failClosed: boolean }
): Promise<RateLimitResult> {
  const { failClosed } = options;

  // 1. Verify configuration
  if (!isUpstashConfigured()) {
    if (process.env.NODE_ENV === "production") {
      if (failClosed) {
        console.error(
          `[RateLimit] Missing Upstash Redis credentials in production for policy "${policyName}". Failing closed.`
        );
        return {
          allowed: false,
          status: 503,
          response: createServiceUnavailableResponse(),
          reason: "unconfigured_production",
        };
      } else {
        console.warn(
          `[RateLimit] Missing Upstash Redis credentials in production for policy "${policyName}". Failing open.`
        );
        return { allowed: true };
      }
    } else {
      // In local dev without credentials, allow developer to work
      return { allowed: true };
    }
  }

  // 2. Instantiate or retrieve limiter
  let limiter: Ratelimit | null = null;
  try {
    const redis = getRedisClient();
    if (!redis) {
      throw new Error("Unable to initialize Redis client");
    }
    limiter = getLimiter(policyName, () => limiterFactory(redis));
  } catch (initErr) {
    console.error(`[RateLimit Initialization Error] Policy "${policyName}":`, initErr);
    if (failClosed) {
      return {
        allowed: false,
        status: 503,
        response: createServiceUnavailableResponse(),
        reason: "initialization_error",
      };
    }
    return { allowed: true };
  }

  // 3. Execute sliding window check
  try {
    const res = await limiter.limit(identifier);

    if (res.reason === "timeout") {
      console.warn(`[RateLimit Timeout] Policy "${policyName}" timed out for key "${identifier}"`);
      if (failClosed) {
        return {
          allowed: false,
          status: 503,
          response: createServiceUnavailableResponse(),
          reason: "timeout",
        };
      }
      return { allowed: true };
    }

    if (!res.success) {
      return {
        allowed: false,
        status: 429,
        response: createTooManyRequestsResponse(res),
        reason: "rate_limit_exceeded",
      };
    }

    return {
      allowed: true,
      limit: res.limit,
      remaining: res.remaining,
      reset: res.reset,
    };
  } catch (error) {
    console.error(
      `[RateLimit Execution Error] Policy "${policyName}" encountered error:`,
      error instanceof Error ? error.message : "Unknown error"
    );
    if (failClosed) {
      return {
        allowed: false,
        status: 503,
        response: createServiceUnavailableResponse(),
        reason: "redis_error",
      };
    }
    return { allowed: true };
  }
}

// ==========================================
// EXPORTED POLICY CHECKERS
// ==========================================

/**
 * Policy 1: CRM Admin Login
 * 5 attempts per 15 minutes per trusted client IP.
 * Fail closed (503) if limiter or trusted IP is unavailable.
 */
export async function checkCrmLoginRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  const trustedIp = getTrustedClientIp(request);
  if (!trustedIp) {
    return {
      allowed: false,
      status: 503,
      response: createServiceUnavailableResponse(
        "Unable to establish trusted client identity for security rate-limiting."
      ),
      reason: "missing_trusted_ip",
    };
  }

  return executeLimit(
    "crm_login",
    trustedIp,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "15 m"),
        prefix: "rl:crm_login",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: true }
  );
}

/**
 * Policy 2A: Customer Login (IP Bucket)
 * 5 attempts per minute per trusted client IP.
 * Fail closed (503) if limiter or trusted IP is unavailable.
 */
export async function checkCustomerLoginIpRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  const trustedIp = getTrustedClientIp(request);
  if (!trustedIp) {
    return {
      allowed: false,
      status: 503,
      response: createServiceUnavailableResponse(
        "Unable to establish trusted client identity for security rate-limiting."
      ),
      reason: "missing_trusted_ip",
    };
  }

  return executeLimit(
    "auth_login_ip",
    trustedIp,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 m"),
        prefix: "rl:auth_login_ip",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: true }
  );
}

/**
 * Policy 2B: Customer Login (Compound Bucket: Normalized Email + Trusted IP)
 * 5 attempts per 15 minutes per (trusted IP + normalized email).
 * Protects specific customer accounts against targeted distributed credential stuffing.
 * Applied before database query and bcrypt verification.
 */
export async function checkCustomerLoginCompoundRateLimit(
  request: NextRequest,
  rawEmail: string
): Promise<RateLimitResult> {
  const trustedIp = getTrustedClientIp(request);
  if (!trustedIp) {
    return {
      allowed: false,
      status: 503,
      response: createServiceUnavailableResponse(
        "Unable to establish trusted client identity for security rate-limiting."
      ),
      reason: "missing_trusted_ip",
    };
  }

  const normalizedEmail = (rawEmail || "").trim().toLowerCase();
  const compoundKey = `${trustedIp}:${normalizedEmail}`;

  return executeLimit(
    "auth_login_compound",
    compoundKey,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "15 m"),
        prefix: "rl:auth_login_compound",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: true }
  );
}

/**
 * Policy 3: Customer Signup
 * 3 attempts per hour per trusted client IP.
 * Fail closed (503) if limiter or trusted IP is unavailable.
 */
export async function checkCustomerSignupRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  const trustedIp = getTrustedClientIp(request);
  if (!trustedIp) {
    return {
      allowed: false,
      status: 503,
      response: createServiceUnavailableResponse(
        "Unable to establish trusted client identity for security rate-limiting."
      ),
      reason: "missing_trusted_ip",
    };
  }

  return executeLimit(
    "auth_signup",
    trustedIp,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        prefix: "rl:auth_signup",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: true }
  );
}

/**
 * Policy 4: Checkout (Orders Submission)
 * 5 requests per minute, keyed primarily by authenticated userId.
 * In addition, checks an IP limit (10 requests/min) if trusted IP is available.
 * Fails closed (503) on limiter failure.
 * Preserves existing checkout idempotency semantics.
 */
export async function checkCheckoutRateLimit(
  request: NextRequest,
  userId: string
): Promise<RateLimitResult> {
  // 1. Primary authenticated user bucket
  const userResult = await executeLimit(
    "orders_user",
    userId,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 m"),
        prefix: "rl:orders_user",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: true }
  );

  if (!userResult.allowed) {
    return userResult;
  }

  // 2. Secondary IP bucket if trusted IP is available
  const trustedIp = getTrustedClientIp(request);
  if (trustedIp) {
    const ipResult = await executeLimit(
      "orders_ip",
      trustedIp,
      (redis) =>
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(10, "1 m"),
          prefix: "rl:orders_ip",
          ephemeralCache: false,
          timeout: 3000,
        }),
      { failClosed: true }
    );

    if (!ipResult.allowed) {
      return ipResult;
    }
  }

  return { allowed: true };
}

/**
 * Policy 5: Media Upload
 * 10 requests per minute, keyed by verified admin ID.
 * Applied after admin authorization.
 * Fail closed (503).
 */
export async function checkCrmUploadRateLimit(
  adminId: string
): Promise<RateLimitResult> {
  return executeLimit(
    "crm_upload",
    adminId,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        prefix: "rl:crm_upload",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: true }
  );
}

/**
 * Policy 6: Contact / Concierge Form
 * 3 requests per 5 minutes keyed by authenticated user ID.
 * Plus secondary IP limit (5 requests per 5 minutes) when trusted IP is available.
 * Fail closed (503).
 */
export async function checkContactRateLimit(
  request: NextRequest,
  userId: string
): Promise<RateLimitResult> {
  // Primary user bucket
  const userResult = await executeLimit(
    "contact_user",
    userId,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "5 m"),
        prefix: "rl:contact_user",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: true }
  );

  if (!userResult.allowed) {
    return userResult;
  }

  // Secondary IP bucket
  const trustedIp = getTrustedClientIp(request);
  if (trustedIp) {
    const ipResult = await executeLimit(
      "contact_ip",
      trustedIp,
      (redis) =>
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(5, "5 m"),
          prefix: "rl:contact_ip",
          ephemeralCache: false,
          timeout: 3000,
        }),
      { failClosed: true }
    );

    if (!ipResult.allowed) {
      return ipResult;
    }
  }

  return { allowed: true };
}

/**
 * Policy 7: CRM Write Operations (POST, PUT, PATCH, DELETE)
 * 60 requests per minute, keyed by verified admin ID.
 * Applied after admin authorization.
 * Fail closed (503).
 */
export async function checkCrmWriteRateLimit(
  adminId: string
): Promise<RateLimitResult> {
  return executeLimit(
    "crm_write",
    adminId,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "1 m"),
        prefix: "rl:crm_write",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: true }
  );
}

/**
 * Policy 8: Public Catalog Reads (GET /api/products, /api/products/[slug], /api/categories, /api/occasions)
 * 60 requests per minute per trusted client IP.
 * Fails OPEN (allowed: true) only upon genuine limiter infrastructure errors, with server warning.
 * Enforces HTTP 429 when limits are exceeded.
 */
export async function checkPublicCatalogRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  const trustedIp = getTrustedClientIp(request);
  if (!trustedIp) {
    // If client IP cannot be verified, fail open for public browsing
    console.warn("[RateLimit] Untrusted or missing client IP for public catalog read; failing open.");
    return { allowed: true };
  }

  return executeLimit(
    "catalog_read",
    trustedIp,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "1 m"),
        prefix: "rl:catalog_read",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: false }
  );
}

/**
 * Policy 9: CRM Administrative Reads (GET /api/crm/analytics, /api/crm/products, /api/crm/orders, etc.)
 * 60 requests per minute, keyed by verified admin ID.
 * Applied after admin authorization.
 * Fails OPEN (allowed: true) upon limiter infrastructure errors so administrators are not locked out of management portals.
 * Enforces HTTP 429 when limits are exceeded.
 */
export async function checkCrmReadRateLimit(
  adminId: string
): Promise<RateLimitResult> {
  return executeLimit(
    "crm_read",
    adminId,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "1 m"),
        prefix: "rl:crm_read",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: false }
  );
}

/**
 * Policy 10: CRM Media Library Reads (GET /api/crm/media)
 * 30 requests per minute, keyed by verified admin ID.
 * Stricter limit protecting upstream Cloudinary API quota.
 * Applied after admin authorization.
 * Fails OPEN (allowed: true) upon limiter infrastructure errors so administrators can still access media management.
 * Enforces HTTP 429 when limits are exceeded.
 */
export async function checkCrmMediaReadRateLimit(
  adminId: string
): Promise<RateLimitResult> {
  return executeLimit(
    "crm_media_read",
    adminId,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        prefix: "rl:crm_media_read",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: false }
  );
}

/**
 * Policy 11: Customer Cart & Wishlist Mutations
 * (POST /api/cart/items, PATCH/DELETE /api/cart/items/[itemId], POST/DELETE /api/wishlist, DELETE /api/cart)
 * 30 requests per minute, keyed by verified customer userId.
 * Applied after customer session authentication.
 * Fails CLOSED (HTTP 503) upon limiter infrastructure failure to protect database write capacity
 * and prevent unthrottled concurrent mutation floods during security/cache degradation.
 * Note: Database consistency, concurrency safety, and inventory validation remain strictly
 * enforced by PostgreSQL transaction row-locking and constraints—rate limiting serves as an
 * upstream traffic and capacity control, not a replacement for database consistency controls.
 */
export async function checkCustomerMutationRateLimit(
  userId: string
): Promise<RateLimitResult> {
  return executeLimit(
    "cust_mut",
    userId,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        prefix: "rl:cust_mut",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: true }
  );
}

/**
 * Policy 12: Customer General Reads (GET /api/cart, GET /api/wishlist, GET /api/orders/[id])
 * 60 requests per minute, keyed by verified customer userId.
 * Applied after customer session authentication.
 * Fails OPEN (allowed: true) upon limiter infrastructure failure so customers can continue
 * viewing their cart, wishlist, and confirmed order status during Redis maintenance or latency.
 * Enforces HTTP 429 when limits are exceeded.
 */
export async function checkCustomerReadRateLimit(
  userId: string
): Promise<RateLimitResult> {
  return executeLimit(
    "cust_read",
    userId,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "1 m"),
        prefix: "rl:cust_read",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: false }
  );
}

/**
 * Policy 13: Customer Order History List Read (GET /api/orders)
 * 30 requests per minute, keyed by verified customer userId.
 * Applied after customer session authentication.
 * Stricter read quota protects expensive multi-record queries with pagination and relation joins.
 * Fails OPEN (allowed: true) upon limiter infrastructure failure so customers can still view order history.
 * Enforces HTTP 429 when limits are exceeded.
 */
export async function checkCustomerOrderListRateLimit(
  userId: string
): Promise<RateLimitResult> {
  return executeLimit(
    "cust_order_list_read",
    userId,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        prefix: "rl:cust_order_list_read",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: false }
  );
}

/**
 * Policy 14: Google OAuth Initiation (GET /api/auth/google)
 * 15 requests per minute per trusted client IP.
 * Applied before generating OAuth state, nonce, or PKCE values.
 * Fails CLOSED (HTTP 503) upon missing trusted client IP or limiter infrastructure failure
 * to prevent unthrottled state generation, nonce flooding, and denial-of-service bot storms.
 * Enforces HTTP 429 when limits are exceeded.
 */
export async function checkOAuthInitiationRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  const trustedIp = getTrustedClientIp(request);
  if (!trustedIp) {
    return {
      allowed: false,
      status: 503,
      response: createServiceUnavailableResponse(
        "Unable to establish trusted client identity for security rate-limiting."
      ),
      reason: "missing_trusted_ip",
    };
  }

  return executeLimit(
    "oauth_init",
    trustedIp,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(15, "1 m"),
        prefix: "rl:oauth_init",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: true }
  );
}

/**
 * Policy 15: Google OAuth Callback (GET /api/auth/google/callback)
 * 30 requests per minute per trusted client IP.
 * Applied after state/PKCE verification and before external token exchange and database operations.
 * Fails OPEN (allowed: true) upon missing trusted client IP or limiter infrastructure failure
 * so legitimate users authenticating via shared NAT or during Redis maintenance are not locked out
 * and do not have single-use authorization codes burned.
 * Enforces HTTP 429 when limits are exceeded.
 */
export async function checkOAuthCallbackRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  const trustedIp = getTrustedClientIp(request);
  if (!trustedIp) {
    console.warn("[RateLimit] Untrusted or missing client IP for OAuth callback; failing open.");
    return { allowed: true };
  }

  return executeLimit(
    "oauth_callback",
    trustedIp,
    (redis) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        prefix: "rl:oauth_callback",
        ephemeralCache: false,
        timeout: 3000,
      }),
    { failClosed: false }
  );
}



