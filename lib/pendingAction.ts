import { PendingAction } from "@/types";

const PENDING_ACTION_KEY = "shivura_pending_action";

/**
 * Persists an intended protected action (e.g. Add to Cart, Wishlist, Enquiry)
 * in sessionStorage so it can be resumed after the user logs in or registers.
 */
export function savePendingAction(action: PendingAction): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(action));
  } catch (e) {
    console.warn("[PendingAction] Could not save pending action to sessionStorage", e);
  }
}

/**
 * Retrieves the pending action stored in sessionStorage, if any.
 * Checks timestamp to discard stale actions (> 2 hours old).
 */
export function getPendingAction(): PendingAction | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_ACTION_KEY);
    if (!raw) return null;
    const action: PendingAction = JSON.parse(raw);
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    if (Date.now() - action.timestamp > TWO_HOURS_MS) {
      clearPendingAction();
      return null;
    }
    return action;
  } catch (e) {
    console.warn("[PendingAction] Failed to parse pending action", e);
    return null;
  }
}

/**
 * Clears the pending action from sessionStorage.
 */
export function clearPendingAction(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PENDING_ACTION_KEY);
  } catch (e) {
    console.warn("[PendingAction] Could not remove pending action", e);
  }
}

/**
 * Sanitizes a redirect path to prevent Open Redirect attacks.
 * Only relative internal URLs starting with '/' and not '//' are permitted.
 */
export function sanitizeClientRedirectPath(path: string | null | undefined, fallback: string = "/"): string {
  if (!path) return fallback;
  const trimmed = path.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) {
    return trimmed;
  }
  return fallback;
}
