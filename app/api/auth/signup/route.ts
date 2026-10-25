import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation/auth";
import { createSession } from "@/lib/session";
import { checkCustomerSignupRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/auth/signup
 * Registers a new user with email and password, creates an authenticated session,
 * and sets the secure HTTP-only session cookie.
 *
 * Security Pipeline:
 * 0. Shared IP rate limit (3 attempts / hour per trusted IP).
 * 1. Role injection defense and payload schema parsing.
 * 2. Admin email reservation check.
 * 3. Duplicate check and bcrypt hash (cost 12).
 * 4. Issues 256-bit AES-GCM session cookie upon creation.
 */
export async function POST(request: NextRequest) {
  try {
    // 0. Signup rate-limit check (blocks table/CPU exhaustion)
    const rateLimit = await checkCustomerSignupRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimit.response;
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

    if (!rawBody || typeof rawBody !== "object") {
      return Response.json(
        { success: false, error: "Invalid request data" },
        { status: 400 }
      );
    }

    // Security: Do not allow the client to submit or self-assign a role
    if ("role" in rawBody && (rawBody as Record<string, unknown>).role !== undefined) {
      return Response.json(
        { success: false, error: "Role cannot be specified during registration" },
        { status: 400 }
      );
    }

    const parseResult = signupSchema.safeParse(rawBody);
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

    const { name, email, password } = parseResult.data;

    // Disallow registering the reserved administrator email
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (adminEmail && email === adminEmail) {
      return Response.json(
        {
          success: false,
          error: "This email address is reserved for system administration",
        },
        { status: 403 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return Response.json(
        {
          success: false,
          error: "An account with this email already exists",
        },
        { status: 409 }
      );
    }

    // Hash password with bcrypt cost factor 12
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user in database with role strictly set to CUSTOMER
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "CUSTOMER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    // Create session and set HTTP-only cookie
    await createSession(newUser.id);

    return Response.json(
      {
        success: true,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Signup API Error]:", error);
    return Response.json(
      { success: false, error: "An unexpected error occurred during signup" },
      { status: 500 }
    );
  }
}
