import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import {
  updateCartItemQuantity,
  removeCartItem,
  handleCartApiError,
} from "@/lib/cart";
import { checkCustomerMutationRateLimit } from "@/lib/rateLimit";

interface RouteContext {
  params: Promise<{ itemId: string }>;
}

/**
 * PATCH /api/cart/items/[itemId]
 * Updates the quantity of a specific cart item belonging to the authenticated user.
 * If quantity <= 0, deletes the item.
 * Strictly verifies ownership through the user's Cart container.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return Response.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to modify cart items",
          },
        },
        { status: 401 }
      );
    }

    // Rate limit customer cart mutations (30 req/min per verified user, fails closed on Redis outage)
    const rateLimit = await checkCustomerMutationRateLimit(userId);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;

    if (!itemId || typeof itemId !== "string") {
      return Response.json(
        {
          success: false,
          error: {
            code: "INVALID_ITEM_ID",
            message: "Invalid or missing cart item identifier",
          },
        },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Malformed request payload",
          },
        },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return Response.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Request body must be a JSON object",
          },
        },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;
    const quantity = payload.quantity;

    if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
      return Response.json(
        {
          success: false,
          error: {
            code: "INVALID_QUANTITY",
            message: "Quantity must be an integer",
          },
        },
        { status: 400 }
      );
    }

    const cart = await updateCartItemQuantity(userId, itemId.trim(), quantity);

    return Response.json({
      success: true,
      message:
        quantity <= 0
          ? "Item removed from cart"
          : "Cart item quantity updated successfully",
      data: cart,
    });
  } catch (error) {
    return handleCartApiError(error);
  }
}

/**
 * DELETE /api/cart/items/[itemId]
 * Removes a specific cart item belonging to the authenticated user.
 * Strictly verifies ownership through the user's Cart container.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return Response.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to remove cart items",
          },
        },
        { status: 401 }
      );
    }

    // Rate limit customer cart mutations (30 req/min per verified user, fails closed on Redis outage)
    const rateLimit = await checkCustomerMutationRateLimit(userId);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;

    if (!itemId || typeof itemId !== "string") {
      return Response.json(
        {
          success: false,
          error: {
            code: "INVALID_ITEM_ID",
            message: "Invalid or missing cart item identifier",
          },
        },
        { status: 400 }
      );
    }

    const cart = await removeCartItem(userId, itemId.trim());

    return Response.json({
      success: true,
      message: "Cart item removed successfully",
      data: cart,
    });
  } catch (error) {
    return handleCartApiError(error);
  }
}
