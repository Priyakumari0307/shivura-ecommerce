import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import {
  addItemToUserCart,
  handleCartApiError,
  AddCartItemInput,
} from "@/lib/cart";
import { checkCustomerMutationRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/cart/items
 * Adds an item to the authenticated user's cart.
 * If the exact same (productId, variantId) combination exists, increments its quantity.
 * Prices and stock are strictly validated and derived from database records.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return Response.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to modify cart",
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
    const productId = payload.productId;
    const variantId = payload.variantId;
    const quantity = payload.quantity ?? 1;

    if (!productId || typeof productId !== "string") {
      return Response.json(
        {
          success: false,
          error: {
            code: "MISSING_PRODUCT_ID",
            message: "Product ID is required and must be a string",
          },
        },
        { status: 400 }
      );
    }

    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
      return Response.json(
        {
          success: false,
          error: {
            code: "INVALID_QUANTITY",
            message: "Quantity must be a positive integer",
          },
        },
        { status: 400 }
      );
    }

    if (variantId !== undefined && variantId !== null && typeof variantId !== "string") {
      return Response.json(
        {
          success: false,
          error: {
            code: "INVALID_VARIANT_ID",
            message: "Variant ID must be a string or null",
          },
        },
        { status: 400 }
      );
    }

    const input: AddCartItemInput = {
      productId: productId.trim(),
      variantId: typeof variantId === "string" ? variantId.trim() : null,
      quantity,
    };

    const cart = await addItemToUserCart(userId, input);

    return Response.json(
      {
        success: true,
        message: "Item added to cart successfully",
        data: cart,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleCartApiError(error);
  }
}
