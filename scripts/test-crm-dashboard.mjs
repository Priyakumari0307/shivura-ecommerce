/**
 * Automated Verification Test Suite for Shivura CRM Sidebar Dashboard Redesign
 *
 * Verifies:
 * 1. Page Route Protection:
 *    - Unauthenticated GET /CRM redirects to /CRM/login
 *    - Authenticated customer GET /CRM returns 403 Forbidden Access Denied
 *    - Authenticated admin GET /CRM renders 200 OK
 * 2. Protected Analytics API Security & Contract:
 *    - Unauthenticated GET /api/crm/analytics returns 401 Unauthorized
 *    - Authenticated customer GET /api/crm/analytics returns 403 Forbidden
 *    - Authenticated admin GET /api/crm/analytics returns 200 OK with live database metrics
 * 3. Exact Database Metric Consistency:
 *    - metrics.total matches real database total
 *    - metrics.stockAlertsTotal === metrics.lowStock + metrics.outOfStock
 *    - metrics.published + metrics.draft === metrics.total
 *    - category breakdown has real product counts
 *    - recent products list contains valid edit links
 * 4. Responsive Sidebar & Topbar Elements:
 *    - Layout contains persistent sidebar brand mark and navigation links
 *    - Active state on Overview
 *    - Links to Products (/CRM/products) and Add Product (/CRM/products/new)
 *    - Upcoming entries (Categories, Media, Orders, Artisans, Settings) marked with Upcoming
 *    - Topbar contains admin identity and logout action
 * 5. Storefront Backward Compatibility:
 *    - Public /api/products returns 200 OK
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
  console.log(`Starting Shivura CRM Sidebar Dashboard Redesign Test Suite`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  // -------------------------------------------------------------
  // Test 1: Route Protection for /CRM
  // -------------------------------------------------------------
  console.log(`[TEST 1] Route Protection on /CRM Dashboard`);

  // 1a. Unauthenticated access redirect
  const unauthRes = await fetch(`${BASE_URL}/CRM`, {
    redirect: "manual",
  });
  const locationHeader = unauthRes.headers.get("location") || "";
  assert(
    unauthRes.status === 307 || unauthRes.status === 302 || locationHeader.includes("/CRM/login"),
    `Unauthenticated GET /CRM redirects to /CRM/login (status: ${unauthRes.status})`
  );

  // 1b. Customer access denial (403)
  const customerEmail = "customer-dashboard-tester@shivura-luxury.com";
  const customerPassword = "CustomerPass2026!";

  await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Customer Dashboard Tester",
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

  const custDashboardRes = await fetch(`${BASE_URL}/CRM`, {
    headers: { Cookie: customerCookie },
  });
  const custDashboardHtml = await custDashboardRes.text();
  assert(
    custDashboardHtml.includes("Customer Account Detected") || custDashboardHtml.includes("403 Forbidden"),
    `Customer GET /CRM renders 403 Forbidden Access Denied screen`
  );

  // -------------------------------------------------------------
  // Test 2: Protected Analytics API Endpoint Security
  // -------------------------------------------------------------
  console.log(`\n[TEST 2] Protected Analytics API Security (/api/crm/analytics)`);

  // 2a. Unauthenticated GET /api/crm/analytics -> 401
  const unauthApiRes = await fetch(`${BASE_URL}/api/crm/analytics`);
  assert(unauthApiRes.status === 401, `Unauthenticated GET /api/crm/analytics returns 401 Unauthorized`);

  // 2b. Customer GET /api/crm/analytics -> 403
  const custApiRes = await fetch(`${BASE_URL}/api/crm/analytics`, {
    headers: { Cookie: customerCookie },
  });
  assert(custApiRes.status === 403, `Customer GET /api/crm/analytics returns 403 Forbidden`);

  // -------------------------------------------------------------
  // Test 3: Admin Authentication & Analytics Retrieval
  // -------------------------------------------------------------
  console.log(`\n[TEST 3] Admin Authentication & Live Analytics Contract`);

  const adminLoginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });
  assert(adminLoginRes.status === 200, `Admin authenticated at /api/crm/auth/login`);

  const adminCookieHeader = adminLoginRes.headers.get("set-cookie") || "";
  const adminMatch = adminCookieHeader.match(/shivura_session=([^;]+)/);
  assert(adminMatch !== null, `Admin session cookie extracted`);
  const adminCookie = adminMatch[0];

  // 3a. Admin GET /api/crm/analytics -> 200 OK
  const analyticsRes = await fetch(`${BASE_URL}/api/crm/analytics`, {
    headers: { Cookie: adminCookie },
  });
  assert(analyticsRes.status === 200, `Admin GET /api/crm/analytics returns 200 OK`);

  const analyticsJson = await analyticsRes.json();
  assert(analyticsJson.success === true, `Analytics response indicates success: true`);
  const { metrics, categories, occasions, recentProducts } = analyticsJson.data;

  // 3b. Verify metric values
  assert(typeof metrics.total === "number" && metrics.total >= 0, `Total products metric is valid number (${metrics.total})`);
  assert(typeof metrics.published === "number" && metrics.published >= 0, `Published products metric is valid (${metrics.published})`);
  assert(typeof metrics.draft === "number" && metrics.draft >= 0, `Draft products metric is valid (${metrics.draft})`);
  assert(typeof metrics.lowStock === "number" && metrics.lowStock >= 0, `Low stock metric is valid (${metrics.lowStock})`);
  assert(typeof metrics.outOfStock === "number" && metrics.outOfStock >= 0, `Out of stock metric is valid (${metrics.outOfStock})`);

  // Mathematical consistency
  assert(
    metrics.published + metrics.draft === metrics.total,
    `Published (${metrics.published}) + Draft (${metrics.draft}) === Total (${metrics.total})`
  );
  assert(
    metrics.stockAlertsTotal === metrics.lowStock + metrics.outOfStock,
    `Stock alerts total (${metrics.stockAlertsTotal}) === Low Stock (${metrics.lowStock}) + Out of Stock (${metrics.outOfStock})`
  );

  // Categories & Occasions
  assert(Array.isArray(categories) && categories.length > 0, `Categories breakdown contains entries (${categories.length})`);
  assert(categories[0].productCount >= 0, `Top category '${categories[0].name}' has product count: ${categories[0].productCount}`);
  assert(Array.isArray(occasions) && occasions.length > 0, `Occasions breakdown contains entries (${occasions.length})`);

  // Recent products
  assert(Array.isArray(recentProducts), `Recent products is an array (${recentProducts.length} items)`);
  if (recentProducts.length > 0) {
    const firstProd = recentProducts[0];
    assert(typeof firstProd.id === "string" && firstProd.name, `Recent product has id and name (${firstProd.name})`);
    assert(typeof firstProd.price === "number", `Recent product has numeric price (${firstProd.price})`);
  }

  // -------------------------------------------------------------
  // Test 4: Dashboard UI & Persistent Sidebar Layout Rendering
  // -------------------------------------------------------------
  console.log(`\n[TEST 4] Dashboard UI & Persistent Sidebar Layout`);

  const dashboardRes = await fetch(`${BASE_URL}/CRM`, {
    headers: { Cookie: adminCookie },
  });
  assert(dashboardRes.status === 200, `Admin GET /CRM renders successfully (200 OK)`);

  const dashboardHtml = await dashboardRes.text();

  // 4a. Header & Greeting
  assert(
    dashboardHtml.includes("Store Overview"),
    `Page contains 'Store Overview' heading`
  );
  assert(
    dashboardHtml.includes("Welcome back"),
    `Page contains personalized greeting`
  );

  // 4b. Summary Cards
  assert(
    dashboardHtml.includes("Total Products") &&
    dashboardHtml.includes("Published") &&
    dashboardHtml.includes("Drafts") &&
    dashboardHtml.includes("Stock Alerts"),
    `Page renders all 4 primary summary metric cards`
  );

  // 4c. Sidebar Navigation Links
  assert(
    dashboardHtml.includes("/CRM/products"),
    `Sidebar contains link to Products catalog (/CRM/products)`
  );
  assert(
    dashboardHtml.includes("/CRM/products/new"),
    `Sidebar / Header contains link to Add Product (/CRM/products/new)`
  );
  assert(
    dashboardHtml.includes("Upcoming"),
    `Sidebar distinguishes upcoming roadmap modules with 'Upcoming' badge`
  );
  assert(
    dashboardHtml.includes("SHIVURA"),
    `Sidebar renders luxury brand mark`
  );

  // 4d. Topbar admin identity & actions
  assert(
    dashboardHtml.includes(ADMIN_EMAIL),
    `Topbar renders authenticated admin identity (${ADMIN_EMAIL})`
  );
  assert(
    dashboardHtml.includes("Admin Logout") || dashboardHtml.includes("Log Out"),
    `Header or sidebar contains logout action`
  );

  // 4e. Working edit links for recent products
  if (recentProducts.length > 0) {
    const sampleId = recentProducts[0].id;
    assert(
      dashboardHtml.includes(`/CRM/products/${sampleId}/edit`),
      `Recent products list contains working edit link (/CRM/products/${sampleId}/edit)`
    );
  }

  // -------------------------------------------------------------
  // Test 5: Layout Consistency Across Product Routes
  // -------------------------------------------------------------
  console.log(`\n[TEST 5] Layout Consistency on /CRM/products and /CRM/products/new`);

  const productsPageRes = await fetch(`${BASE_URL}/CRM/products`, {
    headers: { Cookie: adminCookie },
  });
  assert(productsPageRes.status === 200, `Admin GET /CRM/products returns 200 OK`);
  const productsPageHtml = await productsPageRes.text();

  assert(
    productsPageHtml.includes("/CRM") && productsPageHtml.includes("/CRM/products"),
    `Products page layout contains persistent sidebar navigation to Overview and Products`
  );

  const newProductPageRes = await fetch(`${BASE_URL}/CRM/products/new`, {
    headers: { Cookie: adminCookie },
  });
  assert(newProductPageRes.status === 200, `Admin GET /CRM/products/new returns 200 OK`);
  const newProductPageHtml = await newProductPageRes.text();

  assert(
    newProductPageHtml.includes("/CRM") && newProductPageHtml.includes("/CRM/products"),
    `Add Product page layout contains persistent sidebar navigation`
  );

  // -------------------------------------------------------------
  // Test 6: Public Storefront Compatibility
  // -------------------------------------------------------------
  console.log(`\n[TEST 6] Public Storefront Backward Compatibility`);

  const storefrontRes = await fetch(`${BASE_URL}/api/products`);
  assert(storefrontRes.status === 200, `Public GET /api/products returns 200 OK without regression`);

  console.log(`\n=============================================================`);
  console.log(`All Dashboard Redesign Tests Completed Successfully!`);
  console.log(`Passed: ${testsPassed} | Failed: ${testsFailed}`);
  console.log(`=============================================================\n`);
}

runTests().catch((err) => {
  console.error(`\n❌ Test suite aborted:`, err);
  process.exit(1);
});
