import { NextRequest } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";

/**
 * GET /api/crm/test-protected
 * Demonstrates and tests protection for all future CRM API endpoints.
 *
 * Requirements:
 * - Unauthenticated request -> 401 Unauthorized
 * - Customer request -> 403 Forbidden
 * - Admin request -> 200 OK with operational data
 */
export async function GET(request: NextRequest) {
  try {
    // Development/testing diagnostic only: strictly disabled in production
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { success: false, error: "Not Found" },
        { status: 404 }
      );
    }

    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to access CRM APIs",
        },
        { status: 401 }
      );
    }

    if (auth.status === "forbidden") {
      return Response.json(
        {
          success: false,
          error:
            "Forbidden: Authenticated customer accounts do not have CRM permissions",
        },
        { status: 403 }
      );
    }

    return Response.json({
      success: true,
      message: "Protected CRM API accessed successfully",
      admin: auth.admin,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRM Protected API Error]:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
