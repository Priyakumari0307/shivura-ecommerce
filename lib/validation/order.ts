import { z } from "zod";

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

export const PAYMENT_STATUSES = [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
] as const;

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);

/**
 * Validation schema for administrative order status and payment status updates.
 */
export const orderStatusUpdateSchema = z
  .object({
    status: orderStatusSchema.optional(),
    paymentStatus: paymentStatusSchema.optional(),
    paymentEvidence: z
      .string()
      .trim()
      .max(500, "Payment evidence reference cannot exceed 500 characters")
      .optional(),
  })
  .refine(
    (data) => data.status !== undefined || data.paymentStatus !== undefined,
    {
      message: "At least one of 'status' or 'paymentStatus' must be provided for update.",
    }
  );

export type OrderStatusType = z.infer<typeof orderStatusSchema>;
export type PaymentStatusType = z.infer<typeof paymentStatusSchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;
