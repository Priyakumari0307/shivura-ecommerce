import { NextRequest } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmWriteRateLimit, checkCrmReadRateLimit } from "@/lib/rateLimit";
import { taxonomyCreateSchema, slugify } from "@/lib/validation/taxonomy";

/**
 * GET /api/crm/occasions
 *
 * Administrative listing endpoint for occasions.
 * Supports:
 * - Search by name, slug, or description
 * - Filter by status (all, active, inactive)
 * - Sorting by name, sortOrder, product count, or date
 * - Pagination with metadata and overall catalog summary
 * - Quick "all=true" mode for unpaginated listings
 *
 * Security:
 * - 401 Unauthorized for unauthenticated requests
 * - 403 Forbidden for authenticated non-admin (customer) accounts
 * - 200 OK for verified administrators
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to access occasions",
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
    const status = searchParams.get("status")?.trim().toLowerCase() || "all";
    const sort = searchParams.get("sort")?.trim().toLowerCase() || "sortorder-asc";
    const all = searchParams.get("all") === "true";
    const rawPage = searchParams.get("page");
    const rawLimit = searchParams.get("limit");

    let page = 1;
    if (rawPage) {
      const parsed = parseInt(rawPage, 10);
      if (isNaN(parsed) || parsed < 1) {
        return Response.json(
          { success: false, error: "Invalid 'page' parameter. Must be a positive integer." },
          { status: 400 }
        );
      }
      page = parsed;
    }

    let limit = 10;
    if (rawLimit) {
      const parsed = parseInt(rawLimit, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 100) {
        return Response.json(
          { success: false, error: "Invalid 'limit' parameter. Must be between 1 and 100." },
          { status: 400 }
        );
      }
      limit = parsed;
    }

    // Build Prisma where filter
    const where: Prisma.OccasionWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status === "active") {
      where.active = true;
    } else if (status === "inactive") {
      where.active = false;
    }

    // Build Prisma orderBy
    let orderBy: Prisma.OccasionOrderByWithRelationInput[] = [{ sortOrder: "asc" }, { name: "asc" }];
    if (sort === "name-asc") {
      orderBy = [{ name: "asc" }];
    } else if (sort === "name-desc") {
      orderBy = [{ name: "desc" }];
    } else if (sort === "sortorder-desc") {
      orderBy = [{ sortOrder: "desc" }, { name: "asc" }];
    } else if (sort === "sortorder-asc") {
      orderBy = [{ sortOrder: "asc" }, { name: "asc" }];
    } else if (sort === "newest") {
      orderBy = [{ createdAt: "desc" }];
    } else if (sort === "oldest") {
      orderBy = [{ createdAt: "asc" }];
    }

    // Parallel fetch: filtered count, total summary counts, and records
    const [totalMatching, totalAll, totalActive, totalInactive, occasions] =
      await Promise.all([
        prisma.occasion.count({ where }),
        prisma.occasion.count(),
        prisma.occasion.count({ where: { active: true } }),
        prisma.occasion.count({ where: { active: false } }),
        prisma.occasion.findMany({
          where,
          orderBy,
          skip: all ? undefined : (page - 1) * limit,
          take: all ? undefined : limit,
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            image: true,
            active: true,
            sortOrder: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                products: true,
              },
            },
          },
        }),
      ]);

    // Format occasion records
    const formatted = occasions.map((occ) => ({
      id: occ.id,
      name: occ.name,
      slug: occ.slug,
      description: occ.description,
      image: occ.image,
      active: occ.active,
      sortOrder: occ.sortOrder,
      createdAt: occ.createdAt.toISOString(),
      updatedAt: occ.updatedAt.toISOString(),
      productCount: occ._count.products,
    }));

    // In-memory sort if sorting by product count
    if (sort === "products-desc") {
      formatted.sort((a, b) => b.productCount - a.productCount);
    } else if (sort === "products-asc") {
      formatted.sort((a, b) => a.productCount - b.productCount);
    }

    const totalPages = all ? 1 : Math.max(1, Math.ceil(totalMatching / limit));
    const totalProductsLinked = occasions.reduce(
      (sum, occ) => sum + occ._count.products,
      0
    );

    return Response.json({
      success: true,
      data: formatted,
      pagination: {
        page: all ? 1 : page,
        limit: all ? totalMatching : limit,
        total: totalMatching,
        totalPages,
        hasPrevPage: !all && page > 1,
        hasNextPage: !all && page < totalPages,
      },
      summary: {
        total: totalAll,
        active: totalActive,
        inactive: totalInactive,
        totalProductsLinked,
      },
    });
  } catch (error) {
    console.error("[CRM Occasions GET Error]:", error);
    return Response.json(
      { success: false, error: "Failed to retrieve occasions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crm/occasions
 *
 * Creates a new occasion.
 * - Validates name, slug, description, image, and sortOrder
 * - Handles duplicate slug conflicts safely (409 Conflict)
 * - Auto-generates clean URL slug if none provided
 *
 * Security:
 * - 401 Unauthorized for unauthenticated requests
 * - 403 Forbidden for authenticated non-admin (customer) accounts
 * - 201 Created for verified administrators
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to create occasions",
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

    // Rate-limit CRM mutations (60 req/min per verified admin)
    const rateLimit = await checkCrmWriteRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const validation = taxonomyCreateSchema.safeParse(body);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      return Response.json(
        {
          success: false,
          error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Validation failed",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { name, description, image, sortOrder, active } = validation.data;
    const rawSlug = validation.data.slug?.trim() || slugify(name);
    const slug = slugify(rawSlug);

    if (!slug) {
      return Response.json(
        { success: false, error: "Could not generate a valid slug from the provided occasion name" },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existing = await prisma.occasion.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (existing) {
      return Response.json(
        {
          success: false,
          error: `An occasion with the slug "${slug}" already exists ("${existing.name}"). Please choose a unique slug.`,
          code: "DUPLICATE_SLUG",
        },
        { status: 409 }
      );
    }

    const newOccasion = await prisma.occasion.create({
      data: {
        name,
        slug,
        description: description ?? null,
        image: image ?? null,
        sortOrder,
        active,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        active: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return Response.json(
      {
        success: true,
        message: `Occasion "${newOccasion.name}" created successfully`,
        data: {
          id: newOccasion.id,
          name: newOccasion.name,
          slug: newOccasion.slug,
          description: newOccasion.description,
          image: newOccasion.image,
          active: newOccasion.active,
          sortOrder: newOccasion.sortOrder,
          createdAt: newOccasion.createdAt.toISOString(),
          updatedAt: newOccasion.updatedAt.toISOString(),
          productCount: newOccasion._count.products,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[CRM Occasion POST Error]:", error);
    return Response.json(
      { success: false, error: "Failed to create occasion" },
      { status: 500 }
    );
  }
}
