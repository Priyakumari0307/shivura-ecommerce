import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmReadRateLimit, checkCrmWriteRateLimit } from "@/lib/rateLimit";

export interface HeroBannerConfig {
  imageUrl: string;
  publicId?: string | null;
  altText: string;
  badgeText: string;
  isCustom: boolean;
  updatedAt?: string | null;
}

export const DEFAULT_HERO_CONFIG: HeroBannerConfig = {
  imageUrl: "/images/background.png",
  publicId: null,
  altText: "Shivura Home Decoration",
  badgeText: "New Collection 2026",
  isCustom: false,
  updatedAt: null,
};

/**
 * GET /api/crm/homepage
 *
 * Retrieves current homepage hero configuration.
 *
 * Security:
 * - 401 Unauthorized for unauthenticated requests
 * - 403 Forbidden for non-admin accounts
 * - Rate limited by verified admin ID
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to view homepage configuration",
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

    const rateLimit = await checkCrmReadRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const setting = await prisma.siteSetting.findUnique({
      where: { key: "homepage_hero" },
    });

    if (!setting) {
      return Response.json({
        success: true,
        data: DEFAULT_HERO_CONFIG,
      });
    }

    try {
      const parsed = JSON.parse(setting.value);
      return Response.json({
        success: true,
        data: {
          imageUrl: parsed.imageUrl || DEFAULT_HERO_CONFIG.imageUrl,
          publicId: parsed.publicId ?? null,
          altText: parsed.altText || DEFAULT_HERO_CONFIG.altText,
          badgeText: parsed.badgeText || DEFAULT_HERO_CONFIG.badgeText,
          isCustom: true,
          updatedAt: setting.updatedAt.toISOString(),
        },
      });
    } catch {
      // If setting.value is a raw string URL
      return Response.json({
        success: true,
        data: {
          ...DEFAULT_HERO_CONFIG,
          imageUrl: setting.value,
          isCustom: true,
          updatedAt: setting.updatedAt.toISOString(),
        },
      });
    }
  } catch (error) {
    console.error("[CRM Homepage GET Error]:", error);
    return Response.json(
      { success: false, error: "Internal server error loading homepage configuration" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/crm/homepage
 *
 * Updates homepage hero banner image and metadata.
 * Triggers on-demand storefront revalidation.
 *
 * Security:
 * - 401 Unauthorized for unauthenticated requests
 * - 403 Forbidden for non-admin accounts
 * - Rate limited by verified admin ID
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to update homepage configuration",
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

    const rateLimit = await checkCrmWriteRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    let body: {
      imageUrl?: unknown;
      publicId?: unknown;
      altText?: unknown;
      badgeText?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const rawImageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    if (!rawImageUrl) {
      return Response.json(
        { success: false, error: "Image URL is required" },
        { status: 400 }
      );
    }

    // Validate image URL format
    const isValidProtocol =
      rawImageUrl.startsWith("http://") ||
      rawImageUrl.startsWith("https://") ||
      rawImageUrl.startsWith("/");

    if (!isValidProtocol) {
      return Response.json(
        {
          success: false,
          error:
            "Invalid image URL. Must be an absolute URL (https://...) or root-relative path (/images/...)",
        },
        { status: 400 }
      );
    }

    const publicId = typeof body.publicId === "string" ? body.publicId.trim() : null;
    const altText =
      typeof body.altText === "string" && body.altText.trim()
        ? body.altText.trim().slice(0, 200)
        : DEFAULT_HERO_CONFIG.altText;
    const badgeText =
      typeof body.badgeText === "string" && body.badgeText.trim()
        ? body.badgeText.trim().slice(0, 100)
        : DEFAULT_HERO_CONFIG.badgeText;

    const configToPersist = {
      imageUrl: rawImageUrl,
      publicId,
      altText,
      badgeText,
      updatedAt: new Date().toISOString(),
    };

    const updatedSetting = await prisma.siteSetting.upsert({
      where: { key: "homepage_hero" },
      update: {
        value: JSON.stringify(configToPersist),
      },
      create: {
        key: "homepage_hero",
        value: JSON.stringify(configToPersist),
      },
    });

    // Revalidate public storefront homepage on demand
    try {
      revalidatePath("/");
    } catch {
      // Non-fatal if called in an environment where revalidatePath is unavailable
    }

    return Response.json({
      success: true,
      message: "Homepage hero banner image updated successfully",
      data: {
        ...configToPersist,
        isCustom: true,
        updatedAt: updatedSetting.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[CRM Homepage PUT Error]:", error);
    return Response.json(
      { success: false, error: "Internal server error updating homepage configuration" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/crm/homepage
 *
 * Resets homepage hero to the default theme banner.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    if (auth.status === "forbidden") {
      return Response.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const rateLimit = await checkCrmWriteRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    await prisma.siteSetting.deleteMany({
      where: { key: "homepage_hero" },
    });

    try {
      revalidatePath("/");
    } catch {
      // Non-fatal
    }

    return Response.json({
      success: true,
      message: "Homepage hero banner reset to default theme image",
      data: DEFAULT_HERO_CONFIG,
    });
  } catch (error) {
    console.error("[CRM Homepage DELETE Error]:", error);
    return Response.json(
      { success: false, error: "Failed to reset homepage hero banner" },
      { status: 500 }
    );
  }
}
