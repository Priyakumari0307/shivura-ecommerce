import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/lib/generated/prisma/client";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmWriteRateLimit, checkCrmReadRateLimit } from "@/lib/rateLimit";
import { orderStatusUpdateSchema } from "@/lib/validation/order";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/crm/orders/[id]
 *
 * Administrative single-order retrieval endpoint returning full item snapshots,
 * customer information, shipping addresses, pricing breakdown, and payment records.
 *
 * Security:
 * - 401 Unauthorized for unauthenticated requests
 * - 403 Forbidden for authenticated customer non-admin accounts
 * - Rate-limited to 60 req/min per verified admin (fail-open)
 * - 404 Not Found if identifier does not match any order
 * - 200 OK for verified administrators
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to view order details",
        },
        { status: 401 }
      );
    }

    if (auth.status === "forbidden") {
      return Response.json(
        {
          success: false,
          error: "Forbidden: Customer accounts do not have CRM permissions",
        },
        { status: 403 }
      );
    }

    // Rate-limit CRM administrative reads (60 req/min per verified admin, fail-open)
    const rateLimit = await checkCrmReadRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const { id } = await params;

    if (!id || typeof id !== "string") {
      return Response.json(
        { success: false, error: "Invalid or missing order ID parameter" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        paymentStatus: true,
        subtotal: true,
        discount: true,
        shippingFee: true,
        total: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        shippingAddressLine1: true,
        shippingAddressLine2: true,
        shippingCity: true,
        shippingState: true,
        shippingPostalCode: true,
        shippingCountry: true,
        inventoryRestored: true,
        inventoryRestoredAt: true,
        createdAt: true,
        updatedAt: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                sku: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true, altText: true },
                },
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return Response.json(
        {
          success: false,
          error: `Order with ID "${id}" was not found in the database.`,
        },
        { status: 404 }
      );
    }

    const formattedOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddressLine1: order.shippingAddressLine1,
      shippingAddressLine2: order.shippingAddressLine2,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingPostalCode: order.shippingPostalCode,
      shippingCountry: order.shippingCountry,
      status: order.status,
      paymentStatus: order.paymentStatus,
      inventoryRestored: order.inventoryRestored,
      inventoryRestoredAt: order.inventoryRestoredAt ? order.inventoryRestoredAt.toISOString() : null,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shippingFee: Number(order.shippingFee),
      total: Number(order.total),
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        sku: item.sku,
        variantInfo: item.variantInfo,
        price: Number(item.price),
        quantity: item.quantity,
        subtotal: Number(item.subtotal),
        product: item.product
          ? {
              id: item.product.id,
              name: item.product.name,
              slug: item.product.slug,
              sku: item.product.sku,
              primaryImage: item.product.images[0] || null,
            }
          : null,
      })),
      payments: order.payments.map((p) => ({
        id: p.id,
        provider: p.provider,
        paymentId: p.paymentId,
        providerOrderId: p.providerOrderId,
        amount: Number(p.amount),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      user: order.user
        ? {
            id: order.user.id,
            name: order.user.name,
            email: order.user.email,
            phone: order.user.phone,
            role: order.user.role,
            createdAt: order.user.createdAt.toISOString(),
          }
        : null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };

    return Response.json({
      success: true,
      data: formattedOrder,
    });
  } catch (error) {
    console.error("[CRM Order Details GET Error]:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to retrieve order details",
      },
      { status: 500 }
    );
  }
}

/**
 * Shared order status update logic used by both /api/crm/orders/[id] and /api/crm/orders/[id]/status
 */
export async function updateOrderStatusHandler(
  request: NextRequest,
  orderId: string
) {
  const auth = await verifyAdminSession(request);

  if (auth.status === "unauthenticated") {
    return Response.json(
      {
        success: false,
        error: "Unauthenticated: Administrative login required to update order status",
      },
      { status: 401 }
    );
  }

  if (auth.status === "forbidden") {
    return Response.json(
      {
        success: false,
        error: "Forbidden: Customer accounts do not have CRM permissions",
      },
      { status: 403 }
    );
  }

  // Rate-limit CRM mutations (60 req/min per verified admin)
  const rateLimit = await checkCrmWriteRateLimit(auth.admin!.id);
  if (!rateLimit.allowed) {
    return rateLimit.response;
  }

  if (!orderId || typeof orderId !== "string") {
    return Response.json(
      { success: false, error: "Invalid or missing order ID parameter" },
      { status: 400 }
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const validation = orderStatusUpdateSchema.safeParse(bodyJson);
  if (!validation.success) {
    return Response.json(
      {
        success: false,
        error: "Validation failed: " + validation.error.issues.map((i) => i.message).join(", "),
        issues: validation.error.format(),
      },
      { status: 400 }
    );
  }

  const { status, paymentStatus, paymentEvidence } = validation.data;

  // Fetch target order to verify existence and evaluate state transition
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      total: true,
      inventoryRestored: true,
      payments: true,
      items: true,
    },
  });

  if (!existingOrder) {
    return Response.json(
      {
        success: false,
        error: `Order with ID "${orderId}" was not found in the database.`,
      },
      { status: 404 }
    );
  }

  // 1. Strict payment verification rule:
  // "Do not mark an order PAID without verified payment evidence."
  if (paymentStatus === "PAID") {
    const isAlreadyPaid = existingOrder.paymentStatus === "PAID";
    const hasExistingPaidPayment = existingOrder.payments.some((p) => p.status === "PAID");
    const hasEvidence = Boolean(paymentEvidence && paymentEvidence.trim().length > 0);

    if (!isAlreadyPaid && !hasExistingPaidPayment && !hasEvidence) {
      return Response.json(
        {
          success: false,
          error:
            "Cannot mark order as PAID without verified payment evidence. Please provide a transaction reference ID, UTR number, or manual receipt in the 'paymentEvidence' field.",
          code: "PAYMENT_EVIDENCE_REQUIRED",
        },
        { status: 400 }
      );
    }
  }

  // 2. State transition validation guard
  if (status) {
    if (existingOrder.status === "CANCELLED" && (status === "SHIPPED" || status === "DELIVERED")) {
      return Response.json(
        {
          success: false,
          error: `Cannot transition order "${existingOrder.orderNumber}" directly from CANCELLED to ${status}. Please reinstate the order to PENDING or CONFIRMED first.`,
        },
        { status: 400 }
      );
    }

    if (existingOrder.status === "REFUNDED" && (status === "SHIPPED" || status === "DELIVERED" || status === "PROCESSING")) {
      return Response.json(
        {
          success: false,
          error: `Cannot fulfill order "${existingOrder.orderNumber}" because it is already REFUNDED.`,
        },
        { status: 400 }
      );
    }
  }

  // 3. Define safe, idempotent inventory restoration policy
  const PRE_DISPATCH_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING"];
  const POST_DISPATCH_STATUSES: OrderStatus[] = ["SHIPPED", "DELIVERED"];

  const isTransitioningToCancelled = status === "CANCELLED";
  const isPreDispatchCancellation =
    isTransitioningToCancelled && PRE_DISPATCH_STATUSES.includes(existingOrder.status);
  const isPostDispatchCancellation =
    isTransitioningToCancelled && POST_DISPATCH_STATUSES.includes(existingOrder.status);

  // 4. Execute atomic state update & conditional inventory restoration
  const { updatedOrder, inventoryReport } = await prisma.$transaction(async (tx) => {
    let report: {
      restored: boolean;
      reason: string;
      itemsRestoredCount?: number;
    } = {
      restored: false,
      reason: "No inventory restoration requested for this status transition.",
    };

    if (isPreDispatchCancellation) {
      if (existingOrder.inventoryRestored) {
        report = {
          restored: false,
          reason:
            "Inventory for this order was already restored previously. Skipping redundant restoration (idempotent).",
        };
      } else {
        // Atomic conditional claim to ensure exactly-once execution
        const claimResult = await tx.order.updateMany({
          where: {
            id: orderId,
            inventoryRestored: false,
          },
          data: {
            inventoryRestored: true,
            inventoryRestoredAt: new Date(),
          },
        });

        if (claimResult.count === 1) {
          let restoredCount = 0;
          for (const item of existingOrder.items) {
            // Restore ProductVariant stock if a variant is associated
            if (item.variantId) {
              await tx.productVariant.updateMany({
                where: { id: item.variantId },
                data: { stock: { increment: item.quantity } },
              });
            } else if (item.sku && item.productId) {
              // Backward-compatible fallback lookup by SKU for items created before variantId was recorded
              const matchedVariant = await tx.productVariant.findFirst({
                where: { productId: item.productId, sku: item.sku },
                select: { id: true },
              });
              if (matchedVariant) {
                await tx.productVariant.updateMany({
                  where: { id: matchedVariant.id },
                  data: { stock: { increment: item.quantity } },
                });
              }
            }

            // Restore parent Product aggregate stock
            if (item.productId) {
              await tx.product.updateMany({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              });
            }
            restoredCount++;
          }

          report = {
            restored: true,
            reason:
              "Pre-dispatch cancellation: reserved inventory successfully restored to Product and ProductVariant.",
            itemsRestoredCount: restoredCount,
          };
        } else {
          report = {
            restored: false,
            reason:
              "Inventory restoration was claimed concurrently or already completed (idempotent guard).",
          };
        }
      }
    } else if (isPostDispatchCancellation) {
      report = {
        restored: false,
        reason:
          "Order was already dispatched (status was SHIPPED or DELIVERED). Items in transit or with carrier cannot be automatically restocked.",
      };
    } else if (status === "REFUNDED" || paymentStatus === "REFUNDED") {
      report = {
        restored: false,
        reason:
          "Refund status alone does not restock inventory. Returned goods must be verified through an explicit receipt workflow.",
      };
    }

    // If admin provided payment evidence for an order not previously paid, record a verified payment record
    if (paymentStatus === "PAID" && paymentEvidence && paymentEvidence.trim()) {
      await tx.payment.create({
        data: {
          orderId,
          provider: "ADMIN_VERIFIED",
          paymentId: paymentEvidence.trim(),
          amount: existingOrder.total,
          status: "PAID",
        },
      });
    }

    // Update order status and payment status
    const resultOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        inventoryRestored: true,
        inventoryRestoredAt: true,
        updatedAt: true,
      },
    });

    return { updatedOrder: resultOrder, inventoryReport: report };
  });

  return Response.json({
    success: true,
    message: `Order "${updatedOrder.orderNumber}" status updated successfully.`,
    data: {
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      paymentStatus: updatedOrder.paymentStatus,
      inventoryRestored: updatedOrder.inventoryRestored,
      inventoryRestoredAt: updatedOrder.inventoryRestoredAt
        ? updatedOrder.inventoryRestoredAt.toISOString()
        : null,
      updatedAt: updatedOrder.updatedAt.toISOString(),
    },
    inventoryReport,
    inventoryNotice: inventoryReport.reason,
  });
}

/**
 * PATCH /api/crm/orders/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    return await updateOrderStatusHandler(request, id);
  } catch (error) {
    console.error("[CRM Order PATCH Error]:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update order status",
      },
      { status: 500 }
    );
  }
}
