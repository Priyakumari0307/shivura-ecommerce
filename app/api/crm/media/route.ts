import { NextRequest } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmWriteRateLimit, checkCrmMediaReadRateLimit } from "@/lib/rateLimit";
import {
  isCloudinaryConfigured,
  listCloudinaryImages,
  deleteImageFromCloudinary,
} from "@/lib/cloudinary";
import {
  batchCheckMediaReferences,
  checkMediaReference,
  MediaReferenceReport,
} from "@/lib/crm/mediaReferences";

export interface MediaAssetResponseItem {
  publicId: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  folder?: string;
  fileName: string;
  inUse: boolean;
  references: MediaReferenceReport;
}

/**
 * GET /api/crm/media
 *
 * Administrative listing endpoint for Cloudinary media assets with
 * real-time database reference detection (Products, Categories, Occasions).
 *
 * Features:
 * - Search by file name or publicId keyword
 * - Filter by usage state (all, in_use, unused)
 * - Sorting by date, name, and size
 * - Pagination with metadata and storage summaries
 *
 * Security:
 * - 401 Unauthorized for unauthenticated requests
 * - 403 Forbidden for customer non-admin accounts
 * - 200 OK for verified administrators
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to access Media Library",
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

    // Rate limit CRM media reads (30 req/min per verified admin, protects Cloudinary API limits, fails open on store outage)
    const rateLimit = await checkCrmMediaReadRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    if (!isCloudinaryConfigured()) {
      return Response.json({
        success: true,
        configured: false,
        data: [],
        message:
          "Cloudinary media storage is not configured. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env.",
        pagination: {
          page: 1,
          limit: 24,
          total: 0,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
        },
        summary: {
          totalAssets: 0,
          inUseAssets: 0,
          unusedAssets: 0,
          totalBytes: 0,
        },
      });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const filter = searchParams.get("filter")?.trim().toLowerCase() || "all";
    const sort = searchParams.get("sort")?.trim().toLowerCase() || "newest";
    const rawPage = searchParams.get("page");
    const rawLimit = searchParams.get("limit");

    let page = 1;
    if (rawPage) {
      const parsed = parseInt(rawPage, 10);
      if (!isNaN(parsed) && parsed > 0) page = parsed;
    }

    let limit = 24;
    if (rawLimit) {
      const parsed = parseInt(rawLimit, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 100) limit = parsed;
    }

    // Retrieve assets under the authorized "shivura" prefix
    const cloudinaryResult = await listCloudinaryImages({
      prefix: "shivura",
      maxResults: 100, // Fetch catalog batch for comprehensive cross-referencing
    });

    const rawAssets = cloudinaryResult.resources;

    // Batch-evaluate database references
    const referenceMap = await batchCheckMediaReferences(
      rawAssets.map((a) => ({ publicId: a.publicId, url: a.secureUrl }))
    );

    // Map each Cloudinary asset into full metadata with reference reports
    let items: MediaAssetResponseItem[] = rawAssets.map((asset) => {
      const ref = referenceMap.get(asset.publicId) || {
        inUse: false,
        totalReferences: 0,
        products: [],
        categories: [],
        occasions: [],
        summaryText: "Unused asset",
      };

      const fileName =
        asset.displayName ||
        asset.publicId.split("/").pop() ||
        asset.publicId;

      return {
        publicId: asset.publicId,
        url: asset.secureUrl,
        format: asset.format,
        width: asset.width,
        height: asset.height,
        bytes: asset.bytes,
        createdAt: asset.createdAt,
        folder: asset.folder,
        fileName: `${fileName}.${asset.format}`,
        inUse: ref.inUse,
        references: ref,
      };
    });

    // Apply keyword search
    if (search) {
      items = items.filter(
        (item) =>
          item.fileName.toLowerCase().includes(search) ||
          item.publicId.toLowerCase().includes(search) ||
          item.format.toLowerCase().includes(search)
      );
    }

    // Apply in-use / unused filter
    if (filter === "in_use") {
      items = items.filter((item) => item.inUse);
    } else if (filter === "unused") {
      items = items.filter((item) => !item.inUse);
    }

    // Compute summary metrics before slicing for pagination
    const totalAssets = rawAssets.length;
    const inUseAssets = rawAssets.filter(
      (a) => (referenceMap.get(a.publicId)?.totalReferences || 0) > 0
    ).length;
    const unusedAssets = totalAssets - inUseAssets;
    const totalBytes = rawAssets.reduce((sum, a) => sum + (a.bytes || 0), 0);

    // Apply sorting
    if (sort === "newest") {
      items.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sort === "oldest") {
      items.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } else if (sort === "name_asc") {
      items.sort((a, b) => a.fileName.localeCompare(b.fileName));
    } else if (sort === "name_desc") {
      items.sort((a, b) => b.fileName.localeCompare(a.fileName));
    } else if (sort === "size_desc") {
      items.sort((a, b) => b.bytes - a.bytes);
    }

    // Apply pagination
    const totalMatching = items.length;
    const totalPages = Math.max(1, Math.ceil(totalMatching / limit));
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    return Response.json({
      success: true,
      configured: true,
      data: paginatedItems,
      pagination: {
        page,
        limit,
        total: totalMatching,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        nextCursor: cloudinaryResult.nextCursor || null,
      },
      summary: {
        totalAssets,
        inUseAssets,
        unusedAssets,
        totalBytes,
      },
    });
  } catch (error) {
    console.error("[CRM Media GET Error]:", error);
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to retrieve media library assets",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/crm/media
 *
 * Relationship-Safe Deletion Guard:
 * 1. Checks if publicId is referenced by any product, category, or occasion.
 * 2. If referenced:
 *    - Blocks deletion with HTTP 409 Conflict.
 *    - Explains exact referencing entity names and types.
 * 3. If unused:
 *    - Permanently deletes from Cloudinary.
 *    - Never touches database product or category records.
 *
 * Security:
 * - 401 Unauthorized for unauthenticated requests
 * - 403 Forbidden for customer non-admin accounts
 * - 200 OK for verified administrators
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to delete media assets",
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

    if (!isCloudinaryConfigured()) {
      return Response.json(
        {
          success: false,
          error: "Cloudinary credentials not configured on the server",
        },
        { status: 503 }
      );
    }

    // Extract publicId from search query or body
    const { searchParams } = request.nextUrl;
    let publicId = searchParams.get("publicId")?.trim() || "";

    if (!publicId) {
      try {
        const body = await request.json();
        publicId = body?.publicId?.trim() || "";
      } catch {
        // ignore
      }
    }

    if (!publicId) {
      return Response.json(
        {
          success: false,
          error: "Missing required 'publicId' parameter for deletion",
        },
        { status: 400 }
      );
    }

    // Safety check: ensure publicId belongs to authorized Shivura folders
    if (!publicId.startsWith("shivura/")) {
      return Response.json(
        {
          success: false,
          error: "Access denied: Can only delete assets within the authorized 'shivura/' folder.",
        },
        { status: 403 }
      );
    }

    // Check database references across all catalog models
    const referenceReport = await checkMediaReference(publicId);

    if (referenceReport.inUse) {
      return Response.json(
        {
          success: false,
          error: `Cannot delete asset "${publicId}". ${referenceReport.summaryText}. Deleting this asset would produce broken images in your active storefront catalog. Please remove these product or taxonomy associations before deleting.`,
          code: "IMAGE_IN_USE",
          inUse: true,
          references: referenceReport,
        },
        { status: 409 }
      );
    }

    // Safe deletion: asset has 0 database references
    const deleteResult = await deleteImageFromCloudinary(publicId);

    if (!deleteResult.success) {
      return Response.json(
        {
          success: false,
          error:
            deleteResult.error ||
            "Failed to delete asset from Cloudinary storage.",
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: `Asset "${publicId}" deleted successfully from Cloudinary storage.`,
      publicId,
    });
  } catch (error) {
    console.error("[CRM Media DELETE Error]:", error);
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete media asset",
      },
      { status: 500 }
    );
  }
}
