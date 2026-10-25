import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import {
  getOrCreateUserCart,
  clearUserCart,
  handleCartApiError,
} from "@/lib/cart";
import {
  checkCustomerReadRateLimit,
  checkCustomerMutationRateLimit,
} from "@/lib/rateLimit";

/**
 * GET /api/cart
 * Returns the current authenticated user's cart with live prices and item details.
 * Creates a Cart record if one does not yet exist for the user.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return Response.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to access cart",
          },
        },
        { status: 401 }
      );
    }

    // Rate limit customer cart reads (60 req/min per verified user, fails open on Redis outage)
    const rateLimit = await checkCustomerReadRateLimit(userId);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const cart = await getOrCreateUserCart(userId);

    return Response.json({
      success: true,
      data: cart,
    });
  } catch (error) {
    return handleCartApiError(error);
  }
}

/**
 * DELETE /api/cart
 * Clears all items from the current authenticated user's cart.
 * Preserves the Cart record container.
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return Response.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to access cart",
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

    const cart = await clearUserCart(userId);

    return Response.json({
      success: true,
      message: "Cart cleared successfully",
      data: cart,
    });
  } catch (error) {
    return handleCartApiError(error);
  }
}
