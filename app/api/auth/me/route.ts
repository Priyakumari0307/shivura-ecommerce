import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCustomerReadRateLimit } from "@/lib/rateLimit";

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile based on the active session.
 * Returns HTTP 401 if unauthenticated or if the user no longer exists in the database.
 * Rate-limited to 60 requests/minute per authenticated customer userId (fail-open).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return Response.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Rate limiting: 60 req/min per verified customer userId (fail-open)
    const rateLimit = await checkCustomerReadRateLimit(userId);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return Response.json(
        { success: false, error: "User not found" },
        { status: 401 }
      );
    }

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
    console.error("[Auth Me API Error]:", error);
    return Response.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
