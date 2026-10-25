import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmReadRateLimit, checkCrmWriteRateLimit } from "@/lib/rateLimit";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/constants";

/**
 * Baseline Store Configuration
 * Represents current application configuration anchored to verified luxury constants.
 */
const BASELINE_STORE_INFO = {
  storeName: BRAND_NAME,
  tagline: BRAND_TAGLINE,
  contactEmail: "info@shivura.com",
  contactPhone: "+91 9650218876",
  address: {
    line1: "Alpha-2",
    city: "Greater Noida",
    state: "Uttar Pradesh",
    postalCode: "201310",
    country: "India",
    formatted: "Alpha-2, Greater Noida, Uttar Pradesh, 201310, India",
  },
  operatingHours: "Monday – Saturday: 10:00 AM – 7:00 PM IST (Sunday closed for artisanal workshop rest)",
  persistenceType: "APPLICATION_CONSTANTS" as const,
  schemaRequirementNote:
    "Dynamic in-browser mutation of global store metadata across all storefront sessions requires a dedicated 'StoreSetting' database model and Prisma migration.",
};

const BASELINE_STORE_PREFERENCES = {
  currency: {
    code: "INR",
    symbol: "₹",
    locale: "en-IN",
    description: "Indian Rupee (Standard payment currency across checkout & catalog)",
    isHardened: true,
  },
  orders: {
    preDispatchRestockEnabled: true,
    preDispatchRestockPolicy:
      "Automated stock restoration to Product and ProductVariant upon PENDING, CONFIRMED, or PROCESSING cancellation.",
    postDispatchRestockPolicy:
      "Orders in SHIPPED or DELIVERED status require physical receipt verification and carrier check before restocking.",
    paymentEvidenceRequiredForPaid: true,
    paymentEvidencePolicy:
      "Strict financial audit guard prevents marking orders PAID without verified UTR or payment reference evidence.",
  },
  security: {
    sessionCipher: "256-bit JWE (AES-256-GCM)",
    rateLimitingEnabled: true,
    adminQuota: "60 read req/min, 60 mutation req/min per verified administrator",
  },
};

const BASELINE_NOTIFICATIONS_STATUS = {
  conciergeInquiries: {
    active: true,
    channel: "POSTGRESQL_CENTRAL_TABLE",
    description: "Incoming customer inquiries and bespoke requests logged instantly to ContactEnquiry table.",
  },
  orderConfirmation: {
    active: true,
    channel: "CLIENT_RECEIPT_VERIFICATION",
    description: "Transactional order confirmation receipt generated on checkout completion.",
  },
  automatedOutboundMail: {
    active: false,
    channel: "EXTERNAL_SMTP_SERVICE",
    description:
      "Automated outbound email/SMS webhooks are scheduled for subsequent milestone integration with AWS SES / Resend.",
    isConfigured: false,
  },
};

/**
 * GET /api/crm/settings
 *
 * Retrieves current admin profile from PostgreSQL and verified application settings.
 *
 * Security:
 * - 401 Unauthorized for unauthenticated requests
 * - 403 Forbidden for authenticated customer non-admin accounts
 * - 60 req/min rate limit keyed by verified admin ID
 * - Never returns password hashes, secret keys, or environment tokens
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to access CRM settings",
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

    // Retrieve active administrator profile from PostgreSQL database
    const adminUser = await prisma.user.findUnique({
      where: { id: auth.admin!.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!adminUser) {
      return Response.json(
        { success: false, error: "Administrator record not found in database" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: {
        storeInfo: BASELINE_STORE_INFO,
        adminAccount: {
          id: adminUser.id,
          name: adminUser.name || "Shivura CRM Administrator",
          email: adminUser.email,
          phone: adminUser.phone || "",
          role: adminUser.role,
          createdAt: adminUser.createdAt.toISOString(),
          updatedAt: adminUser.updatedAt.toISOString(),
          passwordRotationMethod:
            "Admin authentication is cryptographically anchored to server configuration with bcrypt cost 12. Passwords must be updated via server environment configuration rather than database mutation.",
        },
        preferences: BASELINE_STORE_PREFERENCES,
        notifications: BASELINE_NOTIFICATIONS_STATUS,
      },
    });
  } catch (error) {
    console.error("[CRM Settings GET Error]:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load settings",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/crm/settings
 *
 * Updates administrator display name and contact phone in the PostgreSQL User table.
 *
 * Security:
 * - 401 Unauthorized for unauthenticated requests
 * - 403 Forbidden for authenticated customer non-admin accounts
 * - 60 mutation req/min rate limit keyed by verified admin ID
 * - Validates name (1-100 chars) and phone
 * - Prevents modification of email or role via this route
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to update settings",
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

    let bodyJson: unknown;
    try {
      bodyJson = await request.json();
    } catch {
      return Response.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (!bodyJson || typeof bodyJson !== "object") {
      return Response.json(
        { success: false, error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const { name, phone } = bodyJson as {
      name?: unknown;
      phone?: unknown;
    };

    const updateData: { name?: string; phone?: string | null } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return Response.json(
          { success: false, error: "Admin name cannot be empty" },
          { status: 400 }
        );
      }
      if (name.trim().length > 100) {
        return Response.json(
          { success: false, error: "Admin name cannot exceed 100 characters" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (phone !== undefined) {
      if (phone === null || phone === "") {
        updateData.phone = null;
      } else if (typeof phone === "string") {
        const trimmedPhone = phone.trim();
        if (trimmedPhone.length > 25) {
          return Response.json(
            { success: false, error: "Phone number cannot exceed 25 characters" },
            { status: 400 }
          );
        }
        updateData.phone = trimmedPhone;
      } else {
        return Response.json(
          { success: false, error: "Phone number must be a valid string or null" },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { success: false, error: "No valid profile fields provided for update" },
        { status: 400 }
      );
    }

    // Persist changes directly to PostgreSQL
    const updatedUser = await prisma.user.update({
      where: { id: auth.admin!.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        updatedAt: true,
      },
    });

    return Response.json({
      success: true,
      message: "Admin profile updated successfully in database",
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone || "",
        role: updatedUser.role,
        updatedAt: updatedUser.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[CRM Settings PATCH Error]:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update settings",
      },
      { status: 500 }
    );
  }
}
