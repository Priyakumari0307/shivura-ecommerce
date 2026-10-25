import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_RETURN_TO_COOKIE,
  OAUTH_COOKIE_MAX_AGE,
} from "./config";

export interface StoredOAuthState {
  state: string | null;
  codeVerifier: string | null;
  nonce: string | null;
  returnTo: string | null;
}

/**
 * Attaches short-lived, HTTP-only, secure OAuth cookies to an outgoing NextResponse.
 */
export function setOAuthCookiesOnResponse(
  response: NextResponse,
  params: {
    state: string;
    codeVerifier: string;
    nonce: string;
    returnTo?: string;
  }
): void {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  };

  response.cookies.set(OAUTH_STATE_COOKIE, params.state, cookieOptions);
  response.cookies.set(OAUTH_VERIFIER_COOKIE, params.codeVerifier, cookieOptions);
  response.cookies.set(OAUTH_NONCE_COOKIE, params.nonce, cookieOptions);
  if (params.returnTo) {
    response.cookies.set(OAUTH_RETURN_TO_COOKIE, params.returnTo, cookieOptions);
  }
}

/**
 * Erases temporary OAuth cookies on an outgoing NextResponse.
 */
export function clearOAuthCookiesOnResponse(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === "production";
  const expiredOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };

  response.cookies.set(OAUTH_STATE_COOKIE, "", expiredOptions);
  response.cookies.set(OAUTH_VERIFIER_COOKIE, "", expiredOptions);
  response.cookies.set(OAUTH_NONCE_COOKIE, "", expiredOptions);
  response.cookies.set(OAUTH_RETURN_TO_COOKIE, "", expiredOptions);
}

/**
 * Stores temporary OAuth initiation values in short-lived, HTTP-only, secure cookies
 * via the Next.js cookies() store.
 */
export async function setOAuthCookies(params: {
  state: string;
  codeVerifier: string;
  nonce: string;
  returnTo?: string;
}): Promise<void> {
  try {
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";

    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/",
      maxAge: OAUTH_COOKIE_MAX_AGE,
    };

    cookieStore.set(OAUTH_STATE_COOKIE, params.state, cookieOptions);
    cookieStore.set(OAUTH_VERIFIER_COOKIE, params.codeVerifier, cookieOptions);
    cookieStore.set(OAUTH_NONCE_COOKIE, params.nonce, cookieOptions);

    if (params.returnTo) {
      cookieStore.set(OAUTH_RETURN_TO_COOKIE, params.returnTo, cookieOptions);
    }
  } catch {
    // Handled via setOAuthCookiesOnResponse
  }
}

/**
 * Retrieves the stored temporary OAuth values from incoming request cookies
 * or Next.js cookie store.
 */
export async function getOAuthCookies(
  request?: NextRequest
): Promise<StoredOAuthState> {
  let state = request?.cookies.get(OAUTH_STATE_COOKIE)?.value ?? null;
  let codeVerifier = request?.cookies.get(OAUTH_VERIFIER_COOKIE)?.value ?? null;
  let nonce = request?.cookies.get(OAUTH_NONCE_COOKIE)?.value ?? null;
  let returnTo = request?.cookies.get(OAUTH_RETURN_TO_COOKIE)?.value ?? null;

  if (!state || !codeVerifier) {
    try {
      const cookieStore = await cookies();
      state = state || cookieStore.get(OAUTH_STATE_COOKIE)?.value || null;
      codeVerifier =
        codeVerifier || cookieStore.get(OAUTH_VERIFIER_COOKIE)?.value || null;
      nonce = nonce || cookieStore.get(OAUTH_NONCE_COOKIE)?.value || null;
      returnTo = returnTo || cookieStore.get(OAUTH_RETURN_TO_COOKIE)?.value || null;
    } catch {
      // Ignored outside request scope
    }
  }

  return { state, codeVerifier, nonce, returnTo };
}

/**
 * Clears all temporary OAuth cookies from the client browser.
 */
export async function clearOAuthCookies(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";

    const expiredOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    };

    cookieStore.set(OAUTH_STATE_COOKIE, "", expiredOptions);
    cookieStore.set(OAUTH_VERIFIER_COOKIE, "", expiredOptions);
    cookieStore.set(OAUTH_NONCE_COOKIE, "", expiredOptions);
    cookieStore.set(OAUTH_RETURN_TO_COOKIE, "", expiredOptions);
  } catch {
    // Handled via clearOAuthCookiesOnResponse
  }
}
