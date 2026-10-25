import type { Product } from "./index";

export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

export type PendingActionType =
  | "ADD_TO_CART"
  | "TOGGLE_WISHLIST"
  | "SUBMIT_ENQUIRY"
  | "CHECKOUT";

export interface PendingActionPayload {
  product?: Product;
  quantity?: number;
  formData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PendingAction {
  type: PendingActionType;
  payload?: PendingActionPayload;
  returnUrl: string;
  reason?: string;
  timestamp: number;
}
