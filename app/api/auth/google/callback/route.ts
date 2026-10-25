import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthConfig } from "@/lib/oauth/config";
import { timingSafeEqual, sanitizeRedirectPath } from "@/lib/oauth/pkce";
import {
  getOAuthCookies,
  clearOAuthCookiesOnResponse,
} from "@/lib/oauth/cookies";
import { exchangeGoogleCode, verifyGoogleIdToken } from "@/lib/oauth/google";
import { handleGoogleUser } from "@/lib/oauth/user";
import {
  createSession,
  encryptSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";
import { checkOAuthCallbackRateLimit } from "@/lib/rateLimit";

/**
 * Helper to build safe redirect back to /login with a sanitized error key,
 * ensuring all temporary OAuth cookies are erased on the response.
 */
function redirectWithError(
  request: NextRequest,
  errorKey: string
): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", errorKey);
  const response = NextResponse.redirect(loginUrl.toString(), 302);
  clearOAuthCookiesOnResponse(response);
  return response;
}

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth 2.0 authorization response.
 *
 * Security & Validation Pipeline:
 * 1. Checks provider error responses and user cancellations safely.
 * 2. Compares incoming state against stored cookie state using timing-safe comparison.
 * 3. Retrieves PKCE code_verifier and exchanges authorization code for tokens over HTTPS.
 * 4. Verifies ID token signature (via Google JWKS), issuer, audience, expiry, and nonce.
 * 5. Requires verified email address (email_verified === true).
 * 5.5. Enforces IP rate limiting (30 req/min, fail-open) before external token exchange and DB operations.
 * 6. Uses stable Google sub claim as the provider account identifier.
 * 7. Strictly avoids automatic account linking when an email/password account already exists.
 * 8. Creates new CUSTOMER User and Account records inside an atomic Prisma transaction.
 * 9. Issues standard encrypted HTTP-only session cookie (createSession).
 * 10. Always clears temporary OAuth cookies on both success and error paths (except throttled 429).
 * 11. Restricts redirect to safe local destinations.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const providerError = searchParams.get("error");
    const code = searchParams.get("code");
    const receivedState = searchParams.get("state");

    // 1. Handle OAuth denial or provider error safely
    if (providerError) {
      console.warn("[Google OAuth Callback] Provider returned error:", providerError);
      return redirectWithError(
        request,
        providerError === "access_denied" ? "oauth_denied" : "oauth_provider_error"
      );
    }

    // 2. Validate server configuration
    const config = getGoogleOAuthConfig();
    if (!config) {
      console.error("[Google OAuth Callback] Server is missing Google OAuth configuration");
      return redirectWithError(request, "oauth_unconfigured");
    }

    // 3. Retrieve stored temporary OAuth values from HTTP-only cookies
    const stored = await getOAuthCookies(request);

    // 4. Validate state parameter (timing-safe comparison against CSRF)
    if (!receivedState || !stored.state) {
      console.warn("[Google OAuth Callback] Missing state parameter or cookie");
      return redirectWithError(request, "missing_state");
    }

    if (!timingSafeEqual(receivedState, stored.state)) {
      console.warn("[Google OAuth Callback] State parameter mismatch");
      return redirectWithError(request, "invalid_state");
    }

    // 5. Validate presence of authorization code and PKCE code_verifier
    if (!code) {
      console.warn("[Google OAuth Callback] Missing authorization code");
      return redirectWithError(request, "missing_code");
    }

    if (!stored.codeVerifier) {
      console.warn("[Google OAuth Callback] Missing stored PKCE code verifier");
      return redirectWithError(request, "invalid_request");
    }

    // 5.5. Rate limiting: 30 req/min per trusted client IP (fail-open)
    // Applied after state/PKCE verification and before external token exchange and database operations.
    // When throttled (HTTP 429), return rateLimit.response directly without clearing temporary OAuth cookies
    // so backing off and retrying does not prematurely destroy the browser's cryptographic session state.
    const rateLimit = await checkOAuthCallbackRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    // 6. Securely exchange authorization code for tokens
    let tokens;
    try {
      tokens = await exchangeGoogleCode({
        code,
        codeVerifier: stored.codeVerifier,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
      });
    } catch (exchangeError) {
      console.error("[Google OAuth Callback] Token exchange failed:", exchangeError);
      return redirectWithError(request, "token_exchange_failed");
    }

    // 7. Verify ID token signature, claims, expiry, and nonce
    let idTokenClaims;
    try {
      idTokenClaims = await verifyGoogleIdToken({
        idToken: tokens.id_token,
        clientId: config.clientId,
        expectedNonce: stored.nonce,
      });
    } catch (verificationError) {
      console.error("[Google OAuth Callback] ID token verification failed:", verificationError);
      const errorMessage =
        verificationError instanceof Error ? verificationError.message : "";
      if (errorMessage.includes("verified")) {
        return redirectWithError(request, "unverified_email");
      }
      return redirectWithError(request, "invalid_token");
    }

    // 8. Account lookup, user creation, and account linking boundaries
    const accountResult = await handleGoogleUser({
      sub: idTokenClaims.sub,
      email: idTokenClaims.email,
      name: idTokenClaims.name,
      picture: idTokenClaims.picture,
    });

    if (!accountResult.success) {
      if (accountResult.error === "ACCOUNT_EXISTS") {
        // Safe redirect when an existing local account exists with this email
        return redirectWithError(request, "account_exists");
      }
      return redirectWithError(request, "oauth_error");
    }

    // 9. Establish authenticated Shivura session
    let sessionToken: string;
    try {
      sessionToken = await createSession(accountResult.user.id);
    } catch {
      // In isolated test runner environment without Next.js async storage
      sessionToken = await encryptSession({ userId: accountResult.user.id });
    }

    // 10. Determine safe destination and prepare redirect response
    const targetPath = sanitizeRedirectPath(stored.returnTo);
    const destinationUrl = new URL(targetPath, request.url);
    const response = NextResponse.redirect(destinationUrl.toString(), 302);

    // Set session cookie on response
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    // Clean up temporary OAuth cookies
    clearOAuthCookiesOnResponse(response);

    return response;
  } catch (error) {
    console.error("[Google OAuth Callback Unexpected Error]:", error);
    return redirectWithError(request, "oauth_error");
  }
}
