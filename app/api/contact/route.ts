import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkContactRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/contact
 * Submits a contact or bespoke enquiry to the Shivura Concierge.
 * Strictly requires authentication (HTTP 401 for guests).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return Response.json(
        {
          success: false,
          error: "Authentication required to submit inquiries. Please sign in to reach concierge.",
        },
        { status: 401 }
      );
    }

    // Rate limit defense: 3 inquiries per 5 minutes per authenticated user (+ IP limit)
    const rateLimit = await checkContactRateLimit(request, userId);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return Response.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (!rawBody || typeof rawBody !== "object") {
      return Response.json(
        { success: false, error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const { name, email, phone, subject, message } = rawBody as {
      name?: string;
      email?: string;
      phone?: string;
      subject?: string;
      message?: string;
    };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return Response.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return Response.json(
        { success: false, error: "Valid email address is required" },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return Response.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const enquiry = await prisma.contactEnquiry.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: typeof phone === "string" ? phone.trim() : null,
        subject: typeof subject === "string" ? subject.trim() : "General Inquiry",
        message: message.trim(),
        status: "NEW",
      },
      select: {
        id: true,
        name: true,
        email: true,
        subject: true,
        createdAt: true,
      },
    });

    return Response.json(
      {
        success: true,
        message: "Your inquiry has been received with grace by our concierge team.",
        data: enquiry,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Contact API Error]:", error);
    return Response.json(
      { success: false, error: "An unexpected error occurred while processing your inquiry." },
      { status: 500 }
    );
  }
}
