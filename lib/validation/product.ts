import { z } from "zod";

/**
 * Normalizes and converts a string into a clean, URL-safe slug.
 * Example: "Shivura Brass Diya Set!" -> "shivura-brass-diya-set"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-word chars (except spaces and hyphens)
    .replace(/[\s_-]+/g, "-") // collapse spaces and dashes to single hyphen
    .replace(/^-+|-+$/g, ""); // trim leading and trailing hyphens
}

/**
 * Generates a clean, deterministic SKU from a product name or slug.
 * Example: "royal-brass-thali" -> "SHIVURA-ROYAL-BRASS-THALI"
 */
export function generateSku(base: string, prefix = "SHIVURA"): string {
  const clean = base
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (clean.startsWith(`${prefix}-`)) {
    return clean;
  }
  return clean ? `${prefix}-${clean}` : prefix;
}

/**
 * Validation schema for product images.
 * Supports both Cloudinary hosted images (with publicId) and local/external image URLs.
 */
export const productImageInputSchema = z.object({
  id: z.string().optional(),
  url: z
    .string()
    .trim()
    .min(1, "Image URL is required")
    .refine(
      (val) => val.startsWith("/") || val.startsWith("http://") || val.startsWith("https://"),
      { message: "Image URL must be an absolute web URL (http/https) or a valid root path (/images/...)" }
    ),
  publicId: z.string().trim().nullable().optional(),
  altText: z.string().trim().max(255, "Alt text too long").nullable().optional(),
  sortOrder: z.coerce.number().int().min(0, "Sort order must be non-negative").default(0),
  isPrimary: z.boolean().default(false),
});

export type ProductImageInput = z.infer<typeof productImageInputSchema>;

/**
 * Validation schema for product variants (size, color, design, stock, SKU, price override).
 */
export const productVariantInputSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Variant name is required")
    .max(100, "Variant name cannot exceed 100 characters"),
  size: z.string().trim().max(50, "Size is too long").nullable().optional(),
  color: z.string().trim().max(50, "Color is too long").nullable().optional(),
  design: z.string().trim().max(100, "Design is too long").nullable().optional(),
  sku: z
    .string()
    .trim()
    .max(100, "Variant SKU cannot exceed 100 characters")
    .nullable()
    .optional(),
  price: z.coerce
    .number()
    .min(0, "Variant price cannot be negative")
    .nullable()
    .optional(),
  stock: z.coerce
    .number()
    .int("Stock must be an integer")
    .min(0, "Stock cannot be negative")
    .default(0),
  active: z.boolean().default(true),
});

export type ProductVariantInput = z.infer<typeof productVariantInputSchema>;

/**
 * Base schema definition without defaults to allow clean partial() operations.
 */
const baseProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Product name is required")
    .max(255, "Product name cannot exceed 255 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug cannot be empty")
    .max(255, "Slug cannot exceed 255 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Slug must contain only lowercase alphanumeric characters and hyphens (e.g. 'brass-diya-set')",
    })
    .optional(),
  description: z.string().trim().nullable().optional(),
  shortDescription: z.string().trim().max(500, "Short description cannot exceed 500 characters").nullable().optional(),
  price: z.coerce
    .number()
    .min(0.01, "Price must be greater than 0"),
  originalPrice: z.coerce
    .number()
    .min(0, "Original price cannot be negative")
    .nullable()
    .optional(),
  pricePrefix: z.string().trim().max(50, "Price prefix too long").nullable().optional(),
  sku: z
    .string()
    .trim()
    .max(100, "SKU cannot exceed 100 characters")
    .nullable()
    .optional(),
  stock: z.coerce
    .number()
    .int("Stock must be an integer")
    .min(0, "Stock cannot be negative"),
  isNew: z.boolean(),
  badge: z.string().trim().max(50, "Badge cannot exceed 50 characters").nullable().optional(),
  active: z.boolean(),
  published: z.boolean(),

  // Media
  images: z.array(productImageInputSchema),

  // Variants
  variants: z.array(productVariantInputSchema),

  // Taxonomy Relations
  categoryIds: z.array(z.string().trim()),
  occasionIds: z.array(z.string().trim()),
});

/**
 * Primary schema for product creation.
 * Enforces valid business rules with defaults for new entities.
 */
export const createProductSchema = baseProductSchema.extend({
  stock: z.coerce
    .number()
    .int("Stock must be an integer")
    .min(0, "Stock cannot be negative")
    .default(0),
  isNew: z.boolean().default(false),
  active: z.boolean().default(true),
  published: z.boolean().default(true),
  images: z.array(productImageInputSchema).default([]),
  variants: z.array(productVariantInputSchema).default([]),
  categoryIds: z.array(z.string().trim()).default([]),
  occasionIds: z.array(z.string().trim()).default([]),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Schema for updating an existing product.
 * Supports partial payload updates without forcing defaults on omitted arrays or flags.
 */
export const updateProductSchema = baseProductSchema.partial().extend({
  id: z.string().optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/**
 * Lightweight schema for quick status toggle mutations (Publish/Draft and Active/Archived).
 */
export const productStatusToggleSchema = z
  .object({
    published: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (data) => typeof data.published === "boolean" || typeof data.active === "boolean",
    { message: "At least one status field ('published' or 'active') must be provided" }
  );

export type ProductStatusToggleInput = z.infer<typeof productStatusToggleSchema>;
