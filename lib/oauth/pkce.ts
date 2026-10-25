import crypto from "node:crypto";

/**
 * Generates a cryptographically secure random string encoded in base64url format.
 * Default 32 bytes provides 256 bits of entropy.
 */
export function generateRandomString(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Generates an unpredictable, cryptographically secure state parameter for CSRF mitigation.
 */
export function generateState(): string {
  return generateRandomString(32);
}

/**
 * Generates an unpredictable nonce value for OIDC replay mitigation.
 */
export function generateNonce(): string {
  return generateRandomString(32);
}

/**
 * Generates a PKCE code_verifier string according to RFC 7636.
 * Using 32 random bytes in base64url format yields a 43-character string,
 * strictly within the RFC 7636 requirement of 43-128 characters.
 */
export function generateCodeVerifier(): string {
  return generateRandomString(32);
}

/**
 * Computes the S256 code_challenge from a code_verifier string according to RFC 7636.
 * code_challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier, "utf8").digest("base64url");
}

/**
 * Compares two strings using constant-time comparison to prevent timing attacks.
 * Returns false if strings are null, undefined, or differ in length.
 */
export function timingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Sanitizes a redirect destination path to prevent Open Redirect vulnerabilities.
 * Enforces:
 * - Must be a local relative path starting with a single '/'
 * - Rejects protocol schemes (http:, https:, javascript:, data:, etc.)
 * - Rejects protocol-relative URLs (//) and backslash paths (/\\)
 * - Rejects CRLF characters and control characters
 * Defaults to '/' if invalid or suspicious.
 */
export function sanitizeRedirectPath(path: string | null | undefined): string {
  if (!path || typeof path !== "string") {
    return "/";
  }

  const trimmed = path.trim();

  // Must begin with a single slash and not double slashes or backslashes
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return "/";
  }

  // Reject protocol, host, or auth bypass indicators
  if (trimmed.includes("\\") || trimmed.includes(":") || trimmed.includes("@")) {
    return "/";
  }

  // Reject newlines or null bytes
  if (/[\r\n\0\t]/.test(trimmed)) {
    return "/";
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");
    // Ensure the origin was not redirected or transformed
    if (parsed.origin !== "http://localhost") {
      return "/";
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }
}
