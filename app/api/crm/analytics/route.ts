import { NextRequest } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmReadRateLimit } from "@/lib/rateLimit";
import { getCrmCatalogAnalytics } from "@/lib/crm/analytics";

/**
 * GET /api/crm/analytics
 *
 * Protected administrative analytics endpoint returning live catalog metrics,
 * publication status distributions, stock alerts, taxonomy breakdowns, and recent products.
 *
 * Security:
 * - Admin authorization strictly enforced via verifyAdminSession.
 * - Customer accounts receive 403 Forbidden.
 * - Unauthenticated requests receive 401 Unauthorized.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        { success: false, error: "Unauthenticated: Administrative login required" },
        { status: 401 }
      );
    }

    if (auth.status === "forbidden") {
      return Response.json(
        { success: false, error: "Forbidden: Customer accounts do not have CRM permissions" },
        { status: 403 }
      );
    }

    // Rate limit CRM administrative reads (60 req/min per verified admin, fails open on store outage)
    const rateLimit = await checkCrmReadRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const data = await getCrmCatalogAnalytics();

    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[CRM Analytics GET Error]:", error);
    return Response.json(
      { success: false, error: "Failed to generate catalog analytics" },
      { status: 500 }
    );
  }
}
