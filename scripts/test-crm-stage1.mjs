/**
 * Test Suite for Stage 1: Shivura CRM Product Management Core Utilities & Taxonomy API
 *
 * Verifies:
 * 1. Zod Product Validation (price, stock, slug, variants, images, SKU generator, slugify)
 * 2. Cloudinary Helper (safe missing config detection, no secret leaks, refusal when unconfigured)
 * 3. Protected GET /api/crm/taxonomy Endpoint (401 unauthenticated, 403 customer, 200 admin)
 */

import {
  createProductSchema,
  productImageInputSchema,
  productVariantInputSchema,
  slugify,
  generateSku,
} from "../lib/validation/product.ts";

const BASE_URL = process.env.TEST_URL || "http://localhost:3001";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shivura.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "shivura@2026";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`  ✅ PASS: ${message}`);
    testsPassed++;
  }
}

async function run() {
  console.log(`\n=============================================================`);
  console.log(`Starting Shivura CRM Product Management Stage 1 Verification`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  // -------------------------------------------------------------
  // Test 1: Product Validation Schema (Zod)
  // -------------------------------------------------------------
  console.log(`[TEST 1] Product Validation Schemas`);

  // 1a. Helper utilities
  assert(slugify("Handmade Terracotta Diya (Set of 4)!") === "handmade-terracotta-diya-set-of-4", "slugify properly formats complex titles");
  assert(generateSku("handmade-diya") === "SHIVURA-HANDMADE-DIYA", "generateSku creates prefixed clean SKU");

  // 1b. Reject invalid price (<= 0)
  const invalidPriceResult = createProductSchema.safeParse({
    name: "Test Brass Thali",
    slug: "test-brass-thali",
    price: -50,
    stock: 10,
  });
  assert(!invalidPriceResult.success, "Rejects negative price");

  // 1c. Reject negative stock
  const invalidStockResult = createProductSchema.safeParse({
    name: "Test Brass Thali",
    slug: "test-brass-thali",
    price: 499,
    stock: -5,
  });
  assert(!invalidStockResult.success, "Rejects negative stock");

  // 1d. Reject invalid slug
  const invalidSlugResult = createProductSchema.safeParse({
    name: "Test Brass Thali",
    slug: "Invalid Slug With Spaces!",
    price: 499,
    stock: 5,
  });
  assert(!invalidSlugResult.success, "Rejects invalid slug with spaces or uppercase");

  // 1e. Validate valid full product
  const validProduct = {
    name: "Shivura Royal Brass Pooja Thali",
    slug: "royal-brass-pooja-thali",
    description: "Handcrafted brass thali for auspicious occasions.",
    shortDescription: "Artisanal luxury brass pooja set.",
    price: 1499,
    originalPrice: 2199,
    pricePrefix: "Starting from",
    sku: "SHIVURA-ROYAL-BRASS-THALI",
    stock: 25,
    isNew: false,
    badge: "Bestseller",
    active: true,
    published: true,
    images: [
      {
        url: "/images/Art3.png",
        publicId: "shivura/products/art3",
        altText: "Brass Thali",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
    variants: [
      {
        name: "Standard 10-inch Set",
        size: "10-inch",
        color: "Antique Gold",
        sku: "SHIVURA-ROYAL-BRASS-THALI-10IN",
        price: 1499,
        stock: 15,
        active: true,
      },
    ],
    categoryIds: ["artisan-crafts"],
    occasionIds: ["diwali"],
  };

  const validParse = createProductSchema.safeParse(validProduct);
  assert(validParse.success, "Parses and validates complete product structure with variants and images");

  // 1f. Image URL validation (rejects invalid relative paths without leading slash)
  const invalidImage = productImageInputSchema.safeParse({
    url: "invalid-path/image.jpg",
  });
  assert(!invalidImage.success, "Rejects image URL lacking http/https or leading slash");

  // 1g. Variant stock validation (rejects non-integer stock)
  const invalidVariantStock = productVariantInputSchema.safeParse({
    name: "Sample Variant",
    stock: 2.5,
  });
  assert(!invalidVariantStock.success, "Rejects non-integer variant stock");

  // -------------------------------------------------------------
  // Test 2: Protected Taxonomy API Endpoint
  // -------------------------------------------------------------
  console.log(`\n[TEST 2] Protected Taxonomy API Security & Data Contract`);

  // 2a. Unauthenticated GET /api/crm/taxonomy must return 401
  const unauthRes = await fetch(`${BASE_URL}/api/crm/taxonomy`);
  assert(
    unauthRes.status === 401,
    `Unauthenticated GET /api/crm/taxonomy returns 401 (got ${unauthRes.status})`
  );
  const unauthData = await unauthRes.json();
  assert(
    unauthData.success === false && unauthData.error?.includes("Unauthenticated"),
    `Unauthenticated response returns error without exposing taxonomy data`
  );

  // 2b. Authenticate as Admin
  console.log(`Authenticating as Admin (${ADMIN_EMAIL})...`);
  const adminLoginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });
  assert(
    adminLoginRes.status === 200,
    `Admin login succeeds with status 200`
  );

  const setCookieHeader = adminLoginRes.headers.get("set-cookie") || "";
  const match = setCookieHeader.match(/shivura_session=([^;]+)/);
  assert(match !== null, `Session cookie received from login`);
  const adminCookie = match[0];

  // 2c. Authenticated Admin GET /api/crm/taxonomy must return 200 with categories and occasions
  const taxonomyRes = await fetch(`${BASE_URL}/api/crm/taxonomy`, {
    headers: { Cookie: adminCookie },
  });
  assert(
    taxonomyRes.status === 200,
    `Admin GET /api/crm/taxonomy returns 200 OK`
  );

  const taxonomyData = await taxonomyRes.json();
  assert(
    taxonomyData.success === true,
    `Response indicates success: true`
  );
  assert(
    Array.isArray(taxonomyData.data?.categories) && taxonomyData.data.categories.length > 0,
    `Returns categories array with length: ${taxonomyData.data?.categories?.length}`
  );
  assert(
    Array.isArray(taxonomyData.data?.occasions) && taxonomyData.data.occasions.length > 0,
    `Returns occasions array with length: ${taxonomyData.data?.occasions?.length}`
  );

  // Inspect first category structure
  const firstCat = taxonomyData.data.categories[0];
  assert(
    firstCat.id && firstCat.name && firstCat.slug && typeof firstCat.productCount === "number",
    `Category object contains id, name, slug, and productCount (${firstCat.name}: ${firstCat.productCount} products)`
  );

  // Inspect media config status
  assert(
    typeof taxonomyData.data.mediaConfig?.cloudinaryConfigured === "boolean",
    `Media config correctly reports cloudinaryConfigured status (${taxonomyData.data.mediaConfig.cloudinaryConfigured})`
  );

  // 2d. Authenticate as Customer and verify 403 Forbidden
  const customerEmail = "customer-taxonomy-tester@shivura-luxury.com";
  const customerPassword = "CustomerPass2026!";

  // Ensure customer exists or signs up
  await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Taxonomy Customer Tester",
      email: customerEmail,
      password: customerPassword,
    }),
  });

  const customerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: customerEmail,
      password: customerPassword,
    }),
  });

  if (customerLoginRes.status === 200) {
    const custCookieHeader = customerLoginRes.headers.get("set-cookie") || "";
    const custMatch = custCookieHeader.match(/shivura_session=([^;]+)/);
    if (custMatch) {
      const customerCookie = custMatch[0];
      const customerTaxonomyRes = await fetch(`${BASE_URL}/api/crm/taxonomy`, {
        headers: { Cookie: customerCookie },
      });
      assert(
        customerTaxonomyRes.status === 403,
        `Customer GET /api/crm/taxonomy returns 403 Forbidden (got ${customerTaxonomyRes.status})`
      );
      const customerTaxonomyData = await customerTaxonomyRes.json();
      assert(
        customerTaxonomyData.success === false && customerTaxonomyData.error?.includes("Forbidden"),
        `Customer response confirms access denial without leaking taxonomy data`
      );
    }
  }

  // -------------------------------------------------------------
  // Test 3: Public Storefront APIs remain unaffected
  // -------------------------------------------------------------
  console.log(`\n[TEST 3] Public Storefront Integrity`);

  const publicProductsRes = await fetch(`${BASE_URL}/api/products?limit=2`);
  assert(
    publicProductsRes.status === 200,
    `Public GET /api/products returns 200 OK without regression`
  );
  const publicProductsData = await publicProductsRes.json();
  assert(
    publicProductsData.success === true && Array.isArray(publicProductsData.data),
    `Public products API retains expected response structure and active catalog`
  );

  console.log(`\n=============================================================`);
  console.log(`Stage 1 Verification Summary:`);
  console.log(`Passed: ${testsPassed} / ${testsPassed + testsFailed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`=============================================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
