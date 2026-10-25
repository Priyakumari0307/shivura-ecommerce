import { deleteSession } from "@/lib/session";

/**
 * POST /api/auth/logout
 * Clears the session cookie. Safe to call whether an active session exists or not.
 */
export async function POST() {
  try {
    await deleteSession();

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error("[Logout API Error]:", error);
    return Response.json(
      { success: false, error: "An unexpected error occurred during logout" },
      { status: 500 }
    );
  }
}
