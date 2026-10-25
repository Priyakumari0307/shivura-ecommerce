import { NextRequest } from "next/server";
import { z } from "zod";
import {
  verifyAdminCredentials,
  ensureAdminDatabaseUser,
} from "@/lib/adminAuth";
import { createSession } from "@/lib/session";
import { checkCrmLoginRateLimit } from "@/lib/rateLimit";

const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address format")
    .max(255)
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(1, "Password is required")
    .max(200, "Password exceeds maximum length"),
});

/**
 * POST /api/crm/auth/login
 * Authenticates the single authorized Shivura CRM administrator.
 *
 * Security Pipeline:
 * 0. Shared sliding window rate limiting (5 attempts / 15 min per trusted IP).
 * 1. Strict validation of request JSON and schema.
 * 2. Constant-time comparison against server-configured ADMIN_EMAIL and ADMIN_PASSWORD_HASH.
 * 3. Atomic database sync ensuring admin user record exists with role = Role.ADMIN.
 * 4. Issues 256-bit AES-GCM encrypted HTTP-only session cookie (shivura_session).
 * 5. Returns safe admin profile; never exposes password hashes or tokens in response body.
 */
export async function POST(request: NextRequest) {
  try {
    // 0. Rate limiting defense
    const rateLimit = await checkCrmLoginRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return Response.json(
        { success: false, error: "Invalid JSON request payload" },
        { status: 400 }
      );
    }

    const parseResult = adminLoginSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return Response.json(
        {
          success: false,
          error: firstIssue?.message || "Invalid credentials format",
        },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;

    // Verify credentials strictly against server configuration
    const verifyResult = await verifyAdminCredentials(email, password);

    if (verifyResult.configError) {
      return Response.json(
        {
          success: false,
          error:
            "Administrative authentication is misconfigured on the server. Please check server logs.",
        },
        { status: 500 }
      );
    }

    if (!verifyResult.success) {
      return Response.json(
        {
          success: false,
          error: "Invalid administrator email or password",
        },
        { status: 401 }
      );
    }

    // Ensure database record exists with Role.ADMIN
    const adminUser = await ensureAdminDatabaseUser();

    // Issue encrypted HTTP-only session cookie
    await createSession(adminUser.id);

    return Response.json({
      success: true,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
      },
    });
  } catch (error) {
    console.error("[CRM Login API Error]:", error);
    return Response.json(
      {
        success: false,
        error: "An unexpected error occurred during administrative authentication",
      },
      { status: 500 }
    );
  }
}
