import "server-only";
import { prisma, Prisma } from "@/lib/prisma";
import { CheckoutInput, CartLineIntent } from "@/lib/validation/checkout";
import {
  verifyAndLockIdempotencyRecord,
  completeIdempotencyRecord,
} from "@/lib/idempotency";

export interface ProcessCheckoutOptions {
  idempotency?: {
    key: string;
    leaseToken: string;
    requestHash: string;
  };
}

export class CheckoutError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode: number = 400,
    details?: unknown
  ) {
    super(message);
    this.name = "CheckoutError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface PreparedOrderItem {
  productId: string;
  variantId: string | null;
  productName: string;
  sku: string | null;
  variantInfo: string | null;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface OrderPricingSummary {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  couponCode: string | null;
  couponDescription?: string | null;
}

export interface CheckoutResult {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    subtotal: number;
    discount: number;
    shippingFee: number;
    total: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddressLine1: string;
    shippingAddressLine2: string | null;
    shippingCity: string;
    shippingState: string;
    shippingPostalCode: string;
    shippingCountry: string;
    createdAt: Date;
    items: Array<{
      id: string;
      productId: string | null;
      productName: string;
      sku: string | null;
      variantInfo: string | null;
      price: number;
      quantity: number;
      subtotal: number;
    }>;
    payment: {
      id: string;
      provider: string;
      amount: number;
      status: string;
    };
  };
}

/**
 * Free shipping threshold across India (₹999).
 * Below this, a standard delivery fee of ₹99 applies.
 */
export const FREE_SHIPPING_THRESHOLD = 999;
export const STANDARD_SHIPPING_FEE = 99;

/**
 * Generates a unique, human-friendly order number with collision protection.
 * Format: SHV-YYYYMMDD-XXXX (e.g. SHV-20261012-A3F9)
 */
async function generateUniqueOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const datePrefix = `SHV-${year}${month}${day}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const candidate = `${datePrefix}-${randomPart}`;

    const existing = await tx.order.findUnique({
      where: { orderNumber: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  // High-entropy fallback using timestamp
  const timestampSuffix = Date.now().toString(36).slice(-5).toUpperCase();
  return `${datePrefix}-${timestampSuffix}`;
}

/**
 * Evaluates coupon validity and calculates discount.
 * Checks:
 * 1. Database `Coupon` table (active, date window, usageLimit, minimumOrderAmount).
 * 2. Supported promo codes defined in storefront rules (SHIVURA10, FESTIVE10, WELCOME15).
 * Rejects unknown or invalid coupon codes with CheckoutError("INVALID_COUPON").
 */
async function evaluateCouponDiscount(
  rawCouponCode: string | null | undefined,
  subtotal: number,
  tx?: Prisma.TransactionClient
): Promise<{
  discount: number;
  matchedDbCoupon: { id: string; code: string; usageLimit: number | null } | null;
  description: string | null;
}> {
  if (!rawCouponCode || !rawCouponCode.trim()) {
    return { discount: 0, matchedDbCoupon: null, description: null };
  }

  const code = rawCouponCode.trim().toUpperCase();
  const client = tx || prisma;

  // 1. Check database Coupon table
  const dbCoupon = await client.coupon.findUnique({
    where: { code },
  });

  if (dbCoupon) {
    if (!dbCoupon.active) {
      throw new CheckoutError(
        "INVALID_COUPON",
        `Coupon code "${code}" is no longer active.`,
        400
      );
    }

    const now = new Date();
    if (dbCoupon.startsAt && now < dbCoupon.startsAt) {
      throw new CheckoutError(
        "INVALID_COUPON",
        `Coupon code "${code}" is not active yet.`,
        400
      );
    }

    if (dbCoupon.expiresAt && now > dbCoupon.expiresAt) {
      throw new CheckoutError(
        "INVALID_COUPON",
        `Coupon code "${code}" has expired.`,
        400
      );
    }

    if (dbCoupon.usageLimit != null && dbCoupon.usageCount >= dbCoupon.usageLimit) {
      throw new CheckoutError(
        "COUPON_LIMIT_REACHED",
        `Coupon code "${code}" has reached its maximum redemption limit.`,
        400
      );
    }

    if (
      dbCoupon.minimumOrderAmount != null &&
      subtotal < Number(dbCoupon.minimumOrderAmount)
    ) {
      throw new CheckoutError(
        "COUPON_MINIMUM_NOT_MET",
        `Order subtotal of ₹${subtotal} is below the minimum order requirement of ₹${Number(
          dbCoupon.minimumOrderAmount
        )} for coupon "${code}".`,
        400
      );
    }

    let calculatedDiscount = 0;
    if (dbCoupon.discountType === "PERCENTAGE") {
      calculatedDiscount = (subtotal * Number(dbCoupon.discountValue)) / 100;
      if (dbCoupon.maximumDiscount != null) {
        calculatedDiscount = Math.min(
          calculatedDiscount,
          Number(dbCoupon.maximumDiscount)
        );
      }
    } else {
      // FIXED discount
      calculatedDiscount = Math.min(subtotal, Number(dbCoupon.discountValue));
    }

    const finalDiscount = Math.min(
      subtotal,
      Math.round(calculatedDiscount * 100) / 100
    );

    return {
      discount: finalDiscount,
      matchedDbCoupon: {
        id: dbCoupon.id,
        code: dbCoupon.code,
        usageLimit: dbCoupon.usageLimit,
      },
      description: dbCoupon.description || `${dbCoupon.code} discount`,
    };
  }

  // 2. Check supported storefront promotional codes
  if (code === "SHIVURA10" || code === "FESTIVE10") {
    const calculatedDiscount = Math.round(((subtotal * 10) / 100) * 100) / 100;
    return {
      discount: Math.min(subtotal, calculatedDiscount),
      matchedDbCoupon: null,
      description: "10% luxury discount",
    };
  }

  if (code === "WELCOME15") {
    const calculatedDiscount = Math.round(((subtotal * 15) / 100) * 100) / 100;
    return {
      discount: Math.min(subtotal, calculatedDiscount),
      matchedDbCoupon: null,
      description: "15% welcome discount",
    };
  }

  // 3. Reject any unknown/invalid coupon code
  throw new CheckoutError(
    "INVALID_COUPON",
    `Invalid promo code "${code}". Please enter a valid coupon code.`,
    400
  );
}

/**
 * Calculates canonical server-side pricing from cart items and optional coupon.
 * Guaranteed to never rely on client-supplied values.
 */
export async function calculateCanonicalOrderPricing(
  items: PreparedOrderItem[],
  couponCode?: string | null
): Promise<OrderPricingSummary> {
  const subtotal = Math.round(
    items.reduce((sum, item) => sum + item.subtotal, 0) * 100
  ) / 100;

  const shippingFee =
    subtotal >= FREE_SHIPPING_THRESHOLD || items.length === 0
      ? 0
      : STANDARD_SHIPPING_FEE;

  const { discount, description } = await evaluateCouponDiscount(
    couponCode,
    subtotal
  );

  const total = Math.max(
    0,
    Math.round((subtotal - discount + shippingFee) * 100) / 100
  );

  return {
    subtotal,
    discount,
    shippingFee,
    total,
    couponCode: couponCode ? couponCode.trim().toUpperCase() : null,
    couponDescription: description,
  };
}

/**
 * Verifies that the client-submitted cart lines exactly match the authenticated
 * customer's active database cart.
 * Prevents tampering with quantities, product IDs, or variant selections.
 */
function verifySubmittedItemsMatchCart(
  submittedItems: CartLineIntent[],
  cartItems: Array<{ productId: string; variantId: string | null; quantity: number }>
): void {
  if (submittedItems.length !== cartItems.length) {
    throw new CheckoutError(
      "CART_MISMATCH",
      "Submitted checkout items do not match your current cart. Please refresh your cart.",
      400
    );
  }

  const sortFn = (
    a: { productId: string; variantId: string | null },
    b: { productId: string; variantId: string | null }
  ) => {
    const cmp = a.productId.localeCompare(b.productId);
    if (cmp !== 0) return cmp;
    const vA = a.variantId || "";
    const vB = b.variantId || "";
    return vA.localeCompare(vB);
  };

  const sortedSubmitted = [...submittedItems].sort(sortFn);
  const sortedCart = [...cartItems].sort(sortFn);

  for (let i = 0; i < sortedSubmitted.length; i++) {
    const sub = sortedSubmitted[i];
    const cart = sortedCart[i];

    if (
      sub.productId !== cart.productId ||
      (sub.variantId ?? null) !== (cart.variantId ?? null) ||
      sub.quantity !== cart.quantity
    ) {
      throw new CheckoutError(
        "CART_MISMATCH",
        "Submitted checkout items do not match your current cart. Please refresh your cart.",
        400
      );
    }
  }
}

/**
 * Core server-side checkout service.
 *
 * Enforces:
 * 1. Customer authentication and database user verification.
 * 2. Database cart inspection with active product/variant and stock validation.
 * 3. Server-computed immutable pricing (subtotal, shipping, coupon discount, total).
 * 4. Concurrency-safe atomic stock decrements (conditional update on stock >= quantity).
 * 5. Atomic transaction creating Order snapshot, OrderItems, Payment (COD/PENDING),
 *    and purging the customer's database cart upon success.
 * 6. Full database rollback if any validation or stock update fails.
 */
export async function processCheckout(
  userId: string,
  input: CheckoutInput,
  options?: ProcessCheckoutOptions
): Promise<CheckoutResult> {
  if (!userId || typeof userId !== "string") {
    throw new CheckoutError(
      "UNAUTHORIZED",
      "Authentication required to proceed with checkout.",
      401
    );
  }

  // 1. Verify user exists in database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new CheckoutError(
      "USER_NOT_FOUND",
      "Customer account not found.",
      401
    );
  }

  // 2. Fetch customer cart and items from database
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: true,
          variant: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new CheckoutError(
      "EMPTY_CART",
      "Your cart is empty. Please add items before checking out.",
      400
    );
  }

  // Verify submitted cart lines strictly match the database cart
  verifySubmittedItemsMatchCart(input.items, cart.items);

  // 3. Inspect and validate each cart item against database truth
  const preparedItems: PreparedOrderItem[] = [];

  for (const item of cart.items) {
    const { product, variant } = item;

    if (!product || !product.active || !product.published) {
      throw new CheckoutError(
        "PRODUCT_UNAVAILABLE",
        `Item "${product?.name || "Product"}" is currently unavailable for purchase.`,
        400
      );
    }

    if (item.variantId) {
      if (!variant) {
        throw new CheckoutError(
          "VARIANT_UNAVAILABLE",
          `Selected variant for "${product.name}" is no longer available.`,
          400
        );
      }
      if (variant.productId !== product.id) {
        throw new CheckoutError(
          "INVALID_CART_ITEM",
          `Variant does not match product "${product.name}".`,
          400
        );
      }
      if (!variant.active) {
        throw new CheckoutError(
          "VARIANT_INACTIVE",
          `Selected variant "${variant.name}" for "${product.name}" is inactive.`,
          400
        );
      }
    }

    // Derive authoritative price from database
    const unitPrice =
      variant?.price != null ? Number(variant.price) : Number(product.price);

    if (isNaN(unitPrice) || unitPrice <= 0) {
      throw new CheckoutError(
        "INVALID_PRICE",
        `Product "${product.name}" has an invalid price configuration.`,
        500
      );
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new CheckoutError(
        "INVALID_QUANTITY",
        `Invalid quantity for "${product.name}".`,
        400
      );
    }

    // Pre-check stock level:
    // If purchasing a variant, validate variant stock.
    // If purchasing a standalone product (no variant), validate product stock.
    if (variant != null) {
      if (variant.stock < item.quantity) {
        throw new CheckoutError(
          "INSUFFICIENT_STOCK",
          `Insufficient stock for "${product.name} (${variant.name})". Available: ${variant.stock}, Requested: ${item.quantity}.`,
          400
        );
      }
    } else {
      if (product.stock < item.quantity) {
        throw new CheckoutError(
          "INSUFFICIENT_STOCK",
          `Insufficient stock for product "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}.`,
          400
        );
      }
    }

    const itemSubtotal = Math.round(unitPrice * item.quantity * 100) / 100;

    // Build variant info string snapshot
    let variantInfo: string | null = null;
    if (variant) {
      const details = [
        variant.name,
        variant.size ? `Size: ${variant.size}` : null,
        variant.color ? `Color: ${variant.color}` : null,
        variant.design ? `Design: ${variant.design}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      variantInfo = details || variant.name;
    }

    preparedItems.push({
      productId: product.id,
      variantId: item.variantId,
      productName: product.name,
      sku: variant?.sku || product.sku || null,
      variantInfo,
      price: unitPrice,
      quantity: item.quantity,
      subtotal: itemSubtotal,
    });
  }

  // 4. Calculate subtotal and shipping
  const subtotal = Math.round(
    preparedItems.reduce((acc, it) => acc + it.subtotal, 0) * 100
  ) / 100;

  const shippingFee =
    subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;

  // 5. Execute atomic transaction
  return await prisma.$transaction(async (tx) => {
    // 5.0 Row-lock and verify idempotency lease before any business mutation
    if (options?.idempotency) {
      await verifyAndLockIdempotencyRecord(
        tx,
        userId,
        options.idempotency.key,
        options.idempotency.leaseToken,
        options.idempotency.requestHash
      );
    }

    // 5a. Validate and evaluate coupon inside transaction
    const { discount, matchedDbCoupon } = await evaluateCouponDiscount(
      input.couponCode,
      subtotal,
      tx
    );

    const total = Math.max(
      0,
      Math.round((subtotal - discount + shippingFee) * 100) / 100
    );

    // 5b. Prevent overselling: conditional atomic stock decrement
    // Group stock demands to handle multiple cart lines referencing the same variant or product
    const variantDemands = new Map<string, { quantity: number; name: string }>();
    const productDemands = new Map<string, { quantity: number; name: string }>();

    for (const item of preparedItems) {
      if (item.variantId) {
        const currentVar = variantDemands.get(item.variantId);
        variantDemands.set(item.variantId, {
          quantity: (currentVar ? currentVar.quantity : 0) + item.quantity,
          name: item.variantInfo || item.productName,
        });
      }

      const currentProd = productDemands.get(item.productId);
      productDemands.set(item.productId, {
        quantity: (currentProd ? currentProd.quantity : 0) + item.quantity,
        name: item.productName,
      });
    }

    // Atomically decrement variant stock conditionally (must be active and have sufficient stock)
    for (const [variantId, demand] of variantDemands.entries()) {
      const updateResult = await tx.productVariant.updateMany({
        where: {
          id: variantId,
          active: true,
          stock: { gte: demand.quantity },
        },
        data: {
          stock: { decrement: demand.quantity },
        },
      });

      if (updateResult.count === 0) {
        throw new CheckoutError(
          "INSUFFICIENT_STOCK",
          `Stock for variant "${demand.name}" is no longer available.`,
          400
        );
      }
    }

    // Atomically decrement parent product aggregate stock conditionally
    // Ensures parent Product aggregate stock stays synchronized with variant purchases
    for (const [productId, demand] of productDemands.entries()) {
      const updateResult = await tx.product.updateMany({
        where: {
          id: productId,
          stock: { gte: demand.quantity },
        },
        data: {
          stock: { decrement: demand.quantity },
        },
      });

      if (updateResult.count === 0) {
        throw new CheckoutError(
          "INSUFFICIENT_STOCK",
          `Stock for product "${demand.name}" is no longer available.`,
          400
        );
      }
    }

    // 5c. Increment coupon usage count safely under concurrent redemptions
    if (matchedDbCoupon) {
      const updateWhere: Prisma.CouponWhereInput = {
        id: matchedDbCoupon.id,
        active: true,
      };
      if (matchedDbCoupon.usageLimit != null) {
        updateWhere.usageCount = { lt: matchedDbCoupon.usageLimit };
      }

      const couponUpdateResult = await tx.coupon.updateMany({
        where: updateWhere,
        data: {
          usageCount: { increment: 1 },
        },
      });

      if (couponUpdateResult.count === 0) {
        throw new CheckoutError(
          "COUPON_LIMIT_REACHED",
          `Coupon code "${matchedDbCoupon.code}" has reached its maximum redemption limit.`,
          400
        );
      }
    }

    // 5d. Generate collision-resistant unique order number
    const orderNumber = await generateUniqueOrderNumber(tx);

    // 5e. Create Order snapshot
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId,
        idempotencyKey: options?.idempotency?.key || null,
        status: "PENDING",
        paymentStatus: "PENDING",
        subtotal,
        discount,
        shippingFee,
        total,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        shippingAddressLine1: input.shippingAddressLine1,
        shippingAddressLine2: input.shippingAddressLine2 || null,
        shippingCity: input.shippingCity,
        shippingState: input.shippingState,
        shippingPostalCode: input.shippingPostalCode,
        shippingCountry: input.shippingCountry || "India",
      },
    });

    // 5f. Create immutable OrderItem snapshots
    await tx.orderItem.createMany({
      data: preparedItems.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        sku: item.sku,
        variantInfo: item.variantInfo,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
    });

    // 5g. Create Payment record for COD (status PENDING - COD payments are never marked PAID on placement)
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        provider: "COD",
        amount: total,
        status: "PENDING",
      },
    });

    // 5h. Purge customer's database cart items ONLY upon full success
    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    // 5i. Query created items for response payload
    const createdItems = await tx.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });

    const checkoutResult: CheckoutResult = {
      order: {
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
        shippingAddressLine1: order.shippingAddressLine1,
        shippingAddressLine2: order.shippingAddressLine2,
        shippingCity: order.shippingCity,
        shippingState: order.shippingState,
        shippingPostalCode: order.shippingPostalCode,
        shippingCountry: order.shippingCountry,
        createdAt: order.createdAt,
        items: createdItems.map((ci) => ({
          id: ci.id,
          productId: ci.productId,
          productName: ci.productName,
          sku: ci.sku,
          variantInfo: ci.variantInfo,
          price: Number(ci.price),
          quantity: ci.quantity,
          subtotal: Number(ci.subtotal),
        })),
        payment: {
          id: payment.id,
          provider: payment.provider,
          amount: Number(payment.amount),
          status: payment.status,
        },
      },
    };

    // 5j. Transition idempotency record to COMPLETED atomically within this transaction
    if (options?.idempotency) {
      await completeIdempotencyRecord(
        tx,
        userId,
        options.idempotency.key,
        options.idempotency.leaseToken,
        order.id,
        {
          success: true,
          message: "Order placed successfully.",
          data: checkoutResult.order,
        }
      );
    }

    return checkoutResult;
  });
}

/**
 * Standardized HTTP error handler for checkout operations.
 * Shields internal database diagnostics and credentials while providing descriptive client error codes.
 */
export function handleCheckoutApiError(error: unknown): Response {
  if (error instanceof CheckoutError) {
    return Response.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  console.error("Unhandled Checkout API error:", error);

  return Response.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while processing checkout.",
      },
    },
    { status: 500 }
  );
}
