import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import {
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_JWKS_ENDPOINT,
  GOOGLE_OAUTH_SCOPES,
} from "./config";
import { timingSafeEqual } from "./pkce";

export interface GoogleTokens {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  refresh_token?: string;
}

export interface GoogleIdTokenClaims extends JWTPayload {
  sub: string;
  email: string;
  email_verified: boolean | string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  nonce?: string;
}

// Remote Key Set for Google's public JSON Web Key Set (JWKS)
// Jose automatically caches keys and fetches updates on key rotation
const googleJWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_ENDPOINT));

/**
 * Builds the official Google OAuth 2.0 authorization URL.
 */
export function createGoogleAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  nonce: string;
}): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);

  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");

  return url.toString();
}

/**
 * Exchanges the Google authorization code for OAuth tokens using PKCE verifier.
 *
 * Security:
 * - Sends request securely over HTTPS to Google token endpoint.
 * - Never returns client secret or tokens in unhandled logs or client responses.
 */
export async function exchangeGoogleCode(params: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
    code_verifier: params.codeVerifier,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    console.error("[Google OAuth] Token exchange failed with HTTP status:", response.status);
    throw new Error(`Google token exchange failed with HTTP status ${response.status}`);
  }

  const data = (await response.json()) as GoogleTokens;

  if (!data.id_token || typeof data.id_token !== "string") {
    throw new Error("Google token response did not contain an id_token");
  }

  return data;
}

/**
 * Cryptographically verifies and validates a Google OpenID Connect ID token.
 *
 * Verification guarantees:
 * 1. Signature is verified against Google's published JWKS.
 * 2. Issuer matches 'https://accounts.google.com' or 'accounts.google.com'.
 * 3. Audience matches our configured Google client ID.
 * 4. Token expiration time (exp) is in the future.
 * 5. Nonce matches the temporary nonce generated during initiation (replay protection).
 * 6. Email claim is present, non-empty, and verified by Google (email_verified === true).
 * 7. Subject claim (sub) is present and non-empty.
 *
 * Note: An optional customKeySet parameter allows isolated unit testing with local keypairs.
 */
export async function verifyGoogleIdToken(params: {
  idToken: string;
  clientId: string;
  expectedNonce?: string | null;
  customKeySet?: JWTVerifyGetKey;
}): Promise<GoogleIdTokenClaims> {
  const keySet = params.customKeySet || googleJWKS;

  const { payload } = await jwtVerify(params.idToken, keySet, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: params.clientId,
  });

  // Verify replay protection nonce
  if (params.expectedNonce) {
    if (!payload.nonce || typeof payload.nonce !== "string") {
      throw new Error("Google ID token is missing expected nonce claim");
    }
    if (!timingSafeEqual(payload.nonce, params.expectedNonce)) {
      throw new Error("Google ID token nonce does not match expected nonce");
    }
  }

  // Verify stable Google subject identifier (sub)
  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.trim() === "") {
    throw new Error("Google ID token is missing a valid subject identifier (sub)");
  }

  // Verify email address
  if (!payload.email || typeof payload.email !== "string" || payload.email.trim() === "") {
    throw new Error("Google ID token is missing a valid email address");
  }

  // Verify email verification status from Google
  const isVerified =
    payload.email_verified === true || payload.email_verified === "true";
  if (!isVerified) {
    throw new Error("Google email address is not verified");
  }

  return payload as GoogleIdTokenClaims;
}
