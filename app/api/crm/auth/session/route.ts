import { NextRequest } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";

/**
 * GET /api/crm/auth/session
 * Verifies active CRM administrative session.
 *
 * Status codes:
 * - 200 OK: Valid administrator session
 * - 401 Unauthorized: No session or expired/invalid session token
 * - 403 Forbidden: Authenticated user is a customer, not an administrator
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminSession(request);

    if (authResult.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          status: "unauthenticated",
          error: authResult.error || "Administrative authentication required",
        },
        { status: 401 }
      );
    }

    if (authResult.status === "forbidden") {
      return Response.json(
        {
          success: false,
          status: "forbidden",
          error:
            authResult.error ||
            "Access denied: Customer accounts do not have administrator permissions",
        },
        { status: 403 }
      );
    }

    return Response.json({
      success: true,
      status: "authorized",
      admin: authResult.admin,
    });
  } catch (error) {
    console.error("[CRM Session API Error]:", error);
    return Response.json(
      { success: false, error: "An unexpected error occurred verifying session" },
      { status: 500 }
    );
  }
}
