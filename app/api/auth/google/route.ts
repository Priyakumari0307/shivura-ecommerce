import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthConfig } from "@/lib/oauth/config";
import {
  generateState,
  generateNonce,
  generateCodeVerifier,
  generateCodeChallenge,
  sanitizeRedirectPath,
} from "@/lib/oauth/pkce";
import { setOAuthCookiesOnResponse } from "@/lib/oauth/cookies";
import { checkOAuthInitiationRateLimit } from "@/lib/rateLimit";

/**
 * GET /api/auth/google
 * Initiates Google OAuth 2.0 Authorization-Code Flow with PKCE and state protection.
 *
 * Security:
 * 0. Applies trusted IP rate limiting (15 req/min, fail-closed) before generating state/PKCE.
 * 1. Checks that Google OAuth is properly configured on the server.
 * 2. Generates unpredictable cryptographic state for CSRF mitigation.
 * 3. Generates PKCE code_verifier and derives S256 code_challenge.
 * 4. Generates unpredictable nonce for OIDC replay mitigation.
 * 5. Stores temporary OAuth state in short-lived, HTTP-only, secure cookies.
 * 6. Sanitizes optional return_to / redirect_to parameter to prevent Open Redirects.
 * 7. Redirects user to Google's official authorization endpoint with minimal required scopes.
 * 8. Never exposes client secrets to the browser.
 */
export async function GET(request: NextRequest) {
  try {
    // 0. Primary rate-limit check (15 req/min per trusted client IP, fail-closed)
    const rateLimit = await checkOAuthInitiationRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const config = getGoogleOAuthConfig();

    if (!config) {
      if (process.env.NODE_ENV !== "production") {
        return Response.json(
          {
            success: false,
            error:
              "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in your environment or .env file.",
          },
          { status: 500 }
        );
      }
      return Response.json(
        { success: false, error: "Authentication service unavailable" },
        { status: 500 }
      );
    }

    // Extract and sanitize optional return destination
    const returnToParam =
      request.nextUrl.searchParams.get("return_to") ||
      request.nextUrl.searchParams.get("redirect_to");
    const safeReturnTo = sanitizeRedirectPath(returnToParam);

    // Cryptographic values
    const state = generateState();
    const nonce = generateNonce();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Build official Google OAuth 2.0 authorization URL
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", config.clientId);
    authUrl.searchParams.set("redirect_uri", config.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("access_type", "online");
    authUrl.searchParams.set("prompt", "select_account");

    const response = NextResponse.redirect(authUrl.toString(), 302);

    // Persist temporary state into secure HTTP-only cookies on the response
    setOAuthCookiesOnResponse(response, {
      state,
      codeVerifier,
      nonce,
      returnTo: safeReturnTo,
    });

    return response;
  } catch (error) {
    console.error("[Google OAuth Initiation Error]:", error);
    return Response.json(
      { success: false, error: "Failed to initiate Google authentication" },
      { status: 500 }
    );
  }
}
