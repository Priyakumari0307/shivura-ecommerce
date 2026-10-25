import "server-only";
import { prisma } from "@/lib/prisma";

export interface CatalogSummaryMetrics {
  total: number;
  published: number;
  draft: number;
  active: number;
  archived: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  stockAlertsTotal: number;
}

export interface CategoryBreakdownItem {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

export interface OccasionBreakdownItem {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

export interface RecentProductItem {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  price: number;
  originalPrice: number | null;
  stock: number;
  published: boolean;
  active: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
  categoryName: string | null;
  createdAt: string;
}

export interface CrmCatalogAnalyticsData {
  metrics: CatalogSummaryMetrics;
  categories: CategoryBreakdownItem[];
  occasions: OccasionBreakdownItem[];
  recentProducts: RecentProductItem[];
  generatedAt: string;
}

/**
 * Fetches comprehensive, real-time catalog analytics directly from PostgreSQL via Prisma.
 * Executes queries concurrently in a single roundtrip batch.
 */
export async function getCrmCatalogAnalytics(): Promise<CrmCatalogAnalyticsData> {
  const [
    totalProducts,
    publishedProducts,
    draftProducts,
    activeProducts,
    archivedProducts,
    lowStockCount,
    outOfStockCount,
    inStockCount,
    categoriesRaw,
    occasionsRaw,
    recentProductsRaw,
  ] = await Promise.all([
    // 1. Total catalog products
    prisma.product.count(),

    // 2. Published products (visible on storefront when active)
    prisma.product.count({ where: { published: true } }),

    // 3. Draft products (unpublished, hidden from public storefront)
    prisma.product.count({ where: { published: false } }),

    // 4. Active products
    prisma.product.count({ where: { active: true } }),

    // 5. Archived products (deactivated products)
    prisma.product.count({ where: { active: false } }),

    // 6. Low stock products (between 1 and 5 units)
    prisma.product.count({ where: { stock: { lte: 5, gt: 0 } } }),

    // 7. Out of stock products (0 units or negative)
    prisma.product.count({ where: { stock: { lte: 0 } } }),

    // 8. Healthy in-stock products (> 5 units)
    prisma.product.count({ where: { stock: { gt: 5 } } }),

    // 9. Categories with real product counts
    prisma.category.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: { products: true },
        },
      },
      orderBy: {
        products: {
          _count: "desc",
        },
      },
    }),

    // 10. Occasions with real product counts
    prisma.occasion.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: { products: true },
        },
      },
      orderBy: {
        products: {
          _count: "desc",
        },
      },
    }),

    // 11. Recently added / updated products for executive dashboard
    prisma.product.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        price: true,
        originalPrice: true,
        stock: true,
        published: true,
        active: true,
        createdAt: true,
        images: {
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
          ],
          take: 1,
          select: {
            url: true,
            altText: true,
          },
        },
        categories: {
          take: 1,
          select: {
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const metrics: CatalogSummaryMetrics = {
    total: totalProducts,
    published: publishedProducts,
    draft: draftProducts,
    active: activeProducts,
    archived: archivedProducts,
    inStock: inStockCount,
    lowStock: lowStockCount,
    outOfStock: outOfStockCount,
    stockAlertsTotal: lowStockCount + outOfStockCount,
  };

  const categories: CategoryBreakdownItem[] = categoriesRaw.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    productCount: cat._count.products,
  }));

  const occasions: OccasionBreakdownItem[] = occasionsRaw.map((occ) => ({
    id: occ.id,
    name: occ.name,
    slug: occ.slug,
    productCount: occ._count.products,
  }));

  const recentProducts: RecentProductItem[] = recentProductsRaw.map((prod) => ({
    id: prod.id,
    name: prod.name,
    slug: prod.slug,
    sku: prod.sku,
    price: Number(prod.price),
    originalPrice: prod.originalPrice ? Number(prod.originalPrice) : null,
    stock: prod.stock,
    published: prod.published,
    active: prod.active,
    imageUrl: prod.images[0]?.url || null,
    imageAlt: prod.images[0]?.altText || prod.name,
    categoryName: prod.categories[0]?.category?.name || null,
    createdAt: prod.createdAt.toISOString(),
  }));

  return {
    metrics,
    categories,
    occasions,
    recentProducts,
    generatedAt: new Date().toISOString(),
  };
}
