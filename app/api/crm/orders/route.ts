import { NextRequest } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmReadRateLimit } from "@/lib/rateLimit";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  OrderStatusType,
  PaymentStatusType,
} from "@/lib/validation/order";

/**
 * GET /api/crm/orders
 *
 * Administrative listing endpoint for customer orders.
 *
 * Features:
 * - Paginated order list with configurable limits
 * - Keyword search across orderNumber, customerName, customerEmail, and customerPhone
 * - Multi-criteria filtering by order status, payment status, and date range
 * - Sorting by newest, oldest, total amount (asc/desc)
 * - Real-time catalog summary metrics (Total, Pending, Delivered, Collected Revenue)
 * - Strict revenue rule: Counts only orders where paymentStatus is "PAID"
 *
 * Security:
 * - 401 Unauthorized for unauthenticated requests
 * - 403 Forbidden for authenticated customer non-admin accounts
 * - 200 OK for verified administrators
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to access CRM orders",
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

    // Rate limit CRM administrative reads (60 req/min per verified admin, fails open on store outage)
    const rateLimit = await checkCrmReadRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search")?.trim() || "";
    const rawStatus = searchParams.get("status")?.trim().toUpperCase();
    const rawPaymentStatus = searchParams.get("paymentStatus")?.trim().toUpperCase();
    const dateFrom = searchParams.get("dateFrom")?.trim();
    const dateTo = searchParams.get("dateTo")?.trim();
    const sort = searchParams.get("sort")?.trim().toLowerCase() || "newest";
    const rawPage = searchParams.get("page");
    const rawLimit = searchParams.get("limit");

    // Validate page
    let page = 1;
    if (rawPage) {
      const parsedPage = parseInt(rawPage, 10);
      if (isNaN(parsedPage) || parsedPage < 1) {
        return Response.json(
          { success: false, error: "Invalid 'page' parameter. Must be a positive integer." },
          { status: 400 }
        );
      }
      page = parsedPage;
    }

    // Validate limit
    let limit = 10;
    if (rawLimit) {
      const parsedLimit = parseInt(rawLimit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return Response.json(
          { success: false, error: "Invalid 'limit' parameter. Must be a positive integer." },
          { status: 400 }
        );
      }
      limit = Math.min(parsedLimit, 100);
    }

    // Build where filter
    const where: Prisma.OrderWhereInput = {};

    // Search filter across orderNumber, customerName, customerEmail, customerPhone
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
      ];
    }

    // Order status filter
    if (rawStatus && rawStatus !== "ALL") {
      if (ORDER_STATUSES.includes(rawStatus as OrderStatusType)) {
        where.status = rawStatus as OrderStatusType;
      } else {
        return Response.json(
          {
            success: false,
            error: `Invalid status filter '${rawStatus}'. Allowed values: ${ORDER_STATUSES.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Payment status filter
    if (rawPaymentStatus && rawPaymentStatus !== "ALL") {
      if (PAYMENT_STATUSES.includes(rawPaymentStatus as PaymentStatusType)) {
        where.paymentStatus = rawPaymentStatus as PaymentStatusType;
      } else {
        return Response.json(
          {
            success: false,
            error: `Invalid paymentStatus filter '${rawPaymentStatus}'. Allowed values: ${PAYMENT_STATUSES.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (isNaN(fromDate.getTime())) {
          return Response.json(
            { success: false, error: "Invalid 'dateFrom' parameter. Must be a valid date string." },
            { status: 400 }
          );
        }
        where.createdAt.gte = fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        if (isNaN(toDate.getTime())) {
          return Response.json(
            { success: false, error: "Invalid 'dateTo' parameter. Must be a valid date string." },
            { status: 400 }
          );
        }
        // Include full day until 23:59:59.999
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    // Determine sort ordering
    let orderBy: Prisma.OrderOrderByWithRelationInput = { createdAt: "desc" };
    switch (sort) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "total-desc":
        orderBy = { total: "desc" };
        break;
      case "total-asc":
        orderBy = { total: "asc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    // Execute queries concurrently
    const [orders, totalMatching, totalOrders, pendingOrders, deliveredOrders, paidRevenueAgg] =
      await Promise.all([
        prisma.order.findMany({
          where,
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
              select: {
                id: true,
                productName: true,
                sku: true,
                variantInfo: true,
                price: true,
                quantity: true,
                subtotal: true,
                productId: true,
              },
            },
            payments: {
              select: {
                id: true,
                provider: true,
                paymentId: true,
                providerOrderId: true,
                amount: true,
                status: true,
                createdAt: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.order.count({ where }),
        prisma.order.count(), // All orders in system
        prisma.order.count({
          where: { status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] } },
        }), // Pending fulfillment
        prisma.order.count({ where: { status: "DELIVERED" } }), // Successfully delivered
        prisma.order.aggregate({
          where: { paymentStatus: "PAID" }, // Only verified collected revenue!
          _sum: { total: true },
          _count: { id: true },
        }),
      ]);

    const totalPages = Math.ceil(totalMatching / limit);

    // Format Decimal fields to numbers for clean client consumption
    const formattedOrders = orders.map((order) => {
      const items = order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        sku: item.sku,
        variantInfo: item.variantInfo,
        price: Number(item.price),
        quantity: item.quantity,
        subtotal: Number(item.subtotal),
        productId: item.productId,
      }));

      const payments = order.payments.map((p) => ({
        id: p.id,
        provider: p.provider,
        paymentId: p.paymentId,
        providerOrderId: p.providerOrderId,
        amount: Number(p.amount),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      }));

      return {
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
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        shippingFee: Number(order.shippingFee),
        total: Number(order.total),
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        items,
        payments,
        user: order.user,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      };
    });

    const collectedRevenue = Number(paidRevenueAgg._sum.total || 0);
    const paidOrders = paidRevenueAgg._count.id;

    return Response.json({
      success: true,
      data: formattedOrders,
      pagination: {
        page,
        limit,
        total: totalMatching,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      },
      summary: {
        totalOrders,
        pendingOrders,
        deliveredOrders,
        paidOrders,
        collectedRevenue,
      },
    });
  } catch (error) {
    console.error("[CRM Orders GET Error]:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to retrieve CRM orders",
      },
      { status: 500 }
    );
  }
}
