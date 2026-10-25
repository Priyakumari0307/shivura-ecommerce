#!/usr/bin/env node

/**
 * Phase 7C — Step 4C.2A Verification Test Suite:
 * Shared Rate Limiting & Outage Policy Unit Tests
 *
 * Mocks Upstash Redis at the module boundary.
 * Does NOT connect to Neon PostgreSQL or a live Redis instance.
 */

import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";

// Intercept 'server-only' import so Node can run Next.js server utilities in test
register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        if (specifier === 'server-only') {
          return { format: 'module', shortCircuit: true, url: 'data:text/javascript,export default {};' };
        }
        return next(specifier, context);
      }
    `),
  import.meta.url
);

const {
  checkCrmLoginRateLimit,
  checkCustomerLoginIpRateLimit,
  checkCustomerLoginCompoundRateLimit,
  checkCustomerSignupRateLimit,
  checkCheckoutRateLimit,
  checkCrmUploadRateLimit,
  checkContactRateLimit,
  checkCrmWriteRateLimit,
  checkPublicCatalogRateLimit,
  checkCrmReadRateLimit,
  checkCrmMediaReadRateLimit,
  checkCustomerMutationRateLimit,
  checkCustomerReadRateLimit,
  checkCustomerOrderListRateLimit,
  checkOAuthInitiationRateLimit,
  checkOAuthCallbackRateLimit,
  getTrustedClientIp,
  cleanAndValidateIp,
  _setTestRedisClient,
  _resetTestRedisClient,
  createTooManyRequestsResponse,
  createServiceUnavailableResponse,
} = await import("../lib/rateLimit.ts");

let passedCount = 0;
let failedCount = 0;

function assertTest(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Helper to construct a mock NextRequest
function createMockRequest({
  headers = {},
  ip = undefined,
  url = "http://localhost:3000/api/test",
} = {}) {
  const headerMap = new Map();
  for (const [k, v] of Object.entries(headers)) {
    headerMap.set(k.toLowerCase(), v);
  }

  return {
    url,
    ip,
    headers: {
      get(name) {
        return headerMap.get(name.toLowerCase()) || null;
      },
    },
  };
}

// In-memory sliding window mock Redis for Upstash Ratelimit
class MockUpstashRedis {
  constructor() {
    this.counters = new Map();
  }

  // The slidingWindow algorithm executes a Lua script returning {remaining, effectiveLimit}
  async eval(script, keys, args) {
    const key = keys[0];
    const maxRequests = Number(args[0]) || 5;
    const now = Number(args[1]) || Date.now();
    const windowMs = Number(args[2]) || 60000;

    let timestamps = this.counters.get(key) || [];
    timestamps = timestamps.filter((t) => t > now - windowMs);

    if (timestamps.length >= maxRequests) {
      // Exceeded limit: Lua script returns {-1, effectiveLimit}
      return [-1, maxRequests];
    }

    timestamps.push(now);
    this.counters.set(key, timestamps);
    const remaining = maxRequests - timestamps.length;
    return [remaining, maxRequests];
  }

  async evalsha(...args) {
    return this.eval(...args);
  }
}

// A mock that simulates a Redis timeout / connection failure
class FailingMockRedis {
  async eval() {
    throw new Error("ETIMEDOUT: Connection to Redis cluster timed out after 3000ms");
  }
  async evalsha() {
    throw new Error("ETIMEDOUT: Connection to Redis cluster timed out after 3000ms");
  }
}

console.log("=====================================================================");
console.log("  PHASE 7C — STEP 4C.2A: SHARED RATE LIMITING TEST SUITE");
console.log("=====================================================================\n");

// -------------------------------------------------------------------
// 1. IP RESOLUTION & TRUST BOUNDARY TESTS
// -------------------------------------------------------------------
console.log("▶ 1. Trusted Client IP Resolution & Anti-Spoofing Tests");

// 1.0 IP Syntax Normalization & Anti-Injection Unit Tests (cleanAndValidateIp)
{
  assertTest(
    cleanAndValidateIp("198.51.100.42") === "198.51.100.42",
    "cleanAndValidateIp: accepts standard IPv4"
  );
  assertTest(
    cleanAndValidateIp("2001:db8::1") === "2001:db8::1",
    "cleanAndValidateIp: accepts standard IPv6"
  );
  assertTest(
    cleanAndValidateIp("::1") === "::1",
    "cleanAndValidateIp: accepts IPv6 loopback"
  );
  assertTest(
    cleanAndValidateIp("[2001:db8::1]") === "2001:db8::1",
    "cleanAndValidateIp: normalizes bracketed IPv6"
  );
  assertTest(
    cleanAndValidateIp("[2001:db8::1]:443") === "2001:db8::1",
    "cleanAndValidateIp: strips port from bracketed IPv6"
  );
  assertTest(
    cleanAndValidateIp("198.51.100.1:8080") === "198.51.100.1",
    "cleanAndValidateIp: strips port from IPv4"
  );
  assertTest(
    cleanAndValidateIp('"198.51.100.42"') === "198.51.100.42",
    "cleanAndValidateIp: strips surrounding double quotes"
  );
  assertTest(
    cleanAndValidateIp("'198.51.100.42'") === "198.51.100.42",
    "cleanAndValidateIp: strips surrounding single quotes"
  );
  assertTest(
    cleanAndValidateIp("999.999.999.999") === null,
    "cleanAndValidateIp: rejects out-of-range IPv4 octets"
  );
  assertTest(
    cleanAndValidateIp("01.02.03.04") === null,
    "cleanAndValidateIp: rejects zero-padded octal IPv4 (prevents SSRF/parser differentials)"
  );
  assertTest(
    cleanAndValidateIp("not-an-ip") === null,
    "cleanAndValidateIp: rejects non-IP strings"
  );
  assertTest(
    cleanAndValidateIp("192.168.1.1/24") === null,
    "cleanAndValidateIp: rejects CIDR subnet notation"
  );
  assertTest(
    cleanAndValidateIp("192.168.1.1\r\nX-Injected: true") === null,
    "cleanAndValidateIp: rejects CRLF injection in IP string"
  );
  assertTest(
    cleanAndValidateIp("") === null && cleanAndValidateIp("   ") === null,
    "cleanAndValidateIp: rejects empty or whitespace-only strings"
  );
  assertTest(
    cleanAndValidateIp(null) === null && cleanAndValidateIp(undefined) === null,
    "cleanAndValidateIp: safely handles null and undefined"
  );
}

// 1.1 Default Production Behavior (Zero Trust for Headers by Default)
const oldEnv = process.env.NODE_ENV;
const oldProxyHeader = process.env.TRUSTED_PROXY_HEADER;
process.env.NODE_ENV = "production";
delete process.env.TRUSTED_PROXY_HEADER;

try {
  // Case A: Attacker supplies only arbitrary X-Forwarded-For
  const spoofedXff = createMockRequest({
    headers: { "X-Forwarded-For": "203.0.113.195, 198.51.100.1" },
  });
  assertTest(
    getTrustedClientIp(spoofedXff) === null,
    "In production, arbitrary X-Forwarded-For is REJECTED by default (returns null)"
  );

  // Case B: Attacker supplies arbitrary cf-connecting-ip without TRUSTED_PROXY_HEADER
  const spoofedCf = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.42" },
  });
  assertTest(
    getTrustedClientIp(spoofedCf) === null,
    "In production, arbitrary cf-connecting-ip is REJECTED by default (returns null)"
  );

  // Case C: Attacker supplies arbitrary x-real-ip without TRUSTED_PROXY_HEADER
  const spoofedRealIp = createMockRequest({
    headers: { "x-real-ip": "198.51.100.42" },
  });
  assertTest(
    getTrustedClientIp(spoofedRealIp) === null,
    "In production, arbitrary x-real-ip is REJECTED by default (returns null)"
  );

  // Case D: Attacker supplies arbitrary x-vercel-forwarded-for without TRUSTED_PROXY_HEADER
  const spoofedVercel = createMockRequest({
    headers: { "x-vercel-forwarded-for": "198.51.100.99" },
  });
  assertTest(
    getTrustedClientIp(spoofedVercel) === null,
    "In production, arbitrary x-vercel-forwarded-for is REJECTED by default (returns null)"
  );

  // Case E: Attacker supplies x-test-client-ip in production
  const spoofedTestHeader = createMockRequest({
    headers: { "x-test-client-ip": "10.0.0.99" },
  });
  assertTest(
    getTrustedClientIp(spoofedTestHeader) === null,
    "In production, x-test-client-ip is REJECTED (returns null)"
  );

  // Case F: Attacker supplies all proxy headers simultaneously
  const allSpoofed = createMockRequest({
    headers: {
      "cf-connecting-ip": "1.1.1.1",
      "x-real-ip": "2.2.2.2",
      "x-vercel-forwarded-for": "3.3.3.3",
      "x-forwarded-for": "4.4.4.4",
      "x-test-client-ip": "5.5.5.5",
    },
  });
  assertTest(
    getTrustedClientIp(allSpoofed) === null,
    "In production, multiple unverified spoofed proxy headers are all rejected"
  );

  // Case G: Framework-verified NextRequest.ip populated by platform runtime
  const directIpReq = createMockRequest({
    ip: "203.0.113.88",
    headers: { "X-Forwarded-For": "3.3.3.3" },
  });
  assertTest(
    getTrustedClientIp(directIpReq) === "203.0.113.88",
    "Framework-verified NextRequest.ip is trusted when no custom header configured"
  );

  // Case H: Framework-verified NextRequest.ip with invalid IP format
  const malformedDirectIpReq = createMockRequest({
    ip: "malformed.ip.value",
    headers: { "X-Forwarded-For": "3.3.3.3" },
  });
  assertTest(
    getTrustedClientIp(malformedDirectIpReq) === null,
    "Framework-verified NextRequest.ip is rejected if malformed"
  );

  // 1.2 Explicitly Configured TRUSTED_PROXY_HEADER Modes in Production
  // Mode 1: Cloudflare cf-connecting-ip
  process.env.TRUSTED_PROXY_HEADER = "cf-connecting-ip";

  const cfValidReq = createMockRequest({
    headers: {
      "cf-connecting-ip": "198.51.100.42",
      "X-Forwarded-For": "1.1.1.1",
    },
  });
  assertTest(
    getTrustedClientIp(cfValidReq) === "198.51.100.42",
    "Configured cf-connecting-ip is trusted and ignores spoofed X-Forwarded-For"
  );

  const cfMissingReq = createMockRequest({
    headers: { "X-Forwarded-For": "1.1.1.1" },
  });
  assertTest(
    getTrustedClientIp(cfMissingReq) === null,
    "Configured cf-connecting-ip fails safely (returns null) when header is missing"
  );

  const cfInvalidReq = createMockRequest({
    headers: { "cf-connecting-ip": "invalid-ip-string" },
  });
  assertTest(
    getTrustedClientIp(cfInvalidReq) === null,
    "Configured cf-connecting-ip fails safely (returns null) on invalid IP content"
  );

  const cfIpv6Req = createMockRequest({
    headers: { "cf-connecting-ip": "[2001:db8::1]:443" },
  });
  assertTest(
    getTrustedClientIp(cfIpv6Req) === "2001:db8::1",
    "Configured cf-connecting-ip extracts and validates IPv6 addresses with port"
  );

  // Mode 2: Vercel x-vercel-forwarded-for
  process.env.TRUSTED_PROXY_HEADER = "x-vercel-forwarded-for";

  const vercelValidReq = createMockRequest({
    headers: {
      "x-vercel-forwarded-for": "198.51.100.99, 10.0.0.1",
      "cf-connecting-ip": "2.2.2.2",
    },
  });
  assertTest(
    getTrustedClientIp(vercelValidReq) === "198.51.100.99",
    "Configured x-vercel-forwarded-for extracts client IP from comma-separated list"
  );

  const vercelMissingReq = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.99" },
  });
  assertTest(
    getTrustedClientIp(vercelMissingReq) === null,
    "Configured x-vercel-forwarded-for fails safely when header is missing"
  );

  // Mode 3: Nginx x-real-ip
  process.env.TRUSTED_PROXY_HEADER = "x-real-ip";

  const nginxValidReq = createMockRequest({
    headers: {
      "x-real-ip": "198.51.100.77",
      "x-forwarded-for": "3.3.3.3",
    },
  });
  assertTest(
    getTrustedClientIp(nginxValidReq) === "198.51.100.77",
    "Configured x-real-ip resolves verified client IP"
  );

  // Mode 4: AWS ALB / Generic x-forwarded-for
  process.env.TRUSTED_PROXY_HEADER = "x-forwarded-for";

  const albValidReq = createMockRequest({
    headers: {
      "x-forwarded-for": "203.0.113.50, 10.0.0.1, 10.0.0.2",
    },
  });
  assertTest(
    getTrustedClientIp(albValidReq) === "203.0.113.50",
    "Configured x-forwarded-for extracts client IP from list"
  );

  const albInvalidReq = createMockRequest({
    headers: {
      "x-forwarded-for": "bad-ip, 10.0.0.1",
    },
  });
  assertTest(
    getTrustedClientIp(albInvalidReq) === null,
    "Configured x-forwarded-for fails safely when first entry is invalid IP"
  );

  // Mode 5: Misconfigured / Malicious Header Name
  process.env.TRUSTED_PROXY_HEADER = "malformed header name with spaces!";
  assertTest(
    getTrustedClientIp(cfValidReq) === null,
    "Malformed TRUSTED_PROXY_HEADER name is rejected and returns null"
  );

  process.env.TRUSTED_PROXY_HEADER = "x-test-client-ip";
  const testOverrideInProd = createMockRequest({
    headers: { "x-test-client-ip": "10.0.0.1" },
  });
  assertTest(
    getTrustedClientIp(testOverrideInProd) === null,
    "Configuring TRUSTED_PROXY_HEADER as x-test-client-ip is forbidden in production"
  );

  process.env.TRUSTED_PROXY_HEADER = "cookie";
  const cookieOverrideInProd = createMockRequest({
    headers: { cookie: "10.0.0.1" },
  });
  assertTest(
    getTrustedClientIp(cookieOverrideInProd) === null,
    "Configuring TRUSTED_PROXY_HEADER as cookie is forbidden in production"
  );

  // 1.3 Non-Production Environment Behavior (development / test)
  process.env.NODE_ENV = "test";
  delete process.env.TRUSTED_PROXY_HEADER;

  const devTestIpReq = createMockRequest({
    headers: { "x-test-client-ip": "10.0.0.42" },
  });
  assertTest(
    getTrustedClientIp(devTestIpReq) === "10.0.0.42",
    "In non-production, x-test-client-ip is accepted for test overrides"
  );

  const devDefaultReq = createMockRequest();
  assertTest(
    getTrustedClientIp(devDefaultReq) === "127.0.0.1",
    "In non-production, missing IP defaults to 127.0.0.1 for local developer convenience"
  );
} finally {
  process.env.NODE_ENV = oldEnv;
  if (oldProxyHeader !== undefined) {
    process.env.TRUSTED_PROXY_HEADER = oldProxyHeader;
  } else {
    delete process.env.TRUSTED_PROXY_HEADER;
  }
}

// -------------------------------------------------------------------
// 2. RESPONSE SHAPE & RETRY-AFTER HEADERS TESTS
// -------------------------------------------------------------------
console.log("\n▶ 2. Standard HTTP 429 and 503 Response Format Tests");

{
  // Test HTTP 429 Response Format
  const resetMs = Date.now() + 45000;
  const res429 = createTooManyRequestsResponse({
    limit: 5,
    remaining: 0,
    reset: resetMs,
  });

  assertTest(res429.status === 429, "TooManyRequests response has HTTP status 429");
  assertTest(
    res429.headers.get("Retry-After") !== null &&
      Number(res429.headers.get("Retry-After")) >= 1,
    "429 response contains positive integer Retry-After header"
  );
  assertTest(
    res429.headers.get("X-RateLimit-Limit") === "5",
    "429 response contains X-RateLimit-Limit header"
  );
  assertTest(
    res429.headers.get("X-RateLimit-Remaining") === "0",
    "429 response contains X-RateLimit-Remaining header"
  );

  // Test HTTP 503 Response Format
  const res503 = createServiceUnavailableResponse();
  assertTest(res503.status === 503, "ServiceUnavailable response has HTTP status 503");
  assertTest(
    res503.headers.get("Retry-After") === "30",
    "503 response sets standard Retry-After: 30 header"
  );
}

// -------------------------------------------------------------------
// 3. POLICY TESTS: BELOW AND ABOVE CONFIGURED LIMITS
// -------------------------------------------------------------------
console.log("\n▶ 3. Policy Rate Enforcement Tests (Below and Above Limits)");

{
  const mockRedis = new MockUpstashRedis();
  _setTestRedisClient(mockRedis);
  // Configure trusted proxy header to simulate edge environment with verified header
  process.env.TRUSTED_PROXY_HEADER = "cf-connecting-ip";

  // 3.1 CRM Login: 5 attempts per 15 minutes
  const crmReq = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.1" },
  });

  for (let i = 1; i <= 5; i++) {
    const res = await checkCrmLoginRateLimit(crmReq);
    assertTest(res.allowed === true, `CRM login attempt ${i}/5 permitted`);
  }

  // 6th attempt must be rejected with 429
  const crmBlocked = await checkCrmLoginRateLimit(crmReq);
  assertTest(
    crmBlocked.allowed === false && crmBlocked.status === 429,
    "CRM login attempt 6/5 rejected with HTTP 429"
  );
  assertTest(
    crmBlocked.response.headers.get("Retry-After") !== null,
    "CRM login rejection includes Retry-After header"
  );

  // 3.2 Customer Login IP limit: 5 attempts per minute
  const custLoginReq = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.2" },
  });

  for (let i = 1; i <= 5; i++) {
    const res = await checkCustomerLoginIpRateLimit(custLoginReq);
    assertTest(res.allowed === true, `Customer login IP attempt ${i}/5 permitted`);
  }
  const custIpBlocked = await checkCustomerLoginIpRateLimit(custLoginReq);
  assertTest(
    custIpBlocked.allowed === false && custIpBlocked.status === 429,
    "Customer login IP attempt 6/5 rejected with HTTP 429"
  );

  // 3.3 Customer Login Compound Bucket: Case and Whitespace Normalization
  const emailA = "  Jane.Doe@EXAMPLE.com ";
  const emailB = "jane.doe@example.com";
  const compoundReq = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.3" },
  });

  for (let i = 1; i <= 5; i++) {
    const res = await checkCustomerLoginCompoundRateLimit(compoundReq, emailA);
    assertTest(res.allowed === true, `Compound bucket attempt ${i}/5 permitted`);
  }
  // Attempt with same normalized email (emailB) must hit the same compound bucket and be rejected
  const compoundBlocked = await checkCustomerLoginCompoundRateLimit(compoundReq, emailB);
  assertTest(
    compoundBlocked.allowed === false && compoundBlocked.status === 429,
    "Compound bucket correctly normalizes email casing/whitespace and blocks 6th attempt"
  );

  // A different customer email under the same IP has its own compound bucket
  const differentEmail = "other.user@example.com";
  const diffEmailRes = await checkCustomerLoginCompoundRateLimit(compoundReq, differentEmail);
  assertTest(
    diffEmailRes.allowed === true,
    "Different email under same IP has distinct compound bucket and is permitted"
  );

  // 3.4 Customer Signup: 3 attempts per hour
  const signupReq = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.4" },
  });

  for (let i = 1; i <= 3; i++) {
    const res = await checkCustomerSignupRateLimit(signupReq);
    assertTest(res.allowed === true, `Signup attempt ${i}/3 permitted`);
  }
  const signupBlocked = await checkCustomerSignupRateLimit(signupReq);
  assertTest(
    signupBlocked.allowed === false && signupBlocked.status === 429,
    "Signup attempt 4/3 rejected with HTTP 429"
  );

  // 3.5 Checkout Orders: 5 requests per minute per user ID
  const orderReq = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.5" },
  });
  const userId = "usr_test_checkout_123";

  for (let i = 1; i <= 5; i++) {
    const res = await checkCheckoutRateLimit(orderReq, userId);
    assertTest(res.allowed === true, `Checkout request ${i}/5 permitted for userId`);
  }
  const orderBlocked = await checkCheckoutRateLimit(orderReq, userId);
  assertTest(
    orderBlocked.allowed === false && orderBlocked.status === 429,
    "Checkout request 6/5 rejected with HTTP 429 for userId"
  );

  // Different user under same IP still has their own user quota (up to IP limit 10)
  const otherUser = "usr_test_checkout_456";
  const otherUserRes = await checkCheckoutRateLimit(orderReq, otherUser);
  assertTest(
    otherUserRes.allowed === true,
    "Different authenticated user has separate user-keyed quota"
  );

  // 3.6 CRM Upload: 10 requests per minute per admin
  const adminId = "admin_super_001";
  for (let i = 1; i <= 10; i++) {
    const res = await checkCrmUploadRateLimit(adminId);
    assertTest(res.allowed === true, `CRM upload ${i}/10 permitted`);
  }
  const uploadBlocked = await checkCrmUploadRateLimit(adminId);
  assertTest(
    uploadBlocked.allowed === false && uploadBlocked.status === 429,
    "CRM upload 11/10 rejected with HTTP 429"
  );

  // 3.7 Contact Form: 3 requests per 5 minutes per user
  const contactReq = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.6" },
  });
  const contactUser = "usr_contact_789";

  for (let i = 1; i <= 3; i++) {
    const res = await checkContactRateLimit(contactReq, contactUser);
    assertTest(res.allowed === true, `Contact request ${i}/3 permitted`);
  }
  const contactBlocked = await checkContactRateLimit(contactReq, contactUser);
  assertTest(
    contactBlocked.allowed === false && contactBlocked.status === 429,
    "Contact request 4/3 rejected with HTTP 429"
  );

  // 3.8 CRM Write Operations: 60 requests per minute per admin
  const writeAdmin = "admin_writer_002";
  for (let i = 1; i <= 60; i++) {
    const res = await checkCrmWriteRateLimit(writeAdmin);
    if (i === 1 || i === 30 || i === 60) {
      assertTest(res.allowed === true, `CRM write operation ${i}/60 permitted`);
    }
  }
  const writeBlocked = await checkCrmWriteRateLimit(writeAdmin);
  assertTest(
    writeBlocked.allowed === false && writeBlocked.status === 429,
    "CRM write operation 61/60 rejected with HTTP 429"
  );

  // 3.9 Public Catalog Reads: 60 requests per minute per IP
  const catalogReq = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.7" },
  });
  for (let i = 1; i <= 60; i++) {
    const res = await checkPublicCatalogRateLimit(catalogReq);
    if (i === 1 || i === 30 || i === 60) {
      assertTest(res.allowed === true, `Catalog read ${i}/60 permitted`);
    }
  }
  const catalogBlocked = await checkPublicCatalogRateLimit(catalogReq);
  assertTest(
    catalogBlocked.allowed === false && catalogBlocked.status === 429,
    "Catalog read 61/60 rejected with HTTP 429"
  );

  // 3.10 CRM Administrative Reads: 60 requests per minute per admin
  const readAdminA = "admin_reader_001";
  for (let i = 1; i <= 60; i++) {
    const res = await checkCrmReadRateLimit(readAdminA);
    if (i === 1 || i === 30 || i === 60) {
      assertTest(res.allowed === true, `CRM read operation ${i}/60 permitted for adminA`);
    }
  }
  const readBlocked = await checkCrmReadRateLimit(readAdminA);
  assertTest(
    readBlocked.allowed === false && readBlocked.status === 429,
    "CRM read operation 61/60 rejected with HTTP 429 for adminA"
  );
  assertTest(
    readBlocked.response.headers.get("Retry-After") !== null,
    "CRM read rejection includes Retry-After header"
  );

  // Key isolation: adminB has separate quota and is permitted
  const readAdminB = "admin_reader_002";
  const adminBRes = await checkCrmReadRateLimit(readAdminB);
  assertTest(
    adminBRes.allowed === true,
    "Different verified admin has separate CRM read quota and is permitted"
  );

  // 3.11 CRM Media Library Reads: 30 requests per minute per admin
  const mediaAdminA = "admin_media_001";
  for (let i = 1; i <= 30; i++) {
    const res = await checkCrmMediaReadRateLimit(mediaAdminA);
    if (i === 1 || i === 15 || i === 30) {
      assertTest(res.allowed === true, `CRM media read operation ${i}/30 permitted for mediaAdminA`);
    }
  }
  const mediaBlocked = await checkCrmMediaReadRateLimit(mediaAdminA);
  assertTest(
    mediaBlocked.allowed === false && mediaBlocked.status === 429,
    "CRM media read operation 31/30 rejected with HTTP 429 for mediaAdminA"
  );
  assertTest(
    mediaBlocked.response.headers.get("Retry-After") !== null,
    "CRM media read rejection includes Retry-After header"
  );

  // Key isolation: mediaAdminB has separate quota and is permitted
  const mediaAdminB = "admin_media_002";
  const mediaAdminBRes = await checkCrmMediaReadRateLimit(mediaAdminB);
  assertTest(
    mediaAdminBRes.allowed === true,
    "Different verified admin has separate CRM media read quota and is permitted"
  );

  // Bucket isolation: mediaAdminA is blocked on media read (30/min), but still has unconsumed crm_read quota
  const mediaAdminGeneralRead = await checkCrmReadRateLimit(mediaAdminA);
  assertTest(
    mediaAdminGeneralRead.allowed === true,
    "Media-limited admin still has independent quota on general CRM read bucket"
  );

  // 3.12 Customer Cart & Wishlist Mutations: 30 requests per minute per userId
  const mutUserA = "usr_cart_mut_001";
  for (let i = 1; i <= 30; i++) {
    const res = await checkCustomerMutationRateLimit(mutUserA);
    if (i === 1 || i === 15 || i === 30) {
      assertTest(res.allowed === true, `Customer mutation ${i}/30 permitted for mutUserA`);
    }
  }
  const mutBlocked = await checkCustomerMutationRateLimit(mutUserA);
  assertTest(
    mutBlocked.allowed === false && mutBlocked.status === 429,
    "Customer mutation 31/30 rejected with HTTP 429 for mutUserA"
  );
  assertTest(
    mutBlocked.response.headers.get("Retry-After") !== null,
    "Customer mutation rejection includes positive Retry-After header"
  );

  // Key isolation: mutUserB has separate quota and is permitted
  const mutUserB = "usr_cart_mut_002";
  const mutUserBRes = await checkCustomerMutationRateLimit(mutUserB);
  assertTest(
    mutUserBRes.allowed === true,
    "Different customer has separate mutation quota and is permitted"
  );

  // 3.13 Customer General Reads (Cart, Wishlist, Order Detail): 60 requests per minute per userId
  const readUserA = "usr_read_001";
  for (let i = 1; i <= 60; i++) {
    const res = await checkCustomerReadRateLimit(readUserA);
    if (i === 1 || i === 30 || i === 60) {
      assertTest(res.allowed === true, `Customer read ${i}/60 permitted for readUserA`);
    }
  }
  const readCustBlocked = await checkCustomerReadRateLimit(readUserA);
  assertTest(
    readCustBlocked.allowed === false && readCustBlocked.status === 429,
    "Customer read 61/60 rejected with HTTP 429 for readUserA"
  );
  assertTest(
    readCustBlocked.response.headers.get("Retry-After") !== null,
    "Customer read rejection includes Retry-After header"
  );

  // Key isolation: readUserB has separate quota and is permitted
  const readUserB = "usr_read_002";
  const readUserBRes = await checkCustomerReadRateLimit(readUserB);
  assertTest(
    readUserBRes.allowed === true,
    "Different customer has separate read quota and is permitted"
  );

  // Bucket isolation: mutUserA (blocked on mutations) still has independent unconsumed general read quota
  const mutUserGeneralRead = await checkCustomerReadRateLimit(mutUserA);
  assertTest(
    mutUserGeneralRead.allowed === true,
    "Mutation-limited customer still has full independent quota on general read bucket"
  );

  // 3.14 Customer Order History List Read: 30 requests per minute per userId
  const orderListUserA = "usr_order_list_001";
  for (let i = 1; i <= 30; i++) {
    const res = await checkCustomerOrderListRateLimit(orderListUserA);
    if (i === 1 || i === 15 || i === 30) {
      assertTest(res.allowed === true, `Order history list read ${i}/30 permitted for orderListUserA`);
    }
  }
  const orderListBlocked = await checkCustomerOrderListRateLimit(orderListUserA);
  assertTest(
    orderListBlocked.allowed === false && orderListBlocked.status === 429,
    "Order history list read 31/30 rejected with HTTP 429 for orderListUserA"
  );
  assertTest(
    orderListBlocked.response.headers.get("Retry-After") !== null,
    "Order history list read rejection includes Retry-After header"
  );

  // Key isolation: orderListUserB has separate quota and is permitted
  const orderListUserB = "usr_order_list_002";
  const orderListUserBRes = await checkCustomerOrderListRateLimit(orderListUserB);
  assertTest(
    orderListUserBRes.allowed === true,
    "Different customer has separate order history list read quota and is permitted"
  );

  // Bucket isolation: orderListUserA (blocked on order list read) still has independent quota on single order / cart read
  const orderListUserSingleRead = await checkCustomerReadRateLimit(orderListUserA);
  assertTest(
    orderListUserSingleRead.allowed === true,
    "Order-list-limited customer still has independent quota on general single-item read bucket"
  );

  // 3.15 Google OAuth Initiation Rate Limit: 15 requests per minute per trusted client IP
  const oauthInitReqA = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.15" },
  });
  for (let i = 1; i <= 15; i++) {
    const res = await checkOAuthInitiationRateLimit(oauthInitReqA);
    if (i === 1 || i === 8 || i === 15) {
      assertTest(res.allowed === true, `OAuth initiation request ${i}/15 permitted for IPA`);
    }
  }
  const oauthInitBlocked = await checkOAuthInitiationRateLimit(oauthInitReqA);
  assertTest(
    oauthInitBlocked.allowed === false && oauthInitBlocked.status === 429,
    "OAuth initiation request 16/15 rejected with HTTP 429 for IPA"
  );
  assertTest(
    oauthInitBlocked.response.headers.get("Retry-After") !== null,
    "OAuth initiation rejection includes Retry-After header"
  );

  // Key isolation: IP B has separate initiation quota and is permitted
  const oauthInitReqB = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.16" },
  });
  const oauthInitBRes = await checkOAuthInitiationRateLimit(oauthInitReqB);
  assertTest(
    oauthInitBRes.allowed === true,
    "Different client IP has separate OAuth initiation quota and is permitted"
  );

  // 3.16 Google OAuth Callback Rate Limit: 30 requests per minute per trusted client IP
  const oauthCallbackReqA = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.17" },
  });
  for (let i = 1; i <= 30; i++) {
    const res = await checkOAuthCallbackRateLimit(oauthCallbackReqA);
    if (i === 1 || i === 15 || i === 30) {
      assertTest(res.allowed === true, `OAuth callback request ${i}/30 permitted for IPA`);
    }
  }
  const oauthCallbackBlocked = await checkOAuthCallbackRateLimit(oauthCallbackReqA);
  assertTest(
    oauthCallbackBlocked.allowed === false && oauthCallbackBlocked.status === 429,
    "OAuth callback request 31/30 rejected with HTTP 429 for IPA"
  );
  assertTest(
    oauthCallbackBlocked.response.headers.get("Retry-After") !== null,
    "OAuth callback rejection includes Retry-After header"
  );

  // Key isolation: IP B has separate callback quota and is permitted
  const oauthCallbackReqB = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.18" },
  });
  const oauthCallbackBRes = await checkOAuthCallbackRateLimit(oauthCallbackReqB);
  assertTest(
    oauthCallbackBRes.allowed === true,
    "Different client IP has separate OAuth callback quota and is permitted"
  );

  // 3.17 Bucket Isolation between OAuth Initiation and Callback
  // Client IP E is exhausted on initiation (15/15), but has independent quota on callback (30/30)
  const oauthBucketReqE = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.19" },
  });
  for (let i = 1; i <= 15; i++) {
    await checkOAuthInitiationRateLimit(oauthBucketReqE);
  }
  const initBlockedE = await checkOAuthInitiationRateLimit(oauthBucketReqE);
  assertTest(initBlockedE.allowed === false, "Client E is blocked on OAuth initiation bucket");
  const callbackAllowedE = await checkOAuthCallbackRateLimit(oauthBucketReqE);
  assertTest(
    callbackAllowedE.allowed === true,
    "Client E throttled on initiation still has independent unconsumed callback quota"
  );

  // Client IP F is exhausted on callback (30/30), but has independent quota on initiation (15/15)
  const oauthBucketReqF = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.20" },
  });
  for (let i = 1; i <= 30; i++) {
    await checkOAuthCallbackRateLimit(oauthBucketReqF);
  }
  const callbackBlockedF = await checkOAuthCallbackRateLimit(oauthBucketReqF);
  assertTest(callbackBlockedF.allowed === false, "Client F is blocked on OAuth callback bucket");
  const initAllowedF = await checkOAuthInitiationRateLimit(oauthBucketReqF);
  assertTest(
    initAllowedF.allowed === true,
    "Client F throttled on callback still has independent unconsumed initiation quota"
  );

  _resetTestRedisClient();
}


// -------------------------------------------------------------------
// 4. OUTAGE & FAILURE POLICY TESTS (FAIL-CLOSED VS FAIL-OPEN)
// -------------------------------------------------------------------
console.log("\n▶ 4. Outage & Failure Policy Tests (Fail-Closed vs Fail-Open)");

{
  process.env.NODE_ENV = "production";
  _resetTestRedisClient();

  // Test 4.1: Missing Upstash Configuration in Production
  const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
  const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    const req = createMockRequest({
      headers: { "cf-connecting-ip": "198.51.100.8" },
    });

    // High-risk mutations MUST fail closed (503)
    const crmLoginFail = await checkCrmLoginRateLimit(req);
    assertTest(
      crmLoginFail.allowed === false && crmLoginFail.status === 503,
      "Protected CRM login FAILS CLOSED with HTTP 503 when Upstash credentials missing in production"
    );

    const custLoginFail = await checkCustomerLoginIpRateLimit(req);
    assertTest(
      custLoginFail.allowed === false && custLoginFail.status === 503,
      "Protected Customer login FAILS CLOSED with HTTP 503 when Upstash credentials missing in production"
    );

    const signupFail = await checkCustomerSignupRateLimit(req);
    assertTest(
      signupFail.allowed === false && signupFail.status === 503,
      "Protected Customer signup FAILS CLOSED with HTTP 503 when Upstash credentials missing in production"
    );

    const checkoutFail = await checkCheckoutRateLimit(req, "usr_123");
    assertTest(
      checkoutFail.allowed === false && checkoutFail.status === 503,
      "Protected Checkout FAILS CLOSED with HTTP 503 when Upstash credentials missing in production"
    );

    const uploadFail = await checkCrmUploadRateLimit("admin_123");
    assertTest(
      uploadFail.allowed === false && uploadFail.status === 503,
      "Protected CRM Upload FAILS CLOSED with HTTP 503 when Upstash credentials missing in production"
    );

    const contactFail = await checkContactRateLimit(req, "usr_123");
    assertTest(
      contactFail.allowed === false && contactFail.status === 503,
      "Protected Contact Form FAILS CLOSED with HTTP 503 when Upstash credentials missing in production"
    );

    const writeFail = await checkCrmWriteRateLimit("admin_123");
    assertTest(
      writeFail.allowed === false && writeFail.status === 503,
      "Protected CRM write FAILS CLOSED with HTTP 503 when Upstash credentials missing in production"
    );

    // Public catalog reads MUST fail open
    const catalogFail = await checkPublicCatalogRateLimit(req);
    assertTest(
      catalogFail.allowed === true,
      "Public catalog read FAILS OPEN (allowed: true) when Upstash credentials missing in production"
    );

    // CRM administrative reads MUST fail open
    const crmReadFail = await checkCrmReadRateLimit("admin_outage_1");
    assertTest(
      crmReadFail.allowed === true,
      "CRM read FAILS OPEN (allowed: true) when Upstash credentials missing in production"
    );

    const crmMediaReadFail = await checkCrmMediaReadRateLimit("admin_outage_1");
    assertTest(
      crmMediaReadFail.allowed === true,
      "CRM media read FAILS OPEN (allowed: true) when Upstash credentials missing in production"
    );

    // Customer mutations MUST fail closed (503)
    const custMutFail = await checkCustomerMutationRateLimit("usr_outage_1");
    assertTest(
      custMutFail.allowed === false && custMutFail.status === 503,
      "Customer mutation FAILS CLOSED with HTTP 503 when Upstash credentials missing in production"
    );

    // Customer general reads MUST fail open
    const custReadFail = await checkCustomerReadRateLimit("usr_outage_1");
    assertTest(
      custReadFail.allowed === true,
      "Customer general read FAILS OPEN (allowed: true) when Upstash credentials missing in production"
    );

    // Customer order list reads MUST fail open
    const custOrderListFail = await checkCustomerOrderListRateLimit("usr_outage_1");
    assertTest(
      custOrderListFail.allowed === true,
      "Customer order list read FAILS OPEN (allowed: true) when Upstash credentials missing in production"
    );

    // Google OAuth initiation MUST fail closed (503)
    const oauthInitFail = await checkOAuthInitiationRateLimit(req);
    assertTest(
      oauthInitFail.allowed === false && oauthInitFail.status === 503,
      "OAuth initiation FAILS CLOSED with HTTP 503 when Upstash credentials missing in production"
    );

    // Google OAuth callback MUST fail open (allowed: true)
    const oauthCallbackFail = await checkOAuthCallbackRateLimit(req);
    assertTest(
      oauthCallbackFail.allowed === true,
      "OAuth callback FAILS OPEN (allowed: true) when Upstash credentials missing in production"
    );
  } finally {
    if (savedUrl) process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    if (savedToken) process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
    process.env.NODE_ENV = oldEnv;
  }

  // Test 4.2: Redis Network / Timeout Error
  _setTestRedisClient(new FailingMockRedis());

  const failReq = createMockRequest({
    headers: { "cf-connecting-ip": "198.51.100.9" },
  });

  const crmNetFail = await checkCrmLoginRateLimit(failReq);
  assertTest(
    crmNetFail.allowed === false && crmNetFail.status === 503,
    "Protected route FAILS CLOSED with HTTP 503 on Redis network exception"
  );
  assertTest(
    crmNetFail.response.headers.get("Retry-After") === "30",
    "503 network error response sets Retry-After: 30"
  );

  const catalogNetFail = await checkPublicCatalogRateLimit(failReq);
  assertTest(
    catalogNetFail.allowed === true,
    "Public catalog read FAILS OPEN (allowed: true) on Redis network exception"
  );

  const crmReadNetFail = await checkCrmReadRateLimit("admin_net_fail");
  assertTest(
    crmReadNetFail.allowed === true,
    "CRM read FAILS OPEN (allowed: true) on Redis network exception"
  );

  const crmMediaNetFail = await checkCrmMediaReadRateLimit("admin_net_fail");
  assertTest(
    crmMediaNetFail.allowed === true,
    "CRM media read FAILS OPEN (allowed: true) on Redis network exception"
  );

  const custMutNetFail = await checkCustomerMutationRateLimit("usr_net_fail");
  assertTest(
    custMutNetFail.allowed === false && custMutNetFail.status === 503,
    "Customer mutation FAILS CLOSED with HTTP 503 on Redis network exception"
  );
  assertTest(
    custMutNetFail.response.headers.get("Retry-After") === "30",
    "Customer mutation 503 network error sets Retry-After: 30"
  );

  const custReadNetFail = await checkCustomerReadRateLimit("usr_net_fail");
  assertTest(
    custReadNetFail.allowed === true,
    "Customer general read FAILS OPEN (allowed: true) on Redis network exception"
  );

  const custOrderListNetFail = await checkCustomerOrderListRateLimit("usr_net_fail");
  assertTest(
    custOrderListNetFail.allowed === true,
    "Customer order list read FAILS OPEN (allowed: true) on Redis network exception"
  );

  const oauthInitNetFail = await checkOAuthInitiationRateLimit(failReq);
  assertTest(
    oauthInitNetFail.allowed === false && oauthInitNetFail.status === 503,
    "OAuth initiation FAILS CLOSED with HTTP 503 on Redis network exception"
  );
  assertTest(
    oauthInitNetFail.response.headers.get("Retry-After") === "30",
    "OAuth initiation 503 network error sets Retry-After: 30"
  );

  const oauthCallbackNetFail = await checkOAuthCallbackRateLimit(failReq);
  assertTest(
    oauthCallbackNetFail.allowed === true,
    "OAuth callback FAILS OPEN (allowed: true) on Redis network exception"
  );

  _resetTestRedisClient();
}

// -------------------------------------------------------------------
// 5. UNTRUSTED IP FAIL-CLOSED IN PRODUCTION
// -------------------------------------------------------------------
console.log("\n▶ 5. Untrusted IP Fail-Closed Defense in Production");

{
  process.env.NODE_ENV = "production";
  _setTestRedisClient(new MockUpstashRedis());

  try {
    delete process.env.TRUSTED_PROXY_HEADER;

    // Test 5.1: Client sends spoofed X-Forwarded-For and no verified proxy header
    const untrustedReq = createMockRequest({
      headers: {
        "X-Forwarded-For": "12.34.56.78",
      },
    });

    const crmRes = await checkCrmLoginRateLimit(untrustedReq);
    assertTest(
      crmRes.allowed === false && crmRes.status === 503,
      "Public unauthenticated CRM login FAILS CLOSED with 503 when trusted IP cannot be established"
    );

    const loginRes = await checkCustomerLoginIpRateLimit(untrustedReq);
    assertTest(
      loginRes.allowed === false && loginRes.status === 503,
      "Public unauthenticated customer login FAILS CLOSED with 503 when trusted IP cannot be established"
    );

    const signupRes = await checkCustomerSignupRateLimit(untrustedReq);
    assertTest(
      signupRes.allowed === false && signupRes.status === 503,
      "Public unauthenticated customer signup FAILS CLOSED with 503 when trusted IP cannot be established"
    );

    // Authenticated checkout keys on verified userId even if IP is unestablished
    const checkoutRes = await checkCheckoutRateLimit(untrustedReq, "usr_verified_999");
    assertTest(
      checkoutRes.allowed === true,
      "Authenticated checkout successfully keys on verified userId when client IP is untrusted"
    );

    // Test 5.2: Spoofed cf-connecting-ip without TRUSTED_PROXY_HEADER fails closed
    const spoofedCfReq = createMockRequest({
      headers: { "cf-connecting-ip": "198.51.100.99" },
    });
    const spoofedCfRes = await checkCrmLoginRateLimit(spoofedCfReq);
    assertTest(
      spoofedCfRes.allowed === false && spoofedCfRes.status === 503,
      "CRM login FAILS CLOSED (503) when cf-connecting-ip is supplied without TRUSTED_PROXY_HEADER"
    );

    // Test 5.3: TRUSTED_PROXY_HEADER configured but incoming IP is invalid
    process.env.TRUSTED_PROXY_HEADER = "cf-connecting-ip";
    const invalidIpReq = createMockRequest({
      headers: { "cf-connecting-ip": "not-an-ip-address" },
    });
    const invalidIpRes = await checkCrmLoginRateLimit(invalidIpReq);
    assertTest(
      invalidIpRes.allowed === false && invalidIpRes.status === 503,
      "CRM login FAILS CLOSED (503) when trusted proxy header contains invalid IP data"
    );

    // Test 5.4: TRUSTED_PROXY_HEADER configured but header is missing from request
    const missingHeaderReq = createMockRequest({
      headers: { "X-Forwarded-For": "1.2.3.4" },
    });
    const missingHeaderRes = await checkCustomerLoginIpRateLimit(missingHeaderReq);
    assertTest(
      missingHeaderRes.allowed === false && missingHeaderRes.status === 503,
      "Customer login FAILS CLOSED (503) when configured trusted proxy header is missing"
    );
    delete process.env.TRUSTED_PROXY_HEADER;

    // Test 5.5: Public catalog read with untrusted IP in production fails open with warning
    const untrustedCatalogRes = await checkPublicCatalogRateLimit(untrustedReq);
    assertTest(
      untrustedCatalogRes.allowed === true,
      "Public catalog read FAILS OPEN (allowed: true) when client IP is untrusted in production"
    );

    // Test 5.6: Untrusted IP on OAuth initiation and callback
    const oauthInitUntrusted = await checkOAuthInitiationRateLimit(untrustedReq);
    assertTest(
      oauthInitUntrusted.allowed === false && oauthInitUntrusted.status === 503,
      "OAuth initiation FAILS CLOSED (503) when trusted client IP cannot be established in production"
    );

    const oauthCallbackUntrusted = await checkOAuthCallbackRateLimit(untrustedReq);
    assertTest(
      oauthCallbackUntrusted.allowed === true,
      "OAuth callback FAILS OPEN (allowed: true) when trusted client IP cannot be established in production"
    );
  } finally {
    process.env.NODE_ENV = oldEnv;
    delete process.env.TRUSTED_PROXY_HEADER;
    _resetTestRedisClient();
  }
}

// -------------------------------------------------------------------
// 6. CHECKOUT IDEMPOTENCY INTEGRITY VERIFICATION
// -------------------------------------------------------------------
console.log("\n▶ 6. Checkout Idempotency & Schema Preservation Verification");

{
  // Verify lib/checkout.ts exists and has not been altered in this step
  const checkoutTs = fs.readFileSync(path.resolve("lib/checkout.ts"), "utf8");
  assertTest(
    checkoutTs.includes("processCheckout"),
    "lib/checkout.ts processCheckout function is preserved intact"
  );
  assertTest(
    checkoutTs.includes("calculateCanonicalOrderPricing"),
    "lib/checkout.ts calculateCanonicalOrderPricing function is preserved intact"
  );

  // Verify lib/idempotency.ts exists and has not been altered in this step
  const idempotencyTs = fs.readFileSync(path.resolve("lib/idempotency.ts"), "utf8");
  assertTest(
    idempotencyTs.includes("FOR UPDATE"),
    "lib/idempotency.ts PostgreSQL row-locking SELECT ... FOR UPDATE query is preserved intact"
  );
  assertTest(
    idempotencyTs.includes("claimIdempotencyRecord"),
    "lib/idempotency.ts claimIdempotencyRecord coordinator is preserved intact"
  );
  assertTest(
    idempotencyTs.includes("checkDurableCheckoutRecovery"),
    "lib/idempotency.ts checkDurableCheckoutRecovery coordinator is preserved intact"
  );
  assertTest(
    idempotencyTs.includes("LEASE_DURATION_MS"),
    "lib/idempotency.ts LEASE_DURATION_MS lease fencing is preserved intact"
  );

  // Verify schema.prisma has not been modified
  const schemaPrisma = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf8");
  assertTest(
    schemaPrisma.includes("model IdempotencyRecord"),
    "prisma/schema.prisma IdempotencyRecord model is preserved intact"
  );
}

// -------------------------------------------------------------------
// 7. STEP 4C.4E ROUTE RATE LIMITING INTEGRATION COVERAGE
// -------------------------------------------------------------------
console.log("\n▶ 7. Step 4C.4E Route Rate Limiting Integration Coverage");

{
  // 1. GET /api/products/[slug] enforces checkPublicCatalogRateLimit
  const productSlugRoute = fs.readFileSync(path.resolve("app/api/products/[slug]/route.ts"), "utf8");
  assertTest(
    productSlugRoute.includes("checkPublicCatalogRateLimit(request)") ||
      productSlugRoute.includes("checkPublicCatalogRateLimit"),
    "GET /api/products/[slug] imports and calls checkPublicCatalogRateLimit"
  );

  // 2. CRM Read routes enforce checkCrmReadRateLimit after verifyAdminSession
  const crmReadRoutes = [
    { file: "app/api/crm/analytics/route.ts", name: "GET /api/crm/analytics" },
    { file: "app/api/crm/products/route.ts", name: "GET /api/crm/products" },
    { file: "app/api/crm/orders/route.ts", name: "GET /api/crm/orders" },
    { file: "app/api/crm/categories/route.ts", name: "GET /api/crm/categories" },
    { file: "app/api/crm/categories/[id]/route.ts", name: "GET /api/crm/categories/[id]" },
    { file: "app/api/crm/occasions/route.ts", name: "GET /api/crm/occasions" },
    { file: "app/api/crm/occasions/[id]/route.ts", name: "GET /api/crm/occasions/[id]" },
    { file: "app/api/crm/taxonomy/route.ts", name: "GET /api/crm/taxonomy" },
  ];

  for (const { file, name } of crmReadRoutes) {
    const content = fs.readFileSync(path.resolve(file), "utf8");
    assertTest(
      content.includes("checkCrmReadRateLimit"),
      `${name} imports and calls checkCrmReadRateLimit`
    );
    // Verify admin authorization happens before consuming rate limit
    const verifyIdx = content.indexOf("verifyAdminSession");
    const rateLimitIdx = content.indexOf("checkCrmReadRateLimit");
    assertTest(
      verifyIdx !== -1 && rateLimitIdx !== -1 && verifyIdx < rateLimitIdx,
      `${name} authenticates and verifies admin access BEFORE consuming rate limit quota`
    );
    assertTest(
      content.includes("auth.admin!.id"),
      `${name} uses verified admin ID for rate limit key`
    );
  }

  // 3. GET /api/crm/media enforces checkCrmMediaReadRateLimit after verifyAdminSession
  const crmMediaContent = fs.readFileSync(path.resolve("app/api/crm/media/route.ts"), "utf8");
  assertTest(
    crmMediaContent.includes("checkCrmMediaReadRateLimit"),
    "GET /api/crm/media imports and calls checkCrmMediaReadRateLimit"
  );
  const mediaVerifyIdx = crmMediaContent.indexOf("verifyAdminSession");
  const mediaRateLimitIdx = crmMediaContent.indexOf("checkCrmMediaReadRateLimit");
  assertTest(
    mediaVerifyIdx !== -1 && mediaRateLimitIdx !== -1 && mediaVerifyIdx < mediaRateLimitIdx,
    "GET /api/crm/media authenticates and verifies admin access BEFORE consuming media rate limit quota"
  );
  assertTest(
    crmMediaContent.includes("auth.admin!.id"),
    "GET /api/crm/media uses verified admin ID for rate limit key"
  );
}

// -------------------------------------------------------------------
// 8. STEP 4C.4F ROUTE RATE LIMITING INTEGRATION COVERAGE
// -------------------------------------------------------------------
console.log("\n▶ 8. Step 4C.4F Route Rate Limiting Integration Coverage");

{
  // 1. Cart & Wishlist Mutation Handlers
  const mutationRoutes = [
    { file: "app/api/cart/items/route.ts", name: "POST /api/cart/items", method: "POST" },
    { file: "app/api/cart/items/[itemId]/route.ts", name: "PATCH /api/cart/items/[itemId]", method: "PATCH" },
    { file: "app/api/cart/items/[itemId]/route.ts", name: "DELETE /api/cart/items/[itemId]", method: "DELETE" },
    { file: "app/api/wishlist/route.ts", name: "POST /api/wishlist", method: "POST" },
    { file: "app/api/wishlist/route.ts", name: "DELETE /api/wishlist", method: "DELETE" },
    { file: "app/api/cart/route.ts", name: "DELETE /api/cart", method: "DELETE" },
  ];

  for (const { file, name } of mutationRoutes) {
    const content = fs.readFileSync(path.resolve(file), "utf8");
    assertTest(
      content.includes("checkCustomerMutationRateLimit"),
      `${name} imports and calls checkCustomerMutationRateLimit`
    );
    // Verify user authentication happens before consuming rate limit
    const authIdx = content.indexOf("getAuthenticatedUserId");
    const rateLimitIdx = content.indexOf("checkCustomerMutationRateLimit");
    assertTest(
      authIdx !== -1 && rateLimitIdx !== -1 && authIdx < rateLimitIdx,
      `${name} authenticates user session BEFORE consuming mutation rate limit quota`
    );
    assertTest(
      content.includes("checkCustomerMutationRateLimit(userId)"),
      `${name} passes verified userId to checkCustomerMutationRateLimit`
    );
  }

  // 2. Customer Read Handlers (Cart, Wishlist, Order Detail)
  const readRoutes = [
    { file: "app/api/cart/route.ts", name: "GET /api/cart" },
    { file: "app/api/wishlist/route.ts", name: "GET /api/wishlist" },
    { file: "app/api/orders/[id]/route.ts", name: "GET /api/orders/[id]" },
  ];

  for (const { file, name } of readRoutes) {
    const content = fs.readFileSync(path.resolve(file), "utf8");
    assertTest(
      content.includes("checkCustomerReadRateLimit"),
      `${name} imports and calls checkCustomerReadRateLimit`
    );
    const authIdx = content.indexOf("getAuthenticatedUserId");
    const rateLimitIdx = content.indexOf("checkCustomerReadRateLimit");
    assertTest(
      authIdx !== -1 && rateLimitIdx !== -1 && authIdx < rateLimitIdx,
      `${name} authenticates user session BEFORE consuming read rate limit quota`
    );
    assertTest(
      content.includes("checkCustomerReadRateLimit(userId)"),
      `${name} passes verified userId to checkCustomerReadRateLimit`
    );
  }

  // 3. Customer Order History List Read Handler
  const orderListContent = fs.readFileSync(path.resolve("app/api/orders/route.ts"), "utf8");
  assertTest(
    orderListContent.includes("checkCustomerOrderListRateLimit"),
    "GET /api/orders imports and calls checkCustomerOrderListRateLimit"
  );
  const getOrdersIdx = orderListContent.indexOf("export async function GET");
  const authIdx = orderListContent.indexOf("getAuthenticatedUserId", getOrdersIdx);
  const rateLimitIdx = orderListContent.indexOf("checkCustomerOrderListRateLimit", getOrdersIdx);
  assertTest(
    getOrdersIdx !== -1 && authIdx !== -1 && rateLimitIdx !== -1 && authIdx < rateLimitIdx,
    "GET /api/orders authenticates user session BEFORE consuming order list rate limit quota"
  );
  assertTest(
    orderListContent.includes("checkCustomerOrderListRateLimit(userId)"),
    "GET /api/orders passes verified userId to checkCustomerOrderListRateLimit"
  );
}

// -------------------------------------------------------------------
// 9. STEP 4C.4H ROUTE RATE LIMITING INTEGRATION & OAUTH SECURITY INVARIANTS
// -------------------------------------------------------------------
console.log("\n▶ 9. Step 4C.4H Google OAuth Rate Limiting Integration Coverage");

{
  // 1. GET /api/auth/google enforces checkOAuthInitiationRateLimit
  const initRouteContent = fs.readFileSync(path.resolve("app/api/auth/google/route.ts"), "utf8");
  assertTest(
    initRouteContent.includes("checkOAuthInitiationRateLimit"),
    "GET /api/auth/google imports and calls checkOAuthInitiationRateLimit"
  );

  const getInitIdx = initRouteContent.indexOf("export async function GET");
  const initRateLimitIdx = initRouteContent.indexOf("checkOAuthInitiationRateLimit", getInitIdx);
  const genStateIdx = initRouteContent.indexOf("generateState", getInitIdx);
  const genVerifierIdx = initRouteContent.indexOf("generateCodeVerifier", getInitIdx);
  const setCookiesIdx = initRouteContent.indexOf("setOAuthCookiesOnResponse", getInitIdx);

  assertTest(
    getInitIdx !== -1 && initRateLimitIdx !== -1 && initRateLimitIdx < genStateIdx,
    "GET /api/auth/google applies rate limiting BEFORE generating cryptographic state"
  );
  assertTest(
    initRateLimitIdx < genVerifierIdx,
    "GET /api/auth/google applies rate limiting BEFORE generating PKCE code_verifier"
  );
  assertTest(
    initRateLimitIdx < setCookiesIdx,
    "GET /api/auth/google applies rate limiting BEFORE writing temporary OAuth cookies"
  );
  assertTest(
    initRouteContent.includes("return rateLimit.response;"),
    "GET /api/auth/google returns standard rateLimit.response when throttled"
  );

  // 2. GET /api/auth/google/callback enforces checkOAuthCallbackRateLimit
  const callbackRouteContent = fs.readFileSync(path.resolve("app/api/auth/google/callback/route.ts"), "utf8");
  assertTest(
    callbackRouteContent.includes("checkOAuthCallbackRateLimit"),
    "GET /api/auth/google/callback imports and calls checkOAuthCallbackRateLimit"
  );

  const getCallbackIdx = callbackRouteContent.indexOf("export async function GET");
  const stateValidateIdx = callbackRouteContent.indexOf("timingSafeEqual", getCallbackIdx);
  const codeCheckIdx = callbackRouteContent.indexOf("!code", getCallbackIdx);
  const verifierCheckIdx = callbackRouteContent.indexOf("!stored.codeVerifier", getCallbackIdx);
  const callbackRateLimitIdx = callbackRouteContent.indexOf("checkOAuthCallbackRateLimit", getCallbackIdx);
  const exchangeIdx = callbackRouteContent.indexOf("exchangeGoogleCode", getCallbackIdx);
  const handleUserIdx = callbackRouteContent.indexOf("handleGoogleUser", getCallbackIdx);

  assertTest(
    getCallbackIdx !== -1 && stateValidateIdx !== -1 && stateValidateIdx < callbackRateLimitIdx,
    "GET /api/auth/google/callback validates OAuth state parameter BEFORE consuming callback rate limit"
  );
  assertTest(
    codeCheckIdx !== -1 && verifierCheckIdx !== -1 && verifierCheckIdx < callbackRateLimitIdx,
    "GET /api/auth/google/callback validates code and code_verifier BEFORE consuming callback rate limit"
  );
  assertTest(
    callbackRateLimitIdx < exchangeIdx,
    "GET /api/auth/google/callback applies rate limiting BEFORE upstream token exchange (protects Google endpoint quota)"
  );
  assertTest(
    callbackRateLimitIdx < handleUserIdx,
    "GET /api/auth/google/callback applies rate limiting BEFORE database operations (handleGoogleUser)"
  );
  assertTest(
    callbackRouteContent.includes("return rateLimit.response;"),
    "GET /api/auth/google/callback returns standard rateLimit.response when throttled"
  );

  // 3. Cookie cleanup safety on throttled callbacks
  // Throttled callback path must NOT call clearOAuthCookiesOnResponse so temporary state is not wiped prematurely
  const throttledBlockMatch = callbackRouteContent.match(
    /checkOAuthCallbackRateLimit\(request\);[\s\S]*?if\s*\(!rateLimit\.allowed\)\s*\{([\s\S]*?)\}/
  );
  assertTest(
    throttledBlockMatch !== null,
    "GET /api/auth/google/callback has dedicated if (!rateLimit.allowed) guard"
  );
  const throttledBlock = throttledBlockMatch ? throttledBlockMatch[1] : "";
  assertTest(
    !throttledBlock.includes("clearOAuthCookiesOnResponse") &&
      !throttledBlock.includes("redirectWithError"),
    "GET /api/auth/google/callback does NOT clear OAuth cookies on throttled 429 response"
  );

  // 4. RateLimit.response cookie preservation regression test
  const testRes = createTooManyRequestsResponse({
    limit: 30,
    remaining: 0,
    reset: Date.now() + 60000,
  });
  assertTest(
    testRes.headers.get("Set-Cookie") === null,
    "createTooManyRequestsResponse contains NO Set-Cookie headers (preserves existing client cookies)"
  );

  // 5. Secret Logging Auditing: verify no authorization codes, tokens, state, verifiers, or cookies are logged
  const forbiddenLogTerms = [
    "console.log",
    "console.info",
    "console.warn",
    "console.error",
  ];
  const sensitiveVars = [
    "codeVerifier",
    "stored.codeVerifier",
    "tokens",
    "idTokenClaims",
    "sessionToken",
    "authUrl.toString()",
  ];

  for (const logTerm of forbiddenLogTerms) {
    for (const secretVar of sensitiveVars) {
      const callbackLogsSecret =
        callbackRouteContent.includes(`${logTerm}(`) &&
        new RegExp(`${logTerm}\\([^)]*\\b${secretVar}\\b[^)]*\\)`).test(callbackRouteContent);
      assertTest(
        !callbackLogsSecret,
        `GET /api/auth/google/callback never passes sensitive variable "${secretVar}" to ${logTerm}`
      );
    }
  }

  // 6. Existing OAuth security checks preservation
  assertTest(
    callbackRouteContent.includes("timingSafeEqual"),
    "timingSafeEqual state comparison is preserved"
  );
  assertTest(
    callbackRouteContent.includes("verifyGoogleIdToken"),
    "verifyGoogleIdToken ID token verification is preserved"
  );
  assertTest(
    callbackRouteContent.includes("ACCOUNT_EXISTS"),
    "Account exists protection against automatic linking is preserved"
  );
  assertTest(
    callbackRouteContent.includes("createSession"),
    "createSession session establishment is preserved"
  );
}

// -------------------------------------------------------------------
// 10. STEP 4C.4J REMAINING READ RATE LIMITS & DIAGNOSTIC GUARD COVERAGE
// -------------------------------------------------------------------
console.log("\n▶ 10. Step 4C.4J Read Rate Limits & Diagnostic Guard Coverage");

{
  const mockRedis = new MockUpstashRedis();
  _setTestRedisClient(mockRedis);

  // 1. Quota & Key Isolation for GET /api/auth/me (checkCustomerReadRateLimit, 60 req/min)
  const meUserA = "usr_me_quota_001";
  for (let i = 1; i <= 60; i++) {
    const res = await checkCustomerReadRateLimit(meUserA);
    if (i === 1 || i === 30 || i === 60) {
      assertTest(res.allowed === true, `Customer me read ${i}/60 permitted for meUserA`);
    }
  }
  const meBlocked = await checkCustomerReadRateLimit(meUserA);
  assertTest(
    meBlocked.allowed === false && meBlocked.status === 429,
    "Customer me read 61/60 rejected with HTTP 429 for meUserA"
  );
  assertTest(
    meBlocked.response.headers.get("Retry-After") !== null,
    "Customer me read rejection includes Retry-After header"
  );

  const meUserB = "usr_me_quota_002";
  const meUserBRes = await checkCustomerReadRateLimit(meUserB);
  assertTest(
    meUserBRes.allowed === true,
    "Different customer has separate GET /api/auth/me read quota and is permitted"
  );

  // 2. Quota & Key Isolation for GET /api/crm/orders/[id] and /api/crm/products/[id] (checkCrmReadRateLimit, 60 req/min)
  const crmSingleAdminA = "admin_single_read_001";
  for (let i = 1; i <= 60; i++) {
    const res = await checkCrmReadRateLimit(crmSingleAdminA);
    if (i === 1 || i === 30 || i === 60) {
      assertTest(res.allowed === true, `CRM single entity read ${i}/60 permitted for adminA`);
    }
  }
  const crmSingleBlocked = await checkCrmReadRateLimit(crmSingleAdminA);
  assertTest(
    crmSingleBlocked.allowed === false && crmSingleBlocked.status === 429,
    "CRM single entity read 61/60 rejected with HTTP 429 for adminA"
  );
  assertTest(
    crmSingleBlocked.response.headers.get("Retry-After") !== null,
    "CRM single entity read rejection includes Retry-After header"
  );

  const crmSingleAdminB = "admin_single_read_002";
  const crmSingleAdminBRes = await checkCrmReadRateLimit(crmSingleAdminB);
  assertTest(
    crmSingleAdminBRes.allowed === true,
    "Different admin has separate CRM single entity read quota and is permitted"
  );

  _resetTestRedisClient();

  // 3. Route Integration: GET /api/auth/me
  const authMeContent = fs.readFileSync(path.resolve("app/api/auth/me/route.ts"), "utf8");
  assertTest(
    authMeContent.includes("checkCustomerReadRateLimit"),
    "GET /api/auth/me imports and calls checkCustomerReadRateLimit"
  );
  const getMeIdx = authMeContent.indexOf("export async function GET");
  const authMeAuthIdx = authMeContent.indexOf("getAuthenticatedUserId", getMeIdx);
  const authMeRateLimitIdx = authMeContent.indexOf("checkCustomerReadRateLimit", getMeIdx);
  const authMeDbIdx = authMeContent.indexOf("prisma.user.findUnique", getMeIdx);

  assertTest(
    getMeIdx !== -1 && authMeAuthIdx !== -1 && authMeRateLimitIdx !== -1 && authMeAuthIdx < authMeRateLimitIdx,
    "GET /api/auth/me authenticates customer session BEFORE consuming read rate limit"
  );
  assertTest(
    authMeRateLimitIdx < authMeDbIdx,
    "GET /api/auth/me applies rate limit BEFORE database user lookup"
  );
  assertTest(
    authMeContent.includes("checkCustomerReadRateLimit(userId)"),
    "GET /api/auth/me passes verified userId to checkCustomerReadRateLimit"
  );
  assertTest(
    authMeContent.includes("return rateLimit.response;"),
    "GET /api/auth/me returns standard rateLimit.response when throttled"
  );

  // 4. Route Integration: GET /api/crm/orders/[id]
  const crmOrderContent = fs.readFileSync(path.resolve("app/api/crm/orders/[id]/route.ts"), "utf8");
  assertTest(
    crmOrderContent.includes("checkCrmReadRateLimit"),
    "GET /api/crm/orders/[id] imports and calls checkCrmReadRateLimit"
  );
  const getCrmOrderIdx = crmOrderContent.indexOf("export async function GET");
  const crmOrderAuthIdx = crmOrderContent.indexOf("verifyAdminSession", getCrmOrderIdx);
  const crmOrderRateLimitIdx = crmOrderContent.indexOf("checkCrmReadRateLimit", getCrmOrderIdx);
  const crmOrderDbIdx = crmOrderContent.indexOf("prisma.order.findUnique", getCrmOrderIdx);

  assertTest(
    getCrmOrderIdx !== -1 && crmOrderAuthIdx !== -1 && crmOrderRateLimitIdx !== -1 && crmOrderAuthIdx < crmOrderRateLimitIdx,
    "GET /api/crm/orders/[id] verifies admin session BEFORE consuming CRM read rate limit"
  );
  assertTest(
    crmOrderRateLimitIdx < crmOrderDbIdx,
    "GET /api/crm/orders/[id] applies rate limit BEFORE database order lookup and joins"
  );
  assertTest(
    crmOrderContent.includes("checkCrmReadRateLimit(auth.admin!.id)"),
    "GET /api/crm/orders/[id] passes verified admin ID to checkCrmReadRateLimit"
  );

  // 5. Route Integration: GET /api/crm/products/[id]
  const crmProductContent = fs.readFileSync(path.resolve("app/api/crm/products/[id]/route.ts"), "utf8");
  assertTest(
    crmProductContent.includes("checkCrmReadRateLimit"),
    "GET /api/crm/products/[id] imports and calls checkCrmReadRateLimit"
  );
  const getCrmProductIdx = crmProductContent.indexOf("export async function GET");
  const crmProductAuthIdx = crmProductContent.indexOf("verifyAdminSession", getCrmProductIdx);
  const crmProductRateLimitIdx = crmProductContent.indexOf("checkCrmReadRateLimit", getCrmProductIdx);
  const crmProductDbIdx = crmProductContent.indexOf("prisma.product.findUnique", getCrmProductIdx);

  assertTest(
    getCrmProductIdx !== -1 && crmProductAuthIdx !== -1 && crmProductRateLimitIdx !== -1 && crmProductAuthIdx < crmProductRateLimitIdx,
    "GET /api/crm/products/[id] verifies admin session BEFORE consuming CRM read rate limit"
  );
  assertTest(
    crmProductRateLimitIdx < crmProductDbIdx,
    "GET /api/crm/products/[id] applies rate limit BEFORE database product lookup and joins"
  );
  assertTest(
    crmProductContent.includes("checkCrmReadRateLimit(auth.admin!.id)"),
    "GET /api/crm/products/[id] passes verified admin ID to checkCrmReadRateLimit"
  );

  // 6. Diagnostic Endpoint Production Inaccessibility Check: GET /api/crm/test-protected
  const testProtectedContent = fs.readFileSync(path.resolve("app/api/crm/test-protected/route.ts"), "utf8");
  assertTest(
    testProtectedContent.includes('process.env.NODE_ENV === "production"'),
    "GET /api/crm/test-protected contains production environment guard"
  );
  assertTest(
    testProtectedContent.includes("status: 404"),
    "GET /api/crm/test-protected returns HTTP 404 Not Found in production"
  );
  const testProtGetIdx = testProtectedContent.indexOf("export async function GET");
  const testProtGuardIdx = testProtectedContent.indexOf('process.env.NODE_ENV === "production"', testProtGetIdx);
  const testProtAuthIdx = testProtectedContent.indexOf("verifyAdminSession", testProtGetIdx);
  assertTest(
    testProtGetIdx !== -1 && testProtGuardIdx !== -1 && testProtGuardIdx < testProtAuthIdx,
    "GET /api/crm/test-protected evaluates production guard BEFORE executing admin session verification"
  );
}

console.log("\n=====================================================================");
console.log(`  TEST RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
console.log("=====================================================================\n");

if (failedCount > 0) {
  process.exit(1);
}
