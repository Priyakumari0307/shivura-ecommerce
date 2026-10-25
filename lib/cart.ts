import "server-only";
import { prisma } from "@/lib/prisma";

export class CartError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = "CartError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface FormattedCartItemVariant {
  id: string;
  name: string;
  size: string | null;
  color: string | null;
  design: string | null;
  sku: string | null;
  price: number | null;
  stock: number;
}

export interface FormattedCartItem {
  id: string; // cartItemId
  productId: string;
  name: string;
  slug: string;
  href: string;
  imageSrc: string;
  price: number;
  originalPrice: number | null;
  pricePrefix: string;
  quantity: number;
  itemTotal: number;
  sku: string | null;
  stock: number;
  isAvailable: boolean;
  variantId: string | null;
  variant: FormattedCartItemVariant | null;
}

export interface FormattedCart {
  id: string; // cartId
  userId: string | null;
  items: FormattedCartItem[];
  itemCount: number;
  subtotal: number;
  currency: string;
}

export interface AddCartItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        include: {
          images: {
            orderBy: [
              { isPrimary: "desc" as const },
              { sortOrder: "asc" as const },
            ],
            take: 1,
            select: { url: true },
          },
        },
      },
      variant: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
};

type CartWithRelations = NonNullable<Awaited<ReturnType<typeof fetchCartRaw>>>;

async function fetchCartRaw(userId: string) {
  return prisma.cart.findUnique({
    where: { userId },
    include: CART_INCLUDE,
  });
}

/**
 * Transforms a raw Prisma Cart record with relations into a safe, client-ready DTO.
 * Computes live prices, item totals, and subtotal directly from database records.
 */
export function formatCart(cart: CartWithRelations): FormattedCart {
  let subtotal = 0;
  let itemCount = 0;

  const items: FormattedCartItem[] = cart.items.map((item) => {
    const product = item.product;
    const variant = item.variant;

    // Use variant price if defined; otherwise fallback to base product price
    const unitPrice =
      variant?.price != null ? Number(variant.price) : Number(product.price);
    const itemTotal = unitPrice * item.quantity;
    subtotal += itemTotal;
    itemCount += item.quantity;

    const primaryImg = product.images?.[0]?.url || "/images/Product1.png";
    const sku = variant?.sku || product.sku || null;
    const stock = variant != null ? variant.stock : product.stock;
    const isAvailable =
      product.active && product.published && (variant ? variant.active : true);

    return {
      id: item.id,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      href: `/shop/${product.slug}`,
      imageSrc: primaryImg,
      price: unitPrice,
      originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
      pricePrefix: product.pricePrefix || "₹",
      quantity: item.quantity,
      itemTotal: Math.round(itemTotal * 100) / 100,
      sku,
      stock,
      isAvailable,
      variantId: item.variantId,
      variant: variant
        ? {
            id: variant.id,
            name: variant.name,
            size: variant.size,
            color: variant.color,
            design: variant.design,
            sku: variant.sku,
            price: variant.price != null ? Number(variant.price) : null,
            stock: variant.stock,
          }
        : null,
    };
  });

  return {
    id: cart.id,
    userId: cart.userId,
    items,
    itemCount,
    subtotal: Math.round(subtotal * 100) / 100,
    currency: "INR",
  };
}

/**
 * Retrieves the cart for a user or atomically creates a new one if it does not yet exist.
 */
export async function getOrCreateUserCart(userId: string): Promise<FormattedCart> {
  let cart = await fetchCartRaw(userId);

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: CART_INCLUDE,
    });
  }

  return formatCart(cart);
}

/**
 * Adds an item to the user's cart or increments quantity if the product+variant already exists.
 * Strictly verifies product and variant existence, active status, relationship, and inventory.
 */
export async function addItemToUserCart(
  userId: string,
  input: AddCartItemInput
): Promise<FormattedCart> {
  const { productId, variantId, quantity } = input;

  if (!productId || typeof productId !== "string") {
    throw new CartError("INVALID_PRODUCT_ID", "Product ID is required", 400);
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new CartError(
      "INVALID_QUANTITY",
      "Quantity must be a positive integer",
      400
    );
  }

  // 1. Validate Product
  const product = await prisma.product.findUnique({
    where: { id: productId.trim() },
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      active: true,
      published: true,
    },
  });

  if (!product || !product.active || !product.published) {
    throw new CartError("PRODUCT_NOT_FOUND", "Product is not available", 404);
  }

  // 2. Validate Variant (if specified)
  let variant = null;
  const cleanVariantId = variantId ? variantId.trim() : null;

  if (cleanVariantId) {
    variant = await prisma.productVariant.findUnique({
      where: { id: cleanVariantId },
    });

    if (!variant) {
      throw new CartError("VARIANT_NOT_FOUND", "Product variant not found", 404);
    }

    if (variant.productId !== product.id) {
      throw new CartError(
        "INVALID_VARIANT",
        "Variant does not belong to specified product",
        400
      );
    }

    if (!variant.active) {
      throw new CartError(
        "VARIANT_INACTIVE",
        "Selected variant is currently inactive",
        400
      );
    }
  }

  // 3. Stock check
  const availableStock = variant != null ? variant.stock : product.stock;
  if (availableStock <= 0) {
    const itemName = variant ? `${product.name} (${variant.name})` : product.name;
    throw new CartError(
      "INSUFFICIENT_STOCK",
      `"${itemName}" is currently out of stock.`,
      400
    );
  }

  if (quantity > availableStock) {
    throw new CartError(
      "INSUFFICIENT_STOCK",
      `Requested quantity (${quantity}) exceeds available stock (${availableStock}).`,
      400
    );
  }

  // 4. Ensure user cart exists
  let cart = await prisma.cart.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      select: { id: true },
    });
  }

  // 5. Look for matching item by logical key: (cartId, productId, variantId)
  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: product.id,
      variantId: cleanVariantId,
    },
  });

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;
    if (availableStock <= 0) {
      const itemName = variant ? `${product.name} (${variant.name})` : product.name;
      throw new CartError(
        "INSUFFICIENT_STOCK",
        `"${itemName}" is currently out of stock.`,
        400
      );
    }

    if (newQuantity > availableStock) {
      throw new CartError(
        "INSUFFICIENT_STOCK",
        `Cannot add ${quantity} more. Stock limit of ${availableStock} reached.`,
        400
      );
    }

    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        variantId: cleanVariantId,
        quantity,
      },
    });
  }

  // Return updated full cart
  const updatedCart = await fetchCartRaw(userId);
  if (!updatedCart) {
    throw new CartError("CART_ERROR", "Failed to retrieve updated cart", 500);
  }

  return formatCart(updatedCart);
}

/**
 * Updates quantity of a specific cart item belonging to the authenticated user.
 * Deletes item if quantity <= 0.
 */
export async function updateCartItemQuantity(
  userId: string,
  itemId: string,
  quantity: number
): Promise<FormattedCart> {
  if (!itemId || typeof itemId !== "string") {
    throw new CartError("INVALID_ITEM_ID", "Cart item ID is required", 400);
  }

  if (!Number.isInteger(quantity)) {
    throw new CartError("INVALID_QUANTITY", "Quantity must be an integer", 400);
  }

  // 1. Verify item exists and belongs to the authenticated user's cart
  const existingItem = await prisma.cartItem.findUnique({
    where: { id: itemId.trim() },
    include: {
      cart: true,
      product: true,
      variant: true,
    },
  });

  if (!existingItem || existingItem.cart.userId !== userId) {
    throw new CartError("ITEM_NOT_FOUND", "Cart item not found", 404);
  }

  // 2. Quantity <= 0 implies deletion
  if (quantity <= 0) {
    await prisma.cartItem.delete({
      where: { id: existingItem.id },
    });
  } else {
    // 3. Stock validation
    const availableStock = existingItem.variant
      ? existingItem.variant.stock
      : existingItem.product.stock;

    if (availableStock <= 0) {
      const itemName = existingItem.variant
        ? `${existingItem.product.name} (${existingItem.variant.name})`
        : existingItem.product.name;
      throw new CartError(
        "INSUFFICIENT_STOCK",
        `"${itemName}" is currently out of stock.`,
        400
      );
    }

    if (quantity > availableStock) {
      throw new CartError(
        "INSUFFICIENT_STOCK",
        `Requested quantity (${quantity}) exceeds available stock (${availableStock}).`,
        400
      );
    }

    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity },
    });
  }

  // Return updated full cart
  const updatedCart = await fetchCartRaw(userId);
  if (!updatedCart) {
    throw new CartError("CART_ERROR", "Failed to retrieve updated cart", 500);
  }

  return formatCart(updatedCart);
}

/**
 * Deletes a single cart item, ensuring ownership by the authenticated user.
 */
export async function removeCartItem(
  userId: string,
  itemId: string
): Promise<FormattedCart> {
  if (!itemId || typeof itemId !== "string") {
    throw new CartError("INVALID_ITEM_ID", "Cart item ID is required", 400);
  }

  const existingItem = await prisma.cartItem.findUnique({
    where: { id: itemId.trim() },
    include: { cart: true },
  });

  if (!existingItem || existingItem.cart.userId !== userId) {
    throw new CartError("ITEM_NOT_FOUND", "Cart item not found", 404);
  }

  await prisma.cartItem.delete({
    where: { id: existingItem.id },
  });

  const updatedCart = await fetchCartRaw(userId);
  if (!updatedCart) {
    throw new CartError("CART_ERROR", "Failed to retrieve updated cart", 500);
  }

  return formatCart(updatedCart);
}

/**
 * Clears all items from the authenticated user's cart without destroying the Cart container.
 */
export async function clearUserCart(userId: string): Promise<FormattedCart> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (cart) {
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });
  }

  const updatedCart = await fetchCartRaw(userId);
  if (!updatedCart) {
    return getOrCreateUserCart(userId);
  }

  return formatCart(updatedCart);
}

/**
 * Standardized error response handler for cart API routes.
 * Ensures internal database connection strings, Prisma errors, and stack traces are never exposed.
 */
export function handleCartApiError(error: unknown): Response {
  if (error instanceof CartError) {
    return Response.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  console.error("Unhandled Cart API error:", error);

  return Response.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while processing the cart request.",
      },
    },
    { status: 500 }
  );
}
