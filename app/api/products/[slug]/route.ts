import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPublicCatalogRateLimit } from "@/lib/rateLimit";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/products/[slug]
 *
 * Fetches detailed product information for a given slug (or id as fallback),
 * including variants, images, categories, occasions, approved reviews,
 * and related products.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  let slugParam = "";
  try {
    // Rate limit public catalog reads (60 req/min per trusted IP, fails open on store outage)
    const rateLimit = await checkPublicCatalogRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const resolvedParams = await params;
    slugParam = resolvedParams.slug;

    if (!slugParam || typeof slugParam !== "string") {
      return Response.json(
        {
          success: false,
          error: "Invalid product slug",
        },
        { status: 400 }
      );
    }

    const cleanSlug = decodeURIComponent(slugParam.trim());

    // Fetch product by unique slug
    let product = await prisma.product.findUnique({
      where: { slug: cleanSlug },
      include: {
        images: {
          select: {
            id: true,
            url: true,
            altText: true,
            sortOrder: true,
            isPrimary: true,
          },
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
          ],
        },
        variants: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            size: true,
            color: true,
            design: true,
            sku: true,
            price: true,
            stock: true,
            active: true,
          },
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
        reviews: {
          where: { approved: true },
          select: {
            id: true,
            author: true,
            rating: true,
            comment: true,
            verified: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Fallback: Check if queried by id
    if (!product) {
      product = await prisma.product.findUnique({
        where: { id: cleanSlug },
        include: {
          images: {
            select: {
              id: true,
              url: true,
              altText: true,
              sortOrder: true,
              isPrimary: true,
            },
            orderBy: [
              { isPrimary: "desc" },
              { sortOrder: "asc" },
            ],
          },
          variants: {
            where: { active: true },
            select: {
              id: true,
              name: true,
              size: true,
              color: true,
              design: true,
              sku: true,
              price: true,
              stock: true,
              active: true,
            },
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
          reviews: {
            where: { approved: true },
            select: {
              id: true,
              author: true,
              rating: true,
              comment: true,
              verified: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }

    if (!product || !product.active || !product.published) {
      return Response.json(
        {
          success: false,
          error: "Product not found",
        },
        { status: 404 }
      );
    }

    // Query related products from matching categories
    const categoryIds = product.categories.map((c) => c.category.id);
    const relatedProducts = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        active: true,
        published: true,
        ...(categoryIds.length > 0
          ? {
              categories: {
                some: {
                  categoryId: { in: categoryIds },
                },
              },
            }
          : {}),
      },
      take: 4,
      orderBy: { rating: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        originalPrice: true,
        pricePrefix: true,
        rating: true,
        reviewCount: true,
        badge: true,
        isNew: true,
        images: {
          select: {
            url: true,
            altText: true,
            isPrimary: true,
          },
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
          ],
          take: 1,
        },
      },
    });

    const primaryImage =
      product.images.find((img) => img.isPrimary) || product.images[0] || null;

    const formattedProduct = {
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
      stock:
        product.variants.length > 0
          ? product.variants.reduce((sum, v) => sum + v.stock, 0)
          : product.stock,
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
      occasions: product.occasions.map((o) => o.occasion),
      reviews: product.reviews.map((rev) => ({
        id: rev.id,
        author: rev.author,
        rating: rev.rating,
        comment: rev.comment,
        verified: rev.verified,
        date: rev.createdAt.toISOString().split("T")[0],
        createdAt: rev.createdAt.toISOString(),
      })),
      relatedProducts: relatedProducts.map((rel) => {
        const relPrimary = rel.images[0];
        return {
          id: rel.id,
          name: rel.name,
          slug: rel.slug,
          href: `/shop/${rel.slug}`,
          price: Number(rel.price),
          originalPrice: rel.originalPrice ? Number(rel.originalPrice) : null,
          pricePrefix: rel.pricePrefix,
          rating: rel.rating,
          reviewCount: rel.reviewCount,
          badge: rel.badge,
          isNew: rel.isNew,
          imageSrc: relPrimary?.url || null,
        };
      }),
    };

    return Response.json({
      success: true,
      data: formattedProduct,
    });
  } catch (error) {
    console.error(`Error fetching product by slug '${slugParam}':`, error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch product",
      },
      { status: 500 }
    );
  }
}
