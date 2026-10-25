/**
 * Shivura E-Commerce - Prisma Database Seed Script
 *
 * SOURCE OF DATA:
 * - Products: ALL_PRODUCTS from lib/constants.ts
 * - Categories: SHOP_SIDEBAR_CATEGORIES from lib/constants.ts & CATEGORIES_DATA from components/home/ShopByCategory.tsx
 * - Occasions: OCCASIONS_DATA from components/home/ShopByOccasion.tsx
 *
 * IDEMPOTENT BEHAVIOR:
 * - All entities (Categories, Occasions, Products, Images, Join Relations) use deterministic identifiers and `upsert` queries.
 * - Re-running this script multiple times will safely update existing records without creating duplicates.
 * - No existing records are deleted.
 *
 * LOCAL IMAGE PATHS:
 * - Local paths (e.g. "/images/Product1.png") are preserved directly in `ProductImage.url`.
 * - Local paths will be migrated to Cloudinary URLs in a future deployment step without inventing mock Cloudinary assets now.
 *
 * SAFETY & INTEGRITY:
 * - No artificial users, orders, reviews, or payments are created.
 * - Merchandising filters like "all" and "bestseller" are not converted into fake categories;
 *   "bestseller" is preserved via the product's `badge` attribute.
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../lib/generated/prisma/client";
import { ALL_PRODUCTS } from "../lib/constants";

// Initialize Neon PostgreSQL driver adapter for Prisma 7 runtime
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required to seed the database.");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// ==========================================
// 1. CATEGORIES SOURCE DATA
// ==========================================
// Sourced from `SHOP_SIDEBAR_CATEGORIES` (lib/constants.ts) and `CATEGORIES_DATA` (components/home/ShopByCategory.tsx)
// Excludes frontend navigational filters ("all", "bestseller").
interface CategorySeedInput {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  sortOrder: number;
}

const CATEGORIES_DATA: CategorySeedInput[] = [
  {
    id: "artisan-crafts",
    name: "Artisan Crafts",
    slug: "artisan-crafts",
    image: null,
    sortOrder: 1,
  },
  {
    id: "clay-pottery",
    name: "Clay & Pottery",
    slug: "clay-pottery",
    image: null,
    sortOrder: 2,
  },
  {
    id: "festive-living",
    name: "Festive Living",
    slug: "festive-living",
    image: "/images/festive living.png",
    sortOrder: 3,
  },
  {
    id: "gifting",
    name: "Gifting",
    slug: "gifting",
    image: "/images/gifting.png",
    sortOrder: 4,
  },
  {
    id: "home-decor",
    name: "Home Decor",
    slug: "home-decor",
    image: "/images/home decor.png",
    sortOrder: 5,
  },
  {
    id: "lighting",
    name: "Lighting",
    slug: "lighting",
    image: "/images/lighting.png",
    sortOrder: 6,
  },
  {
    id: "diwali",
    name: "Diwali",
    slug: "diwali",
    image: "/images/festive living.png",
    sortOrder: 7,
  },
  {
    id: "rakhi",
    name: "Rakhi",
    slug: "rakhi",
    image: null,
    sortOrder: 8,
  },
];

// ==========================================
// 2. OCCASIONS SOURCE DATA
// ==========================================
// Sourced strictly from `OCCASIONS_DATA` in components/home/ShopByOccasion.tsx
interface OccasionSeedInput {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  sortOrder: number;
}

const OCCASIONS_DATA: OccasionSeedInput[] = [
  {
    id: "diwali",
    name: "Diwali",
    slug: "diwali",
    image: "/images/festive living.png",
    sortOrder: 1,
  },
  {
    id: "rakhi",
    name: "Rakhi",
    slug: "rakhi",
    image: "/images/om-rakhi.jpg",
    sortOrder: 2,
  },
  {
    id: "festive-gifting",
    name: "Festive Gifting",
    slug: "festive-gifting",
    image: "/images/gifting.png",
    sortOrder: 3,
  },
  {
    id: "everyday-living",
    name: "Everyday Living",
    slug: "everyday-living",
    image: "/images/home decor.png",
    sortOrder: 4,
  },
  {
    id: "griha-pravesh",
    name: "Griha Pravesh",
    slug: "griha-pravesh",
    image: "/images/explore image.png",
    sortOrder: 5,
  },
  {
    id: "weddings",
    name: "Weddings",
    slug: "weddings",
    image: "/images/artisan-diya-woman.jpg",
    sortOrder: 6,
  },
  {
    id: "puja-rituals",
    name: "Puja & Rituals",
    slug: "puja-rituals",
    image: "/images/terracotta-diyas-cloth.jpg",
    sortOrder: 7,
  },
  {
    id: "new-beginnings",
    name: "New Beginnings",
    slug: "new-beginnings",
    image: "/images/Product1.png",
    sortOrder: 8,
  },
];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Derives a deterministic, clean product slug from product href or id.
 * Example: "/shop/formula-1-hot-wheels-display-frame" -> "formula-1-hot-wheels-display-frame"
 */
function deriveProductSlug(href: string, fallbackId: string): string {
  const fromHref = href ? href.replace(/^\/shop\//, "").trim() : "";
  return fromHref || fallbackId;
}

/**
 * Generates a stable, unique, and deterministic SKU from product id.
 * Example: "formula-1-hot-wheels-frame" -> "SHIVURA-FORMULA-1-HOT-WHEELS-FRAME"
 */
function generateProductSku(id: string): string {
  const cleanId = id.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return cleanId.startsWith("SHIVURA-") ? cleanId : `SHIVURA-${cleanId}`;
}

// ==========================================
// MAIN SEED EXECUTION
// ==========================================

async function main() {
  console.log("🌱 Starting idempotent database seed for Shivura e-commerce...");

  // 1. Seed Categories
  console.log(`📦 Seeding ${CATEGORIES_DATA.length} categories...`);
  const categoryMap = new Map<string, string>(); // slug -> id

  for (const cat of CATEGORIES_DATA) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        image: cat.image ?? undefined,
        sortOrder: cat.sortOrder,
        active: true,
      },
      create: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        image: cat.image ?? null,
        sortOrder: cat.sortOrder,
        active: true,
      },
    });
    categoryMap.set(record.slug, record.id);
  }

  // 2. Seed Occasions
  console.log(`🎉 Seeding ${OCCASIONS_DATA.length} occasions...`);
  const occasionMap = new Map<string, string>(); // slug -> id

  for (const occ of OCCASIONS_DATA) {
    const record = await prisma.occasion.upsert({
      where: { slug: occ.slug },
      update: {
        name: occ.name,
        image: occ.image ?? undefined,
        sortOrder: occ.sortOrder,
        active: true,
      },
      create: {
        id: occ.id,
        name: occ.name,
        slug: occ.slug,
        image: occ.image ?? null,
        sortOrder: occ.sortOrder,
        active: true,
      },
    });
    occasionMap.set(record.slug, record.id);
  }

  // 3. Seed Products, Images & Relationships
  console.log(`🛍️ Seeding ${ALL_PRODUCTS.length} products...`);
  let totalProductImages = 0;
  let totalProductCategories = 0;
  let totalProductOccasions = 0;

  for (const prod of ALL_PRODUCTS) {
    const slug = deriveProductSlug(prod.href, prod.id);
    const sku = generateProductSku(prod.id);
    const isNew = Boolean(prod.isNew || prod.badge === "New");
    const badge = prod.badge ?? (prod.isNew ? "New" : null);

    // Upsert Product record
    const productRecord = await prisma.product.upsert({
      where: { slug },
      update: {
        name: prod.name,
        price: prod.price,
        originalPrice: prod.originalPrice ?? null,
        pricePrefix: prod.pricePrefix ?? null,
        sku: sku,
        rating: prod.rating ?? 0,
        reviewCount: prod.reviewCount ?? 0,
        isNew: isNew,
        badge: badge,
        active: true,
        published: true,
      },
      create: {
        id: prod.id,
        name: prod.name,
        slug: slug,
        sku: sku,
        price: prod.price,
        originalPrice: prod.originalPrice ?? null,
        pricePrefix: prod.pricePrefix ?? null,
        rating: prod.rating ?? 0,
        reviewCount: prod.reviewCount ?? 0,
        isNew: isNew,
        badge: badge,
        active: true,
        published: true,
        stock: 0,
      },
    });

    // Upsert Primary Product Image
    if (prod.imageSrc) {
      const deterministicImageId = `img-${prod.id}`;
      await prisma.productImage.upsert({
        where: { id: deterministicImageId },
        update: {
          url: prod.imageSrc,
          altText: prod.name,
          isPrimary: true,
          sortOrder: 0,
        },
        create: {
          id: deterministicImageId,
          productId: productRecord.id,
          url: prod.imageSrc,
          altText: prod.name,
          isPrimary: true,
          sortOrder: 0,
        },
      });
      totalProductImages++;
    }

    // Upsert ProductCategory Relationships
    const productCategorySlugs = new Set<string>();
    if (prod.category && prod.category !== "all" && prod.category !== "bestseller") {
      productCategorySlugs.add(prod.category);
    }
    if (Array.isArray(prod.categories)) {
      for (const cat of prod.categories) {
        if (cat !== "all" && cat !== "bestseller") {
          productCategorySlugs.add(cat);
        }
      }
    }

    for (const catSlug of productCategorySlugs) {
      const categoryId = categoryMap.get(catSlug);
      if (categoryId) {
        await prisma.productCategory.upsert({
          where: {
            productId_categoryId: {
              productId: productRecord.id,
              categoryId: categoryId,
            },
          },
          update: {},
          create: {
            productId: productRecord.id,
            categoryId: categoryId,
          },
        });
        totalProductCategories++;
      }
    }

    // Upsert ProductOccasion Relationships
    // Link products to occasions only when the occasion slug explicitly appears in the product's tags/category
    const productOccasionSlugs = new Set<string>();
    if (prod.category && occasionMap.has(prod.category)) {
      productOccasionSlugs.add(prod.category);
    }
    if (Array.isArray(prod.categories)) {
      for (const cat of prod.categories) {
        if (occasionMap.has(cat)) {
          productOccasionSlugs.add(cat);
        }
      }
    }

    for (const occSlug of productOccasionSlugs) {
      const occasionId = occasionMap.get(occSlug);
      if (occasionId) {
        await prisma.productOccasion.upsert({
          where: {
            productId_occasionId: {
              productId: productRecord.id,
              occasionId: occasionId,
            },
          },
          update: {},
          create: {
            productId: productRecord.id,
            occasionId: occasionId,
          },
        });
        totalProductOccasions++;
      }
    }
  }

  console.log("✅ Database seeding prepared successfully!");
  console.log(`- Categories seeded: ${CATEGORIES_DATA.length}`);
  console.log(`- Occasions seeded: ${OCCASIONS_DATA.length}`);
  console.log(`- Products seeded: ${ALL_PRODUCTS.length}`);
  console.log(`- Primary Product Images linked: ${totalProductImages}`);
  console.log(`- ProductCategory relations created: ${totalProductCategories}`);
  console.log(`- ProductOccasion relations created: ${totalProductOccasions}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error while seeding database:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
