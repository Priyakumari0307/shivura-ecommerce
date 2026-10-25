import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkCustomerReadRateLimit,
  checkCustomerMutationRateLimit,
} from "@/lib/rateLimit";

/**
 * GET /api/wishlist
 * Returns the authenticated user's wishlist items.
 * Strictly requires active session (HTTP 401 for guests).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return Response.json(
        { success: false, error: "Authentication required to view wishlist" },
        { status: 401 }
      );
    }

    // Rate limit customer wishlist reads (60 req/min per verified user, fails open on Redis outage)
    const rateLimit = await checkCustomerReadRateLimit(userId);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return Response.json({
      success: true,
      items: wishlist?.items || [],
    });
  } catch (error) {
    console.error("[Wishlist GET Error]:", error);
    return Response.json(
      { success: false, error: "Failed to retrieve wishlist" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wishlist
 * Toggles a product in the authenticated user's wishlist.
 * Strictly requires active session (HTTP 401 for guests).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return Response.json(
        { success: false, error: "Authentication required to modify wishlist" },
        { status: 401 }
      );
    }

    // Rate limit customer wishlist mutations (30 req/min per verified user, fails closed on Redis outage)
    const rateLimit = await checkCustomerMutationRateLimit(userId);
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

    if (!body || typeof body !== "object") {
      return Response.json(
        { success: false, error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const { productId } = body as { productId?: string };
    if (!productId || typeof productId !== "string") {
      return Response.json(
        { success: false, error: "productId is required" },
        { status: 400 }
      );
    }

    // Ensure product exists
    const product = await prisma.product.findUnique({
      where: { id: productId.trim() },
      select: { id: true },
    });

    if (!product) {
      return Response.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    // Find or create wishlist container for user
    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId },
      });
    }

    // Check if item already exists in wishlist
    const existingItem = await prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId: product.id,
        },
      },
    });

    if (existingItem) {
      // Toggle off: remove item
      await prisma.wishlistItem.delete({
        where: { id: existingItem.id },
      });

      return Response.json({
        success: true,
        action: "removed",
        message: "Item removed from wishlist",
      });
    } else {
      // Toggle on: add item
      await prisma.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId: product.id,
        },
      });

      return Response.json(
        {
          success: true,
          action: "added",
          message: "Item added to wishlist",
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("[Wishlist POST Error]:", error);
    return Response.json(
      { success: false, error: "Failed to update wishlist" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wishlist
 * Removes a product from the authenticated user's wishlist.
 * Strictly requires active session (HTTP 401 for guests).
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return Response.json(
        { success: false, error: "Authentication required to modify wishlist" },
        { status: 401 }
      );
    }

    // Rate limit customer wishlist mutations (30 req/min per verified user, fails closed on Redis outage)
    const rateLimit = await checkCustomerMutationRateLimit(userId);
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

    const { productId } = (body as { productId?: string }) || {};
    if (!productId || typeof productId !== "string") {
      return Response.json(
        { success: false, error: "productId is required" },
        { status: 400 }
      );
    }

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
    });

    if (wishlist) {
      await prisma.wishlistItem.deleteMany({
        where: {
          wishlistId: wishlist.id,
          productId: productId.trim(),
        },
      });
    }

    return Response.json({
      success: true,
      message: "Item removed from wishlist",
    });
  } catch (error) {
    console.error("[Wishlist DELETE Error]:", error);
    return Response.json(
      { success: false, error: "Failed to remove item from wishlist" },
      { status: 500 }
    );
  }
}
