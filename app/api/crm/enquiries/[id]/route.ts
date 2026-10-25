import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmReadRateLimit, checkCrmWriteRateLimit } from "@/lib/rateLimit";

const VALID_ENQUIRY_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
type EnquiryStatusType = (typeof VALID_ENQUIRY_STATUSES)[number];

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/crm/enquiries/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to view enquiry details",
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

    const { id } = await params;

    if (!id || typeof id !== "string") {
      return Response.json(
        { success: false, error: "Invalid or missing enquiry ID parameter" },
        { status: 400 }
      );
    }

    const enquiry = await prisma.contactEnquiry.findUnique({
      where: { id },
    });

    if (!enquiry) {
      return Response.json(
        { success: false, error: `Enquiry with ID "${id}" was not found.` },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    console.error("[CRM Enquiry Detail GET Error]:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to retrieve enquiry details",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/crm/enquiries/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to update enquiry status",
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

    const { id } = await params;

    if (!id || typeof id !== "string") {
      return Response.json(
        { success: false, error: "Invalid or missing enquiry ID parameter" },
        { status: 400 }
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

    const { status } = (bodyJson || {}) as { status?: string };

    if (!status || !VALID_ENQUIRY_STATUSES.includes(status as EnquiryStatusType)) {
      return Response.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${VALID_ENQUIRY_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const existing = await prisma.contactEnquiry.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Response.json(
        { success: false, error: `Enquiry with ID "${id}" was not found.` },
        { status: 404 }
      );
    }

    const updated = await prisma.contactEnquiry.update({
      where: { id },
      data: {
        status: status as EnquiryStatusType,
      },
    });

    return Response.json({
      success: true,
      message: `Enquiry status updated to ${status}.`,
      data: updated,
    });
  } catch (error) {
    console.error("[CRM Enquiry Status PATCH Error]:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update enquiry status",
      },
      { status: 500 }
    );
  }
}
