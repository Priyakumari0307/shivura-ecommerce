import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmReadRateLimit } from "@/lib/rateLimit";
import { getCloudinaryConfigStatus } from "@/lib/cloudinary";

/**
 * GET /api/crm/taxonomy
 *
 * Protected CRM administration endpoint to fetch all categories and occasions
 * along with their product counts and system configuration status.
 *
 * Security:
 * - Unauthenticated -> 401 Unauthorized
 * - Authenticated Customer -> 403 Forbidden
 * - Verified Administrator -> 200 OK with categories and occasions
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to access CRM taxonomy data",
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

    // Fetch categories and occasions in parallel
    const [categories, occasions] = await Promise.all([
      prisma.category.findMany({
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
          active: true,
          sortOrder: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
      }),
      prisma.occasion.findMany({
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
          active: true,
          sortOrder: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
      }),
    ]);

    const formattedCategories = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      image: cat.image,
      active: cat.active,
      sortOrder: cat.sortOrder,
      productCount: cat._count.products,
    }));

    const formattedOccasions = occasions.map((occ) => ({
      id: occ.id,
      name: occ.name,
      slug: occ.slug,
      description: occ.description,
      image: occ.image,
      active: occ.active,
      sortOrder: occ.sortOrder,
      productCount: occ._count.products,
    }));

    const cloudinaryStatus = getCloudinaryConfigStatus();

    return Response.json({
      success: true,
      data: {
        categories: formattedCategories,
        occasions: formattedOccasions,
        mediaConfig: {
          cloudinaryConfigured: cloudinaryStatus.configured,
          cloudName: cloudinaryStatus.cloudName,
        },
      },
    });
  } catch (error) {
    console.error("[CRM Taxonomy API Error]:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to retrieve CRM taxonomy data",
      },
      { status: 500 }
    );
  }
}
