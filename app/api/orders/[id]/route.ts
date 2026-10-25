import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCustomerReadRateLimit } from "@/lib/rateLimit";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/orders/[id]
 *
 * Retrieves detailed confirmation information for a single order owned by
 * the authenticated customer.
 *
 * Security & Ownership:
 * - 401 Unauthorized for unauthenticated requests.
 * - 404 Not Found if identifier does not match any order owned by the session user.
 *   (Strictly prevents cross-customer order snooping by enforcing `userId` ownership).
 * - Accepts either `orderId` or `orderNumber` as the route parameter.
 * - Sanitized output: never leaks payment secrets or internal database diagnostics.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return Response.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to view order details.",
          },
        },
        { status: 401 }
      );
    }

    // Rate limit customer single order read (60 req/min per verified user, fails open on Redis outage)
    const rateLimit = await checkCustomerReadRateLimit(userId);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const { id } = await params;

    if (!id || typeof id !== "string" || id.trim() === "") {
      return Response.json(
        {
          success: false,
          error: {
            code: "INVALID_IDENTIFIER",
            message: "Invalid or missing order identifier.",
          },
        },
        { status: 400 }
      );
    }

    const cleanId = id.trim();

    // Query strictly matching authenticated customer ownership
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: cleanId }, { orderNumber: cleanId }],
        userId, // Critical ownership filter
      },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            product: {
              select: {
                slug: true,
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
    });

    if (!order) {
      return Response.json(
        {
          success: false,
          error: {
            code: "ORDER_NOT_FOUND",
            message: "Order not found or access denied.",
          },
        },
        { status: 404 }
      );
    }

    const primaryPayment = order.payments[0] || null;

    return Response.json({
      success: true,
      data: {
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
          slug: item.product?.slug || null,
        })),
        payment: primaryPayment
          ? {
              id: primaryPayment.id,
              provider: primaryPayment.provider,
              amount: Number(primaryPayment.amount),
              status: primaryPayment.status,
              createdAt: primaryPayment.createdAt,
            }
          : null,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error("[Customer Order Detail GET Error]:", error);

    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve order details.",
        },
      },
      { status: 500 }
    );
  }
}
