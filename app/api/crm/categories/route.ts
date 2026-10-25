import { NextRequest } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmWriteRateLimit, checkCrmReadRateLimit } from "@/lib/rateLimit";
import { taxonomyCreateSchema, slugify } from "@/lib/validation/taxonomy";

/**
 * GET /api/crm/categories
 *
 * Administrative listing endpoint for categories.
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
          error: "Unauthenticated: Administrative login required to access categories",
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
    const where: Prisma.CategoryWhereInput = {};

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
    let orderBy: Prisma.CategoryOrderByWithRelationInput[] = [{ sortOrder: "asc" }, { name: "asc" }];
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
    const [totalMatching, totalAll, totalActive, totalInactive, categories] =
      await Promise.all([
        prisma.category.count({ where }),
        prisma.category.count(),
        prisma.category.count({ where: { active: true } }),
        prisma.category.count({ where: { active: false } }),
        prisma.category.findMany({
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

    // Format category records
    const formatted = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      image: cat.image,
      active: cat.active,
      sortOrder: cat.sortOrder,
      createdAt: cat.createdAt.toISOString(),
      updatedAt: cat.updatedAt.toISOString(),
      productCount: cat._count.products,
    }));

    // In-memory sort if sorting by product count
    if (sort === "products-desc") {
      formatted.sort((a, b) => b.productCount - a.productCount);
    } else if (sort === "products-asc") {
      formatted.sort((a, b) => a.productCount - b.productCount);
    }

    const totalPages = all ? 1 : Math.max(1, Math.ceil(totalMatching / limit));
    const totalProductsLinked = categories.reduce(
      (sum, cat) => sum + cat._count.products,
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
    console.error("[CRM Categories GET Error]:", error);
    return Response.json(
      { success: false, error: "Failed to retrieve categories" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crm/categories
 *
 * Creates a new category.
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
          error: "Unauthenticated: Administrative login required to create categories",
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
        { success: false, error: "Could not generate a valid slug from the provided category name" },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existing = await prisma.category.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (existing) {
      return Response.json(
        {
          success: false,
          error: `A category with the slug "${slug}" already exists ("${existing.name}"). Please choose a unique slug.`,
          code: "DUPLICATE_SLUG",
        },
        { status: 409 }
      );
    }

    const newCategory = await prisma.category.create({
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
        message: `Category "${newCategory.name}" created successfully`,
        data: {
          id: newCategory.id,
          name: newCategory.name,
          slug: newCategory.slug,
          description: newCategory.description,
          image: newCategory.image,
          active: newCategory.active,
          sortOrder: newCategory.sortOrder,
          createdAt: newCategory.createdAt.toISOString(),
          updatedAt: newCategory.updatedAt.toISOString(),
          productCount: newCategory._count.products,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[CRM Category POST Error]:", error);
    return Response.json(
      { success: false, error: "Failed to create category" },
      { status: 500 }
    );
  }
}
