import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmWriteRateLimit, checkCrmReadRateLimit } from "@/lib/rateLimit";
import { taxonomyUpdateSchema, slugify } from "@/lib/validation/taxonomy";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/crm/categories/[id]
 *
 * Administrative single category endpoint.
 * Returns category details, product count, and sample associated products.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to access category details",
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

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return Response.json(
        { success: false, error: "Invalid category ID parameter" },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
        products: {
          take: 10,
          select: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                stock: true,
                active: true,
                published: true,
              },
            },
          },
        },
      },
    });

    if (!category) {
      return Response.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        active: category.active,
        sortOrder: category.sortOrder,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
        productCount: category._count.products,
        associatedProducts: category.products.map((p) => ({
          ...p.product,
          price: Number(p.product.price),
        })),
      },
    });
  } catch (error) {
    console.error("[CRM Category GET [id] Error]:", error);
    return Response.json(
      { success: false, error: "Failed to retrieve category details" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/crm/categories/[id]
 *
 * Updates an existing category.
 * - Validates input fields
 * - Handles duplicate slug conflicts (409 Conflict)
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to update category",
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

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return Response.json(
        { success: false, error: "Invalid category ID parameter" },
        { status: 400 }
      );
    }

    const existingCategory = await prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });

    if (!existingCategory) {
      return Response.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      );
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

    const validation = taxonomyUpdateSchema.safeParse(body);
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
    let newSlug: string | undefined = undefined;

    if (validation.data.slug !== undefined) {
      newSlug = slugify(validation.data.slug);
      if (!newSlug) {
        return Response.json(
          { success: false, error: "Provided slug is invalid" },
          { status: 400 }
        );
      }
    } else if (name && name !== existingCategory.name && !validation.data.slug) {
      // If name changed but no explicit slug provided, keep existing slug to avoid breaking URLs
      // Unless the caller specifically requests slug update
      newSlug = existingCategory.slug;
    }

    // Check slug collision with another category
    if (newSlug && newSlug !== existingCategory.slug) {
      const collision = await prisma.category.findUnique({
        where: { slug: newSlug },
        select: { id: true, name: true },
      });

      if (collision && collision.id !== id) {
        return Response.json(
          {
            success: false,
            error: `A category with the slug "${newSlug}" already exists ("${collision.name}"). Please choose a unique slug.`,
            code: "DUPLICATE_SLUG",
          },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(newSlug !== undefined ? { slug: newSlug } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(image !== undefined ? { image } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(active !== undefined ? { active } : {}),
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
          select: { products: true },
        },
      },
    });

    return Response.json({
      success: true,
      message: `Category "${updated.name}" updated successfully`,
      data: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        image: updated.image,
        active: updated.active,
        sortOrder: updated.sortOrder,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        productCount: updated._count.products,
      },
    });
  } catch (error) {
    console.error("[CRM Category PUT Error]:", error);
    return Response.json(
      { success: false, error: "Failed to update category" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/crm/categories/[id]
 *
 * Quick partial update endpoint, commonly used for toggling active/inactive status.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required",
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

    const { id } = await params;
    let body: { active?: boolean; sortOrder?: number };
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true, active: true },
    });

    if (!existing) {
      return Response.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      );
    }

    const data: { active?: boolean; sortOrder?: number } = {};
    if (typeof body.active === "boolean") {
      data.active = body.active;
    }
    if (typeof body.sortOrder === "number" && body.sortOrder >= 0) {
      data.sortOrder = Math.floor(body.sortOrder);
    }

    const updated = await prisma.category.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        sortOrder: true,
        _count: { select: { products: true } },
      },
    });

    return Response.json({
      success: true,
      message: `Category "${updated.name}" status updated to ${updated.active ? "Active" : "Inactive"}`,
      data: {
        ...updated,
        productCount: updated._count.products,
      },
    });
  } catch (error) {
    console.error("[CRM Category PATCH Error]:", error);
    return Response.json(
      { success: false, error: "Failed to update category" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/crm/categories/[id]
 *
 * Relationship-Safe Deletion Policy:
 * 1. Checks if any products are associated with this category.
 * 2. If product associations exist:
 *    - STOPS and returns 409 Conflict.
 *    - Never silently deletes products or removes associations.
 *    - Recommends deactivating the category as a safe alternative.
 * 3. Only if zero products are associated:
 *    - Permanently deletes the category.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to delete category",
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

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return Response.json(
        { success: false, error: "Invalid category ID parameter" },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return Response.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      );
    }

    // Safety relationship check
    const productCount = category._count.products;
    if (productCount > 0) {
      return Response.json(
        {
          success: false,
          error: `Cannot delete category "${category.name}". It is currently associated with ${productCount} product(s). To preserve catalog integrity, you cannot delete a category with active product relationships. Instead, deactivate this category to hide it from the storefront without disrupting product records.`,
          hasProducts: true,
          productCount,
          safeAlternative: "deactivate",
        },
        { status: 409 }
      );
    }

    // Safe deletion: no products associated
    await prisma.category.delete({
      where: { id },
    });

    return Response.json({
      success: true,
      message: `Category "${category.name}" deleted successfully`,
    });
  } catch (error) {
    console.error("[CRM Category DELETE Error]:", error);
    return Response.json(
      { success: false, error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
