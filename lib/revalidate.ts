import { revalidatePath } from "next/cache";

/**
 * Revalidates storefront pages when a product is created, updated, status-toggled, or deleted.
 * Purges stale static cache for homepage, main catalog, categories, and the specific product detail page.
 */
export function revalidateStorefront(slug?: string) {
  try {
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath("/shop/festival-living");
    revalidatePath("/shop/home-decor");
    revalidatePath("/shop/lighting");
    revalidatePath("/shop/gifting");
    if (slug) {
      revalidatePath(`/shop/${slug}`);
    }
  } catch (err) {
    // Gracefully handle environments where revalidatePath is unavailable
    console.warn("[revalidateStorefront warning]:", err);
  }
}
