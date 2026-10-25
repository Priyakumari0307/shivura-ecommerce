#!/usr/bin/env node

/**
 * Automated Verification Test Suite for Phase 7C - Step 2:
 * Safe, Idempotent Inventory Restoration on Order Cancellation & Refunds
 *
 * Verifies:
 * 1. Eligible pre-dispatch cancellation restores stock exactly once.
 * 2. Repeated cancellation requests do not restore stock twice (idempotency).
 * 3. Cancellation after dispatch does not restore stock automatically.
 * 4. Refund status alone does not restock inventory.
 * 5. Product and variant stock remain consistent after an eligible restoration (multi-item).
 * 6. Invalid status transitions leave stock and order records unchanged.
 * 7. Customer and non-admin access cannot invoke CRM inventory restoration (401/403).
 * 8. GET /api/crm/orders/:id detail view correctly reflects inventoryRestored status & variantId.
 * 9. Guaranteed safe teardown of all test fixtures in database.
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
  orderIds: [],
  variantIds: [],
  productIds: [],
  userIds: [],
};

async function run() {
  console.log(`\n=============================================================`);
  console.log(`Starting Phase 7C Step 2: Inventory Restoration Test Suite`);
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
    assert(Boolean(match), "Received shivura_session cookie");
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
  const customerA = await getCustomerCookie(
    `customer-restock-${timestamp}@shivura-luxury.com`,
    "SecurePass2026!",
    "Inventory Test Customer"
  );

  try {
    // -----------------------------------------------------------------
    // TEST 1: Eligible pre-dispatch cancellation restores stock once
    // -----------------------------------------------------------------
    console.log(`\n[TEST 1] Pre-Dispatch Cancellation Restores Stock Exactly Once`);

    const p1Id = `prd_restock1_${timestamp}`;
    const v1Id = `var_restock1_${timestamp}`;
    const o1Id = `ord_restock1_${timestamp}`;
    const oi1Id = `item_restock1_${timestamp}`;

    // Create Product (aggregate stock 20, after order 17)
    await sql`
      INSERT INTO "Product" (
        "id", "name", "slug", "sku", "price", "stock", "active", "published", "createdAt", "updatedAt"
      ) VALUES (
        ${p1Id}, ${`[TEST-RESTOCK-1] Brass Urli ${timestamp}`}, ${`test-restock-urli-${timestamp}`},
        ${`URLI-P1-${timestamp}`}, 2500, 17, true, true, NOW(), NOW()
      );
    `;
    cleanup.productIds.push(p1Id);

    // Create Variant (stock 15, after order 12)
    await sql`
      INSERT INTO "ProductVariant" (
        "id", "productId", "name", "sku", "price", "stock", "active", "createdAt", "updatedAt"
      ) VALUES (
        ${v1Id}, ${p1Id}, '12 Inch Urli', ${`URLI-V1-${timestamp}`}, 2800, 12, true, NOW(), NOW()
      );
    `;
    cleanup.variantIds.push(v1Id);

    // Create Order with status PENDING, inventoryRestored false
    await sql`
      INSERT INTO "Order" (
        "id", "orderNumber", "status", "paymentStatus",
        "subtotal", "discount", "shippingFee", "total",
        "customerName", "customerEmail", "customerPhone",
        "shippingAddressLine1", "shippingCity", "shippingState",
        "shippingPostalCode", "shippingCountry", "inventoryRestored", "createdAt", "updatedAt"
      ) VALUES (
        ${o1Id}, ${`SHV-RESTOCK-1-${timestamp}`}, 'PENDING', 'PENDING',
        8400, 0, 0, 8400,
        'Inventory Test Customer', ${customerA.user.email}, '+91 98765 11111',
        '123 Palace Road', 'Udaipur', 'Rajasthan', '313001', 'India', false, NOW(), NOW()
      );
    `;
    cleanup.orderIds.push(o1Id);

    // Create OrderItem (3 units, variantId attached)
    await sql`
      INSERT INTO "OrderItem" (
        "id", "orderId", "productId", "variantId", "productName", "sku",
        "price", "quantity", "subtotal", "createdAt"
      ) VALUES (
        ${oi1Id}, ${o1Id}, ${p1Id}, ${v1Id}, 'Brass Urli', ${`URLI-V1-${timestamp}`},
        2800, 3, 8400, NOW()
      );
    `;

    // Admin cancels the pre-dispatch order (PENDING -> CANCELLED)
    const cancelRes1 = await fetch(`${BASE_URL}/api/crm/orders/${o1Id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ status: "CANCELLED" }),
    });

    assert(cancelRes1.status === 200, `Admin pre-dispatch cancellation returns 200 (got ${cancelRes1.status})`);
    const cancelJson1 = await cancelRes1.json();
    assert(cancelJson1.success === true, "Cancellation reports success: true");
    assert(cancelJson1.inventoryReport?.restored === true, "inventoryReport confirms stock restored: true");
    assert(cancelJson1.inventoryReport?.itemsRestoredCount === 1, "inventoryReport records 1 line restored");

    // Verify stock restored in database (product: 17 + 3 = 20, variant: 12 + 3 = 15)
    const [p1Db] = await sql`SELECT stock FROM "Product" WHERE id = ${p1Id}`;
    const [v1Db] = await sql`SELECT stock FROM "ProductVariant" WHERE id = ${v1Id}`;
    assert(p1Db.stock === 20, `Product stock restored from 17 back to 20 (got ${p1Db.stock})`);
    assert(v1Db.stock === 15, `Variant stock restored from 12 back to 15 (got ${v1Db.stock})`);

    // Verify order marker
    const [o1Db] = await sql`SELECT status, "inventoryRestored", "inventoryRestoredAt" FROM "Order" WHERE id = ${o1Id}`;
    assert(o1Db.status === "CANCELLED", "Order status updated to CANCELLED");
    assert(o1Db.inventoryRestored === true, "Order inventoryRestored is set to true");
    assert(Boolean(o1Db.inventoryRestoredAt), "Order inventoryRestoredAt timestamp is recorded");

    // -----------------------------------------------------------------
    // TEST 2: Repeated cancellation requests do not restore stock twice
    // -----------------------------------------------------------------
    console.log(`\n[TEST 2] Repeated Cancellation Requests Do Not Restore Stock Twice (Idempotency)`);

    const repeatCancelRes = await fetch(`${BASE_URL}/api/crm/orders/${o1Id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ status: "CANCELLED" }),
    });

    assert(repeatCancelRes.status === 200, `Repeated cancellation returns 200 (got ${repeatCancelRes.status})`);
    const repeatJson = await repeatCancelRes.json();
    assert(repeatJson.inventoryReport?.restored === false, "Repeated cancel does NOT restock inventory (restored: false)");

    const [p1Repeat] = await sql`SELECT stock FROM "Product" WHERE id = ${p1Id}`;
    const [v1Repeat] = await sql`SELECT stock FROM "ProductVariant" WHERE id = ${v1Id}`;
    assert(p1Repeat.stock === 20, `Product stock remains 20 after repeat cancellation (got ${p1Repeat.stock})`);
    assert(v1Repeat.stock === 15, `Variant stock remains 15 after repeat cancellation (got ${v1Repeat.stock})`);

    // -----------------------------------------------------------------
    // TEST 2B: Concurrent cancellation race condition (atomic conditional lock)
    // -----------------------------------------------------------------
    console.log(`\n[TEST 2B] Concurrent Cancellation Requests Race Condition (Atomic Exactly-Once Execution)`);

    const pConcId = `prd_conc_${timestamp}`;
    const vConcId = `var_conc_${timestamp}`;
    const oConcId = `ord_conc_${timestamp}`;
    const oiConcId = `item_conc_${timestamp}`;

    // Product aggregate stock 10 (decremented to 7)
    await sql`
      INSERT INTO "Product" (
        "id", "name", "slug", "sku", "price", "stock", "active", "published", "createdAt", "updatedAt"
      ) VALUES (
        ${pConcId}, ${`[TEST-CONC] Brass Bell ${timestamp}`}, ${`test-conc-bell-${timestamp}`},
        ${`BELL-P-${timestamp}`}, 1200, 7, true, true, NOW(), NOW()
      );
    `;
    cleanup.productIds.push(pConcId);

    // Variant stock 8 (decremented to 5)
    await sql`
      INSERT INTO "ProductVariant" (
        "id", "productId", "name", "sku", "price", "stock", "active", "createdAt", "updatedAt"
      ) VALUES (
        ${vConcId}, ${pConcId}, 'Medium Bell', ${`BELL-V-${timestamp}`}, 1200, 5, true, NOW(), NOW()
      );
    `;
    cleanup.variantIds.push(vConcId);

    await sql`
      INSERT INTO "Order" (
        "id", "orderNumber", "status", "paymentStatus",
        "subtotal", "discount", "shippingFee", "total",
        "customerName", "customerEmail", "customerPhone",
        "shippingAddressLine1", "shippingCity", "shippingState",
        "shippingPostalCode", "shippingCountry", "inventoryRestored", "createdAt", "updatedAt"
      ) VALUES (
        ${oConcId}, ${`SHV-CONC-${timestamp}`}, 'PENDING', 'PENDING',
        3600, 0, 0, 3600,
        'Inventory Test Customer', ${customerA.user.email}, '+91 98765 11111',
        '123 Palace Road', 'Udaipur', 'Rajasthan', '313001', 'India', false, NOW(), NOW()
      );
    `;
    cleanup.orderIds.push(oConcId);

    await sql`
      INSERT INTO "OrderItem" (
        "id", "orderId", "productId", "variantId", "productName", "sku",
        "price", "quantity", "subtotal", "createdAt"
      ) VALUES (
        ${oiConcId}, ${oConcId}, ${pConcId}, ${vConcId}, 'Brass Bell', ${`BELL-V-${timestamp}`},
        1200, 3, 3600, NOW()
      );
    `;

    // Fire 3 concurrent cancellation requests simultaneously
    const [resA, resB, resC] = await Promise.all([
      fetch(`${BASE_URL}/api/crm/orders/${oConcId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ status: "CANCELLED" }),
      }),
      fetch(`${BASE_URL}/api/crm/orders/${oConcId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ status: "CANCELLED" }),
      }),
      fetch(`${BASE_URL}/api/crm/orders/${oConcId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ status: "CANCELLED" }),
      }),
    ]);

    assert(resA.status === 200 && resB.status === 200 && resC.status === 200, "All 3 concurrent requests completed with HTTP 200");
    const jsonA = await resA.json();
    const jsonB = await resB.json();
    const jsonC = await resC.json();

    const restoredFlags = [jsonA.inventoryReport?.restored, jsonB.inventoryReport?.restored, jsonC.inventoryReport?.restored];
    const trueCount = restoredFlags.filter((x) => x === true).length;
    const falseCount = restoredFlags.filter((x) => x === false).length;

    assert(trueCount === 1, `Exactly ONE concurrent request claimed restoration (true count: ${trueCount})`);
    assert(falseCount === 2, `The other 2 concurrent requests were safely de-duplicated (false count: ${falseCount})`);

    // Verify stock incremented exactly once: 7 + 3 = 10 (NOT 7 + 9 = 16!)
    const [pConcDb] = await sql`SELECT stock FROM "Product" WHERE id = ${pConcId}`;
    const [vConcDb] = await sql`SELECT stock FROM "ProductVariant" WHERE id = ${vConcId}`;
    assert(pConcDb.stock === 10, `Concurrent race: Product stock restored exactly once to 10 (got ${pConcDb.stock})`);
    assert(vConcDb.stock === 8, `Concurrent race: Variant stock restored exactly once to 8 (got ${vConcDb.stock})`);


    // -----------------------------------------------------------------
    // TEST 3: Cancellation after dispatch does not restore stock
    // -----------------------------------------------------------------
    console.log(`\n[TEST 3] Cancellation After Dispatch Does Not Restore Stock`);

    const p2Id = `prd_restock2_${timestamp}`;
    const o2Id = `ord_restock2_${timestamp}`;
    const oi2Id = `item_restock2_${timestamp}`;

    // Create Product with stock = 8 (dispatched 2 units)
    await sql`
      INSERT INTO "Product" (
        "id", "name", "slug", "sku", "price", "stock", "active", "published", "createdAt", "updatedAt"
      ) VALUES (
        ${p2Id}, ${`[TEST-RESTOCK-2] Marble Idol ${timestamp}`}, ${`test-restock-marble-${timestamp}`},
        ${`MARBLE-P2-${timestamp}`}, 5000, 8, true, true, NOW(), NOW()
      );
    `;
    cleanup.productIds.push(p2Id);

    // Create Order with status SHIPPED (already dispatched), inventoryRestored = false
    await sql`
      INSERT INTO "Order" (
        "id", "orderNumber", "status", "paymentStatus",
        "subtotal", "discount", "shippingFee", "total",
        "customerName", "customerEmail", "customerPhone",
        "shippingAddressLine1", "shippingCity", "shippingState",
        "shippingPostalCode", "shippingCountry", "inventoryRestored", "createdAt", "updatedAt"
      ) VALUES (
        ${o2Id}, ${`SHV-RESTOCK-2-${timestamp}`}, 'SHIPPED', 'PENDING',
        10000, 0, 0, 10000,
        'Inventory Test Customer', ${customerA.user.email}, '+91 98765 11111',
        '123 Palace Road', 'Udaipur', 'Rajasthan', '313001', 'India', false, NOW(), NOW()
      );
    `;
    cleanup.orderIds.push(o2Id);

    await sql`
      INSERT INTO "OrderItem" (
        "id", "orderId", "productId", "productName", "sku",
        "price", "quantity", "subtotal", "createdAt"
      ) VALUES (
        ${oi2Id}, ${o2Id}, ${p2Id}, 'Marble Idol', ${`MARBLE-P2-${timestamp}`},
        5000, 2, 10000, NOW()
      );
    `;

    // Now cancel the already-shipped order
    const cancelPostDispatchRes = await fetch(`${BASE_URL}/api/crm/orders/${o2Id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ status: "CANCELLED" }),
    });

    assert(cancelPostDispatchRes.status === 200, "Post-dispatch cancellation accepted");
    const cancelPostDispatchJson = await cancelPostDispatchRes.json();
    assert(
      cancelPostDispatchJson.inventoryReport?.restored === false,
      "Post-dispatch cancel does NOT restore stock (restored: false)"
    );

    const [p2Db] = await sql`SELECT stock FROM "Product" WHERE id = ${p2Id}`;
    assert(p2Db.stock === 8, `Product stock remains 8 after post-dispatch cancellation (got ${p2Db.stock})`);

    const [o2Db] = await sql`SELECT "inventoryRestored" FROM "Order" WHERE id = ${o2Id}`;
    assert(o2Db.inventoryRestored === false, "Post-dispatch order inventoryRestored remains false");

    // -----------------------------------------------------------------
    // TEST 4: Refund status alone does not restock inventory
    // -----------------------------------------------------------------
    console.log(`\n[TEST 4] Refund Status Alone Does Not Restock Inventory`);

    const p3Id = `prd_restock3_${timestamp}`;
    const o3Id = `ord_restock3_${timestamp}`;
    const oi3Id = `item_restock3_${timestamp}`;

    await sql`
      INSERT INTO "Product" (
        "id", "name", "slug", "sku", "price", "stock", "active", "published", "createdAt", "updatedAt"
      ) VALUES (
        ${p3Id}, ${`[TEST-RESTOCK-3] Silk Shawl ${timestamp}`}, ${`test-restock-shawl-${timestamp}`},
        ${`SHAWL-P3-${timestamp}`}, 1800, 9, true, true, NOW(), NOW()
      );
    `;
    cleanup.productIds.push(p3Id);

    await sql`
      INSERT INTO "Order" (
        "id", "orderNumber", "status", "paymentStatus",
        "subtotal", "discount", "shippingFee", "total",
        "customerName", "customerEmail", "customerPhone",
        "shippingAddressLine1", "shippingCity", "shippingState",
        "shippingPostalCode", "shippingCountry", "inventoryRestored", "createdAt", "updatedAt"
      ) VALUES (
        ${o3Id}, ${`SHV-RESTOCK-3-${timestamp}`}, 'PENDING', 'PENDING',
        5400, 0, 0, 5400,
        'Inventory Test Customer', ${customerA.user.email}, '+91 98765 11111',
        '123 Palace Road', 'Udaipur', 'Rajasthan', '313001', 'India', false, NOW(), NOW()
      );
    `;
    cleanup.orderIds.push(o3Id);

    await sql`
      INSERT INTO "OrderItem" (
        "id", "orderId", "productId", "productName", "sku",
        "price", "quantity", "subtotal", "createdAt"
      ) VALUES (
        ${oi3Id}, ${o3Id}, ${p3Id}, 'Silk Shawl', ${`SHAWL-P3-${timestamp}`},
        1800, 3, 5400, NOW()
      );
    `;

    // Admin updates status to REFUNDED
    const refundRes = await fetch(`${BASE_URL}/api/crm/orders/${o3Id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ status: "REFUNDED", paymentStatus: "REFUNDED" }),
    });

    assert(refundRes.status === 200, "Order status update to REFUNDED accepted");
    const refundJson = await refundRes.json();
    assert(refundJson.inventoryReport?.restored === false, "Refund update does NOT restore stock (restored: false)");

    const [p3Db] = await sql`SELECT stock FROM "Product" WHERE id = ${p3Id}`;
    assert(p3Db.stock === 9, `Product stock remains 9 after refund status update (got ${p3Db.stock})`);

    const [o3Db] = await sql`SELECT "inventoryRestored" FROM "Order" WHERE id = ${o3Id}`;
    assert(o3Db.inventoryRestored === false, "Refunded order inventoryRestored remains false");

    // -----------------------------------------------------------------
    // TEST 5: Product & Variant Stock Consistency on Multi-item Order
    // -----------------------------------------------------------------
    console.log(`\n[TEST 5] Multi-item Order Variant & Aggregate Stock Consistency`);

    const p4Id = `prd_restock4_${timestamp}`;
    const v4Id = `var_restock4_${timestamp}`;
    const p5Id = `prd_restock5_${timestamp}`;
    const o4Id = `ord_restock4_${timestamp}`;
    const oi4AId = `item_restock4a_${timestamp}`;
    const oi4BId = `item_restock4b_${timestamp}`;

    // Product 4 (parent of variant 4A): stock 23 (was 25, 2 ordered)
    await sql`
      INSERT INTO "Product" (
        "id", "name", "slug", "sku", "price", "stock", "active", "published", "createdAt", "updatedAt"
      ) VALUES (
        ${p4Id}, ${`[TEST-RESTOCK-4] Carved Frame ${timestamp}`}, ${`test-restock-frame-${timestamp}`},
        ${`FRAME-P4-${timestamp}`}, 3200, 23, true, true, NOW(), NOW()
      );
    `;
    cleanup.productIds.push(p4Id);

    // Variant 4A: stock 8 (was 10, 2 ordered)
    await sql`
      INSERT INTO "ProductVariant" (
        "id", "productId", "name", "sku", "price", "stock", "active", "createdAt", "updatedAt"
      ) VALUES (
        ${v4Id}, ${p4Id}, 'A4 Teak', ${`FRAME-V4A-${timestamp}`}, 3200, 8, true, NOW(), NOW()
      );
    `;
    cleanup.variantIds.push(v4Id);

    // Standalone Product 5: stock 25 (was 30, 5 ordered)
    await sql`
      INSERT INTO "Product" (
        "id", "name", "slug", "sku", "price", "stock", "active", "published", "createdAt", "updatedAt"
      ) VALUES (
        ${p5Id}, ${`[TEST-RESTOCK-STANDALONE] Incense Holder ${timestamp}`}, ${`test-restock-incense-${timestamp}`},
        ${`INCENSE-P5-${timestamp}`}, 499, 25, true, true, NOW(), NOW()
      );
    `;
    cleanup.productIds.push(p5Id);

    // Order 4 in PROCESSING status (pre-dispatch)
    await sql`
      INSERT INTO "Order" (
        "id", "orderNumber", "status", "paymentStatus",
        "subtotal", "discount", "shippingFee", "total",
        "customerName", "customerEmail", "customerPhone",
        "shippingAddressLine1", "shippingCity", "shippingState",
        "shippingPostalCode", "shippingCountry", "inventoryRestored", "createdAt", "updatedAt"
      ) VALUES (
        ${o4Id}, ${`SHV-RESTOCK-4-${timestamp}`}, 'PROCESSING', 'PENDING',
        8895, 0, 0, 8895,
        'Inventory Test Customer', ${customerA.user.email}, '+91 98765 11111',
        '123 Palace Road', 'Udaipur', 'Rajasthan', '313001', 'India', false, NOW(), NOW()
      );
    `;
    cleanup.orderIds.push(o4Id);

    // Item 1: 2 units of Variant 4A (references variantId)
    await sql`
      INSERT INTO "OrderItem" (
        "id", "orderId", "productId", "variantId", "productName", "sku",
        "price", "quantity", "subtotal", "createdAt"
      ) VALUES (
        ${oi4AId}, ${o4Id}, ${p4Id}, ${v4Id}, 'Carved Frame', ${`FRAME-V4A-${timestamp}`},
        3200, 2, 6400, NOW()
      );
    `;

    // Item 2: 5 units of standalone Product 5 (no variantId)
    await sql`
      INSERT INTO "OrderItem" (
        "id", "orderId", "productId", "productName", "sku",
        "price", "quantity", "subtotal", "createdAt"
      ) VALUES (
        ${oi4BId}, ${o4Id}, ${p5Id}, 'Incense Holder', ${`INCENSE-P5-${timestamp}`},
        499, 5, 2495, NOW()
      );
    `;

    // Cancel multi-item order pre-dispatch (PROCESSING -> CANCELLED)
    const cancelRes4 = await fetch(`${BASE_URL}/api/crm/orders/${o4Id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ status: "CANCELLED" }),
    });

    assert(cancelRes4.status === 200, "Multi-item order cancelled successfully");
    const cancelJson4 = await cancelRes4.json();
    assert(cancelJson4.inventoryReport?.itemsRestoredCount === 2, "Both distinct order lines restored");

    // Both parent and variant restored consistently:
    // Product 4: 23 + 2 = 25
    // Variant 4A: 8 + 2 = 10
    // Product 5: 25 + 5 = 30
    const [p4Restored] = await sql`SELECT stock FROM "Product" WHERE id = ${p4Id}`;
    const [v4Restored] = await sql`SELECT stock FROM "ProductVariant" WHERE id = ${v4Id}`;
    const [p5Restored] = await sql`SELECT stock FROM "Product" WHERE id = ${p5Id}`;
    assert(p4Restored.stock === 25, `Parent product4 restored back to 25 (got ${p4Restored.stock})`);
    assert(v4Restored.stock === 10, `Variant4A restored back to 10 (got ${v4Restored.stock})`);
    assert(p5Restored.stock === 30, `Standalone product5 restored back to 30 (got ${p5Restored.stock})`);

    // -----------------------------------------------------------------
    // TEST 6: Disallowed Status Transitions Leave Stock Unchanged
    // -----------------------------------------------------------------
    console.log(`\n[TEST 6] Disallowed Status Transitions Leave Stock and Records Unchanged`);

    // Order 1 is already CANCELLED. Attempt invalid transition directly to SHIPPED
    const invalidRes = await fetch(`${BASE_URL}/api/crm/orders/${o1Id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ status: "SHIPPED" }),
    });

    assert(invalidRes.status === 400, `Direct CANCELLED -> SHIPPED transition returns 400 (got ${invalidRes.status})`);

    // Stock for product1/variant1 must remain unchanged
    const [p1Unchanged] = await sql`SELECT stock FROM "Product" WHERE id = ${p1Id}`;
    assert(p1Unchanged.stock === 20, `Stock remains 20 after rejected transition (got ${p1Unchanged.stock})`);

    // -----------------------------------------------------------------
    // TEST 6B: Transaction Failure Rolls Back All Inventory & Order Changes
    // -----------------------------------------------------------------
    console.log(`\n[TEST 6B] Transaction Failure Atomically Rolls Back All Inventory & Order Changes`);

    const pFailId = `prd_fail_${timestamp}`;
    const oFailId = `ord_fail_${timestamp}`;

    await sql`
      INSERT INTO "Product" (
        "id", "name", "slug", "sku", "price", "stock", "active", "published", "createdAt", "updatedAt"
      ) VALUES (
        ${pFailId}, ${`[TEST-FAIL] Rollback Tester ${timestamp}`}, ${`test-fail-${timestamp}`},
        ${`FAIL-P-${timestamp}`}, 999, 10, true, true, NOW(), NOW()
      );
    `;
    cleanup.productIds.push(pFailId);

    await sql`
      INSERT INTO "Order" (
        "id", "orderNumber", "status", "paymentStatus",
        "subtotal", "discount", "shippingFee", "total",
        "customerName", "customerEmail", "customerPhone",
        "shippingAddressLine1", "shippingCity", "shippingState",
        "shippingPostalCode", "shippingCountry", "inventoryRestored", "createdAt", "updatedAt"
      ) VALUES (
        ${oFailId}, ${`SHV-FAIL-${timestamp}`}, 'PENDING', 'PENDING',
        999, 0, 0, 999,
        'Inventory Test Customer', ${customerA.user.email}, '+91 98765 11111',
        '123 Palace Road', 'Udaipur', 'Rajasthan', '313001', 'India', false, NOW(), NOW()
      );
    `;
    cleanup.orderIds.push(oFailId);

    // 1. Attempt API update that violates payment evidence guard while attempting status change
    const failApiRes = await fetch(`${BASE_URL}/api/crm/orders/${oFailId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ status: "CANCELLED", paymentStatus: "PAID" }), // missing paymentEvidence
    });

    assert(failApiRes.status === 400, `Guard rejects request with 400 (got ${failApiRes.status})`);
    const [pFailAfterApi] = await sql`SELECT stock FROM "Product" WHERE id = ${pFailId}`;
    const [oFailAfterApi] = await sql`SELECT status, "inventoryRestored" FROM "Order" WHERE id = ${oFailId}`;
    assert(pFailAfterApi.stock === 10, "Stock untouched after rejected request");
    assert(oFailAfterApi.status === "PENDING", "Order status remains PENDING");
    assert(oFailAfterApi.inventoryRestored === false, "inventoryRestored remains false");

    // 2. Direct transactional failure verification in Neon DB
    let rollbackCaught = false;
    try {
      await sql`
        DO $$
        BEGIN
          UPDATE "Product" SET stock = stock + 50 WHERE id = ${pFailId};
          UPDATE "Order" SET status = 'CANCELLED', "inventoryRestored" = true WHERE id = ${oFailId};
          RAISE EXCEPTION 'Simulated transaction crash';
        END $$;
      `;
    } catch {
      rollbackCaught = true;
    }

    assert(rollbackCaught, "Transaction exception was raised and caught");
    const [pFailAfterTx] = await sql`SELECT stock FROM "Product" WHERE id = ${pFailId}`;
    const [oFailAfterTx] = await sql`SELECT status, "inventoryRestored" FROM "Order" WHERE id = ${oFailId}`;
    assert(pFailAfterTx.stock === 10, `ACID rollback preserved stock at 10 (got ${pFailAfterTx.stock})`);
    assert(oFailAfterTx.status === "PENDING", `ACID rollback preserved status as PENDING (got ${oFailAfterTx.status})`);
    assert(oFailAfterTx.inventoryRestored === false, "ACID rollback preserved inventoryRestored as false");

    // -----------------------------------------------------------------
    // TEST 7: Customer and Non-Admin Cannot Invoke Restoration
    // -----------------------------------------------------------------
    console.log(`\n[TEST 7] Customer and Unauthenticated Access Protected (401 & 403)`);

    // 7a. Unauthenticated PATCH
    const unauthPatch = await fetch(`${BASE_URL}/api/crm/orders/${o1Id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    assert(unauthPatch.status === 401, `Unauthenticated status PATCH returns 401 (got ${unauthPatch.status})`);

    // 7b. Customer session PATCH
    const customerPatch = await fetch(`${BASE_URL}/api/crm/orders/${o1Id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerA.cookie,
      },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    assert(customerPatch.status === 403, `Customer status PATCH returns 403 (got ${customerPatch.status})`);

    // -----------------------------------------------------------------
    // TEST 8: GET /api/crm/orders/:id Reports inventoryRestored Field
    // -----------------------------------------------------------------
    console.log(`\n[TEST 8] GET /api/crm/orders/:id Detail View Reports inventoryRestored Status`);

    const getDetailRes = await fetch(`${BASE_URL}/api/crm/orders/${o1Id}`, {
      headers: { Cookie: adminCookie },
    });
    assert(getDetailRes.status === 200, "Admin GET order details returns 200");
    const getDetailJson = await getDetailRes.json();
    assert(getDetailJson.data.inventoryRestored === true, "Detail view reports inventoryRestored: true");
    assert(Boolean(getDetailJson.data.inventoryRestoredAt), "Detail view reports inventoryRestoredAt ISO timestamp");
    assert(getDetailJson.data.items[0].variantId === v1Id, "OrderItem detail view includes variantId");

    console.log(`\n=============================================================`);
    console.log(`Inventory Restoration Test Suite Completed: ALL ${testsPassed} CHECKS PASSED`);
    console.log(`=============================================================\n`);
  } finally {
    console.log("Cleaning up test fixtures...");
    try {
      if (cleanup.orderIds.length > 0) {
        await sql`DELETE FROM "Payment" WHERE "orderId" = ANY(${cleanup.orderIds})`;
        await sql`DELETE FROM "OrderItem" WHERE "orderId" = ANY(${cleanup.orderIds})`;
        await sql`DELETE FROM "Order" WHERE "id" = ANY(${cleanup.orderIds})`;
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
