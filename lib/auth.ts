import "server-only";
import { NextRequest } from "next/server";
import { getSessionUserId, getSession, SessionPayload } from "./session";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
}

/**
 * Resolves the authenticated user ID for incoming server-side API requests.
 *
 * Connected to secure HTTP-only encrypted session infrastructure (lib/session.ts).
 *
 * - Reads and decrypts the encrypted session token (JWE).
 * - Returns verified userId if valid.
 * - Returns `null` when no verified authentication session exists (e.g. missing, expired, or invalid token),
 *   which safely triggers 401 Unauthorized in protected endpoints like Cart APIs.
 */
export async function getAuthenticatedUserId(
  request?: NextRequest
): Promise<string | null> {
  return await getSessionUserId(request);
}

/**
 * Retrieves the full authenticated session payload if an active session exists.
 */
export async function getAuthenticatedSession(
  request?: NextRequest
): Promise<SessionPayload | null> {
  return await getSession(request);
}

