import "server-only";
import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";
import { NextRequest } from "next/server";

// ==========================================
// SESSION CONFIGURATION & CONSTANTS
// ==========================================

export const SESSION_COOKIE_NAME = "shivura_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds (604,800s)

export interface SessionPayload {
  userId: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Derives a 256-bit (32-byte) cryptographic key from the AUTH_SECRET environment variable.
 *
 * Security Requirements:
 * - Must NOT silently fall back to a hardcoded secret.
 * - Fails safely with a clear server-side error if AUTH_SECRET is missing or empty.
 * - Never logs or exposes the secret string.
 */
async function getEncryptionKey(): Promise<Uint8Array> {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.trim() === "") {
    throw new Error(
      "AUTH_SECRET environment variable is missing or empty. A secure secret is required for session encryption/decryption."
    );
  }

  // Derive a deterministic 256-bit key using SHA-256 via Web Crypto
  const encoded = new TextEncoder().encode(secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return new Uint8Array(hashBuffer);
}

/**
 * Encrypts a session payload into a compact JWE string (AES-256-GCM authenticated encryption).
 *
 * @param payload Session payload containing at least non-empty `userId`
 * @returns Encrypted JWE token string
 */
export async function encryptSession(payload: { userId: string }): Promise<string> {
  if (!payload.userId || typeof payload.userId !== "string" || payload.userId.trim() === "") {
    throw new Error("Cannot create session: userId must be a non-empty string.");
  }

  const key = await getEncryptionKey();

  return await new EncryptJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .encrypt(key);
}

/**
 * Decrypts and verifies an encrypted session JWE token.
 *
 * Validation rules:
 * - Missing/empty token -> returns null
 * - Invalid/malformed token -> returns null
 * - Expired token -> returns null
 * - Missing/invalid userId in payload -> returns null
 * - Missing AUTH_SECRET -> logs server error, returns null without exposing crypto details
 *
 * @param token Encrypted JWE string
 * @returns Verified session payload or null
 */
export async function decryptSession(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return null;
  }

  try {
    const key = await getEncryptionKey();
    const { payload } = await jwtDecrypt(token, key);

    if (!payload || typeof payload.userId !== "string" || payload.userId.trim() === "") {
      return null;
    }

    return {
      userId: payload.userId,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("AUTH_SECRET")) {
      console.error("[Session Security] Session verification failed:", error.message);
      return null;
    }

    // Token expired, tampered, or malformed -> return null safely
    return null;
  }
}

/**
 * Creates an encrypted session for the given userId and sets a secure HTTP-only cookie.
 *
 * @param userId Unique identifier of the authenticated user
 * @returns The encrypted session token
 */
export async function createSession(userId: string): Promise<string> {
  const token = await encryptSession({ userId });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return token;
}

/**
 * Reads and verifies the current session from incoming request cookies or Next.js headers.
 *
 * Supports both:
 * 1. Explicit request object (e.g. from Route Handlers passing `request: NextRequest`)
 * 2. Next.js `cookies()` store from `next/headers` (Server Actions, Server Components, Route Handlers)
 *
 * @param request Optional NextRequest or Request
 * @returns Decrypted session payload or null
 */
export async function getSession(
  request?: NextRequest | Request
): Promise<SessionPayload | null> {
  try {
    let token: string | undefined;

    // 1. Check request cookies if available
    if (request && "cookies" in request && typeof request.cookies?.get === "function") {
      token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    }

    // 2. Fall back to Next.js cookieStore
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    }

    if (!token) {
      return null;
    }

    return await decryptSession(token);
  } catch {
    return null;
  }
}

/**
 * Returns the verified user ID from the active session, or null if unauthenticated.
 *
 * Architectural Note on Database Lookup:
 * We intentionally decrypt and verify the authenticated JWE token without querying
 * the database on every request. This preserves sub-millisecond response times and
 * eliminates unnecessary database load on Neon serverless pooling. Full user
 * database verification can be performed downstream when mutative operations occur.
 *
 * @param request Optional NextRequest or Request
 * @returns Verified user ID string or null
 */
export async function getSessionUserId(
  request?: NextRequest | Request
): Promise<string | null> {
  const session = await getSession(request);
  return session?.userId ?? null;
}

/**
 * Deletes the active session by expiring the HTTP-only session cookie.
 */
export async function deleteSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  } catch (error) {
    console.error("[Session Security] Failed to delete session cookie:", error);
  }
}
