import { neon } from "@neondatabase/serverless";
import pkg from "@next/env";

const { loadEnvConfig } = pkg;
loadEnvConfig(".");

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shivura.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "shivura@2026";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

let passed = 0;
function assert(condition, msg) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ PASS: ${msg}`);
  passed++;
}

const cleanup = {
  productIds: [],
};

async function run() {
  console.log("\n=============================================================");
  console.log("Starting Step 5C Storefront & CRM Product Flow Verification");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("=============================================================\n");

  const ts = Date.now();

  // 1. Admin login
  console.log("--- 1. Authenticating Admin Session ---");
  const loginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert(loginRes.status === 200, "Admin login successful");
  const cookieHeader = loginRes.headers.get("set-cookie") || "";
  const match = cookieHeader.match(/shivura_session=([^;]+)/);
  const adminCookie = match ? match[0] : "";
  assert(Boolean(adminCookie), "Admin cookie received");

  // Get category for test
  const [cat] = await sql`SELECT id, slug, name FROM "Category" WHERE slug = 'home-decor' LIMIT 1`;
  assert(Boolean(cat), "Found 'home-decor' category");

  try {
    // 2. Test Product Creation with default values
    console.log("\n--- 2. Testing Product Creation with publication = true ---");
    const testSlug = `step5c-brass-vase-${ts}`;
    const testName = `Step 5C Antique Brass Vase ${ts}`;

    const createRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        name: testName,
        slug: testSlug,
        price: 1499,
        originalPrice: 1999,
        stock: 25,
        isNew: true,
        badge: "Bestseller",
        published: true,
        active: true,
        description: "Handcrafted antique brass flower vase with intricate engraving.",
        shortDescription: "Artisanal brass vase",
        categoryIds: [cat.id],
        occasionIds: [],
        variants: [],
        images: [{ url: "/images/Product1.png", altText: testName, isPrimary: true }],
      }),
    });
    assert(createRes.status === 201, `Product created via CRM (status: ${createRes.status})`);
    const createJson = await createRes.json();
    const productId = createJson.data.id;
    cleanup.productIds.push(productId);

    // 3. Verify Database Persistence
    console.log("\n--- 3. Verifying Database Persistence ---");
    const [dbProd] = await sql`
      SELECT id, name, slug, price, stock, published, active 
      FROM "Product" 
      WHERE id = ${productId}
    `;
    assert(Boolean(dbProd), "Product persisted in PostgreSQL");
    assert(dbProd.published === true, "Product published flag is true");
    assert(dbProd.active === true, "Product active flag is true");
    assert(dbProd.stock === 25, "Product stock matches 25");

    // 4. Verify Storefront API: GET /api/products
    console.log("\n--- 4. Verifying Storefront Catalog API ---");
    const apiRes = await fetch(`${BASE_URL}/api/products?search=${encodeURIComponent(testName)}`);
    assert(apiRes.status === 200, "GET /api/products returns 200");
    const apiJson = await apiRes.json();
    const foundApiItem = apiJson.data.find(p => p.id === productId);
    assert(Boolean(foundApiItem), "Created product found in /api/products");
    assert(foundApiItem.name === testName, "Product name matches");
    assert(foundApiItem.price === 1499, "Product price matches");
    assert(foundApiItem.stock === 25, "Product stock matches");
    assert(foundApiItem.isAvailable === true, "isAvailable is true");

    // 5. Verify Storefront API: GET /api/products/[slug]
    console.log("\n--- 5. Verifying Storefront Detail API ---");
    const detailApiRes = await fetch(`${BASE_URL}/api/products/${testSlug}`);
    assert(detailApiRes.status === 200, "GET /api/products/[slug] returns 200");
    const detailApiJson = await detailApiRes.json();
    assert(detailApiJson.data.id === productId, "Detail API returns correct product ID");
    assert(detailApiJson.data.name === testName, "Detail API returns correct name");

    // 6. Verify Storefront Homepage Appearance
    console.log("\n--- 6. Verifying Storefront Homepage Appearance ---");
    const homeRes = await fetch(`${BASE_URL}/`);
    assert(homeRes.status === 200, "GET / returns 200");
    const homeHtml = await homeRes.text();
    assert(homeHtml.includes(testName), "Created product appears in Homepage HTML");

    // 7. Verify Product Detail Page SSR
    console.log("\n--- 7. Verifying Product Detail Page SSR & Metadata ---");
    const pageRes = await fetch(`${BASE_URL}/shop/${testSlug}`);
    assert(pageRes.status === 200, "GET /shop/[slug] returns 200");
    const pageHtml = await pageRes.text();
    assert(pageHtml.includes(testName), "Product detail page HTML contains product name");
    assert(pageHtml.includes(`₹1499.00`) || pageHtml.includes(`1499`), "Product detail page HTML contains price");

    // 8. Test Product Updates and Cache Invalidation
    console.log("\n--- 8. Verifying Product Update and Reflection ---");
    const updatedName = `Step 5C Updated Brass Urli ${ts}`;
    const updateRes = await fetch(`${BASE_URL}/api/crm/products/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        id: productId,
        name: updatedName,
        price: 1799,
        stock: 30,
        published: true,
        active: true,
      }),
    });
    assert(updateRes.status === 200, `Product updated via CRM (status: ${updateRes.status})`);

    // Verify update reflects on storefront API immediately
    const updateCheckRes = await fetch(`${BASE_URL}/api/products/${testSlug}`);
    const updateCheckJson = await updateCheckRes.json();
    assert(updateCheckJson.data.name === updatedName, "Detail API returns updated product name");
    assert(updateCheckJson.data.price === 1799, "Detail API returns updated price");

    // Verify update reflects on homepage
    const updatedHomeRes = await fetch(`${BASE_URL}/`);
    const updatedHomeHtml = await updatedHomeRes.text();
    assert(updatedHomeHtml.includes(updatedName), "Homepage HTML reflects updated product name");

    // 9. Verify Unpublished Products Remain Hidden
    console.log("\n--- 9. Verifying Unpublished Product Visibility Rules ---");
    const unpublishRes = await fetch(`${BASE_URL}/api/crm/products/${productId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ published: false }),
    });
    assert(unpublishRes.status === 200, "Product unpublished via status endpoint");

    // Should return 404 on public detail API
    const unpubApiRes = await fetch(`${BASE_URL}/api/products/${testSlug}`);
    assert(unpubApiRes.status === 404, "Unpublished product returns 404 on GET /api/products/[slug]");

    // Should not appear in catalog search
    const unpubCatalogRes = await fetch(`${BASE_URL}/api/products?search=${encodeURIComponent(updatedName)}`);
    const unpubCatalogJson = await unpubCatalogRes.json();
    const foundUnpub = unpubCatalogJson.data.find(p => p.id === productId);
    assert(!foundUnpub, "Unpublished product is hidden from GET /api/products catalog");

    // Should not appear on homepage
    const unpubHomeRes = await fetch(`${BASE_URL}/`);
    const unpubHomeHtml = await unpubHomeRes.text();
    assert(!unpubHomeHtml.includes(updatedName), "Unpublished product is hidden from Homepage HTML");

    // 10. Verify Inactive Products Remain Hidden
    console.log("\n--- 10. Verifying Inactive Product Visibility Rules ---");
    // Set published: true, active: false (archived)
    const inactRes = await fetch(`${BASE_URL}/api/crm/products/${productId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ published: true, active: false }),
    });
    assert(inactRes.status === 200, "Product marked active = false");

    // Should return 404 on public detail API
    const inactApiRes = await fetch(`${BASE_URL}/api/products/${testSlug}`);
    assert(inactApiRes.status === 404, "Inactive product returns 404 on GET /api/products/[slug]");

    // Should not appear in catalog search
    const inactCatalogRes = await fetch(`${BASE_URL}/api/products?search=${encodeURIComponent(updatedName)}`);
    const inactCatalogJson = await inactCatalogRes.json();
    const foundInact = inactCatalogJson.data.find(p => p.id === productId);
    assert(!foundInact, "Inactive product is hidden from GET /api/products catalog");

    // Should not appear on homepage
    const inactHomeRes = await fetch(`${BASE_URL}/`);
    const inactHomeHtml = await inactHomeRes.text();
    assert(!inactHomeHtml.includes(updatedName), "Inactive product is hidden from Homepage HTML");

    console.log("\n=============================================================");
    console.log(`Step 5C Verification Complete: ALL ${passed} CHECKS PASSED!`);
    console.log("=============================================================\n");
  } finally {
    console.log("Cleaning up test fixtures...");
    for (const pid of cleanup.productIds) {
      await sql`DELETE FROM "ProductCategory" WHERE "productId" = ${pid}`;
      await sql`DELETE FROM "ProductOccasion" WHERE "productId" = ${pid}`;
      await sql`DELETE FROM "ProductImage" WHERE "productId" = ${pid}`;
      await sql`DELETE FROM "ProductVariant" WHERE "productId" = ${pid}`;
      await sql`DELETE FROM "Product" WHERE id = ${pid}`;
    }
    // Also clean up any leftover test products from previous test runs
    await sql`
      DELETE FROM "ProductCategory" 
      WHERE "productId" IN (SELECT id FROM "Product" WHERE name LIKE 'Step 5C%' OR name LIKE 'Investigate Product%')
    `;
    await sql`
      DELETE FROM "ProductImage" 
      WHERE "productId" IN (SELECT id FROM "Product" WHERE name LIKE 'Step 5C%' OR name LIKE 'Investigate Product%')
    `;
    await sql`
      DELETE FROM "Product" 
      WHERE name LIKE 'Step 5C%' OR name LIKE 'Investigate Product%'
    `;
    console.log("Cleaned up test data.");
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
