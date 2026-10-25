import { prisma } from "@/lib/prisma";
import {
  HeroPlaceholder,
  ShopByCategory,
  CollectionSlides,
  BestSellers,
  MeetOurArtisans,
  ShopByOccasion,
  NewArrivals,
  FollowOurJourney,
  NewsletterStory,
  CategoryItem,
  CATEGORIES_DATA,
  OccasionItem,
  OCCASIONS_DATA,
} from "@/components/home";
import { BEST_SELLERS_PRODUCTS, NEW_ARRIVALS_PRODUCTS } from "@/lib/constants";
import { Product } from "@/types";

export const revalidate = 60; // ISR revalidation

function mapDbProductToStorefront(p: {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  price: unknown;
  originalPrice?: unknown | null;
  pricePrefix?: string | null;
  sku?: string | null;
  stock: number;
  rating?: number | null;
  reviewCount?: number | null;
  isNew?: boolean;
  badge?: string | null;
  images?: { id: string; url: string; altText?: string | null; isPrimary?: boolean }[];
  categories?: { category?: { id: string; name: string; slug: string } }[];
}): Product {
  const primaryImage =
    p.images?.find((img) => img.isPrimary) || p.images?.[0] || null;
  const categorySlugs = (p.categories || []).map(
    (c) => c.category?.slug || ""
  ).filter(Boolean);

  return {
    id: p.id,
    name: p.name,
    href: `/shop/${p.slug}`,
    imageSrc: primaryImage?.url || "/images/Product1.png",
    slug: p.slug,
    description: p.description,
    shortDescription: p.shortDescription,
    price: Number(p.price),
    originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
    pricePrefix: p.pricePrefix,
    sku: p.sku,
    stock: p.stock,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    isNew: p.isNew,
    badge: p.badge,
    category: categorySlugs[0] || "",
    categories: categorySlugs,
    primaryImage: primaryImage
      ? {
          id: primaryImage.id,
          url: primaryImage.url,
          altText: primaryImage.altText,
          isPrimary: primaryImage.isPrimary,
        }
      : null,
  };
}

export default async function Home() {
  let bestSellers: Product[] = BEST_SELLERS_PRODUCTS;
  let newArrivals: Product[] = NEW_ARRIVALS_PRODUCTS;
  let categories: CategoryItem[] = CATEGORIES_DATA;
  let occasions: OccasionItem[] = OCCASIONS_DATA;
  let heroConfig: { imageUrl?: string; altText?: string; badgeText?: string } | null = null;

  try {
    const productInclude = {
      images: { orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }] },
      categories: {
        select: { category: { select: { id: true, name: true, slug: true } } },
      },
    };

    const [dbBestSellers, dbNewArrivals, dbCategories, dbOccasions, dbHeroSetting] = await Promise.all([
      prisma.product.findMany({
        where: {
          active: true,
          published: true,
          OR: [
            { badge: { equals: "Bestseller", mode: "insensitive" } },
            { rating: { gte: 4.5 } },
          ],
        },
        take: 8,
        orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
        include: productInclude,
      }),
      prisma.product.findMany({
        where: {
          active: true,
          published: true,
          OR: [
            { isNew: true },
            { badge: { equals: "New", mode: "insensitive" } },
          ],
        },
        take: 8,
        orderBy: { createdAt: "desc" },
        include: productInclude,
      }),
      prisma.category.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.occasion.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.siteSetting.findUnique({
        where: { key: "homepage_hero" },
      }).catch(() => null),
    ]);

    if (dbHeroSetting?.value) {
      try {
        const parsed = JSON.parse(dbHeroSetting.value);
        if (parsed.imageUrl) {
          heroConfig = {
            imageUrl: parsed.imageUrl,
            altText: parsed.altText || "Shivura Home Decoration",
            badgeText: parsed.badgeText || "New Collection 2026",
          };
        }
      } catch {
        heroConfig = { imageUrl: dbHeroSetting.value };
      }
    }

    if (dbCategories && dbCategories.length > 0) {
      categories = dbCategories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        image: c.image,
        imageSrc: c.image,
      }));
    }

    if (dbOccasions && dbOccasions.length > 0) {
      occasions = dbOccasions.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        image: o.image,
        imageSrc: o.image,
      }));
    }

    if (dbBestSellers.length > 0) {
      bestSellers = dbBestSellers.map(mapDbProductToStorefront);
    } else {
      // Fallback query for published products if no specific bestseller badges exist
      const generalPublished = await prisma.product.findMany({
        where: { active: true, published: true },
        take: 8,
        orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
        include: productInclude,
      });
      if (generalPublished.length > 0) {
        bestSellers = generalPublished.map(mapDbProductToStorefront);
      }
    }

    if (dbNewArrivals.length > 0) {
      newArrivals = dbNewArrivals.map(mapDbProductToStorefront);
    } else {
      // Fallback query for recent published products if no explicit isNew products
      const recentPublished = await prisma.product.findMany({
        where: { active: true, published: true },
        take: 8,
        orderBy: { createdAt: "desc" },
        include: productInclude,
      });
      if (recentPublished.length > 0) {
        newArrivals = recentPublished.map(mapDbProductToStorefront);
      }
    }
  } catch (err) {
    console.warn("[Home Page] Could not load dynamic catalog data, using fallback constants:", err);
  }

  return (
    <>
      <HeroPlaceholder heroImage={heroConfig} />
      <ShopByCategory categories={categories} />
      <CollectionSlides />
      <BestSellers products={bestSellers} />
      <MeetOurArtisans />
      <ShopByOccasion occasions={occasions} />
      <NewArrivals products={newArrivals} />
      <FollowOurJourney />
      <NewsletterStory />
    </>
  );
}