/**
 * Automated Verification Test Suite for Step 5C.4: CRM Homepage Hero Image Management
 *
 * Verifies:
 * 1. Security & Authorization:
 *    - Unauthenticated GET /api/crm/homepage -> 401
 *    - Unauthenticated PUT /api/crm/homepage -> 401
 *    - Unauthenticated GET /CRM/homepage -> 307 redirect to /CRM/login
 *    - Customer account GET /api/crm/homepage -> 403 Forbidden
 *    - Customer account PUT /api/crm/homepage -> 403 Forbidden
 * 2. Default Configuration:
 *    - Admin GET /api/crm/homepage returns default hero configuration
 * 3. Validation:
 *    - PUT without imageUrl returns 400
 *    - PUT with invalid URL format returns 400
 * 4. Persistence & On-Demand Updates:
 *    - Admin PUT /api/crm/homepage updates and persists in PostgreSQL SiteSetting
 *    - Admin GET /api/crm/homepage returns updated custom hero
 *    - Storefront GET / renders the updated hero banner image and badge
 * 5. Reset to Default:
 *    - Admin DELETE /api/crm/homepage resets to default theme banner
 *    - Storefront GET / renders the default theme banner
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shivura.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "shivura@2026";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    testsFailed++;
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ PASS: ${message}`);
    testsPassed++;
  }
}

async function runTests() {
  console.log("=============================================================");
  console.log("Starting Shivura CRM Step 5C.4 Homepage Hero Test Suite");
  console.log(`Target URL: ${BASE_URL}`);
  console.log("=============================================================\n");

  // -------------------------------------------------------------
  // [TEST 1] Route Protection & Security
  // -------------------------------------------------------------
  console.log("[TEST 1] Route Protection & Admin Authorization");

  // 1.1 Unauthenticated portal page access
  const unauthPortalRes = await fetch(`${BASE_URL}/CRM/homepage`, { redirect: "manual" });
  assert(
    unauthPortalRes.status === 307 || unauthPortalRes.status === 302,
    `Unauthenticated GET /CRM/homepage redirects to login (got ${unauthPortalRes.status})`
  );

  // 1.2 Unauthenticated API access
  const unauthGetRes = await fetch(`${BASE_URL}/api/crm/homepage`);
  assert(unauthGetRes.status === 401, `Unauthenticated GET /api/crm/homepage returns 401 (got ${unauthGetRes.status})`);

  const unauthPutRes = await fetch(`${BASE_URL}/api/crm/homepage`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl: "https://example.com/hero.jpg" }),
  });
  assert(unauthPutRes.status === 401, `Unauthenticated PUT /api/crm/homepage returns 401 (got ${unauthPutRes.status})`);

  // 1.3 Customer account access returns 403
  // Login as customer
  const customerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "priya@example.com", password: "Password@123" }),
  });

  let customerCookie = "";
  if (customerLoginRes.ok) {
    customerCookie = customerLoginRes.headers.get("set-cookie") || "";
  }

  if (customerCookie) {
    const custGetRes = await fetch(`${BASE_URL}/api/crm/homepage`, {
      headers: { cookie: customerCookie },
    });
    assert(custGetRes.status === 403, `Customer GET /api/crm/homepage returns 403 (got ${custGetRes.status})`);

    const custPutRes = await fetch(`${BASE_URL}/api/crm/homepage`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: customerCookie },
      body: JSON.stringify({ imageUrl: "https://example.com/hacked.jpg" }),
    });
    assert(custPutRes.status === 403, `Customer PUT /api/crm/homepage returns 403 (got ${custPutRes.status})`);
  } else {
    console.log("  ⚠️ Skipping customer 403 check (test customer account not present in seed)");
  }

  // -------------------------------------------------------------
  // [TEST 2] Admin Authentication & Default Hero Banner
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Admin Authentication & Default Hero Banner");

  const adminLoginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  assert(adminLoginRes.status === 200, "Admin login succeeded with 200 OK");
  const adminSetCookie = adminLoginRes.headers.get("set-cookie") || "";
  const adminMatch = adminSetCookie.match(/shivura_session=([^;]+)/);
  assert(adminMatch !== null, "Admin session cookie obtained");
  const adminCookie = adminMatch[0];

  const defaultHeroRes = await fetch(`${BASE_URL}/api/crm/homepage`, {
    headers: { Cookie: adminCookie },
  });
  assert(defaultHeroRes.status === 200, `Admin GET /api/crm/homepage returns 200 OK (got ${defaultHeroRes.status})`);

  const defaultHeroJson = await defaultHeroRes.json();
  assert(defaultHeroJson.success === true, "Response success is true");
  assert(Boolean(defaultHeroJson.data?.imageUrl), "Hero configuration has an imageUrl");
  console.log(`  ℹ️ Initial Hero Image: ${defaultHeroJson.data.imageUrl}`);

  // -------------------------------------------------------------
  // [TEST 3] Validation Handling
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Input Validation & Error Handling");

  const emptyUrlRes = await fetch(`${BASE_URL}/api/crm/homepage`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ imageUrl: "   " }),
  });
  assert(emptyUrlRes.status === 400, "PUT with empty imageUrl returns 400 Bad Request");

  const invalidSchemeRes = await fetch(`${BASE_URL}/api/crm/homepage`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ imageUrl: "ftp://files.example.com/banner.png" }),
  });
  assert(invalidSchemeRes.status === 400, "PUT with invalid URL protocol returns 400 Bad Request");

  // -------------------------------------------------------------
  // [TEST 4] Save New Hero Image & Storefront Persistence
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Save Custom Hero Banner & Storefront Verification");

  const testHeroPayload = {
    imageUrl: "https://res.cloudinary.com/dbrtelk0s/image/upload/v1792925000/hero_luxury_festive.jpg",
    publicId: "hero_luxury_festive",
    altText: "Shivura Royal Brass Diyas & Festive Artifacts",
    badgeText: "Diwali Haute Collection 2026",
  };

  const updateRes = await fetch(`${BASE_URL}/api/crm/homepage`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify(testHeroPayload),
  });

  assert(updateRes.status === 200, "Admin PUT /api/crm/homepage returns 200 OK");
  const updateJson = await updateRes.json();
  assert(updateJson.success === true, "Update response success is true");
  assert(updateJson.data.imageUrl === testHeroPayload.imageUrl, "Returned imageUrl matches updated payload");
  assert(updateJson.data.badgeText === testHeroPayload.badgeText, "Returned badgeText matches updated payload");
  assert(updateJson.data.isCustom === true, "Returned isCustom is true");

  // Fetch again via GET to verify persistence
  const verifyGetRes = await fetch(`${BASE_URL}/api/crm/homepage`, {
    headers: { Cookie: adminCookie },
  });
  assert(verifyGetRes.status === 200, "Subsequent GET /api/crm/homepage returns 200 OK");
  const verifyGetJson = await verifyGetRes.json();
  assert(verifyGetJson.data.imageUrl === testHeroPayload.imageUrl, "Persisted imageUrl verified from database");
  assert(verifyGetJson.data.altText === testHeroPayload.altText, "Persisted altText verified from database");
  assert(verifyGetJson.data.badgeText === testHeroPayload.badgeText, "Persisted badgeText verified from database");

  // Verify public storefront renders the new hero image
  const storefrontRes = await fetch(`${BASE_URL}/`, { cache: "no-store" });
  assert(storefrontRes.status === 200, "Public storefront GET / returns 200 OK");
  const storefrontHtml = await storefrontRes.text();

  assert(
    storefrontHtml.includes("hero_luxury_festive.jpg") || storefrontHtml.includes("hero_luxury_festive"),
    "Storefront homepage HTML includes the newly saved hero banner image URL"
  );
  assert(
    storefrontHtml.includes("Diwali Haute Collection 2026"),
    "Storefront homepage HTML includes the custom hero badge text"
  );

  // -------------------------------------------------------------
  // [TEST 5] Reset to Default Theme Hero
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Reset to Default Theme Banner");

  const resetRes = await fetch(`${BASE_URL}/api/crm/homepage`, {
    method: "DELETE",
    headers: { Cookie: adminCookie },
  });

  assert(resetRes.status === 200, "Admin DELETE /api/crm/homepage returns 200 OK");
  const resetJson = await resetRes.json();
  assert(resetJson.success === true, "Reset response success is true");
  assert(resetJson.data.imageUrl === "/images/background.png", "Reset data returned default imageUrl (/images/background.png)");

  // Verify storefront after reset
  const storefrontResetRes = await fetch(`${BASE_URL}/`, { cache: "no-store" });
  assert(storefrontResetRes.status === 200, "Public storefront GET / after reset returns 200 OK");
  const storefrontResetHtml = await storefrontResetRes.text();
  assert(
    storefrontResetHtml.includes("/images/background.png") || storefrontResetHtml.includes("background.png"),
    "Storefront homepage HTML reverted to default background image"
  );

  console.log("\n=============================================================");
  console.log("🎉 ALL HOMEPAGE HERO MANAGEMENT TESTS PASSED SUCCESSFULLY!");
  console.log(`Tests Passed: ${testsPassed} | Tests Failed: ${testsFailed}`);
  console.log("=============================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
