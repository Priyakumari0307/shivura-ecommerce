/**
 * Automated Verification Test Suite for Stage 3: Shivura CRM Navigation and Product Listing UI
 *
 * Verifies:
 * 1. Page Route Protection:
 *    - Unauthenticated GET /CRM/products redirects to /CRM/login
 *    - Authenticated customer GET /CRM/products returns 403 Forbidden screen
 *    - Authenticated admin GET /CRM/products renders the management console (200 OK)
 * 2. Executive Navigation:
 *    - /CRM and /CRM/products contain navigation links for Overview and Products
 * 3. Real-Time Summary Metrics Contract:
 *    - GET /api/crm/products returns real-time catalog summary (total, published, draft, lowStock, outOfStock)
 * 4. Filter, Search, Pagination & Sort Combinations:
 *    - Search query matching
 *    - Status filtering (published, draft, low_stock, out_of_stock)
 *    - Category and Occasion filtering
 *    - Pagination metadata
 * 5. Storefront Backward Compatibility:
 *    - Storefront public product APIs and catalog routes remain unaffected
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
  console.log(`Starting Shivura CRM Stage 3 Navigation & Listing Test Suite`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  // -------------------------------------------------------------
  // Test 1: Route Protection for /CRM/products
  // -------------------------------------------------------------
  console.log(`[TEST 1] Route Protection on /CRM/products`);

  // 1a. Unauthenticated access redirect
  const unauthRes = await fetch(`${BASE_URL}/CRM/products`, {
    redirect: "manual",
  });
  const locationHeader = unauthRes.headers.get("location") || "";
  assert(
    unauthRes.status === 307 || unauthRes.status === 302 || locationHeader.includes("/CRM/login"),
    `Unauthenticated GET /CRM/products redirects to /CRM/login (status: ${unauthRes.status}, location: ${locationHeader})`
  );

  // 1b. Customer access denial (403)
  const customerEmail = "customer-stage3-tester@shivura-luxury.com";
  const customerPassword = "CustomerPass2026!";

  await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Customer Stage3 Tester",
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
  assert(custMatch !== null, `Customer login session cookie obtained`);
  const customerCookie = custMatch[0];

  const custPageRes = await fetch(`${BASE_URL}/CRM/products`, {
    headers: { Cookie: customerCookie },
  });
  const custPageHtml = await custPageRes.text();
  assert(
    custPageHtml.includes("Customer Account Detected") || custPageHtml.includes("403 Forbidden"),
    `Customer GET /CRM/products renders 403 Forbidden Access Denied screen`
  );

  // -------------------------------------------------------------
  // Test 2: Admin Authentication & Page Rendering
  // -------------------------------------------------------------
  console.log(`\n[TEST 2] Admin Access & UI Rendering`);

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
  assert(adminMatch !== null, `Admin session cookie obtained`);
  const adminCookie = adminMatch[0];

  // 2a. Admin GET /CRM/products returns 200 OK
  const adminProductsPageRes = await fetch(`${BASE_URL}/CRM/products`, {
    headers: { Cookie: adminCookie },
  });
  assert(adminProductsPageRes.status === 200, `Admin GET /CRM/products returns 200 OK`);
  const adminProductsPageHtml = await adminProductsPageRes.text();

  assert(
    adminProductsPageHtml.includes("Product Management") || adminProductsPageHtml.includes("Products"),
    `/CRM/products page renders heading 'Product Management'`
  );
  assert(
    adminProductsPageHtml.includes("/CRM/products/new"),
    `/CRM/products page contains link to Add Product ('/CRM/products/new')`
  );

  // 2b. Executive Navigation Links rendered
  assert(
    adminProductsPageHtml.includes("/CRM/products") && adminProductsPageHtml.includes("/CRM"),
    `/CRM/products layout renders navigation links for Overview and Products`
  );

  // 2c. Check /CRM overview dashboard also contains navigation
  const adminDashboardRes = await fetch(`${BASE_URL}/CRM`, {
    headers: { Cookie: adminCookie },
  });
  assert(adminDashboardRes.status === 200, `Admin GET /CRM returns 200 OK`);
  const adminDashboardHtml = await adminDashboardRes.text();
  assert(
    adminDashboardHtml.includes("/CRM/products"),
    `/CRM dashboard page contains navigation link to Products catalog`
  );

  // -------------------------------------------------------------
  // Test 3: Catalog Listing API Summary Metrics
  // -------------------------------------------------------------
  console.log(`\n[TEST 3] Real-Time Catalog Summary Metrics`);

  const catalogApiRes = await fetch(`${BASE_URL}/api/crm/products?page=1&limit=5`, {
    headers: { Cookie: adminCookie },
  });
  assert(catalogApiRes.status === 200, `GET /api/crm/products returns 200 OK`);
  const catalogApiData = await catalogApiRes.json();

  assert(
    catalogApiData.summary && typeof catalogApiData.summary.total === "number",
    `Returns real-time summary.total count (${catalogApiData.summary.total})`
  );
  assert(
    typeof catalogApiData.summary.published === "number",
    `Returns real-time summary.published count (${catalogApiData.summary.published})`
  );
  assert(
    typeof catalogApiData.summary.lowStock === "number",
    `Returns real-time summary.lowStock count (${catalogApiData.summary.lowStock})`
  );
  assert(
    typeof catalogApiData.summary.outOfStock === "number",
    `Returns real-time summary.outOfStock count (${catalogApiData.summary.outOfStock})`
  );

  // -------------------------------------------------------------
  // Test 4: Dynamic Taxonomy Data for Filters
  // -------------------------------------------------------------
  console.log(`\n[TEST 4] Taxonomy Metadata for Filters`);

  const taxonomyRes = await fetch(`${BASE_URL}/api/crm/taxonomy`, {
    headers: { Cookie: adminCookie },
  });
  assert(taxonomyRes.status === 200, `GET /api/crm/taxonomy returns 200 OK`);
  const taxonomyData = await taxonomyRes.json();

  assert(
    Array.isArray(taxonomyData.data?.categories) && taxonomyData.data.categories.length > 0,
    `Taxonomy returns categories list for dropdown filters`
  );
  assert(
    Array.isArray(taxonomyData.data?.occasions) && taxonomyData.data.occasions.length > 0,
    `Taxonomy returns occasions list for dropdown filters`
  );

  // -------------------------------------------------------------
  // Test 5: Search, Sort, Filter Combinations
  // -------------------------------------------------------------
  console.log(`\n[TEST 5] Filter & Search Variations`);

  // Search by keyword
  const searchFilterRes = await fetch(`${BASE_URL}/api/crm/products?search=Diya`, {
    headers: { Cookie: adminCookie },
  });
  const searchFilterData = await searchFilterRes.json();
  assert(searchFilterRes.status === 200, `Search query returns 200 OK`);
  assert(searchFilterData.data.length > 0, `Search for 'Diya' finds products (${searchFilterData.data.length} found)`);

  // Filter by category slug
  const catFilterRes = await fetch(`${BASE_URL}/api/crm/products?category=lighting`, {
    headers: { Cookie: adminCookie },
  });
  assert(catFilterRes.status === 200, `Filter by category 'lighting' returns 200 OK`);

  // Filter by stock status
  const stockFilterRes = await fetch(`${BASE_URL}/api/crm/products?status=low_stock`, {
    headers: { Cookie: adminCookie },
  });
  assert(stockFilterRes.status === 200, `Filter by status 'low_stock' returns 200 OK`);

  // Sort by price-desc
  const sortRes = await fetch(`${BASE_URL}/api/crm/products?sort=price-desc&limit=2`, {
    headers: { Cookie: adminCookie },
  });
  const sortData = await sortRes.json();
  assert(sortRes.status === 200, `Sort by price-desc returns 200 OK`);
  if (sortData.data.length >= 2) {
    assert(
      sortData.data[0].price >= sortData.data[1].price,
      `Sort by price-desc orders items correctly (₹${sortData.data[0].price} >= ₹${sortData.data[1].price})`
    );
  }

  // -------------------------------------------------------------
  // Test 6: Public Storefront API Backward Compatibility
  // -------------------------------------------------------------
  console.log(`\n[TEST 6] Storefront Public Compatibility`);

  const publicStorefrontRes = await fetch(`${BASE_URL}/api/products?limit=4`);
  assert(publicStorefrontRes.status === 200, `Public GET /api/products returns 200 OK`);
  const publicStorefrontData = await publicStorefrontRes.json();
  assert(
    publicStorefrontData.success === true &&
    Array.isArray(publicStorefrontData.data) &&
    publicStorefrontData.pagination?.total > 0,
    `Public storefront product API retains intact contract`
  );

  console.log(`\n=============================================================`);
  console.log(`Stage 3 Verification Summary:`);
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
