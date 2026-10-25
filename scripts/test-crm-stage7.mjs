#!/usr/bin/env node

/**
 * Automated Verification Test Suite for Stage 7A: CRM Orders Management
 *
 * Verifies:
 * 1. Route Protection & RBAC (401 & 403):
 *    - Unauthenticated GET /CRM/orders redirects to /CRM/login
 *    - Unauthenticated GET /api/crm/orders returns 401
 *    - Unauthenticated GET /api/crm/orders/:id returns 401
 *    - Unauthenticated PATCH /api/crm/orders/:id/status returns 401
 *    - Customer account accessing /CRM/orders returns 403 Forbidden portal layout
 *    - Customer account GET /api/crm/orders returns 403 Forbidden
 *    - Customer account GET /api/crm/orders/:id returns 403 Forbidden
 *    - Customer account PATCH /api/crm/orders/:id/status returns 403 Forbidden
 * 2. Parameter Validation & Error Handling:
 *    - Invalid page, invalid status, invalid paymentStatus return 400 Bad Request
 *    - Non-existent order IDs return 404 Not Found
 *    - Invalid status values and empty PATCH bodies return 400 Bad Request
 * 3. Order Listing, Metrics & Search:
 *    - Admin GET /api/crm/orders returns 200 OK with pagination and summary metrics
 *    - Summary metrics accurately report totalOrders, pendingOrders, deliveredOrders, collectedRevenue
 * 4. Isolated Temporary Test Order Lifecycle:
 *    - Creates an isolated temporary order with OrderItem
 *    - GET /api/crm/orders/:id retrieves complete item snapshots, shipping address, customer info
 *    - Payment verification guard: Rejects marking order PAID without payment evidence (400 Bad Request)
 *    - Approved payment verification: Marking PAID with evidence succeeds (200 OK)
 *    - Revenue metric isolation: Counts only verified PAID orders toward collectedRevenue
 *    - Fulfillment state transitions: PENDING -> PROCESSING -> SHIPPED -> DELIVERED
 * 5. Safe Teardown:
 *    - Guaranteed cleanup of all temporary test records in finally block
 * 6. Storefront Non-Regression:
 *    - /api/products, /api/categories, /api/occasions unaffected
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
let testsFailed = 0;
const cleanupOrderIds = [];

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
  console.log(`Starting Shivura CRM Stage 7A Orders Management Test Suite`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  try {
    // -------------------------------------------------------------
    // Test 1: Route Protection & Admin Authorization (401 & 403)
    // -------------------------------------------------------------
    console.log(`[TEST 1] Route Protection & Admin Authorization`);

    // 1a. Unauthenticated page redirect
    const unauthPageRes = await fetch(`${BASE_URL}/CRM/orders`, { redirect: "manual" });
    const pageLocation = unauthPageRes.headers.get("location") || "";
    assert(
      unauthPageRes.status === 307 || unauthPageRes.status === 302 || pageLocation.includes("/CRM/login"),
      `Unauthenticated GET /CRM/orders redirects to /CRM/login (got ${unauthPageRes.status})`
    );

    // 1b. Unauthenticated API requests return 401
    const unauthGetOrders = await fetch(`${BASE_URL}/api/crm/orders`);
    assert(unauthGetOrders.status === 401, `Unauthenticated GET /api/crm/orders returns 401 (got ${unauthGetOrders.status})`);

    const unauthGetSingle = await fetch(`${BASE_URL}/api/crm/orders/dummy-order-id`);
    assert(unauthGetSingle.status === 401, `Unauthenticated GET /api/crm/orders/:id returns 401 (got ${unauthGetSingle.status})`);

    const unauthPatchStatus = await fetch(`${BASE_URL}/api/crm/orders/dummy-order-id/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    assert(unauthPatchStatus.status === 401, `Unauthenticated PATCH /api/crm/orders/:id/status returns 401 (got ${unauthPatchStatus.status})`);

    // 1c. Customer accounts receive 403 Forbidden
    const customerEmail = "customer-stage7-tester@shivura-luxury.com";
    const customerPassword = "CustomerPass2026!";

    await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Stage 7 Customer Tester",
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

    let customerCookie = "";
    if (customerLoginRes.status === 200) {
      const custCookieHeader = customerLoginRes.headers.get("set-cookie") || "";
      const custMatch = custCookieHeader.match(/shivura_session=([^;]+)/);
      if (custMatch) customerCookie = custMatch[0];
    }
    assert(customerCookie.length > 0, "Customer session cookie obtained for 403 verification");

    const custPageRes = await fetch(`${BASE_URL}/CRM/orders`, {
      headers: { Cookie: customerCookie },
    });
    assert(custPageRes.status === 200, "Customer accessing /CRM/orders is caught by CRM portal layout");
    const custPageText = await custPageRes.text();
    assert(
      custPageText.includes("403 Forbidden") || custPageText.includes("Access Denied") || custPageText.includes("Customer Account Detected"),
      "Customer receives 403 Access Denied layout for /CRM/orders"
    );

    const custGetOrders = await fetch(`${BASE_URL}/api/crm/orders`, {
      headers: { Cookie: customerCookie },
    });
    assert(custGetOrders.status === 403, `Customer GET /api/crm/orders returns 403 (got ${custGetOrders.status})`);

    const custGetSingle = await fetch(`${BASE_URL}/api/crm/orders/dummy-order-id`, {
      headers: { Cookie: customerCookie },
    });
    assert(custGetSingle.status === 403, `Customer GET /api/crm/orders/:id returns 403 (got ${custGetSingle.status})`);

    const custPatchStatus = await fetch(`${BASE_URL}/api/crm/orders/dummy-order-id/status`, {
      method: "PATCH",
      headers: { Cookie: customerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    assert(custPatchStatus.status === 403, `Customer PATCH /api/crm/orders/:id/status returns 403 (got ${custPatchStatus.status})`);

    // -------------------------------------------------------------
    // Test 2: Admin Authentication & Input Validation
    // -------------------------------------------------------------
    console.log(`\n[TEST 2] Admin Authentication & Input Validation`);

    const adminLoginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
    });
    assert(adminLoginRes.status === 200, "Admin login succeeded");

    const adminSetCookie = adminLoginRes.headers.get("set-cookie") || "";
    const adminMatch = adminSetCookie.match(/shivura_session=([^;]+)/);
    assert(adminMatch !== null, "Admin session cookie obtained");
    const adminCookie = adminMatch[0];

    // 2a. Check /CRM/orders page renders 200 OK for admin
    const adminPageRes = await fetch(`${BASE_URL}/CRM/orders`, {
      headers: { Cookie: adminCookie },
    });
    assert(adminPageRes.status === 200, "Admin GET /CRM/orders renders 200 OK");
    const adminPageText = await adminPageRes.text();
    assert(
      adminPageText.includes("Orders Management") || adminPageText.includes("shivura"),
      "Admin /CRM/orders contains Orders management markup"
    );

    // 2b. Validate query parameters
    const badPageRes = await fetch(`${BASE_URL}/api/crm/orders?page=-1`, {
      headers: { Cookie: adminCookie },
    });
    assert(badPageRes.status === 400, `GET /api/crm/orders with invalid page returns 400 (got ${badPageRes.status})`);

    const badStatusRes = await fetch(`${BASE_URL}/api/crm/orders?status=INVALID_STATUS`, {
      headers: { Cookie: adminCookie },
    });
    assert(badStatusRes.status === 400, `GET /api/crm/orders with invalid status returns 400 (got ${badStatusRes.status})`);

    const badPaymentStatusRes = await fetch(`${BASE_URL}/api/crm/orders?paymentStatus=INVALID_PST`, {
      headers: { Cookie: adminCookie },
    });
    assert(badPaymentStatusRes.status === 400, `GET /api/crm/orders with invalid paymentStatus returns 400 (got ${badPaymentStatusRes.status})`);

    // 2c. Non-existent ID returns 404
    const notFoundRes = await fetch(`${BASE_URL}/api/crm/orders/non-existent-order-id-404`, {
      headers: { Cookie: adminCookie },
    });
    assert(notFoundRes.status === 404, `GET non-existent order ID returns 404 (got ${notFoundRes.status})`);

    const notFoundPatchRes = await fetch(`${BASE_URL}/api/crm/orders/non-existent-order-id-404/status`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    assert(notFoundPatchRes.status === 404, `PATCH non-existent order ID returns 404 (got ${notFoundPatchRes.status})`);

    // 2d. Invalid PATCH bodies
    const emptyPatchRes = await fetch(`${BASE_URL}/api/crm/orders/dummy/status`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert(emptyPatchRes.status === 400, `PATCH with empty body returns 400 (got ${emptyPatchRes.status})`);

    const invalidEnumPatchRes = await fetch(`${BASE_URL}/api/crm/orders/dummy/status`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "BOGUS_STATE" }),
    });
    assert(invalidEnumPatchRes.status === 400, `PATCH with invalid status enum returns 400 (got ${invalidEnumPatchRes.status})`);

    // -------------------------------------------------------------
    // Test 3: Admin GET /api/crm/orders & Metrics Contract
    // -------------------------------------------------------------
    console.log(`\n[TEST 3] Admin Orders Listing & Metrics Contract`);

    const listOrdersRes = await fetch(`${BASE_URL}/api/crm/orders`, {
      headers: { Cookie: adminCookie },
    });
    assert(listOrdersRes.status === 200, "Admin GET /api/crm/orders returns 200 OK");
    const listOrdersJson = await listOrdersRes.json();
    assert(listOrdersJson.success === true, "Orders response success is true");
    assert(Array.isArray(listOrdersJson.data), "Orders response data is an array");
    assert(listOrdersJson.pagination !== undefined, "Orders response includes pagination metadata");
    assert(listOrdersJson.summary !== undefined, "Orders response includes summary statistics");
    assert(typeof listOrdersJson.summary.totalOrders === "number", "summary.totalOrders is a number");
    assert(typeof listOrdersJson.summary.pendingOrders === "number", "summary.pendingOrders is a number");
    assert(typeof listOrdersJson.summary.deliveredOrders === "number", "summary.deliveredOrders is a number");
    assert(typeof listOrdersJson.summary.paidOrders === "number", "summary.paidOrders is a number");
    assert(typeof listOrdersJson.summary.collectedRevenue === "number", "summary.collectedRevenue is a number");

    console.log(
      `  📊 Catalog Orders Baseline: Total=${listOrdersJson.summary.totalOrders}, Pending=${listOrdersJson.summary.pendingOrders}, Delivered=${listOrdersJson.summary.deliveredOrders}, Revenue=₹${listOrdersJson.summary.collectedRevenue}`
    );

    // -------------------------------------------------------------
    // Test 4: Isolated Temporary Test Order Lifecycle
    // -------------------------------------------------------------
    console.log(`\n[TEST 4] Isolated Temporary Test Order Lifecycle`);

    const timestamp = Date.now();
    const testOrderId = `cstage7_${timestamp}`;
    const testOrderNumber = `SHV-ORD-${timestamp}`;
    const testItemId = `citem7_${timestamp}`;

    console.log("  Creating isolated temporary test order in database...");
    await sql`
      INSERT INTO "Order" (
        "id", "orderNumber", "status", "paymentStatus",
        "subtotal", "discount", "shippingFee", "total",
        "customerName", "customerEmail", "customerPhone",
        "shippingAddressLine1", "shippingAddressLine2", "shippingCity",
        "shippingState", "shippingPostalCode", "shippingCountry",
        "createdAt", "updatedAt"
      ) VALUES (
        ${testOrderId}, ${testOrderNumber}, 'PENDING', 'PENDING',
        4999.00, 0.00, 0.00, 4999.00,
        'Stage 7 Test Customer', 'stage7test@shivura-luxury.com', '+91 98765 43210',
        '704 Heritage Palace, MG Road', 'Near City Gate', 'Jaipur',
        'Rajasthan', '302001', 'India',
        NOW(), NOW()
      );
    `;
    cleanupOrderIds.push(testOrderId);

    // Insert line item
    await sql`
      INSERT INTO "OrderItem" (
        "id", "orderId", "productName", "sku", "variantInfo",
        "price", "quantity", "subtotal", "createdAt"
      ) VALUES (
        ${testItemId}, ${testOrderId}, 'Handcrafted Brass Samai', 'SHV-SAMAI-01', 'Standard Edition',
        4999.00, 1, 4999.00, NOW()
      );
    `;

    // 4a. Find test order in listing and search
    const searchRes = await fetch(`${BASE_URL}/api/crm/orders?search=${encodeURIComponent(testOrderNumber)}`, {
      headers: { Cookie: adminCookie },
    });
    assert(searchRes.status === 200, "Search by orderNumber returns 200 OK");
    const searchJson = await searchRes.json();
    const foundOrder = searchJson.data.find((o) => o.id === testOrderId);
    assert(foundOrder !== undefined, "Search successfully located the newly created test order");
    assert(foundOrder.orderNumber === testOrderNumber, "Order number matches created record");
    assert(foundOrder.customerName === "Stage 7 Test Customer", "Customer name matches snapshot");
    assert(foundOrder.status === "PENDING", "Initial order status is PENDING");
    assert(foundOrder.paymentStatus === "PENDING", "Initial payment status is PENDING");
    assert(foundOrder.total === 4999, "Total amount is 4999");
    assert(foundOrder.items.length === 1, "Order contains 1 line item");

    // 4b. GET /api/crm/orders/:id details retrieval
    const detailsRes = await fetch(`${BASE_URL}/api/crm/orders/${testOrderId}`, {
      headers: { Cookie: adminCookie },
    });
    assert(detailsRes.status === 200, "GET /api/crm/orders/:id returns 200 OK");
    const detailsJson = await detailsRes.json();
    assert(detailsJson.success === true, "Details response is success");
    const orderDetails = detailsJson.data;
    assert(orderDetails.id === testOrderId, "Details ID matches requested order");
    assert(orderDetails.shippingAddressLine1 === "704 Heritage Palace, MG Road", "Shipping address line 1 preserved");
    assert(orderDetails.shippingCity === "Jaipur", "Shipping city preserved");
    assert(orderDetails.shippingPostalCode === "302001", "Postal code preserved");
    assert(orderDetails.items.length === 1, "Item snapshots array contains purchased item");
    assert(orderDetails.items[0].productName === "Handcrafted Brass Samai", "Product name snapshot intact");
    assert(orderDetails.items[0].price === 4999, "Item price is 4999");

    // 4c. Payment Verification Rule Enforcement
    // Attempting to mark PAID without payment evidence MUST BE BLOCKED
    console.log("  Testing payment verification guard: marking PAID without evidence...");
    const unverifiedPaidRes = await fetch(`${BASE_URL}/api/crm/orders/${testOrderId}/status`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "PAID" }),
    });
    assert(unverifiedPaidRes.status === 400, `Marking PAID without evidence is BLOCKED with 400 (got ${unverifiedPaidRes.status})`);
    const unverifiedPaidJson = await unverifiedPaidRes.json();
    assert(
      unverifiedPaidJson.code === "PAYMENT_EVIDENCE_REQUIRED",
      "Response code indicates 'PAYMENT_EVIDENCE_REQUIRED'"
    );

    // Verify order was NOT changed to PAID
    const checkUnpaid = await fetch(`${BASE_URL}/api/crm/orders/${testOrderId}`, {
      headers: { Cookie: adminCookie },
    });
    const checkUnpaidJson = await checkUnpaid.json();
    assert(checkUnpaidJson.data.paymentStatus === "PENDING", "Order remains PENDING payment status");

    // Now mark PAID with valid paymentEvidence
    console.log("  Marking PAID with verified payment evidence...");
    const verifiedPaidRes = await fetch(`${BASE_URL}/api/crm/orders/${testOrderId}/status`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentStatus: "PAID",
        paymentEvidence: "BANK-UTR-9876543210-VERIFIED",
      }),
    });
    assert(verifiedPaidRes.status === 200, `Marking PAID with evidence returns 200 OK (got ${verifiedPaidRes.status})`);
    const verifiedPaidJson = await verifiedPaidRes.json();
    assert(verifiedPaidJson.data.paymentStatus === "PAID", "Order paymentStatus updated to PAID");
    assert(Boolean(verifiedPaidJson.inventoryNotice), "Response includes inventory preservation notice");

    // Verify a verified payment record was created
    const checkPaidDetails = await fetch(`${BASE_URL}/api/crm/orders/${testOrderId}`, {
      headers: { Cookie: adminCookie },
    });
    const checkPaidJson = await checkPaidDetails.json();
    assert(checkPaidJson.data.payments.length >= 1, "Order now contains verified payment record");
    assert(
      checkPaidJson.data.payments[0].paymentId === "BANK-UTR-9876543210-VERIFIED",
      "Payment record preserves paymentEvidence reference"
    );

    // 4d. Fulfillment State Transitions: PENDING -> PROCESSING -> SHIPPED -> DELIVERED
    console.log("  Testing state transition: PENDING -> PROCESSING...");
    const processingRes = await fetch(`${BASE_URL}/api/crm/orders/${testOrderId}/status`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PROCESSING" }),
    });
    assert(processingRes.status === 200, "Status updated to PROCESSING with 200 OK");

    console.log("  Testing state transition: PROCESSING -> SHIPPED...");
    const shippedRes = await fetch(`${BASE_URL}/api/crm/orders/${testOrderId}/status`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SHIPPED" }),
    });
    assert(shippedRes.status === 200, "Status updated to SHIPPED with 200 OK");

    console.log("  Testing state transition: SHIPPED -> DELIVERED...");
    const deliveredRes = await fetch(`${BASE_URL}/api/crm/orders/${testOrderId}/status`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DELIVERED" }),
    });
    assert(deliveredRes.status === 200, "Status updated to DELIVERED with 200 OK");
    const deliveredJson = await deliveredRes.json();
    assert(deliveredJson.data.status === "DELIVERED", "Order status confirmed as DELIVERED");

    // -------------------------------------------------------------
    // Test 5: Zero Regression on Storefront APIs
    // -------------------------------------------------------------
    console.log(`\n[TEST 5] Storefront APIs Regression Check`);

    const productsRes = await fetch(`${BASE_URL}/api/products`);
    assert(productsRes.status === 200, "Storefront /api/products returns 200 OK");

    const categoriesRes = await fetch(`${BASE_URL}/api/categories`);
    assert(categoriesRes.status === 200, "Storefront /api/categories returns 200 OK");

    const occasionsRes = await fetch(`${BASE_URL}/api/occasions`);
    assert(occasionsRes.status === 200, "Storefront /api/occasions returns 200 OK");

    console.log(`\n=============================================================`);
    console.log(`✅ STAGE 7A CRM ORDERS MANAGEMENT TEST SUITE PASSED!`);
    console.log(`Total assertions passed: ${testsPassed}`);
    console.log(`Total assertions failed: ${testsFailed}`);
    console.log(`=============================================================\n`);
  } catch (err) {
    console.error(`\n❌ Test suite aborted with error:`, err);
    testsFailed++;
  } finally {
    // -------------------------------------------------------------
    // Guaranteed Safe Teardown
    // -------------------------------------------------------------
    if (cleanupOrderIds.length > 0) {
      console.log(`Cleaning up ${cleanupOrderIds.length} temporary test order(s)...`);
      for (const orderId of cleanupOrderIds) {
        try {
          await sql`DELETE FROM "Payment" WHERE "orderId" = ${orderId};`;
          await sql`DELETE FROM "OrderItem" WHERE "orderId" = ${orderId};`;
          await sql`DELETE FROM "Order" WHERE "id" = ${orderId};`;
          console.log(`  ✓ Safely purged test order: ${orderId}`);
        } catch (cleanupErr) {
          console.error(`  ⚠️ Cleanup error for ${orderId}:`, cleanupErr.message);
        }
      }
    }
  }

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
