import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { createSession } from "@/lib/session";
import {
  checkCustomerLoginIpRateLimit,
  checkCustomerLoginCompoundRateLimit,
} from "@/lib/rateLimit";

/**
 * POST /api/auth/login
 * Authenticates user credentials, sets an encrypted HTTP-only session cookie,
 * and returns safe user profile data.
 *
 * Security Pipeline:
 * 0. Shared IP rate limit (5 attempts / minute per trusted IP).
 * 1. Zod payload parsing and validation.
 * 2. Compound account rate limit (5 attempts / 15 min per trusted IP + normalized email).
 * 3. Constant-time password verification via bcrypt.
 * 4. Issues 256-bit AES-GCM session cookie upon success.
 */
export async function POST(request: NextRequest) {
  try {
    // 0. Primary IP rate-limit check
    const ipRateLimit = await checkCustomerLoginIpRateLimit(request);
    if (!ipRateLimit.allowed) {
      return ipRateLimit.response;
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return Response.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const parseResult = loginSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return Response.json(
        {
          success: false,
          error: firstIssue?.message || "Invalid request data",
        },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;

    // 2. Compound IP + email rate-limit check (applied before DB lookup and bcrypt.compare)
    const compoundRateLimit = await checkCustomerLoginCompoundRateLimit(request, email);
    if (!compoundRateLimit.allowed) {
      return compoundRateLimit.response;
    }

    // Find user by normalized email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });

    // Constant-time protection: If user doesn't exist or has no passwordHash,
    // fail with generic "Invalid email or password" to prevent user enumeration.
    if (!user || !user.passwordHash) {
      return Response.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return Response.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create session and set HTTP-only cookie
    await createSession(user.id);

    return Response.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[Login API Error]:", error);
    return Response.json(
      { success: false, error: "An unexpected error occurred during login" },
      { status: 500 }
    );
  }
}
