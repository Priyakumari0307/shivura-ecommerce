import { NextRequest } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmWriteRateLimit, checkCrmReadRateLimit } from "@/lib/rateLimit";
import {
  createProductSchema,
  slugify,
  generateSku,
} from "@/lib/validation/product";
import { revalidateStorefront } from "@/lib/revalidate";

/**
 * Finds a unique slug by appending incremental suffixes if collisions exist.
 */
async function findAvailableSlug(base: string, excludeProductId?: string): Promise<string> {
  const cleanBase = slugify(base) || "product";
  let candidate = cleanBase;
  let counter = 1;

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || (excludeProductId && existing.id === excludeProductId)) {
      return candidate;
    }
    counter++;
    candidate = `${cleanBase}-${counter}`;
  }
}

/**
 * Finds a unique SKU by appending incremental suffixes if collisions exist.
 */
async function findAvailableSku(base: string, excludeProductId?: string): Promise<string> {
  const cleanBase = generateSku(base);
  let candidate = cleanBase;
  let counter = 1;

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { sku: candidate },
      select: { id: true },
    });

    if (!existing || (excludeProductId && existing.id === excludeProductId)) {
      return candidate;
    }
    counter++;
    candidate = `${cleanBase}-${counter}`;
  }
}

/**
 * GET /api/crm/products
 *
 * Paginated product listing for Shivura CRM administrative catalog.
 * Supports searching by name/slug/sku, filtering by status, category, and occasion.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        { success: false, error: "Unauthenticated: Administrative login required to access CRM products" },
        { status: 401 }
      );
    }

    if (auth.status === "forbidden") {
      return Response.json(
        { success: false, error: "Forbidden: Customer accounts do not have CRM permissions" },
        { status: 403 }
      );
    }

    // Rate limit CRM administrative reads (60 req/min per verified admin, fails open on store outage)
    const rateLimit = await checkCrmReadRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim().toLowerCase() || "all";
    const category = searchParams.get("category")?.trim();
    const occasion = searchParams.get("occasion")?.trim();
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

    // Build where clause
    const where: Prisma.ProductWhereInput = {};

    // Search filter across name, slug, or SKU
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    // Status filter
    switch (status) {
      case "published":
        where.published = true;
        break;
      case "draft":
        where.published = false;
        break;
      case "active":
        where.active = true;
        break;
      case "archived":
        where.active = false;
        break;
      case "low_stock":
        where.stock = { lte: 5, gt: 0 };
        break;
      case "out_of_stock":
        where.stock = { lte: 0 };
        break;
      case "all":
      default:
        // No filter applied for 'all'
        break;
    }

    // Category filter
    if (category && category !== "all") {
      where.categories = {
        some: {
          OR: [
            { categoryId: category },
            { category: { slug: category.toLowerCase() } },
          ],
        },
      };
    }

    // Occasion filter
    if (occasion && occasion !== "all") {
      where.occasions = {
        some: {
          OR: [
            { occasionId: occasion },
            { occasion: { slug: occasion.toLowerCase() } },
          ],
        },
      };
    }

    // Sort order
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
    switch (sort) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "price-asc":
        orderBy = { price: "asc" };
        break;
      case "price-desc":
        orderBy = { price: "desc" };
        break;
      case "stock-asc":
        orderBy = { stock: "asc" };
        break;
      case "stock-desc":
        orderBy = { stock: "desc" };
        break;
      case "name-asc":
        orderBy = { name: "asc" };
        break;
      case "name-desc":
        orderBy = { name: "desc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    const skip = (page - 1) * limit;

    const [
      total,
      products,
      totalCatalog,
      publishedCount,
      draftCount,
      lowStockCount,
      outOfStockCount,
    ] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          price: true,
          originalPrice: true,
          pricePrefix: true,
          stock: true,
          rating: true,
          reviewCount: true,
          isNew: true,
          badge: true,
          active: true,
          published: true,
          createdAt: true,
          updatedAt: true,
          images: {
            select: {
              id: true,
              url: true,
              publicId: true,
              altText: true,
              isPrimary: true,
              sortOrder: true,
            },
            orderBy: [
              { isPrimary: "desc" },
              { sortOrder: "asc" },
            ],
          },
          categories: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          occasions: {
            select: {
              occasion: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          _count: {
            select: {
              images: true,
              variants: true,
              orderItems: true,
            },
          },
        },
      }),
      prisma.product.count(),
      prisma.product.count({ where: { published: true } }),
      prisma.product.count({ where: { published: false } }),
      prisma.product.count({ where: { stock: { lte: 5, gt: 0 } } }),
      prisma.product.count({ where: { stock: { lte: 0 } } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const formattedProducts = products.map((product) => {
      const primaryImage =
        product.images.find((img) => img.isPrimary) || product.images[0] || null;

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        price: Number(product.price),
        originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
        pricePrefix: product.pricePrefix,
        stock: product.stock,
        rating: product.rating,
        reviewCount: product.reviewCount,
        isNew: product.isNew,
        badge: product.badge,
        active: product.active,
        published: product.published,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        primaryImage: primaryImage
          ? {
              id: primaryImage.id,
              url: primaryImage.url,
              publicId: primaryImage.publicId,
              altText: primaryImage.altText,
            }
          : null,
        imagesCount: product._count.images,
        variantsCount: product._count.variants,
        ordersCount: product._count.orderItems,
        hasOrders: product._count.orderItems > 0,
        categories: product.categories.map((c) => c.category),
        occasions: product.occasions.map((o) => o.occasion),
      };
    });

    return Response.json({
      success: true,
      data: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      },
      summary: {
        total: totalCatalog,
        published: publishedCount,
        draft: draftCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
      },
    });
  } catch (error) {
    console.error("[CRM Products GET Error]:", error);
    return Response.json(
      { success: false, error: "Failed to retrieve CRM products" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crm/products
 *
 * Creates a new product with images, variants, category links, and occasion links
 * inside an atomic database transaction.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        { success: false, error: "Unauthenticated: Administrative login required to create products" },
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

    let bodyJson: unknown;
    try {
      bodyJson = await request.json();
    } catch {
      return Response.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const validation = createProductSchema.safeParse(bodyJson);
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

    // Resolve or generate slug
    let finalSlug: string;
    if (data.slug) {
      const existingSlug = await prisma.product.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });
      if (existingSlug) {
        return Response.json(
          {
            success: false,
            error: `A product with slug "${data.slug}" already exists. Please choose a unique slug.`,
            conflict: "slug",
          },
          { status: 409 }
        );
      }
      finalSlug = data.slug;
    } else {
      finalSlug = await findAvailableSlug(data.name);
    }

    // Resolve or generate SKU
    let finalSku: string;
    if (data.sku) {
      const existingSku = await prisma.product.findUnique({
        where: { sku: data.sku },
        select: { id: true },
      });
      if (existingSku) {
        return Response.json(
          {
            success: false,
            error: `A product with SKU "${data.sku}" already exists. Please choose a unique SKU.`,
            conflict: "sku",
          },
          { status: 409 }
        );
      }
      finalSku = data.sku;
    } else {
      finalSku = await findAvailableSku(finalSlug);
    }

    // Validate variant SKUs for uniqueness
    if (data.variants.length > 0) {
      const variantSkus = new Set<string>();
      for (const variant of data.variants) {
        if (variant.sku) {
          const upperSku = variant.sku.toUpperCase();
          if (upperSku === finalSku.toUpperCase()) {
            return Response.json(
              {
                success: false,
                error: `Variant SKU "${variant.sku}" cannot be identical to the parent product SKU.`,
                conflict: "variant_sku",
              },
              { status: 409 }
            );
          }
          if (variantSkus.has(upperSku)) {
            return Response.json(
              {
                success: false,
                error: `Duplicate variant SKU "${variant.sku}" provided in request.`,
                conflict: "variant_sku",
              },
              { status: 400 }
            );
          }
          variantSkus.add(upperSku);

          // Check if variant SKU already exists in database
          const existingVariantSku = await prisma.productVariant.findUnique({
            where: { sku: variant.sku },
            select: { id: true },
          });
          if (existingVariantSku) {
            return Response.json(
              {
                success: false,
                error: `A variant with SKU "${variant.sku}" already exists in the database.`,
                conflict: "variant_sku",
              },
              { status: 409 }
            );
          }
        }
      }
    }

    // Validate category IDs
    if (data.categoryIds.length > 0) {
      const existingCats = await prisma.category.findMany({
        where: { id: { in: data.categoryIds } },
        select: { id: true },
      });
      if (existingCats.length !== data.categoryIds.length) {
        return Response.json(
          {
            success: false,
            error: "One or more selected categories do not exist in the database.",
          },
          { status: 400 }
        );
      }
    }

    // Validate occasion IDs
    if (data.occasionIds.length > 0) {
      const existingOccs = await prisma.occasion.findMany({
        where: { id: { in: data.occasionIds } },
        select: { id: true },
      });
      if (existingOccs.length !== data.occasionIds.length) {
        return Response.json(
          {
            success: false,
            error: "One or more selected occasions do not exist in the database.",
          },
          { status: 400 }
        );
      }
    }

    // Ensure at least one image is primary if images exist
    const imagesToCreate = data.images.map((img, idx) => {
      const hasPrimaryInArray = data.images.some((i) => i.isPrimary);
      const isPrimary = hasPrimaryInArray ? img.isPrimary : idx === 0;
      return {
        url: img.url,
        publicId: img.publicId || null,
        altText: img.altText || data.name,
        sortOrder: img.sortOrder ?? idx,
        isPrimary,
      };
    });

    // Execute atomic transaction
    const newProduct = await prisma.$transaction(async (tx) => {
      // Step 3 Unified Inventory: If variants exist, Product.stock is strictly the sum of active variants' stock.
      // Standalone products without variants use data.stock. Never trust a client-supplied aggregate.
      const authoritativeStock =
        data.variants.length > 0
          ? data.variants
              .filter((v) => v.active !== false)
              .reduce((sum, v) => sum + v.stock, 0)
          : data.stock;

      // 1. Create main Product
      const product = await tx.product.create({
        data: {
          name: data.name,
          slug: finalSlug,
          description: data.description || null,
          shortDescription: data.shortDescription || null,
          price: data.price,
          originalPrice: data.originalPrice || null,
          pricePrefix: data.pricePrefix || null,
          sku: finalSku,
          stock: authoritativeStock,
          isNew: data.isNew,
          badge: data.badge || null,
          active: data.active,
          published: data.published,
        },
      });

      // 2. Create Images
      if (imagesToCreate.length > 0) {
        await tx.productImage.createMany({
          data: imagesToCreate.map((img) => ({
            productId: product.id,
            url: img.url,
            publicId: img.publicId,
            altText: img.altText,
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
          })),
        });
      }

      // 3. Create Variants
      if (data.variants.length > 0) {
        await tx.productVariant.createMany({
          data: data.variants.map((v) => ({
            productId: product.id,
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
      }

      // 4. Link Categories
      if (data.categoryIds.length > 0) {
        await tx.productCategory.createMany({
          data: data.categoryIds.map((catId) => ({
            productId: product.id,
            categoryId: catId,
          })),
        });
      }

      // 5. Link Occasions
      if (data.occasionIds.length > 0) {
        await tx.productOccasion.createMany({
          data: data.occasionIds.map((occId) => ({
            productId: product.id,
            occasionId: occId,
          })),
        });
      }

      return product;
    });

    // Fetch complete created product with relations
    const completeProduct = await prisma.product.findUnique({
      where: { id: newProduct.id },
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
      },
    });

    // Revalidate storefront static and ISR cache
    revalidateStorefront(finalSlug);

    return Response.json(
      {
        success: true,
        message: "Product created successfully",
        data: {
          ...completeProduct,
          price: Number(completeProduct?.price),
          originalPrice: completeProduct?.originalPrice ? Number(completeProduct.originalPrice) : null,
          categories: completeProduct?.categories.map((c) => c.category) || [],
          occasions: completeProduct?.occasions.map((o) => o.occasion) || [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[CRM Product POST Error]:", error);
    return Response.json(
      { success: false, error: "Failed to create product" },
      { status: 500 }
    );
  }
}
