import { deleteSession } from "@/lib/session";

/**
 * POST /api/crm/auth/logout
 * Secure admin logout action: expires the HTTP-only session cookie.
 */
export async function POST() {
  try {
    await deleteSession();

    return Response.json({
      success: true,
      message: "Administrative session terminated successfully",
    });
  } catch (error) {
    console.error("[CRM Logout API Error]:", error);
    return Response.json(
      {
        success: false,
        error: "An unexpected error occurred during administrative logout",
      },
      { status: 500 }
    );
  }
}
