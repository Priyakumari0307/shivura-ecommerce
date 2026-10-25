import { NextRequest } from "next/server";
import { updateOrderStatusHandler } from "../route";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * PATCH /api/crm/orders/[id]/status
 *
 * Dedicated status mutation endpoint conforming to Stage 7 specification.
 *
 * Security:
 * - 401 Unauthorized for unauthenticated requests
 * - 403 Forbidden for authenticated customer non-admin accounts
 * - 404 Not Found if identifier does not exist
 * - 200 OK on validated update
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    return await updateOrderStatusHandler(request, id);
  } catch (error) {
    console.error("[CRM Order Status PATCH Error]:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update order status",
      },
      { status: 500 }
    );
  }
}
