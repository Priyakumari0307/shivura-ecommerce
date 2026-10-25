// ==========================================
// GOOGLE OAUTH CONFIGURATION & CONSTANTS
// ==========================================

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";

export const GOOGLE_OAUTH_SCOPES = ["openid", "email", "profile"] as const;

// Cookie names for temporary OAuth state during authorization-code flow
export const OAUTH_STATE_COOKIE = "shivura_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "shivura_oauth_verifier";
export const OAUTH_NONCE_COOKIE = "shivura_oauth_nonce";
export const OAUTH_RETURN_TO_COOKIE = "shivura_oauth_return_to";

// Short-lived cookie lifetime (10 minutes)
export const OAUTH_COOKIE_MAX_AGE = 10 * 60; // 600 seconds

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Retrieves and validates server-side Google OAuth credentials.
 * Returns null if credentials are not configured or empty.
 * Never logs or exposes secret values.
 */
export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";

  if (!clientId || clientId.trim() === "" || !clientSecret || clientSecret.trim() === "") {
    return null;
  }

  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    redirectUri: redirectUri.trim(),
  };
}

/**
 * Checks whether Google OAuth is configured in the current environment.
 */
export function isGoogleOAuthConfigured(): boolean {
  return getGoogleOAuthConfig() !== null;
}
