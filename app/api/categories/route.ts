import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPublicCatalogRateLimit } from "@/lib/rateLimit";

/**
 * GET /api/categories
 *
 * Fetches active categories from the database for the storefront.
 * Results are sorted by sortOrder ascending, then name ascending.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit public catalog reads (60 req/min per trusted IP, fails open on store outage)
    const rateLimit = await checkPublicCatalogRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const categories = await prisma.category.findMany({
      where: {
        active: true,
      },
      orderBy: [
        { sortOrder: "asc" },
        { name: "asc" },
      ],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        sortOrder: true,
      },
    });

    const formattedCategories = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      href: `/shop/${cat.slug}`,
      description: cat.description,
      image: cat.image,
      imageSrc: cat.image,
      sortOrder: cat.sortOrder,
    }));

    return Response.json({
      success: true,
      data: formattedCategories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch categories",
      },
      { status: 500 }
    );
  }
}
