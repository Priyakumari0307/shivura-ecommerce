import { z } from "zod";
import crypto from "node:crypto";

/**
 * Validates a single cart item line in checkout intent.
 * Enforces positive integer quantity and optional trimmed variantId.
 */
export const cartLineIntentSchema = z.object({
  productId: z
    .string({ message: "Product ID is required" })
    .trim()
    .min(1, "Product ID cannot be empty"),
  variantId: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  quantity: z
    .number({ message: "Quantity must be a valid number" })
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than zero"),
});

export type CartLineIntent = z.infer<typeof cartLineIntentSchema>;

/**
 * Normalizes Indian mobile phone numbers to a standard format (+91 XXXXXXXXXX).
 * Accepts:
 * - 10 digits starting with 6, 7, 8, or 9
 * - Prefixed with +91, 91, or 0
 * Returns formatted "+91 XXXXXXXXXX" or null if invalid.
 */
export function normalizeIndianPhone(rawPhone: string): string | null {
  if (typeof rawPhone !== "string") return null;
  const digitsOnly = rawPhone.replace(/\D/g, "");

  let coreDigits: string;
  if (digitsOnly.length === 10) {
    coreDigits = digitsOnly;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    coreDigits = digitsOnly.slice(1);
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    coreDigits = digitsOnly.slice(2);
  } else {
    return null;
  }

  // Indian mobile numbers must start with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(coreDigits)) {
    return null;
  }

  return `+91 ${coreDigits.slice(0, 5)} ${coreDigits.slice(5)}`;
}

export const SUPPORTED_PAYMENT_METHODS = ["COD"] as const;
export type SupportedPaymentMethod = (typeof SUPPORTED_PAYMENT_METHODS)[number];

/**
 * Raw checkout input schema with alias normalization.
 * Accepts both canonical fields (customerName, shippingAddressLine1, etc.)
 * and storefront form shortcuts (fullName, addressLine1, pinCode, etc.).
 */
export const checkoutInputSchema = z.preprocess(
  (val: unknown) => {
    if (!val || typeof val !== "object") return val;
    const obj = { ...(val as Record<string, unknown>) };

    // Support field aliases
    if (!obj.customerName && obj.fullName) obj.customerName = obj.fullName;
    if (!obj.customerEmail && obj.email) obj.customerEmail = obj.email;
    if (!obj.customerPhone && obj.phone) obj.customerPhone = obj.phone;
    if (!obj.shippingAddressLine1 && obj.addressLine1) obj.shippingAddressLine1 = obj.addressLine1;
    if (!obj.shippingAddressLine2 && obj.addressLine2) obj.shippingAddressLine2 = obj.addressLine2;
    if (!obj.shippingCity && obj.city) obj.shippingCity = obj.city;
    if (!obj.shippingState && obj.state) obj.shippingState = obj.state;
    if (!obj.shippingPostalCode && (obj.postalCode || obj.pinCode)) {
      obj.shippingPostalCode = obj.postalCode || obj.pinCode;
    }
    if (!obj.shippingCountry && obj.country) obj.shippingCountry = obj.country;

    return obj;
  },
  z.object({
    customerName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name cannot exceed 100 characters"),

    customerEmail: z
      .string()
      .trim()
      .email("Invalid email address")
      .max(255, "Email address is too long")
      .transform((val) => val.toLowerCase()),

    customerPhone: z
      .string()
      .trim()
      .refine(
        (val) => normalizeIndianPhone(val) !== null,
        {
          message: "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210 or +91 98765 43210)",
        }
      )
      .transform((val) => normalizeIndianPhone(val)!),

    shippingAddressLine1: z
      .string()
      .trim()
      .min(3, "Address Line 1 must be at least 3 characters")
      .max(255, "Address Line 1 cannot exceed 255 characters"),

    shippingAddressLine2: z
      .string()
      .trim()
      .max(255, "Address Line 2 cannot exceed 255 characters")
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),

    shippingCity: z
      .string()
      .trim()
      .min(2, "City must be at least 2 characters")
      .max(100, "City cannot exceed 100 characters"),

    shippingState: z
      .string()
      .trim()
      .min(2, "State must be at least 2 characters")
      .max(100, "State cannot exceed 100 characters"),

    shippingPostalCode: z
      .string()
      .trim()
      .regex(
        /^[1-9][0-9]{5}$/,
        "PIN code must be a valid 6-digit Indian postal code"
      ),

    shippingCountry: z
      .string()
      .trim()
      .max(100)
      .default("India")
      .optional()
      .transform((val) => val || "India"),

    paymentMethod: z.enum(SUPPORTED_PAYMENT_METHODS, {
      message: "Only Cash on Delivery (COD) is supported for this checkout step",
    }),

    couponCode: z
      .string()
      .trim()
      .max(50, "Coupon code cannot exceed 50 characters")
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val.toUpperCase() : null)),

    items: z
      .array(cartLineIntentSchema)
      .min(1, "Checkout requires at least one cart item")
      .refine(
        (items) => {
          const seen = new Set<string>();
          for (const item of items) {
            const key = `${item.productId}:::${item.variantId ?? ""}`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
          }
          return true;
        },
        {
          message: "Duplicate cart lines detected for the same product and variant combination.",
        }
      ),
  })
);

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

/**
 * Validates a UUIDv4 string strictly matching RFC 4122.
 */
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuidV4(val: unknown): val is string {
  return typeof val === "string" && UUID_V4_REGEX.test(val.trim());
}

/**
 * Computes a deterministic SHA-256 hash of the canonical checkout intent.
 * - Deterministically sorts cart lines by productId asc, then variantId asc.
 * - Normalizes strings, emails to lowercase, coupons to uppercase, phone to standard format.
 * - Strips any client-supplied prices, totals, or stock.
 */
export function computeCheckoutIntentHash(input: CheckoutInput): string {
  const sortedItems = [...input.items]
    .map((item) => ({
      productId: item.productId.trim(),
      variantId: item.variantId ? item.variantId.trim() : null,
      quantity: item.quantity,
    }))
    .sort((a, b) => {
      const cmp = a.productId.localeCompare(b.productId);
      if (cmp !== 0) return cmp;
      const vA = a.variantId || "";
      const vB = b.variantId || "";
      return vA.localeCompare(vB);
    });

  const canonicalIntent = {
    couponCode: input.couponCode ? input.couponCode.trim().toUpperCase() : null,
    customerEmail: input.customerEmail.trim().toLowerCase(),
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    items: sortedItems,
    paymentMethod: input.paymentMethod,
    shippingAddressLine1: input.shippingAddressLine1.trim(),
    shippingAddressLine2: input.shippingAddressLine2
      ? input.shippingAddressLine2.trim()
      : null,
    shippingCity: input.shippingCity.trim(),
    shippingCountry: (input.shippingCountry || "India").trim(),
    shippingPostalCode: input.shippingPostalCode.trim(),
    shippingState: input.shippingState.trim(),
  };

  const serialized = JSON.stringify(canonicalIntent);
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

/**
 * Helper to safely validate checkout form/request body.
 */
export function validateCheckoutInput(data: unknown) {
  return checkoutInputSchema.safeParse(data);
}
