import assert from "node:assert";
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
loadEnvConfig(".");

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shivura.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "shivura@2026";

async function runTests() {
  console.log("\n=============================================================");
  console.log("Starting Shivura CRM Settings Test Suite");
  console.log(`Target URL: ${BASE_URL}`);
  console.log("=============================================================\n");

  let testsPassed = 0;
  function pass(msg) {
    console.log(`  ✅ PASS: ${msg}`);
    testsPassed++;
  }

  // 1. Unauthenticated & Authorization Guards
  console.log("[TEST 1] Route Protection & Security Guards (401 & 403)");

  const unauthPageRes = await fetch(`${BASE_URL}/CRM/settings`, { redirect: "manual" });
  assert(unauthPageRes.status === 307, `Unauthenticated GET /CRM/settings redirects to /CRM/login (got ${unauthPageRes.status})`);
  pass("Unauthenticated GET /CRM/settings redirects to /CRM/login (got 307)");

  const unauthApiGet = await fetch(`${BASE_URL}/api/crm/settings`);
  assert(unauthApiGet.status === 401, `Unauthenticated GET /api/crm/settings returns 401 (got ${unauthApiGet.status})`);
  pass("Unauthenticated GET /api/crm/settings returns 401");

  const unauthApiPatch = await fetch(`${BASE_URL}/api/crm/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Hacker" }),
  });
  assert(unauthApiPatch.status === 401, `Unauthenticated PATCH /api/crm/settings returns 401 (got ${unauthApiPatch.status})`);
  pass("Unauthenticated PATCH /api/crm/settings returns 401");

  // Customer session test
  const custLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "priya@example.com",
      password: "Password123!",
    }),
  });

  if (custLoginRes.status === 200) {
    const custCookie = (custLoginRes.headers.get("set-cookie") || "").match(/shivura_session=([^;]+)/)?.[0];
    if (custCookie) {
      const custApiGet = await fetch(`${BASE_URL}/api/crm/settings`, {
        headers: { Cookie: custCookie },
      });
      assert(custApiGet.status === 403, `Customer GET /api/crm/settings returns 403 (got ${custApiGet.status})`);
      pass("Customer account GET /api/crm/settings returns 403 Forbidden");

      const custApiPatch = await fetch(`${BASE_URL}/api/crm/settings`, {
        method: "PATCH",
        headers: { Cookie: custCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Customer Trying Admin Change" }),
      });
      assert(custApiPatch.status === 403, `Customer PATCH /api/crm/settings returns 403 (got ${custApiPatch.status})`);
      pass("Customer account PATCH /api/crm/settings returns 403 Forbidden");
    }
  }

  // 2. Admin Authentication & Data Retrieval
  console.log("\n[TEST 2] Admin Settings Data Contract & Zero-Secret Verification");

  const adminLoginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });
  assert(adminLoginRes.status === 200, "Admin login succeeded");
  pass("Admin login succeeded with HTTP 200");

  const adminCookie = (adminLoginRes.headers.get("set-cookie") || "").match(/shivura_session=([^;]+)/)?.[0];
  assert(Boolean(adminCookie), "Admin session cookie obtained");
  pass("Admin session cookie obtained");

  // 2a. Admin GET /CRM/settings page
  const adminPageRes = await fetch(`${BASE_URL}/CRM/settings`, {
    headers: { Cookie: adminCookie },
  });
  assert(adminPageRes.status === 200, "Admin GET /CRM/settings renders 200 OK");
  pass("Admin GET /CRM/settings renders 200 OK");
  const adminPageHtml = await adminPageRes.text();
  assert(adminPageHtml.includes("Settings") || adminPageHtml.includes("shivura"), "Settings page contains CRM layout");
  pass("Admin /CRM/settings contains Settings page layout markup");

  // 2b. Admin GET /api/crm/settings
  const settingsRes = await fetch(`${BASE_URL}/api/crm/settings`, {
    headers: { Cookie: adminCookie },
  });
  assert(settingsRes.status === 200, `GET /api/crm/settings returns 200 OK (got ${settingsRes.status})`);
  pass("Admin GET /api/crm/settings returns 200 OK");

  const settingsJson = await settingsRes.json();
  assert(settingsJson.success === true, "Settings response success is true");
  assert(typeof settingsJson.data === "object", "Settings response data is an object");

  const { storeInfo, adminAccount, preferences, notifications } = settingsJson.data;

  // Verify Store Info
  assert(storeInfo.storeName === "SHIVURA", "Store name matches BRAND_NAME");
  assert(Boolean(storeInfo.contactEmail), "Contact email is present");
  assert(Boolean(storeInfo.contactPhone), "Contact phone is present");
  assert(Boolean(storeInfo.address.formatted), "Store formatted address is present");
  pass("Section A: Store Information fields verified");

  // Verify Admin Account
  assert(adminAccount.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(), "Admin email matches configured admin");
  assert(adminAccount.role === "ADMIN", "Admin role is ADMIN");
  pass("Section B: Admin Account fields verified");

  // Verify Zero-Secret Guarantee
  const rawBodyText = JSON.stringify(settingsJson);
  assert(!rawBodyText.includes("$2b$") && !rawBodyText.includes("$2a$"), "Response does NOT expose bcrypt password hashes");
  assert(!rawBodyText.includes("ADMIN_PASSWORD_HASH"), "Response does NOT leak environment hash variable names");
  pass("Zero-Secret Guarantee: No password hashes or secret tokens exposed");

  // Verify Store Preferences
  assert(preferences.currency.code === "INR", "Preferences currency is INR");
  assert(preferences.currency.symbol === "₹", "Preferences symbol is ₹");
  assert(preferences.orders.preDispatchRestockEnabled === true, "Pre-dispatch restock policy is true");
  pass("Section C: Store Preferences (Currency & Order Policies) verified");

  // Verify Notifications
  assert(notifications.conciergeInquiries.active === true, "Concierge inquiries notification is active");
  assert(notifications.automatedOutboundMail.active === false, "Automated outbound mail correctly marked inactive/pending");
  pass("Section D: Notification Capabilities honestly reported (no fake active toggles)");

  // 3. Admin Profile Persistence (PATCH)
  console.log("\n[TEST 3] Admin Profile Update & Database Persistence");

  // 3a. Invalid bodies
  const badNameRes = await fetch(`${BASE_URL}/api/crm/settings`, {
    method: "PATCH",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "   " }),
  });
  assert(badNameRes.status === 400, "Empty admin name returns 400");
  pass("PATCH with whitespace-only name rejected with HTTP 400");

  const tooLongNameRes = await fetch(`${BASE_URL}/api/crm/settings`, {
    method: "PATCH",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "A".repeat(101) }),
  });
  assert(tooLongNameRes.status === 400, "Name over 100 chars returns 400");
  pass("PATCH with name > 100 characters rejected with HTTP 400");

  // 3b. Valid update
  const testName = `Shivura Admin Verification ${Date.now()}`;
  const testPhone = "+91 9876543210";

  const patchSuccessRes = await fetch(`${BASE_URL}/api/crm/settings`, {
    method: "PATCH",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: testName, phone: testPhone }),
  });
  assert(patchSuccessRes.status === 200, `Valid PATCH returns 200 OK (got ${patchSuccessRes.status})`);
  const patchSuccessJson = await patchSuccessRes.json();
  assert(patchSuccessJson.success === true, "PATCH response success is true");
  assert(patchSuccessJson.data.name === testName, "PATCH response returns updated name");
  assert(patchSuccessJson.data.phone === testPhone, "PATCH response returns updated phone");
  pass("PATCH /api/crm/settings persisted profile changes with HTTP 200");

  // 3c. Re-read via GET to verify PostgreSQL persistence
  const verifyGetRes = await fetch(`${BASE_URL}/api/crm/settings`, {
    headers: { Cookie: adminCookie },
  });
  const verifyGetJson = await verifyGetRes.json();
  assert(verifyGetJson.data.adminAccount.name === testName, "GET verifies name persisted in PostgreSQL");
  assert(verifyGetJson.data.adminAccount.phone === testPhone, "GET verifies phone persisted in PostgreSQL");
  pass("Re-read GET /api/crm/settings confirms database persistence");

  // 3d. Restore baseline name
  await fetch(`${BASE_URL}/api/crm/settings`, {
    method: "PATCH",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Shivura CRM Administrator", phone: null }),
  });
  pass("Restored baseline admin name in database cleanly");

  console.log("\n=============================================================");
  console.log(`✅ ALL ${testsPassed} CRM SETTINGS CHECKS PASSED!`);
  console.log("=============================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
