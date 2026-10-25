#!/usr/bin/env node

/**
 * Automated Verification Test Suite for Phase 7C - Step 3C:
 * Storefront Stock-Awareness & Cart Pre-Validation
 *
 * Verifies:
 * 1. Adding a standalone product with zero stock is rejected (400 INSUFFICIENT_STOCK).
 * 2. Adding a variant with zero stock is rejected (400 INSUFFICIENT_STOCK).
 * 3. Adding more than available stock is rejected (both initial add and quantity increment).
 * 4. Inactive variants cannot be added (400 VARIANT_INACTIVE).
 * 5. Catalog API reports standalone stock correctly.
 * 6. Catalog API sums active variant stock correctly.
 * 7. Inactive variants are excluded from the catalog stock total (and all-inactive products report 0).
 * 8. Quick Add is disabled for out-of-stock products and remains functional for in-stock products.
 * 9. Guaranteed safe teardown of all test fixtures.
 */

import { neon } from "@neondatabase/serverless";
import pkg from "@next/env";

const { loadEnvConfig } = pkg;
loadEnvConfig(".");

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shivura.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "shivura@2026";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL missing in environment");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

let testsPassed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✅ PASS: ${message}`);
    testsPassed++;
  }
}

const cleanup = {
  cartItemIds: [],
  cartIds: [],
  variantIds: [],
  productIds: [],
  userIds: [],
};

async function run() {
  console.log(`\n=============================================================`);
  console.log(`Starting Phase 7C Step 3C: Storefront Stock-Awareness Test Suite`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  const timestamp = Date.now();

  // Helper: Admin CRM Login
  async function getAdminCookie() {
    const loginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });

    assert(loginRes.status === 200, "Admin CRM authentication succeeds");
    const cookieHeader = loginRes.headers.get("set-cookie") || "";
    const match = cookieHeader.match(/shivura_session=([^;]+)/);
    assert(Boolean(match), "Received shivura_session cookie for admin");
    return match ? match[0] : "";
  }

  // Helper: Customer Login
  async function getCustomerCookie(email, password, name) {
    await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    let cookie = "";
    if (loginRes.status === 200) {
      const cookieHeader = loginRes.headers.get("set-cookie") || "";
      const match = cookieHeader.match(/shivura_session=([^;]+)/);
      if (match) cookie = match[0];
    }
    const [user] = await sql`SELECT id, email FROM "User" WHERE email = ${email.toLowerCase()}`;
    if (user) cleanup.userIds.push(user.id);
    return { user, cookie };
  }

  const adminCookie = await getAdminCookie();
  const customer = await getCustomerCookie(
    `cust-stock-3c-${timestamp}@shivura-luxury.com`,
    "SecurePass2026!",
    "Step 3C Verification Customer"
  );

  try {
    // -----------------------------------------------------------------
    // FIXTURE SETUP
    // -----------------------------------------------------------------
    console.log(`\n--- Creating Test Fixtures ---`);

    // 1. Standalone product with zero stock
    const pZeroRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        name: `[TEST-3C-ZERO] Zero Stock Idol ${timestamp}`,
        slug: `test-3c-zero-${timestamp}`,
        price: 1299,
        stock: 0,
        published: true,
        active: true,
        variants: [],
        images: [],
        categoryIds: [],
        occasionIds: [],
      }),
    });
    assert(pZeroRes.status === 201, "Zero-stock standalone product created (201)");
    const pZeroJson = await pZeroRes.json();
    const pZeroId = pZeroJson.data.id;
    cleanup.productIds.push(pZeroId);

    // 2. Standalone product with stock = 5
    const pFiveRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        name: `[TEST-3C-FIVE] Limited Stock Candle ${timestamp}`,
        slug: `test-3c-five-${timestamp}`,
        price: 899,
        stock: 5,
        published: true,
        active: true,
        variants: [],
        images: [],
        categoryIds: [],
        occasionIds: [],
      }),
    });
    assert(pFiveRes.status === 201, "In-stock standalone product created (201)");
    const pFiveJson = await pFiveRes.json();
    const pFiveId = pFiveJson.data.id;
    cleanup.productIds.push(pFiveId);

    // 3. Multi-variant product:
    // - Variant A: active=true, stock=10
    // - Variant B: active=true, stock=0 (out of stock)
    // - Variant C: active=false, stock=20 (inactive)
    const pVarRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        name: `[TEST-3C-VAR] Multi-Variant Lamp ${timestamp}`,
        slug: `test-3c-var-${timestamp}`,
        price: 2499,
        published: true,
        active: true,
        variants: [
          { name: "Brass (In Stock)", sku: `3C-BRASS-${timestamp}`, price: 2499, stock: 10, active: true },
          { name: "Copper (OOS)", sku: `3C-COPPER-${timestamp}`, price: 2499, stock: 0, active: true },
          { name: "Gold (Inactive)", sku: `3C-GOLD-${timestamp}`, price: 2999, stock: 20, active: false },
        ],
        images: [],
        categoryIds: [],
        occasionIds: [],
      }),
    });
    assert(pVarRes.status === 201, "Multi-variant product created (201)");
    const pVarJson = await pVarRes.json();
    const pVarId = pVarJson.data.id;
    cleanup.productIds.push(pVarId);
    pVarJson.data.variants.forEach((v) => cleanup.variantIds.push(v.id));

    const varA = pVarJson.data.variants.find((v) => v.name.includes("Brass"));
    assert(Boolean(varA), "Variant A (Brass - in stock) created");
    const varB = pVarJson.data.variants.find((v) => v.name.includes("Copper"));
    const varC = pVarJson.data.variants.find((v) => v.name.includes("Gold"));

    // 4. Product with all variants inactive
    const pAllInactRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        name: `[TEST-3C-INACT] All Inactive Variants Product ${timestamp}`,
        slug: `test-3c-inact-${timestamp}`,
        price: 1999,
        published: true,
        active: true,
        variants: [
          { name: "Option 1 (Inactive)", sku: `3C-OPT1-${timestamp}`, price: 1999, stock: 15, active: false },
          { name: "Option 2 (Inactive)", sku: `3C-OPT2-${timestamp}`, price: 1999, stock: 25, active: false },
        ],
        images: [],
        categoryIds: [],
        occasionIds: [],
      }),
    });
    assert(pAllInactRes.status === 201, "All-inactive variants product created (201)");
    const pAllInactJson = await pAllInactRes.json();
    const pAllInactId = pAllInactJson.data.id;
    cleanup.productIds.push(pAllInactId);
    pAllInactJson.data.variants.forEach((v) => cleanup.variantIds.push(v.id));

    // -----------------------------------------------------------------
    // TEST 1: Adding a standalone product with zero stock is rejected
    // -----------------------------------------------------------------
    console.log(`\n[TEST 1] Adding a standalone product with zero stock is rejected`);
    const addZeroRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customer.cookie },
      body: JSON.stringify({
        productId: pZeroId,
        quantity: 1,
      }),
    });
    assert(addZeroRes.status === 400, `POST /api/cart/items returns 400 (got ${addZeroRes.status})`);
    const addZeroJson = await addZeroRes.json();
    assert(addZeroJson.error?.code === "INSUFFICIENT_STOCK", "Error code is INSUFFICIENT_STOCK");
    assert(addZeroJson.error?.message.includes("out of stock"), `Error message indicates out of stock (got "${addZeroJson.error?.message}")`);

    // -----------------------------------------------------------------
    // TEST 2: Adding a variant with zero stock is rejected
    // -----------------------------------------------------------------
    console.log(`\n[TEST 2] Adding a variant with zero stock is rejected`);
    const addVarOosRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customer.cookie },
      body: JSON.stringify({
        productId: pVarId,
        variantId: varB.id,
        quantity: 1,
      }),
    });
    assert(addVarOosRes.status === 400, `POST /api/cart/items for zero-stock variant returns 400 (got ${addVarOosRes.status})`);
    const addVarOosJson = await addVarOosRes.json();
    assert(addVarOosJson.error?.code === "INSUFFICIENT_STOCK", "Error code is INSUFFICIENT_STOCK");
    assert(addVarOosJson.error?.message.includes("out of stock"), `Error message indicates out of stock (got "${addVarOosJson.error?.message}")`);

    // -----------------------------------------------------------------
    // TEST 3: Adding more than available stock is rejected
    // -----------------------------------------------------------------
    console.log(`\n[TEST 3] Adding more than available stock is rejected`);
    // 3A. Initial request exceeds stock (requested 6, available 5)
    const addExcessRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customer.cookie },
      body: JSON.stringify({
        productId: pFiveId,
        quantity: 6,
      }),
    });
    assert(addExcessRes.status === 400, `Excess quantity request returns 400 (got ${addExcessRes.status})`);
    const addExcessJson = await addExcessRes.json();
    assert(addExcessJson.error?.code === "INSUFFICIENT_STOCK", "Error code is INSUFFICIENT_STOCK");
    assert(addExcessJson.error?.message.includes("exceeds available stock"), "Message indicates requested quantity exceeds available stock");

    // 3B. Successful initial add (3 units out of 5)
    const addValidRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customer.cookie },
      body: JSON.stringify({
        productId: pFiveId,
        quantity: 3,
      }),
    });
    assert(addValidRes.status === 201, `Valid quantity add succeeds with 201 (got ${addValidRes.status})`);
    const validCartJson = await addValidRes.json();
    cleanup.cartIds.push(validCartJson.data.id);

    // 3C. Adding 3 more to cart (3 + 3 = 6 > 5) should be rejected
    const addMoreExcessRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customer.cookie },
      body: JSON.stringify({
        productId: pFiveId,
        quantity: 3,
      }),
    });
    assert(addMoreExcessRes.status === 400, `Incremental add exceeding limit returns 400 (got ${addMoreExcessRes.status})`);
    const addMoreExcessJson = await addMoreExcessRes.json();
    assert(addMoreExcessJson.error?.code === "INSUFFICIENT_STOCK", "Error code is INSUFFICIENT_STOCK on incremental addition");

    // -----------------------------------------------------------------
    // TEST 4: Inactive variants cannot be added
    // -----------------------------------------------------------------
    console.log(`\n[TEST 4] Inactive variants cannot be added`);
    const addInactiveRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customer.cookie },
      body: JSON.stringify({
        productId: pVarId,
        variantId: varC.id,
        quantity: 1,
      }),
    });
    assert(addInactiveRes.status === 400, `Inactive variant add returns 400 (got ${addInactiveRes.status})`);
    const addInactiveJson = await addInactiveRes.json();
    assert(addInactiveJson.error?.code === "VARIANT_INACTIVE", `Error code is VARIANT_INACTIVE (got "${addInactiveJson.error?.code}")`);

    // -----------------------------------------------------------------
    // TEST 5: Catalog API reports standalone stock correctly
    // -----------------------------------------------------------------
    console.log(`\n[TEST 5] Catalog API reports standalone stock correctly`);
    const catZeroRes = await fetch(`${BASE_URL}/api/products?search=${encodeURIComponent(`[TEST-3C-ZERO] Zero Stock Idol ${timestamp}`)}`);
    assert(catZeroRes.status === 200, "Catalog query for zero-stock product returns 200 OK");
    const catZeroJson = await catZeroRes.json();
    const pZeroItem = catZeroJson.data.find((p) => p.id === pZeroId);
    assert(Boolean(pZeroItem), "Zero-stock product found in catalog response");
    assert(pZeroItem.stock === 0, `Catalog reports stock === 0 (got ${pZeroItem.stock})`);
    assert(pZeroItem.isAvailable === false, "Catalog reports isAvailable === false for 0 stock");

    const catFiveRes = await fetch(`${BASE_URL}/api/products?search=${encodeURIComponent(`[TEST-3C-FIVE] Limited Stock Candle ${timestamp}`)}`);
    const catFiveJson = await catFiveRes.json();
    const pFiveItem = catFiveJson.data.find((p) => p.id === pFiveId);
    assert(Boolean(pFiveItem), "In-stock product found in catalog response");
    assert(pFiveItem.stock === 5, `Catalog reports stock === 5 (got ${pFiveItem.stock})`);
    assert(pFiveItem.isAvailable === true, "Catalog reports isAvailable === true for in-stock product");

    // -----------------------------------------------------------------
    // TEST 6: Catalog API sums active variant stock correctly
    // -----------------------------------------------------------------
    console.log(`\n[TEST 6] Catalog API sums active variant stock correctly`);
    const catVarRes = await fetch(`${BASE_URL}/api/products?search=${encodeURIComponent(`[TEST-3C-VAR] Multi-Variant Lamp ${timestamp}`)}`);
    assert(catVarRes.status === 200, "Catalog query for multi-variant product returns 200 OK");
    const catVarJson = await catVarRes.json();
    const pVarItem = catVarJson.data.find((p) => p.id === pVarId);
    assert(Boolean(pVarItem), "Multi-variant product found in catalog response");
    // Variant A (stock 10) + Variant B (stock 0) = 10
    assert(pVarItem.stock === 10, `Catalog API reports active variant sum of 10 (got ${pVarItem.stock})`);
    assert(pVarItem.isAvailable === true, "Catalog reports isAvailable === true");

    // -----------------------------------------------------------------
    // TEST 7: Inactive variants are excluded from stock total
    // -----------------------------------------------------------------
    console.log(`\n[TEST 7] Inactive variants are excluded from the stock total`);
    // Multi-variant product had Variant C (stock 20, active: false). If included, stock would be 30.
    assert(pVarItem.stock !== 30, "Inactive variant stock (20) was NOT added to total stock (30)");
    assert(pVarItem.stock === 10, "Stock strictly matches active variants sum (10)");

    // Test product where all variants are inactive: must report stock 0 and isAvailable false
    const catInactRes = await fetch(`${BASE_URL}/api/products?search=${encodeURIComponent(`[TEST-3C-INACT] All Inactive Variants Product ${timestamp}`)}`);
    const catInactJson = await catInactRes.json();
    const pInactItem = catInactJson.data.find((p) => p.id === pAllInactId);
    assert(Boolean(pInactItem), "All-inactive product found in catalog response");
    assert(pInactItem.stock === 0, `All-inactive variants product reports stock === 0 (got ${pInactItem.stock})`);
    assert(pInactItem.isAvailable === false, "All-inactive variants product reports isAvailable === false");

    // -----------------------------------------------------------------
    // TEST 8: Quick Add is disabled for out-of-stock products
    // -----------------------------------------------------------------
    console.log(`\n[TEST 8] Quick Add behaves consistently with stock availability`);
    // Attempting to Quick Add (calling cart addition for the out of stock product) is rejected
    const quickAddOosRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customer.cookie },
      body: JSON.stringify({
        productId: pZeroId,
        quantity: 1,
      }),
    });
    assert(quickAddOosRes.status === 400, "Quick Add for out-of-stock product is rejected with 400");

    // Quick Add for in-stock product succeeds
    const quickAddInStockRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customer.cookie },
      body: JSON.stringify({
        productId: pFiveId,
        quantity: 1,
      }),
    });
    // Already had 3 in cart, adding 1 more -> 4 <= 5 succeeds!
    assert(quickAddInStockRes.status === 201, "Quick Add for in-stock product succeeds with 201");

    console.log(`\n=============================================================`);
    console.log(`Storefront Stock-Awareness Test Suite: ALL ${testsPassed} CHECKS PASSED`);
    console.log(`=============================================================\n`);
  } finally {
    console.log("Cleaning up test fixtures...");
    try {
      if (cleanup.cartIds.length > 0) {
        await sql`DELETE FROM "CartItem" WHERE "cartId" = ANY(${cleanup.cartIds})`;
        await sql`DELETE FROM "Cart" WHERE "id" = ANY(${cleanup.cartIds})`;
      }
      if (cleanup.variantIds.length > 0) {
        await sql`DELETE FROM "ProductVariant" WHERE "id" = ANY(${cleanup.variantIds})`;
      }
      if (cleanup.productIds.length > 0) {
        await sql`DELETE FROM "Product" WHERE "id" = ANY(${cleanup.productIds})`;
      }
      if (cleanup.userIds.length > 0) {
        await sql`DELETE FROM "User" WHERE "id" = ANY(${cleanup.userIds})`;
      }
      console.log("Cleanup completed successfully.");
    } catch (cleanupErr) {
      console.warn("Teardown warning:", cleanupErr.message);
    }
  }
}

run().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
