import { Metadata } from "next";
import { ALL_PRODUCTS } from "@/lib/constants";
import { ProductDetailView } from "@/components/product";
import { prisma } from "@/lib/prisma";
import { Product } from "@/types";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    const dbProducts = await prisma.product.findMany({
      where: { active: true, published: true },
      select: { slug: true },
    });
    const dbSlugs = dbProducts.map((p) => ({ slug: p.slug }));
    const staticSlugs = ALL_PRODUCTS.map((product) => {
      const slug = product.href.replace("/shop/", "");
      return { slug };
    });
    const slugMap = new Map();
    for (const item of [...staticSlugs, ...dbSlugs]) {
      slugMap.set(item.slug, item);
    }
    return Array.from(slugMap.values());
  } catch {
    return ALL_PRODUCTS.map((product) => {
      const slug = product.href.replace("/shop/", "");
      return { slug };
    });
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const cleanSlug = decodeURIComponent(slug.trim());

  try {
    const dbProduct = await prisma.product.findUnique({
      where: { slug: cleanSlug },
      select: { name: true, description: true, active: true, published: true },
    });

    if (dbProduct && dbProduct.active && dbProduct.published) {
      return {
        title: `${dbProduct.name} | Shivura Handcrafted Luxury`,
        description:
          dbProduct.description ||
          `Discover ${dbProduct.name} handcrafted with timeless elegance and authentic artisanal Indian heritage.`,
      };
    }
  } catch {}

  const product =
    ALL_PRODUCTS.find((p) => p.href === `/shop/${slug}` || p.id === slug) ||
    ALL_PRODUCTS.find((p) => p.href.endsWith(slug));

  if (product) {
    return {
      title: `${product.name} | Shivura Handcrafted Luxury`,
      description: `Discover ${product.name} handcrafted with timeless elegance and authentic artisanal Indian heritage.`,
    };
  }

  const titleCaseSlug = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    title: `${titleCaseSlug} | Shivura Handcrafted Luxury`,
    description: `Discover ${titleCaseSlug} handcrafted with timeless elegance and authentic artisanal Indian heritage.`,
  };
}

function formatDbProduct(product: {
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
  images?: { id: string; url: string; altText?: string | null; isPrimary?: boolean; sortOrder?: number }[];
  categories?: { category?: { id: string; name: string; slug: string } }[];
  occasions?: { occasion?: { id: string; name: string; slug: string } }[];
}): Product {
  const primaryImage =
    product.images?.find((img) => img.isPrimary) || product.images?.[0] || null;
  const categorySlugs = (product.categories || []).map(
    (c) => c.category?.slug || ""
  ).filter(Boolean);
  const occasions = (product.occasions || []).map(
    (o) => o.occasion || { id: "", name: "", slug: "" }
  ).filter((o) => Boolean(o.name));

  return {
    id: product.id,
    name: product.name,
    href: `/shop/${product.slug}`,
    imageSrc: primaryImage?.url || "/images/Product1.png",
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    price: Number(product.price),
    originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
    pricePrefix: product.pricePrefix,
    sku: product.sku,
    stock: product.stock,
    rating: product.rating ?? 0,
    reviewCount: product.reviewCount ?? 0,
    isNew: product.isNew,
    badge: product.badge,
    category: categorySlugs[0] || "",
    categories: categorySlugs,
    occasions,
    primaryImage: primaryImage
      ? {
          id: primaryImage.id,
          url: primaryImage.url,
          altText: primaryImage.altText,
          isPrimary: primaryImage.isPrimary,
        }
      : null,
    images: product.images?.map((img) => ({
      id: img.id,
      url: img.url,
      altText: img.altText,
      isPrimary: img.isPrimary,
      sortOrder: img.sortOrder,
    })),
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const cleanSlug = decodeURIComponent(slug.trim());

  let dbProduct = null;
  try {
    dbProduct = await prisma.product.findUnique({
      where: { slug: cleanSlug },
      include: {
        images: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        },
        variants: {
          where: { active: true },
        },
        categories: {
          select: { category: { select: { id: true, name: true, slug: true } } },
        },
        occasions: {
          select: { occasion: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
  } catch (err) {
    console.error("Error fetching product by slug:", err);
  }

  // If found in database
  if (dbProduct) {
    // Adhere to visibility rules: if unpublished or inactive, do not show details
    if (!dbProduct.active || !dbProduct.published) {
      return <ProductDetailView product={undefined} slug={slug} initialProduct={undefined} />;
    }
    const formatted = formatDbProduct(dbProduct);
    return <ProductDetailView product={formatted} slug={slug} initialProduct={formatted} />;
  }

  // Fallback to static products
  const product =
    ALL_PRODUCTS.find((p) => p.href === `/shop/${slug}` || p.id === slug) ||
    ALL_PRODUCTS.find((p) => p.href.endsWith(slug));

  return <ProductDetailView product={product} slug={slug} initialProduct={product} />;
}
