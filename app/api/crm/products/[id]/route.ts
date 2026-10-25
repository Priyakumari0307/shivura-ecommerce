import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmWriteRateLimit, checkCrmReadRateLimit } from "@/lib/rateLimit";
import { updateProductSchema } from "@/lib/validation/product";
import { revalidateStorefront } from "@/lib/revalidate";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/crm/products/[id]
 *
 * Fetches complete product details by ID for the CRM editor,
 * including images, variants, category links, occasion links, and order statistics.
 * Rate-limited to 60 req/min per verified admin (fail-open).
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyAdminSession(_request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        { success: false, error: "Unauthenticated: Administrative login required" },
        { status: 401 }
      );
    }

    if (auth.status === "forbidden") {
      return Response.json(
        { success: false, error: "Forbidden: Customer accounts do not have CRM permissions" },
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
        { success: false, error: "Invalid product ID parameter" },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
          ],
        },
        variants: {
          orderBy: { createdAt: "asc" },
        },
        categories: {
          select: {
            category: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        occasions: {
          select: {
            occasion: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        _count: {
          select: {
            orderItems: true,
            reviews: true,
          },
        },
      },
    });

    if (!product) {
      return Response.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        shortDescription: product.shortDescription,
        price: Number(product.price),
        originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
        pricePrefix: product.pricePrefix,
        sku: product.sku,
        stock: product.stock,
        rating: product.rating,
        reviewCount: product.reviewCount,
        isNew: product.isNew,
        badge: product.badge,
        active: product.active,
        published: product.published,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        images: product.images.map((img) => ({
          id: img.id,
          url: img.url,
          publicId: img.publicId,
          altText: img.altText,
          sortOrder: img.sortOrder,
          isPrimary: img.isPrimary,
        })),
        variants: product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          size: v.size,
          color: v.color,
          design: v.design,
          sku: v.sku,
          price: v.price ? Number(v.price) : null,
          stock: v.stock,
          active: v.active,
        })),
        categories: product.categories.map((c) => c.category),
        categoryIds: product.categories.map((c) => c.category.id),
        occasions: product.occasions.map((o) => o.occasion),
        occasionIds: product.occasions.map((o) => o.occasion.id),
        ordersCount: product._count.orderItems,
        hasOrders: product._count.orderItems > 0,
        reviewsCount: product._count.reviews,
      },
    });
  } catch (error) {
    console.error("[CRM Product GET by ID Error]:", error);
    return Response.json(
      { success: false, error: "Failed to fetch product details" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/crm/products/[id]
 *
 * Full or partial relational update for an existing product.
 *
 * Behavior for arrays:
 * - If `images` is explicitly provided: replaces previous product images. If omitted, leaves images unchanged.
 * - If `variants` is explicitly provided: replaces previous product variants. If omitted, leaves variants unchanged.
 * - If `categoryIds` is explicitly provided: replaces category join records. If omitted, leaves categories unchanged.
 * - If `occasionIds` is explicitly provided: replaces occasion join records. If omitted, leaves occasions unchanged.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        { success: false, error: "Unauthenticated: Administrative login required" },
        { status: 401 }
      );
    }

    if (auth.status === "forbidden") {
      return Response.json(
        { success: false, error: "Forbidden: Customer accounts do not have CRM permissions" },
        { status: 403 }
      );
    }

    // Rate-limit CRM mutations (60 req/min per verified admin)
    const rateLimit = await checkCrmWriteRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return Response.json(
        { success: false, error: "Invalid product ID parameter" },
        { status: 400 }
      );
    }

    // Check existing product
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      select: { id: true, slug: true, sku: true },
    });

    if (!existingProduct) {
      return Response.json(
        { success: false, error: "Product not found" },
        { status: 404 }
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

    const validation = updateProductSchema.safeParse(bodyJson);
    if (!validation.success) {
      return Response.json(
        {
          success: false,
          error: "Validation failed",
          issues: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Check slug conflict if slug was provided and changed
    if (data.slug && data.slug !== existingProduct.slug) {
      const slugConflict = await prisma.product.findFirst({
        where: {
          slug: data.slug,
          id: { not: id },
        },
        select: { id: true },
      });

      if (slugConflict) {
        return Response.json(
          {
            success: false,
            error: `Another product with slug "${data.slug}" already exists.`,
            conflict: "slug",
          },
          { status: 409 }
        );
      }
    }

    // Check SKU conflict if SKU was provided and changed
    if (data.sku && data.sku !== existingProduct.sku) {
      const skuConflict = await prisma.product.findFirst({
        where: {
          sku: data.sku,
          id: { not: id },
        },
        select: { id: true },
      });

      if (skuConflict) {
        return Response.json(
          {
            success: false,
            error: `Another product with SKU "${data.sku}" already exists.`,
            conflict: "sku",
          },
          { status: 409 }
        );
      }
    }

    // Validate variant SKUs if variants array is provided
    if (data.variants && data.variants.length > 0) {
      const variantSkus = new Set<string>();
      for (const variant of data.variants) {
        if (variant.sku) {
          const upperSku = variant.sku.toUpperCase();
          if (variantSkus.has(upperSku)) {
            return Response.json(
              {
                success: false,
                error: `Duplicate variant SKU "${variant.sku}" provided in update.`,
                conflict: "variant_sku",
              },
              { status: 400 }
            );
          }
          variantSkus.add(upperSku);

          // Check if variant SKU belongs to another product's variant
          const existingVariantSku = await prisma.productVariant.findFirst({
            where: {
              sku: variant.sku,
              productId: { not: id },
            },
            select: { id: true },
          });

          if (existingVariantSku) {
            return Response.json(
              {
                success: false,
                error: `A variant with SKU "${variant.sku}" belongs to another product.`,
                conflict: "variant_sku",
              },
              { status: 409 }
            );
          }
        }
      }
    }

    // Validate category IDs if provided
    if (data.categoryIds && data.categoryIds.length > 0) {
      const existingCats = await prisma.category.findMany({
        where: { id: { in: data.categoryIds } },
        select: { id: true },
      });
      if (existingCats.length !== data.categoryIds.length) {
        return Response.json(
          {
            success: false,
            error: "One or more selected categories do not exist.",
          },
          { status: 400 }
        );
      }
    }

    // Validate occasion IDs if provided
    if (data.occasionIds && data.occasionIds.length > 0) {
      const existingOccs = await prisma.occasion.findMany({
        where: { id: { in: data.occasionIds } },
        select: { id: true },
      });
      if (existingOccs.length !== data.occasionIds.length) {
        return Response.json(
          {
            success: false,
            error: "One or more selected occasions do not exist.",
          },
          { status: 400 }
        );
      }
    }

    // Execute safe update transaction
    await prisma.$transaction(async (tx) => {
      // Step 3 Unified Inventory: Synchronize variants and calculate authoritative stock.
      // If variants exist, Product.stock is strictly the sum of active variants' stock.
      // If no variants exist (standalone), use data.stock. Never trust a client-supplied aggregate.
      let authoritativeStock: number | undefined = undefined;

      if (Array.isArray(data.variants)) {
        await tx.productVariant.deleteMany({ where: { productId: id } });

        if (data.variants.length > 0) {
          await tx.productVariant.createMany({
            data: data.variants.map((v) => ({
              productId: id,
              name: v.name,
              size: v.size || null,
              color: v.color || null,
              design: v.design || null,
              sku: v.sku || null,
              price: v.price || null,
              stock: v.stock,
              active: v.active,
            })),
          });

          authoritativeStock = data.variants
            .filter((v) => v.active !== false)
            .reduce((sum, v) => sum + v.stock, 0);
        } else {
          // All variants removed -> product becomes standalone
          authoritativeStock = data.stock !== undefined ? data.stock : 0;
        }
      } else {
        // Variants were not supplied in this update payload. Check if product currently has variants.
        const existingVariants = await tx.productVariant.findMany({
          where: { productId: id },
          select: { stock: true, active: true },
        });

        if (existingVariants.length > 0) {
          // Authoritative rollup: recompute from existing active variants
          authoritativeStock = existingVariants
            .filter((v) => v.active)
            .reduce((sum, v) => sum + v.stock, 0);
        } else if (data.stock !== undefined) {
          // Standalone product update
          authoritativeStock = data.stock;
        }
      }

      // 1. Update scalar product fields
      await tx.product.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.slug !== undefined ? { slug: data.slug } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.shortDescription !== undefined ? { shortDescription: data.shortDescription } : {}),
          ...(data.price !== undefined ? { price: data.price } : {}),
          ...(data.originalPrice !== undefined ? { originalPrice: data.originalPrice } : {}),
          ...(data.pricePrefix !== undefined ? { pricePrefix: data.pricePrefix } : {}),
          ...(data.sku !== undefined ? { sku: data.sku } : {}),
          ...(authoritativeStock !== undefined ? { stock: authoritativeStock } : {}),
          ...(data.isNew !== undefined ? { isNew: data.isNew } : {}),
          ...(data.badge !== undefined ? { badge: data.badge } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
          ...(data.published !== undefined ? { published: data.published } : {}),
        },
      });

      // 2. Synchronize images if explicitly supplied
      if (Array.isArray(data.images)) {
        await tx.productImage.deleteMany({ where: { productId: id } });

        if (data.images.length > 0) {
          const hasPrimary = data.images.some((i) => i.isPrimary);
          await tx.productImage.createMany({
            data: data.images.map((img, idx) => ({
              productId: id,
              url: img.url,
              publicId: img.publicId || null,
              altText: img.altText || (data.name || "Product image"),
              sortOrder: img.sortOrder ?? idx,
              isPrimary: hasPrimary ? img.isPrimary : idx === 0,
            })),
          });
        }
      }

      // (Variants already synchronized above)

      // 4. Synchronize category join records if explicitly supplied
      if (Array.isArray(data.categoryIds)) {
        await tx.productCategory.deleteMany({ where: { productId: id } });

        if (data.categoryIds.length > 0) {
          await tx.productCategory.createMany({
            data: data.categoryIds.map((catId) => ({
              productId: id,
              categoryId: catId,
            })),
          });
        }
      }

      // 5. Synchronize occasion join records if explicitly supplied
      if (Array.isArray(data.occasionIds)) {
        await tx.productOccasion.deleteMany({ where: { productId: id } });

        if (data.occasionIds.length > 0) {
          await tx.productOccasion.createMany({
            data: data.occasionIds.map((occId) => ({
              productId: id,
              occasionId: occId,
            })),
          });
        }
      }
    });

    // Fetch refreshed complete product
    const updatedProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
          ],
        },
        variants: {
          orderBy: { createdAt: "asc" },
        },
        categories: {
          select: {
            category: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        occasions: {
          select: {
            occasion: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        _count: {
          select: { orderItems: true },
        },
      },
    });

    // Revalidate storefront cache
    revalidateStorefront(existingProduct.slug);
    if (updatedProduct?.slug && updatedProduct.slug !== existingProduct.slug) {
      revalidateStorefront(updatedProduct.slug);
    }

    return Response.json({
      success: true,
      message: "Product updated successfully",
      data: {
        ...updatedProduct,
        price: Number(updatedProduct?.price),
        originalPrice: updatedProduct?.originalPrice ? Number(updatedProduct.originalPrice) : null,
        categories: updatedProduct?.categories.map((c) => c.category) || [],
        occasions: updatedProduct?.occasions.map((o) => o.occasion) || [],
        hasOrders: (updatedProduct?._count.orderItems || 0) > 0,
      },
    });
  } catch (error) {
    console.error("[CRM Product PUT Error]:", error);
    return Response.json(
      { success: false, error: "Failed to update product" },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;

/**
 * DELETE /api/crm/products/[id]
 *
 * Safe deletion endpoint for products.
 *
 * Safety policy:
 * - If order items reference the product, deletion is blocked to preserve customer purchase history.
 *   The administrator is instructed to archive the product instead.
 * - If no orders reference the product, cascading deletion removes variants, images, and taxonomy joins.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyAdminSession(_request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        { success: false, error: "Unauthenticated: Administrative login required" },
        { status: 401 }
      );
    }

    if (auth.status === "forbidden") {
      return Response.json(
        { success: false, error: "Forbidden: Customer accounts do not have CRM permissions" },
        { status: 403 }
      );
    }

    // Rate-limit CRM mutations (60 req/min per verified admin)
    const rateLimit = await checkCrmWriteRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return Response.json(
        { success: false, error: "Invalid product ID parameter" },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    });

    if (!product) {
      return Response.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    // Inspect order history
    if (product._count.orderItems > 0) {
      return Response.json(
        {
          success: false,
          error: `Cannot delete product "${product.name}". It is referenced by ${product._count.orderItems} customer order item(s). Please archive the product instead to preserve sales and fulfillment records.`,
          hasOrders: true,
          orderCount: product._count.orderItems,
        },
        { status: 409 }
      );
    }

    // Safe deletion (cascades images, variants, category links, occasion links)
    await prisma.product.delete({
      where: { id },
    });

    // Revalidate storefront cache
    revalidateStorefront(product.slug);

    return Response.json({
      success: true,
      message: `Product "${product.name}" deleted successfully`,
    });
  } catch (error) {
    console.error("[CRM Product DELETE Error]:", error);
    return Response.json(
      { success: false, error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
