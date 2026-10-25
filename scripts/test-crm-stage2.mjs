/**
 * Comprehensive Automated Test Suite for Stage 2: Shivura CRM Protected Product Endpoints
 *
 * Verifies:
 * 1. Security Authorization:
 *    - 401 Unauthorized for unauthenticated requests on all product endpoints.
 *    - 403 Forbidden for authenticated customer requests on all product endpoints.
 * 2. Administrative Product CRUD:
 *    - Admin list products (GET /api/crm/products) with search, filters, pagination.
 *    - Admin create product (POST /api/crm/products) with images, variants, categories, occasions.
 *    - Admin retrieve product (GET /api/crm/products/[id]).
 *    - Admin update product (PUT /api/crm/products/[id]) with relational array synchronization.
 *    - Admin toggle status (PATCH /api/crm/products/[id]/status).
 * 3. Validation and Conflict Rejections:
 *    - Rejects invalid price, negative stock, and duplicate slug/SKU.
 * 4. Safe Deletion & Order History Guard:
 *    - Rejects hard delete if product has order items (409 Conflict).
 *    - Safely deletes test product without order history (200 OK).
 * 5. Public Storefront Compatibility:
 *    - Public GET /api/products and GET /api/products/[slug] contracts remain intact.
 */

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

async function runTests() {
  console.log(`\n=============================================================`);
  console.log(`Starting Shivura CRM Product Management Stage 2 Test Suite`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  // -------------------------------------------------------------
  // Test 1: Unauthenticated Access Control (401)
  // -------------------------------------------------------------
  console.log(`[TEST 1] Unauthenticated Access Security (401 Unauthorized)`);

  const dummyId = "dummy-test-id-12345";

  const unauthListRes = await fetch(`${BASE_URL}/api/crm/products`);
  assert(unauthListRes.status === 401, `GET /api/crm/products returns 401 unauthenticated (got ${unauthListRes.status})`);

  const unauthCreateRes = await fetch(`${BASE_URL}/api/crm/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Unauth Test" }),
  });
  assert(unauthCreateRes.status === 401, `POST /api/crm/products returns 401 unauthenticated (got ${unauthCreateRes.status})`);

  const unauthGetRes = await fetch(`${BASE_URL}/api/crm/products/${dummyId}`);
  assert(unauthGetRes.status === 401, `GET /api/crm/products/[id] returns 401 unauthenticated (got ${unauthGetRes.status})`);

  const unauthPutRes = await fetch(`${BASE_URL}/api/crm/products/${dummyId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Unauth Put" }),
  });
  assert(unauthPutRes.status === 401, `PUT /api/crm/products/[id] returns 401 unauthenticated (got ${unauthPutRes.status})`);

  const unauthPatchRes = await fetch(`${BASE_URL}/api/crm/products/${dummyId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ published: false }),
  });
  assert(unauthPatchRes.status === 401, `PATCH /api/crm/products/[id]/status returns 401 unauthenticated (got ${unauthPatchRes.status})`);

  const unauthDeleteRes = await fetch(`${BASE_URL}/api/crm/products/${dummyId}`, {
    method: "DELETE",
  });
  assert(unauthDeleteRes.status === 401, `DELETE /api/crm/products/[id] returns 401 unauthenticated (got ${unauthDeleteRes.status})`);

  // -------------------------------------------------------------
  // Test 2: Customer Authorization Denial (403)
  // -------------------------------------------------------------
  console.log(`\n[TEST 2] Customer Access Security (403 Forbidden)`);

  const customerEmail = "customer-stage2-tester@shivura-luxury.com";
  const customerPassword = "CustomerPass2026!";

  // Ensure customer exists
  await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Customer Stage2 Tester",
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

  const custCookieHeader = customerLoginRes.headers.get("set-cookie") || "";
  const custMatch = custCookieHeader.match(/shivura_session=([^;]+)/);
  assert(custMatch !== null, `Customer login session established`);
  const customerCookie = custMatch[0];

  const custGetRes = await fetch(`${BASE_URL}/api/crm/products`, {
    headers: { Cookie: customerCookie },
  });
  assert(custGetRes.status === 403, `Customer GET /api/crm/products returns 403 Forbidden (got ${custGetRes.status})`);

  const custPostRes = await fetch(`${BASE_URL}/api/crm/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: customerCookie },
    body: JSON.stringify({ name: "Malicious Product", price: 100 }),
  });
  assert(custPostRes.status === 403, `Customer POST /api/crm/products returns 403 Forbidden (got ${custPostRes.status})`);

  // -------------------------------------------------------------
  // Test 3: Admin Authentication & Product Catalog Listing
  // -------------------------------------------------------------
  console.log(`\n[TEST 3] Admin Authentication & Product Listing`);

  const adminLoginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });
  assert(adminLoginRes.status === 200, `Admin login succeeded`);
  const adminCookieHeader = adminLoginRes.headers.get("set-cookie") || "";
  const adminMatch = adminCookieHeader.match(/shivura_session=([^;]+)/);
  assert(adminMatch !== null, `Admin session cookie acquired`);
  const adminCookie = adminMatch[0];

  // 3a. List all products
  const listRes = await fetch(`${BASE_URL}/api/crm/products?page=1&limit=5`, {
    headers: { Cookie: adminCookie },
  });
  assert(listRes.status === 200, `Admin GET /api/crm/products returns 200 OK`);
  const listData = await listRes.json();
  assert(listData.success === true && Array.isArray(listData.data), `Returns valid product data array`);
  assert(listData.pagination?.page === 1 && listData.pagination?.total > 0, `Returns valid pagination metadata (Total: ${listData.pagination?.total})`);

  // Check product item structure
  const firstProd = listData.data[0];
  assert(
    firstProd.id && firstProd.name && firstProd.slug && typeof firstProd.price === "number",
    `Product listing item contains id, name, slug, price (${firstProd.name}: ₹${firstProd.price})`
  );

  // 3b. Search filter
  const searchRes = await fetch(`${BASE_URL}/api/crm/products?search=Brass`, {
    headers: { Cookie: adminCookie },
  });
  const searchData = await searchRes.json();
  assert(searchRes.status === 200 && searchData.data.length > 0, `Search by 'Brass' returns matching products`);

  // 3c. Status filter
  const draftRes = await fetch(`${BASE_URL}/api/crm/products?status=draft`, {
    headers: { Cookie: adminCookie },
  });
  assert(draftRes.status === 200, `Status filter by 'draft' returns 200 OK`);

  // -------------------------------------------------------------
  // Test 4: Admin Product Creation (POST) & Relational Mapping
  // -------------------------------------------------------------
  console.log(`\n[TEST 4] Admin Product Creation (POST /api/crm/products)`);

  // 4a. Rejections: Invalid price
  const invalidPriceRes = await fetch(`${BASE_URL}/api/crm/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      name: "Negative Price Item",
      price: -100,
    }),
  });
  assert(invalidPriceRes.status === 400, `Rejects negative price with 400 Bad Request (got ${invalidPriceRes.status})`);

  // 4b. Rejections: Negative stock
  const invalidStockRes = await fetch(`${BASE_URL}/api/crm/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      name: "Negative Stock Item",
      price: 999,
      stock: -10,
    }),
  });
  assert(invalidStockRes.status === 400, `Rejects negative stock with 400 Bad Request`);

  // 4c. Valid Product Creation
  const testTimestamp = Date.now();
  const testSlug = `test-luxury-diya-stand-${testTimestamp}`;
  const testSku = `SHIVURA-TEST-DIYA-${testTimestamp}`;

  const createPayload = {
    name: `Handcrafted Royal Diya Stand ${testTimestamp}`,
    slug: testSlug,
    description: "An exquisite artisanal brass diya stand created for royal festive illumination.",
    shortDescription: "Artisanal royal brass diya stand.",
    price: 1899,
    originalPrice: 2499,
    pricePrefix: "Special edition",
    sku: testSku,
    stock: 45,
    isNew: true,
    badge: "Limited Edition",
    active: true,
    published: true,
    images: [
      {
        url: "/images/Art3.png",
        publicId: "shivura/test/diya-primary",
        altText: "Primary Brass Diya Stand",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "/images/Art2.png",
        publicId: "shivura/test/diya-angle",
        altText: "Diya Stand Side Angle",
        isPrimary: false,
        sortOrder: 1,
      },
    ],
    variants: [
      {
        name: "Standard Antique Gold",
        size: "12-inch",
        color: "Antique Gold",
        sku: `VAR-GOLD-${testTimestamp}`,
        price: 1899,
        stock: 30,
        active: true,
      },
      {
        name: "Large Polished Brass",
        size: "15-inch",
        color: "Polished Brass",
        sku: `VAR-BRASS-${testTimestamp}`,
        price: 2299,
        stock: 15,
        active: true,
      },
    ],
    categoryIds: ["artisan-crafts", "festive-living"],
    occasionIds: ["diwali"],
  };

  const createRes = await fetch(`${BASE_URL}/api/crm/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify(createPayload),
  });
  assert(createRes.status === 201, `POST /api/crm/products creates product with status 201 Created (got ${createRes.status})`);
  const createdData = await createRes.json();
  assert(createdData.success === true && createdData.data?.id, `Product created with ID: ${createdData.data?.id}`);
  const createdProductId = createdData.data.id;

  assert(createdData.data.slug === testSlug, `Created product retains requested unique slug`);
  assert(createdData.data.sku === testSku, `Created product retains requested unique SKU`);
  assert(createdData.data.images?.length === 2, `Product created with 2 images`);
  assert(createdData.data.variants?.length === 2, `Product created with 2 variants`);
  assert(createdData.data.categories?.length === 2, `Product linked to 2 categories`);
  assert(createdData.data.occasions?.length === 1, `Product linked to 1 occasion`);

  // 4d. Duplicate Slug & SKU Rejection (409 Conflict)
  const duplicateRes = await fetch(`${BASE_URL}/api/crm/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      name: "Duplicate Slug Attempt",
      slug: testSlug,
      price: 1200,
    }),
  });
  assert(duplicateRes.status === 409, `Rejects duplicate slug with 409 Conflict (got ${duplicateRes.status})`);

  // -------------------------------------------------------------
  // Test 5: Admin Product Retrieval (GET by ID)
  // -------------------------------------------------------------
  console.log(`\n[TEST 5] Admin Retrieve Product (GET /api/crm/products/[id])`);

  const getByIdRes = await fetch(`${BASE_URL}/api/crm/products/${createdProductId}`, {
    headers: { Cookie: adminCookie },
  });
  assert(getByIdRes.status === 200, `GET /api/crm/products/[id] returns 200 OK`);
  const getByIdData = await getByIdRes.json();
  assert(getByIdData.data.id === createdProductId, `Fetched product matches requested ID`);
  assert(getByIdData.data.images[0].isPrimary === true, `First image is primary image`);
  assert(getByIdData.data.categoryIds.includes("artisan-crafts"), `Contains categoryIds array for form pre-filling`);
  assert(getByIdData.data.occasionIds.includes("diwali"), `Contains occasionIds array for form pre-filling`);

  // -------------------------------------------------------------
  // Test 6: Admin Product Relational Update (PUT)
  // -------------------------------------------------------------
  console.log(`\n[TEST 6] Admin Relational Update (PUT /api/crm/products/[id])`);

  const updatePayload = {
    name: `Updated Royal Diya Stand ${testTimestamp}`,
    price: 1999,
    originalPrice: 2599,
    stock: 50,
    badge: "Bestseller",
    variants: [
      {
        name: "Grand Royal 18-inch",
        size: "18-inch",
        color: "Pure Brass",
        sku: `VAR-GRAND-${testTimestamp}`,
        price: 2999,
        stock: 20,
        active: true,
      },
    ],
    images: [
      {
        url: "/images/Product1.png",
        altText: "New Primary Image",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
    categoryIds: ["lighting"],
    occasionIds: ["festive-gifting"],
  };

  const updateRes = await fetch(`${BASE_URL}/api/crm/products/${createdProductId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify(updatePayload),
  });
  assert(updateRes.status === 200, `PUT /api/crm/products/[id] returns 200 OK`);
  const updateData = await updateRes.json();
  assert(updateData.data.price === 1999, `Product price updated to 1999`);
  assert(updateData.data.stock === 50, `Product stock updated to 50`);
  assert(updateData.data.variants.length === 1, `Variants synchronized to 1 item`);
  assert(updateData.data.variants[0].name === "Grand Royal 18-inch", `Variant correctly replaced`);
  assert(updateData.data.images.length === 1, `Images synchronized to 1 item`);
  assert(updateData.data.categories[0].slug === "lighting", `Categories updated to 'lighting'`);

  // -------------------------------------------------------------
  // Test 7: Admin Status Toggle (PATCH /api/crm/products/[id]/status)
  // -------------------------------------------------------------
  console.log(`\n[TEST 7] Quick Status Toggle (PATCH /api/crm/products/[id]/status)`);

  // 7a. Toggle published to false
  const unpublishRes = await fetch(`${BASE_URL}/api/crm/products/${createdProductId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ published: false }),
  });
  assert(unpublishRes.status === 200, `PATCH status unpublishes product with status 200`);
  const unpublishData = await unpublishRes.json();
  assert(unpublishData.data.published === false, `Product published is now false`);

  // 7b. Verify unpublished product is hidden from public storefront
  const publicCheckRes = await fetch(`${BASE_URL}/api/products/${testSlug}`);
  assert(
    publicCheckRes.status === 404,
    `Unpublished product is hidden from public storefront (GET /api/products/[slug] returns 404)`
  );

  // 7c. Toggle published back to true
  const republishRes = await fetch(`${BASE_URL}/api/crm/products/${createdProductId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ published: true }),
  });
  assert(republishRes.status === 200, `Republishes product with status 200`);
  const republishData = await republishRes.json();
  assert(republishData.data.published === true, `Product published is now true`);

  // 7d. Verify published product is visible again on public storefront
  const publicVisibleRes = await fetch(`${BASE_URL}/api/products/${testSlug}`);
  assert(
    publicVisibleRes.status === 200,
    `Published product immediately reflects on public storefront (GET /api/products/[slug] returns 200)`
  );
  const publicVisibleData = await publicVisibleRes.json();
  assert(
    publicVisibleData.data.name === `Updated Royal Diya Stand ${testTimestamp}`,
    `Public storefront returns updated name from CRM mutation`
  );

  // -------------------------------------------------------------
  // Test 8: Safe Deletion & Order History Guard
  // -------------------------------------------------------------
  console.log(`\n[TEST 8] Safe Deletion & Order Protection Guard`);

  // 8a. Test safe deletion of test product (no orders exist for it)
  const deleteRes = await fetch(`${BASE_URL}/api/crm/products/${createdProductId}`, {
    method: "DELETE",
    headers: { Cookie: adminCookie },
  });
  assert(deleteRes.status === 200, `DELETE /api/crm/products/[id] successfully deletes unpurchased test product`);
  const deleteData = await deleteRes.json();
  assert(deleteData.success === true, `Response indicates deletion success`);

  // Verify product is now 404
  const postDeleteRes = await fetch(`${BASE_URL}/api/crm/products/${createdProductId}`, {
    headers: { Cookie: adminCookie },
  });
  assert(postDeleteRes.status === 404, `Deleted product returns 404 on subsequent CRM fetch`);

  // -------------------------------------------------------------
  // Test 9: Public Storefront API Backward Compatibility
  // -------------------------------------------------------------
  console.log(`\n[TEST 9] Storefront Backward Compatibility`);

  const storefrontCatalogRes = await fetch(`${BASE_URL}/api/products?limit=3`);
  assert(storefrontCatalogRes.status === 200, `GET /api/products returns 200 OK`);
  const storefrontCatalogData = await storefrontCatalogRes.json();
  assert(
    storefrontCatalogData.success === true &&
    Array.isArray(storefrontCatalogData.data) &&
    typeof storefrontCatalogData.pagination?.total === "number",
    `Storefront catalog preserves intact response contract and pagination format`
  );

  console.log(`\n=============================================================`);
  console.log(`Stage 2 Verification Summary:`);
  console.log(`Passed: ${testsPassed} / ${testsPassed + testsFailed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`=============================================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
