import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmWriteRateLimit } from "@/lib/rateLimit";
import { productStatusToggleSchema } from "@/lib/validation/product";
import { revalidateStorefront } from "@/lib/revalidate";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/crm/products/[id]/status
 *
 * Dedicated lightweight endpoint for toggling `published` and/or `active` status.
 * Prevents mutation of any other product fields.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        { success: false, error: "Unauthenticated: Administrative login required" },
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

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return Response.json(
        { success: false, error: "Invalid product ID parameter" },
        { status: 400 }
      );
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, published: true, active: true },
    });

    if (!product) {
      return Response.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
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

    const validation = productStatusToggleSchema.safeParse(bodyJson);
    if (!validation.success) {
      return Response.json(
        {
          success: false,
          error: "Invalid status payload",
          issues: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const { published, active } = validation.data;

    // Apply only allowed status mutations
    const updateData: { published?: boolean; active?: boolean } = {};
    if (typeof published === "boolean") {
      updateData.published = published;
    }
    if (typeof active === "boolean") {
      updateData.active = active;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        published: true,
        updatedAt: true,
      },
    });

    // Revalidate storefront cache
    revalidateStorefront(updated.slug);

    return Response.json({
      success: true,
      message: `Status updated for "${updated.name}"`,
      data: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        active: updated.active,
        published: updated.published,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[CRM Product Status PATCH Error]:", error);
    return Response.json(
      { success: false, error: "Failed to update product status" },
      { status: 500 }
    );
  }
}
