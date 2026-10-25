import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPublicCatalogRateLimit } from "@/lib/rateLimit";

/**
 * GET /api/occasions
 *
 * Fetches active occasions from the database for the storefront.
 * Results are sorted by sortOrder ascending, then name ascending.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit public catalog reads (60 req/min per trusted IP, fails open on store outage)
    const rateLimit = await checkPublicCatalogRateLimit(request);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const occasions = await prisma.occasion.findMany({
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

    const formattedOccasions = occasions.map((occ) => ({
      id: occ.id,
      name: occ.name,
      slug: occ.slug,
      href: `/shop/${occ.slug}`,
      description: occ.description,
      image: occ.image,
      imageSrc: occ.image,
      sortOrder: occ.sortOrder,
    }));

    return Response.json({
      success: true,
      data: formattedOccasions,
    });
  } catch (error) {
    console.error("Error fetching occasions:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch occasions",
      },
      { status: 500 }
    );
  }
}
