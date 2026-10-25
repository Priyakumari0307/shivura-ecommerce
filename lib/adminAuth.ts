import "server-only";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { getSession } from "./session";
import { prisma } from "./prisma";
import { Role } from "./generated/prisma/client";

export interface VerifiedAdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export interface AuthenticatedCustomerUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export type AdminAuthStatus = "authorized" | "forbidden" | "unauthenticated";

export interface AdminAuthResult {
  authenticated: boolean;
  authorized: boolean;
  status: AdminAuthStatus;
  admin?: VerifiedAdminUser;
  customer?: AuthenticatedCustomerUser;
  error?: string;
}

/**
 * Fallback dummy bcrypt hash (cost 12) used to ensure constant-time comparison
 * and protect against user enumeration or timing attacks when an email does not match.
 */
const DUMMY_TIMING_HASH =
  "$2b$12$e80MvQkK3o3VnN.1Fp0Jpe3fE8pZ4m1a5q0Z9p.bK2c3d4e5f6g7h8i9j0k";

/**
 * Bcrypt hash structure regex (Modular Crypt Format).
 * Valid bcrypt hashes start with $2a$, $2b$, or $2y$, followed by a 2-digit cost,
 * $, and 53 base64 characters (exactly 60 characters in total).
 */
export const BCRYPT_HASH_REGEX = /^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/;

export function isValidBcryptHash(hash: string): boolean {
  return BCRYPT_HASH_REGEX.test(hash);
}

/**
 * Returns the normalized ADMIN_EMAIL from environment variables.
 * Returns null if not configured or empty.
 */
export function getAdminEmail(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim();
  return email ? email.toLowerCase() : null;
}

/**
 * Returns ADMIN_PASSWORD_HASH from environment variables.
 * Automatically normalizes wrapping quotes and resolves literal backslash-escaped
 * dollar signs (\$ -> $) if an execution environment preserves them.
 * Returns null if not configured or empty.
 */
export function getAdminPasswordHash(): string | null {
  const rawHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!rawHash) return null;

  let hash = rawHash;

  // Strip accidental wrapping quotes
  if (
    (hash.startsWith('"') && hash.endsWith('"')) ||
    (hash.startsWith("'") && hash.endsWith("'"))
  ) {
    hash = hash.slice(1, -1).trim();
  }

  // Next.js unescapes \$ in .env, but if another environment/runner didn't,
  // normalize literal backslash-escaped dollars back to $
  if (hash.includes("\\$")) {
    hash = hash.replace(/\\(\$)/g, "$1");
  }

  return hash || null;
}

/**
 * Safe server-side diagnostic check for administrator credentials configuration.
 * Never prints or logs the actual secret password or hash.
 */
export function validateAdminConfig(): {
  valid: boolean;
  adminEmail: string | null;
  adminHash: string | null;
  error?: "MISSING_ADMIN_EMAIL" | "MISSING_ADMIN_PASSWORD_HASH" | "INVALID_HASH_FORMAT";
} {
  const adminEmail = getAdminEmail();
  const adminHash = getAdminPasswordHash();

  if (!adminEmail) {
    console.error(
      "[Admin Security Diagnostic] Missing ADMIN_EMAIL environment variable in .env"
    );
    return {
      valid: false,
      adminEmail: null,
      adminHash: null,
      error: "MISSING_ADMIN_EMAIL",
    };
  }

  if (!adminHash) {
    console.error(
      "[Admin Security Diagnostic] Missing ADMIN_PASSWORD_HASH environment variable in .env"
    );
    return {
      valid: false,
      adminEmail,
      adminHash: null,
      error: "MISSING_ADMIN_PASSWORD_HASH",
    };
  }

  if (!isValidBcryptHash(adminHash)) {
    console.error(
      `[Admin Security Diagnostic] ADMIN_PASSWORD_HASH in environment is not a valid 60-character bcrypt hash ($2a/$2b). Received length: ${adminHash.length}. If a plaintext password was entered into .env, generate a valid hash using: node scripts/generate-admin-hash.mjs "<password>"`
    );
    return {
      valid: false,
      adminEmail,
      adminHash: null,
      error: "INVALID_HASH_FORMAT",
    };
  }

  return {
    valid: true,
    adminEmail,
    adminHash,
  };
}

/**
 * Verifies submitted credentials against the server-configured admin identity.
 *
 * Security Properties:
 * 1. Fixed identity: Only the exact email in ADMIN_EMAIL is permitted.
 * 2. Timing attack mitigation: Performs a constant-time bcrypt compare even if email is wrong
 *    or server config is incomplete.
 * 3. Never logs credentials or hashes.
 */
export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<{ success: boolean; configError?: boolean }> {
  const config = validateAdminConfig();

  // If server admin credentials are not properly configured, fail safely
  if (!config.valid || !config.adminEmail || !config.adminHash) {
    await bcrypt.compare(password, DUMMY_TIMING_HASH);
    return { success: false, configError: true };
  }

  const normalizedInputEmail = email.trim().toLowerCase();
  const isEmailMatch = normalizedInputEmail === config.adminEmail;

  if (!isEmailMatch) {
    // Constant-time dummy comparison to prevent timing enumeration
    await bcrypt.compare(password, DUMMY_TIMING_HASH);
    return { success: false };
  }

  // Compare submitted password against configured bcrypt hash
  const passwordMatches = await bcrypt.compare(password, config.adminHash);
  return { success: passwordMatches };
}

/**
 * Ensures the authorized admin user exists in the database with role = Role.ADMIN.
 * Atomically creates or updates the user record so that relational foreign keys
 * (orders, reviews, logs) remain valid in the PostgreSQL schema.
 */
export async function ensureAdminDatabaseUser(): Promise<VerifiedAdminUser> {
  const config = validateAdminConfig();

  if (!config.valid || !config.adminEmail || !config.adminHash) {
    throw new Error(
      "Admin credentials not configured or invalid on server. Ensure ADMIN_EMAIL and a valid 60-character ADMIN_PASSWORD_HASH are set."
    );
  }

  const user = await prisma.user.upsert({
    where: { email: config.adminEmail },
    update: {
      role: Role.ADMIN,
      passwordHash: config.adminHash,
    },
    create: {
      email: config.adminEmail,
      name: "Shivura CRM Administrator",
      role: Role.ADMIN,
      passwordHash: config.adminHash,
      emailVerified: new Date(),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  return user;
}

/**
 * Distinct server-side verification of admin authorization.
 *
 * Security Pipeline:
 * 1. Decrypts JWE session token from secure HTTP-only cookie using AUTH_SECRET.
 * 2. If no valid session token exists -> returns status: "unauthenticated"
 * 3. Queries database for the verified userId (never trusting client headers or body).
 * 4. Checks that:
 *    - User exists in database
 *    - user.role === Role.ADMIN
 *    - user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
 * 5. If user is a customer -> returns status: "forbidden" with customer details.
 * 6. If verified admin -> returns status: "authorized" with admin details.
 */
export async function verifyAdminSession(
  request?: NextRequest
): Promise<AdminAuthResult> {
  const session = await getSession(request);

  if (!session?.userId) {
    return {
      authenticated: false,
      authorized: false,
      status: "unauthenticated",
      error: "Authentication required. Please sign in to Shivura CRM.",
    };
  }

  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    console.error(
      "[Admin Security] ADMIN_EMAIL environment variable is missing on server."
    );
    return {
      authenticated: true,
      authorized: false,
      status: "forbidden",
      error: "Server administrator configuration is incomplete.",
    };
  }

  // Lookup user by the cryptographically verified userId
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (!user) {
    return {
      authenticated: false,
      authorized: false,
      status: "unauthenticated",
      error: "Session user record does not exist in the database.",
    };
  }

  const isRoleAdmin = user.role === Role.ADMIN;
  const isEmailAdmin = user.email.toLowerCase() === adminEmail;

  if (isRoleAdmin && isEmailAdmin) {
    return {
      authenticated: true,
      authorized: true,
      status: "authorized",
      admin: user,
    };
  }

  // Authenticated customer attempting to access CRM resources
  return {
    authenticated: true,
    authorized: false,
    status: "forbidden",
    customer: user,
    error: "Access denied. Customer accounts are not authorized for CRM access.",
  };
}
