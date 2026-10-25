import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  validateCheckoutInput,
  computeCheckoutIntentHash,
  isValidUuidV4,
} from "@/lib/validation/checkout";
import { processCheckout, handleCheckoutApiError } from "@/lib/checkout";
import {
  claimIdempotencyRecord,
  failIdempotencyRecord,
  checkDurableCheckoutRecovery,
} from "@/lib/idempotency";
import {
  checkCheckoutRateLimit,
  checkCustomerOrderListRateLimit,
} from "@/lib/rateLimit";

/**
 * POST /api/orders
 *
 * Places a customer order from their current database-backed cart with strict
 * idempotency enforcement. Requires an authenticated customer session.
 *
 * Flow:
 * 1. Require and validate UUIDv4 `Idempotency-Key` header.
 * 2. Authenticate user from session.
 * 2.5. Rate-limit checkout requests (5 req/min per user, 10 req/min per IP).
 * 3. Validate customer intent (contact, address, COD, items array).
 * 4. Compute deterministic SHA-256 canonical request hash.
 * 5. Coordinate idempotency record claim:
 *    - Replay cached 201 response if already COMPLETED with same hash.
 *    - Return 422 if hash mismatch for this key.
 *    - Return 409 if actively PROCESSING under unexpired lease.
 *    - Atomically claim if new, FAILED, or expired PROCESSING lease.
 * 6. Execute atomic transaction in `processCheckout`:
 *    - Acquires PostgreSQL row lock on IdempotencyRecord with lease fencing.
 *    - Validates products/variants and live database stock.
 *    - Atomically decrements variant and product aggregate inventory.
 *    - Creates immutable Order, OrderItem, and Payment (COD/PENDING) records.
 *    - Clears the database cart upon success.
 *    - Completes IdempotencyRecord requiring affectedRows === 1.
 * 7. On error, verify durable recovery before safely cleaning up with FAILED status.
 * 8. Returns HTTP 201 with confirmed order details.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Require and validate UUIDv4 Idempotency-Key header
    const rawIdempotencyKey = request.headers.get("Idempotency-Key");
    const idempotencyKey = rawIdempotencyKey ? rawIdempotencyKey.trim() : null;

    if (!idempotencyKey || !isValidUuidV4(idempotencyKey)) {
      return Response.json(
        {
          success: false,
          error: {
            code: "INVALID_IDEMPOTENCY_KEY",
            message: "A valid UUIDv4 Idempotency-Key header is required.",
          },
        },
        { status: 400 }
      );
    }

    // 2. Authenticate user from session
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return Response.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to place an order.",
          },
        },
        { status: 401 }
      );
    }

    // 2.5 Rate limit check: 5 requests / min per authenticated user (plus IP limit)
    const rateLimit = await checkCheckoutRateLimit(request, userId);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    // 3. Parse JSON request body
    let bodyJson: unknown;
    try {
      bodyJson = await request.json();
    } catch {
      return Response.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Malformed JSON in request body.",
          },
        },
        { status: 400 }
      );
    }

    // 4. Validate checkout input schema
    const validation = validateCheckoutInput(bodyJson);

    if (!validation.success) {
      return Response.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid checkout information.",
            issues: validation.error.format(),
          },
        },
        { status: 400 }
      );
    }

    // 5. Compute canonical SHA-256 hash of validated intent
    const requestHash = computeCheckoutIntentHash(validation.data);

    // 6. Pre-flight claim coordinator
    const claim = await claimIdempotencyRecord(
      userId,
      idempotencyKey,
      requestHash
    );

    if (claim.action === "REPLAY") {
      return Response.json(claim.responseBody, {
        status: claim.statusCode,
        headers: { "Idempotent-Replay": "true" },
      });
    }

    if (claim.action === "ERROR") {
      return Response.json(
        {
          success: false,
          error: {
            code: claim.error.code,
            message: claim.error.message,
          },
        },
        {
          status: claim.error.status,
          headers: claim.error.headers,
        }
      );
    }

    // 7. Proceed with transactional checkout execution
    try {
      const checkoutResult = await processCheckout(userId, validation.data, {
        idempotency: {
          key: idempotencyKey,
          leaseToken: claim.leaseToken,
          requestHash,
        },
      });

      return Response.json(
        {
          success: true,
          message: "Order placed successfully.",
          data: checkoutResult.order,
        },
        { status: 201 }
      );
    } catch (checkoutError) {
      // If transaction outcome is uncertain, check durable state before marking failed
      const recovery = await checkDurableCheckoutRecovery(
        userId,
        idempotencyKey
      );

      if (recovery.recovered) {
        return Response.json(recovery.responseBody, {
          status: recovery.statusCode,
          headers: { "Idempotent-Replay": "true" },
        });
      }

      // Safe failure cleanup: only mark FAILED if still in PROCESSING with this worker's leaseToken
      await failIdempotencyRecord(userId, idempotencyKey, claim.leaseToken);

      return handleCheckoutApiError(checkoutError);
    }
  } catch (error) {
    return handleCheckoutApiError(error);
  }
}

/**
 * GET /api/orders
 *
 * Retrieves paginated order history for the authenticated customer.
 * Enforces strict user isolation: customers can only view their own orders.
 * Query parameters cannot override the authenticated user ID.
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 50)
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
            message: "Authentication required to view order history.",
          },
        },
        { status: 401 }
      );
    }

    // Rate limit customer order history list reads (30 req/min per verified user, fails open on Redis outage)
    const rateLimit = await checkCustomerOrderListRateLimit(userId);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const { searchParams } = new URL(request.url);

    // Parse and sanitize pagination parameters
    const rawPage = parseInt(searchParams.get("page") || "1", 10);
    const rawLimit = parseInt(searchParams.get("limit") || "10", 10);

    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit =
      Number.isInteger(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 50)
        : 10;

    const skip = (page - 1) * limit;

    // Query authenticated customer's own orders with stable sort order
    const [totalOrders, orders] = await Promise.all([
      prisma.order.count({
        where: { userId },
      }),
      prisma.order.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
        include: {
          items: {
            orderBy: { createdAt: "asc" },
            include: {
              product: {
                select: {
                  images: {
                    orderBy: [
                      { isPrimary: "desc" },
                      { sortOrder: "asc" },
                    ],
                    take: 1,
                    select: { url: true },
                  },
                },
              },
            },
          },
          payments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              provider: true,
              amount: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const formattedOrders = orders.map((order) => {
      const primaryPayment = order.payments[0] || null;

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        shippingFee: Number(order.shippingFee),
        total: Number(order.total),
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        shippingAddress: {
          addressLine1: order.shippingAddressLine1,
          addressLine2: order.shippingAddressLine2,
          city: order.shippingCity,
          state: order.shippingState,
          postalCode: order.shippingPostalCode,
          country: order.shippingCountry,
        },
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          variantInfo: item.variantInfo,
          price: Number(item.price),
          quantity: item.quantity,
          subtotal: Number(item.subtotal),
          imageSrc: item.product?.images?.[0]?.url || "/images/Product1.png",
        })),
        payment: primaryPayment
          ? {
              id: primaryPayment.id,
              provider: primaryPayment.provider,
              amount: Number(primaryPayment.amount),
              status: primaryPayment.status,
            }
          : null,
        createdAt: order.createdAt,
      };
    });

    const totalPages = Math.ceil(totalOrders / limit) || 1;

    return Response.json({
      success: true,
      data: formattedOrders,
      pagination: {
        page,
        limit,
        total: totalOrders,
        totalPages,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    console.error("[Customer Orders GET Error]:", error);

    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve order history.",
        },
      },
      { status: 500 }
    );
  }
}
