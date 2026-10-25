import { prisma } from "@/lib/prisma";

export interface ReferencedProduct {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  isPrimary?: boolean;
}

export interface ReferencedTaxonomy {
  id: string;
  name: string;
  slug: string;
}

export interface MediaReferenceReport {
  inUse: boolean;
  totalReferences: number;
  products: ReferencedProduct[];
  categories: ReferencedTaxonomy[];
  occasions: ReferencedTaxonomy[];
  summaryText: string;
}

/**
 * Checks whether an image asset (by its publicId and/or full URL) is currently
 * referenced in the database by any ProductImage, Category, or Occasion.
 *
 * Safety guarantee:
 * Used to block deletion of in-use assets to prevent broken images and orphaned URLs.
 */
export async function checkMediaReference(
  publicId: string,
  url?: string
): Promise<MediaReferenceReport> {
  const normalizedPublicId = publicId.trim();
  const normalizedUrl = url?.trim();

  // 1. Query ProductImage associations
  const productImages = await prisma.productImage.findMany({
    where: {
      OR: [
        { publicId: normalizedPublicId },
        { url: { contains: normalizedPublicId } },
        ...(normalizedUrl ? [{ url: normalizedUrl }] : []),
      ],
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
        },
      },
    },
  });

  // Deduplicate products in case multiple product images reference the same file
  const seenProductIds = new Set<string>();
  const products: ReferencedProduct[] = [];
  for (const pi of productImages) {
    if (!seenProductIds.has(pi.productId)) {
      seenProductIds.add(pi.productId);
      products.push({
        id: pi.product.id,
        name: pi.product.name,
        slug: pi.product.slug,
        sku: pi.product.sku,
        isPrimary: pi.isPrimary,
      });
    }
  }

  // 2. Query Category associations
  const categories = await prisma.category.findMany({
    where: {
      OR: [
        { image: { contains: normalizedPublicId } },
        ...(normalizedUrl ? [{ image: normalizedUrl }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  // 3. Query Occasion associations
  const occasions = await prisma.occasion.findMany({
    where: {
      OR: [
        { image: { contains: normalizedPublicId } },
        ...(normalizedUrl ? [{ image: normalizedUrl }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  const totalReferences = products.length + categories.length + occasions.length;
  const inUse = totalReferences > 0;

  // Build human-friendly explanation
  const parts: string[] = [];
  if (products.length > 0) {
    const names = products.slice(0, 3).map((p) => `"${p.name}"`).join(", ");
    parts.push(
      `${products.length} product(s) (${names}${products.length > 3 ? "..." : ""})`
    );
  }
  if (categories.length > 0) {
    const names = categories.slice(0, 3).map((c) => `"${c.name}"`).join(", ");
    parts.push(
      `${categories.length} category(s) (${names}${categories.length > 3 ? "..." : ""})`
    );
  }
  if (occasions.length > 0) {
    const names = occasions.slice(0, 3).map((o) => `"${o.name}"`).join(", ");
    parts.push(
      `${occasions.length} occasion(s) (${names}${occasions.length > 3 ? "..." : ""})`
    );
  }

  const summaryText = inUse
    ? `Referenced by ${parts.join(" and ")}`
    : "Unused asset (not linked to any catalog items)";

  return {
    inUse,
    totalReferences,
    products,
    categories,
    occasions,
    summaryText,
  };
}

/**
 * Batch-evaluates database references for a list of assets in parallel queries
 * to avoid N+1 database roundtrips when populating the Media Library grid.
 */
export async function batchCheckMediaReferences(
  assets: Array<{ publicId: string; url?: string }>
): Promise<Map<string, MediaReferenceReport>> {
  const results = new Map<string, MediaReferenceReport>();
  if (assets.length === 0) return results;

  // Run reference checks concurrently in batches
  await Promise.all(
    assets.map(async (asset) => {
      const report = await checkMediaReference(asset.publicId, asset.url);
      results.set(asset.publicId, report);
    })
  );

  return results;
}
