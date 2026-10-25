import { z } from "zod";

/**
 * Regular expression for validating clean, URL-safe slugs.
 * Requires lowercase alphanumeric characters separated by single hyphens.
 * Examples: "artisan-crafts", "festive-living", "diwali"
 */
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Normalizes and converts arbitrary text into a URL-safe slug.
 * Example: "Artisan Crafts & Gifts!" -> "artisan-crafts-gifts"
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
 * Schema for creating a new Category or Occasion.
 */
export const taxonomyCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name cannot be empty")
    .max(100, "Name cannot exceed 100 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug cannot be empty")
    .max(120, "Slug cannot exceed 120 characters")
    .regex(
      SLUG_REGEX,
      "Slug must contain only lowercase letters, numbers, and single hyphens (e.g., 'artisan-crafts')"
    )
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  image: z
    .string()
    .trim()
    .max(500, "Image URL is too long")
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null))
    .refine(
      (val) =>
        !val ||
        val.startsWith("/") ||
        val.startsWith("http://") ||
        val.startsWith("https://"),
      {
        message:
          "Image must be an absolute web URL (http:// or https://) or a root path (/images/...)",
      }
    ),
  sortOrder: z.coerce
    .number()
    .int("Sort order must be an integer")
    .min(0, "Sort order must be non-negative")
    .default(0),
  active: z.boolean().default(true),
});

export type TaxonomyCreateInput = z.infer<typeof taxonomyCreateSchema>;

/**
 * Schema for updating an existing Category or Occasion.
 */
export const taxonomyUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name cannot be empty")
    .max(100, "Name cannot exceed 100 characters")
    .optional(),
  slug: z
    .string()
    .trim()
    .min(1, "Slug cannot be empty")
    .max(120, "Slug cannot exceed 120 characters")
    .regex(
      SLUG_REGEX,
      "Slug must contain only lowercase letters, numbers, and single hyphens (e.g., 'artisan-crafts')"
    )
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  image: z
    .string()
    .trim()
    .max(500, "Image URL is too long")
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null))
    .refine(
      (val) =>
        !val ||
        val.startsWith("/") ||
        val.startsWith("http://") ||
        val.startsWith("https://"),
      {
        message:
          "Image must be an absolute web URL (http:// or https://) or a root path (/images/...)",
      }
    ),
  sortOrder: z.coerce
    .number()
    .int("Sort order must be an integer")
    .min(0, "Sort order must be non-negative")
    .optional(),
  active: z.boolean().optional(),
});

export type TaxonomyUpdateInput = z.infer<typeof taxonomyUpdateSchema>;
