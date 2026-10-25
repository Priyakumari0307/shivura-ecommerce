import { NextRequest } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { checkPublicCatalogRateLimit } from "@/lib/rateLimit";

/**
 * GET /api/products
 *
 * Query parameters:
 * - search: case-insensitive search matching product name
 * - category: filter by Category slug (via ProductCategory relation)
 * - occasion: filter by Occasion slug (via ProductOccasion relation)
 * - sort: 'price-low' | 'price-high' | 'newest' | 'rating' (default: 'newest')
 * - page: 1-indexed page number (default: 1)
 * - limit: items per page (default: 12)
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit public catalog reads (60 req/min per trusted IP, fails open on store outage)
    const rateLimit = await checkPublicCatalogRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const { searchParams } = request.nextUrl;

    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const occasion = searchParams.get("occasion");
    const sort = searchParams.get("sort");
    const rawPage = searchParams.get("page");
    const rawLimit = searchParams.get("limit");

    // Validate page
    let page = 1;
    if (rawPage !== null) {
      const parsedPage = parseInt(rawPage, 10);
      if (isNaN(parsedPage) || parsedPage < 1) {
        return Response.json(
          {
            success: false,
            error: "Invalid 'page' query parameter. Page must be a positive integer.",
          },
          { status: 400 }
        );
      }
      page = parsedPage;
    }

    // Validate limit
    let limit = 12;
    if (rawLimit !== null) {
      const parsedLimit = parseInt(rawLimit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return Response.json(
          {
            success: false,
            error: "Invalid 'limit' query parameter. Limit must be a positive integer.",
          },
          { status: 400 }
        );
      }
      limit = Math.min(parsedLimit, 100);
    }

    // Validate sort
    const validSorts = ["price-low", "price-high", "newest", "rating"];
    if (sort && !validSorts.includes(sort)) {
      return Response.json(
        {
          success: false,
          error: `Invalid 'sort' query parameter. Supported values: ${validSorts.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // Base filter: only public active products
    const where: Prisma.ProductWhereInput = {
      active: true,
      published: true,
    };

    // Case-insensitive search on product name
    if (search && search.trim()) {
      where.name = {
        contains: search.trim(),
        mode: "insensitive",
      };
    }

    // Category filter via ProductCategory relation
    if (category && category.trim()) {
      const catSlug = category.trim().toLowerCase();
      if (catSlug !== "all") {
        where.categories = {
          some: {
            category: {
              slug: catSlug,
            },
          },
        };
      }
    }

    // Occasion filter via ProductOccasion relation
    if (occasion && occasion.trim()) {
      const occSlug = occasion.trim().toLowerCase();
      if (occSlug !== "all") {
        where.occasions = {
          some: {
            occasion: {
              slug: occSlug,
            },
          },
        };
      }
    }

    // Determine ordering
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
    switch (sort) {
      case "price-low":
        orderBy = { price: "asc" };
        break;
      case "price-high":
        orderBy = { price: "desc" };
        break;
      case "rating":
        orderBy = { rating: "desc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    const skip = (page - 1) * limit;

    const [total, products] = await Promise.all([
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
          description: true,
          shortDescription: true,
          price: true,
          originalPrice: true,
          pricePrefix: true,
          sku: true,
          stock: true,
          rating: true,
          reviewCount: true,
          badge: true,
          isNew: true,
          variants: {
            select: {
              id: true,
              stock: true,
              active: true,
            },
          },
          images: {
            select: {
              id: true,
              url: true,
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
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const formattedProducts = products.map((product) => {
      const primaryImage =
        product.images.find((img) => img.isPrimary) || product.images[0] || null;

      // Authoritative stock calculation:
      // - For products with variants, sum active variant stock.
      // - If all variants are inactive, treat as out of stock (0).
      // - For standalone products, use product.stock directly.
      const hasVariants = product.variants.length > 0;
      const activeVariantsStock = product.variants
        .filter((v) => v.active)
        .reduce((sum, v) => sum + v.stock, 0);

      const authoritativeStock = hasVariants
        ? activeVariantsStock
        : product.stock;

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        href: `/shop/${product.slug}`,
        description: product.description,
        shortDescription: product.shortDescription,
        price: Number(product.price),
        originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
        pricePrefix: product.pricePrefix,
        sku: product.sku,
        stock: authoritativeStock,
        isAvailable: authoritativeStock > 0,
        rating: product.rating,
        reviewCount: product.reviewCount,
        badge: product.badge,
        isNew: product.isNew,
        imageSrc: primaryImage?.url || null,
        primaryImage: primaryImage
          ? {
              id: primaryImage.id,
              url: primaryImage.url,
              altText: primaryImage.altText,
              isPrimary: primaryImage.isPrimary,
            }
          : null,
        images: product.images.map((img) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
          isPrimary: img.isPrimary,
          sortOrder: img.sortOrder,
        })),
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
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch products",
      },
      { status: 500 }
    );
  }
}
