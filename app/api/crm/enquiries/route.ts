import { NextRequest } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmReadRateLimit } from "@/lib/rateLimit";

const VALID_ENQUIRY_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
type EnquiryStatusType = (typeof VALID_ENQUIRY_STATUSES)[number];

/**
 * GET /api/crm/enquiries
 *
 * Administrative listing endpoint for customer and artisan collaboration enquiries.
 *
 * Security:
 * - 401 Unauthorized for unauthenticated requests
 * - 403 Forbidden for authenticated customer non-admin accounts
 * - 60 req/min rate limit keyed by verified admin ID (fails open on store outage)
 * - 200 OK for verified administrators
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to access CRM enquiries",
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

    // Rate limit CRM administrative reads (60 req/min per verified admin)
    const rateLimit = await checkCrmReadRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search")?.trim() || "";
    const rawStatus = searchParams.get("status")?.trim().toUpperCase();
    const rawPage = searchParams.get("page");
    const rawLimit = searchParams.get("limit");

    // Validate page
    let page = 1;
    if (rawPage) {
      const parsedPage = parseInt(rawPage, 10);
      if (isNaN(parsedPage) || parsedPage < 1) {
        return Response.json(
          { success: false, error: "Invalid 'page' parameter. Must be a positive integer." },
          { status: 400 }
        );
      }
      page = parsedPage;
    }

    // Validate limit
    let limit = 10;
    if (rawLimit) {
      const parsedLimit = parseInt(rawLimit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return Response.json(
          { success: false, error: "Invalid 'limit' parameter. Must be a positive integer." },
          { status: 400 }
        );
      }
      limit = Math.min(parsedLimit, 50);
    }

    // Build filter
    const where: Prisma.ContactEnquiryWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
      ];
    }

    if (rawStatus && rawStatus !== "ALL") {
      if (!VALID_ENQUIRY_STATUSES.includes(rawStatus as EnquiryStatusType)) {
        return Response.json(
          {
            success: false,
            error: `Invalid 'status' parameter "${rawStatus}". Must be one of: ALL, ${VALID_ENQUIRY_STATUSES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      where.status = rawStatus as EnquiryStatusType;
    }

    // Execute queries concurrently
    const [enquiries, totalMatching, totalEnquiries, newEnquiries, inProgressEnquiries, resolvedEnquiries] =
      await Promise.all([
        prisma.contactEnquiry.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.contactEnquiry.count({ where }),
        prisma.contactEnquiry.count(),
        prisma.contactEnquiry.count({ where: { status: "NEW" } }),
        prisma.contactEnquiry.count({ where: { status: "IN_PROGRESS" } }),
        prisma.contactEnquiry.count({
          where: { status: { in: ["RESOLVED", "CLOSED"] } },
        }),
      ]);

    const totalPages = Math.ceil(totalMatching / limit) || 1;

    return Response.json({
      success: true,
      data: enquiries,
      pagination: {
        page,
        limit,
        total: totalMatching,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      },
      summary: {
        totalEnquiries,
        newEnquiries,
        inProgressEnquiries,
        resolvedEnquiries,
      },
    });
  } catch (error) {
    console.error("[CRM Enquiries GET Error]:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to retrieve enquiries",
      },
      { status: 500 }
    );
  }
}
