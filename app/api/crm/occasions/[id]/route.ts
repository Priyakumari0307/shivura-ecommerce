import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmWriteRateLimit, checkCrmReadRateLimit } from "@/lib/rateLimit";
import { taxonomyUpdateSchema, slugify } from "@/lib/validation/taxonomy";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/crm/occasions/[id]
 *
 * Administrative single occasion endpoint.
 * Returns occasion details, product count, and sample associated products.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to access occasion details",
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
        { success: false, error: "Invalid occasion ID parameter" },
        { status: 400 }
      );
    }

    const occasion = await prisma.occasion.findUnique({
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

    if (!occasion) {
      return Response.json(
        { success: false, error: "Occasion not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: {
        id: occasion.id,
        name: occasion.name,
        slug: occasion.slug,
        description: occasion.description,
        image: occasion.image,
        active: occasion.active,
        sortOrder: occasion.sortOrder,
        createdAt: occasion.createdAt.toISOString(),
        updatedAt: occasion.updatedAt.toISOString(),
        productCount: occasion._count.products,
        associatedProducts: occasion.products.map((p) => ({
          ...p.product,
          price: Number(p.product.price),
        })),
      },
    });
  } catch (error) {
    console.error("[CRM Occasion GET [id] Error]:", error);
    return Response.json(
      { success: false, error: "Failed to retrieve occasion details" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/crm/occasions/[id]
 *
 * Updates an existing occasion.
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
          error: "Unauthenticated: Administrative login required to update occasion",
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
        { success: false, error: "Invalid occasion ID parameter" },
        { status: 400 }
      );
    }

    const existingOccasion = await prisma.occasion.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });

    if (!existingOccasion) {
      return Response.json(
        { success: false, error: "Occasion not found" },
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
    } else if (name && name !== existingOccasion.name && !validation.data.slug) {
      // Preserve existing slug if name changed but no explicit slug update requested
      newSlug = existingOccasion.slug;
    }

    // Check slug collision with another occasion
    if (newSlug && newSlug !== existingOccasion.slug) {
      const collision = await prisma.occasion.findUnique({
        where: { slug: newSlug },
        select: { id: true, name: true },
      });

      if (collision && collision.id !== id) {
        return Response.json(
          {
            success: false,
            error: `An occasion with the slug "${newSlug}" already exists ("${collision.name}"). Please choose a unique slug.`,
            code: "DUPLICATE_SLUG",
          },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.occasion.update({
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
      message: `Occasion "${updated.name}" updated successfully`,
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
    console.error("[CRM Occasion PUT Error]:", error);
    return Response.json(
      { success: false, error: "Failed to update occasion" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/crm/occasions/[id]
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

    const existing = await prisma.occasion.findUnique({
      where: { id },
      select: { id: true, name: true, active: true },
    });

    if (!existing) {
      return Response.json(
        { success: false, error: "Occasion not found" },
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

    const updated = await prisma.occasion.update({
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
      message: `Occasion "${updated.name}" status updated to ${updated.active ? "Active" : "Inactive"}`,
      data: {
        ...updated,
        productCount: updated._count.products,
      },
    });
  } catch (error) {
    console.error("[CRM Occasion PATCH Error]:", error);
    return Response.json(
      { success: false, error: "Failed to update occasion" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/crm/occasions/[id]
 *
 * Relationship-Safe Deletion Policy:
 * 1. Checks if any products are associated with this occasion.
 * 2. If product associations exist:
 *    - STOPS and returns 409 Conflict.
 *    - Never silently deletes products or removes associations.
 *    - Recommends deactivating the occasion as a safe alternative.
 * 3. Only if zero products are associated:
 *    - Permanently deletes the occasion.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to delete occasion",
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
        { success: false, error: "Invalid occasion ID parameter" },
        { status: 400 }
      );
    }

    const occasion = await prisma.occasion.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!occasion) {
      return Response.json(
        { success: false, error: "Occasion not found" },
        { status: 404 }
      );
    }

    // Safety relationship check
    const productCount = occasion._count.products;
    if (productCount > 0) {
      return Response.json(
        {
          success: false,
          error: `Cannot delete occasion "${occasion.name}". It is currently associated with ${productCount} product(s). To preserve catalog integrity, you cannot delete an occasion with active product relationships. Instead, deactivate this occasion to hide it from the storefront without disrupting product records.`,
          hasProducts: true,
          productCount,
          safeAlternative: "deactivate",
        },
        { status: 409 }
      );
    }

    // Safe deletion: no products associated
    await prisma.occasion.delete({
      where: { id },
    });

    return Response.json({
      success: true,
      message: `Occasion "${occasion.name}" deleted successfully`,
    });
  } catch (error) {
    console.error("[CRM Occasion DELETE Error]:", error);
    return Response.json(
      { success: false, error: "Failed to delete occasion" },
      { status: 500 }
    );
  }
}
