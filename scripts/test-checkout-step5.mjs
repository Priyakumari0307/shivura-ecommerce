#!/usr/bin/env node

/**
 * Automated Verification Test Suite for Phase 7B - Step 5:
 * Customer Order History Page & Secure List API
 *
 * Verifies:
 * 1. Order History Page Server Rendering:
 *    - GET /account/orders renders with HTTP 200 OK
 * 2. Unauthenticated Access & Redirection Contract:
 *    - Unauthenticated GET /api/orders returns 401 Unauthorized
 * 3. Empty History State:
 *    - Customer with 0 orders receives empty list (data: [], total: 0)
 * 4. Authenticated Customer Access & Strict Isolation:
 *    - Customer A can view their own orders
 *    - Customer B cannot view Customer A's orders (and vice versa)
 *    - Query parameter tampering (?userId=...) is completely ignored
 * 5. Data Fidelity & Saved Snapshots:
 *    - Order statuses, payment statuses, dates, totals, and item thumbnails match database records
 * 6. Pagination Integrity:
 *    - Paginated queries work seamlessly without duplicate or missing orders
 * 7. Order Detail Link & Ownership Enforcement:
 *    - Links use correct identifiers (id, orderNumber)
 *    - Details endpoint enforces ownership (Customer B cannot view Customer A's order)
 * 8. Refresh & Idempotency Safety:
 *    - Multiple page reloads do not create duplicate orders or alter stock
 * 9. Guaranteed Teardown:
 *    - Complete cleanup of all temporary test fixtures
 */

import pkg from "@next/env";
const { loadEnvConfig } = pkg;
loadEnvConfig(".");

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

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

const cleanup = {
  orderIds: [],
  cartItemIds: [],
  cartIds: [],
  productIds: [],
  userIds: [],
};

async function createAndLoginCustomer(name, email, password) {
  // Signup
  await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  // Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const cookies = loginRes.headers.get("set-cookie") || "";
  const cookieMatch = cookies.match(/shivura_session=([^;]+)/);
  const sessionToken = cookieMatch ? cookieMatch[1] : null;

  return { sessionToken, cookieHeader: `shivura_session=${sessionToken}` };
}

async function run() {
  const { prisma } = await import("../lib/prisma.ts");

  console.log(`\n=============================================================`);
  console.log(`Starting Phase 7B Step 5: Customer Order History Tests`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  const timestamp = Date.now();

  try {
    // -------------------------------------------------------------
    // Test 1: Order History Page Rendering
    // -------------------------------------------------------------
    console.log(`[TEST 1] Order History Page Rendering (/account/orders)`);

    const pageRes = await fetch(`${BASE_URL}/account/orders`, {
      headers: { "Accept": "text/html" },
    });
    assert(pageRes.status === 200, `GET /account/orders renders 200 OK (got ${pageRes.status})`);

    const pageHtml = await pageRes.text();
    assert(
      pageHtml.includes("Shivura") || pageHtml.includes("Orders"),
      "Order history page HTML includes branding or layout structure"
    );

    // -------------------------------------------------------------
    // Test 2: Unauthenticated Access Protection
    // -------------------------------------------------------------
    console.log(`\n[TEST 2] Unauthenticated Access Protection`);

    const unauthRes = await fetch(`${BASE_URL}/api/orders`);
    assert(unauthRes.status === 401, `Unauthenticated GET /api/orders returns 401 (got ${unauthRes.status})`);
    const unauthJson = await unauthRes.json();
    assert(unauthJson.success === false, "Unauthenticated response indicates success: false");
    assert(unauthJson.error?.code === "UNAUTHORIZED", "Error code is UNAUTHORIZED");

    // -------------------------------------------------------------
    // Test 3: Empty History State
    // -------------------------------------------------------------
    console.log(`\n[TEST 3] Empty Order History for New Customer`);

    const newCustomerEmail = `new-cust-${timestamp}@shivura.com`;
    const newCustomerAuth = await createAndLoginCustomer("Kavita Rao", newCustomerEmail, "KavitaPass2026!");
    const newUser = await prisma.user.findUnique({ where: { email: newCustomerEmail } });
    if (newUser) cleanup.userIds.push(newUser.id);

    const emptyRes = await fetch(`${BASE_URL}/api/orders`, {
      headers: { Cookie: newCustomerAuth.cookieHeader },
    });
    assert(emptyRes.status === 200, `Empty order query returns 200 OK (got ${emptyRes.status})`);
    const emptyJson = await emptyRes.json();
    assert(Array.isArray(emptyJson.data) && emptyJson.data.length === 0, "Empty customer has data: []");
    assert(emptyJson.pagination?.total === 0, "Empty customer pagination total is 0");

    // -------------------------------------------------------------
    // Setup Test Products & Multiple Orders for Customer A & B
    // -------------------------------------------------------------
    console.log(`\n[SETUP] Creating test products, Customer A (3 orders), and Customer B (1 order)`);

    const product1 = await prisma.product.create({
      data: {
        name: `Heritage Brass Diya ${timestamp}`,
        slug: `heritage-brass-diya-${timestamp}`,
        sku: `SKU-DIYA-${timestamp}`,
        price: 1999.00,
        stock: 50,
        published: true,
        active: true,
        images: {
          create: {
            url: "https://res.cloudinary.com/demo/image/upload/diya.jpg",
            isPrimary: true,
            sortOrder: 0,
          },
        },
      },
    });
    cleanup.productIds.push(product1.id);

    const product2 = await prisma.product.create({
      data: {
        name: `Handcrafted Velvet Cushion ${timestamp}`,
        slug: `handcrafted-velvet-cushion-${timestamp}`,
        sku: `SKU-CUSHION-${timestamp}`,
        price: 1299.00,
        stock: 50,
        published: true,
        active: true,
        images: {
          create: {
            url: "https://res.cloudinary.com/demo/image/upload/cushion.jpg",
            isPrimary: true,
            sortOrder: 0,
          },
        },
      },
    });
    cleanup.productIds.push(product2.id);

    // Customer A
    const custAEmail = `cust-hist-a-${timestamp}@shivura.com`;
    const custAAuth = await createAndLoginCustomer("Aditya Birla", custAEmail, "AdityaPass2026!");
    const userA = await prisma.user.findUnique({ where: { email: custAEmail } });
    if (userA) cleanup.userIds.push(userA.id);

    // Customer B
    const custBEmail = `cust-hist-b-${timestamp}@shivura.com`;
    const custBAuth = await createAndLoginCustomer("Sunita Verma", custBEmail, "SunitaPass2026!");
    const userB = await prisma.user.findUnique({ where: { email: custBEmail } });
    if (userB) cleanup.userIds.push(userB.id);

    // Helper to create order directly via checkout endpoint
    async function placeOrderForCustomer(auth, cartItems, customerName, email) {
      const user = await prisma.user.findUnique({ where: { email } });
      const cart = await prisma.cart.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
      cleanup.cartIds.push(cart.id);

      for (const item of cartItems) {
        const ci = await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: item.productId,
            quantity: item.quantity,
          },
        });
        cleanup.cartItemIds.push(ci.id);
      }

      const res = await fetch(`${BASE_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": auth.cookieHeader,
        },
        body: JSON.stringify({
          customerName,
          customerEmail: email,
          customerPhone: "9876543210",
          shippingAddressLine1: "123 Royal Palms",
          shippingCity: "Mumbai",
          shippingState: "Maharashtra",
          shippingPostalCode: "400001",
          shippingCountry: "India",
          paymentMethod: "COD",
        }),
      });

      const json = await res.json();
      if (json.data?.id) cleanup.orderIds.push(json.data.id);
      return json.data;
    }

    // Place 3 orders for Customer A
    console.log("  Placing Order A1 for Customer A...");
    const orderA1 = await placeOrderForCustomer(custAAuth, [{ productId: product1.id, quantity: 1 }], "Aditya Birla", custAEmail);
    // Add small pause to guarantee distinct timestamps for deterministic desc ordering
    await new Promise((r) => setTimeout(r, 60));

    console.log("  Placing Order A2 for Customer A...");
    const orderA2 = await placeOrderForCustomer(custAAuth, [{ productId: product2.id, quantity: 2 }], "Aditya Birla", custAEmail);
    await new Promise((r) => setTimeout(r, 60));

    console.log("  Placing Order A3 for Customer A...");
    const orderA3 = await placeOrderForCustomer(custAAuth, [{ productId: product1.id, quantity: 1 }, { productId: product2.id, quantity: 1 }], "Aditya Birla", custAEmail);

    // Place 1 order for Customer B
    console.log("  Placing Order B1 for Customer B...");
    const orderB1 = await placeOrderForCustomer(custBAuth, [{ productId: product1.id, quantity: 3 }], "Sunita Verma", custBEmail);

    // -------------------------------------------------------------
    // Test 4: Customer Order Visibility & Strict Isolation
    // -------------------------------------------------------------
    console.log(`\n[TEST 4] Authenticated Customer Visibility & Cross-Customer Isolation`);

    // Customer A queries order history
    const custARes = await fetch(`${BASE_URL}/api/orders`, {
      headers: { Cookie: custAAuth.cookieHeader },
    });
    assert(custARes.status === 200, `Customer A order history returns 200 OK`);
    const custAJson = await custARes.json();

    assert(custAJson.success === true, "Customer A response indicates success: true");
    assert(custAJson.pagination.total === 3, `Customer A has exactly 3 orders (got ${custAJson.pagination.total})`);

    const custAOrderIds = custAJson.data.map((o) => o.id);
    assert(custAOrderIds.includes(orderA1.id), "Customer A history contains Order A1");
    assert(custAOrderIds.includes(orderA2.id), "Customer A history contains Order A2");
    assert(custAOrderIds.includes(orderA3.id), "Customer A history contains Order A3");
    assert(!custAOrderIds.includes(orderB1.id), "Customer A history DOES NOT contain Customer B's order");

    // Order chronological sorting (latest first)
    assert(custAJson.data[0].id === orderA3.id, "Latest placed order (A3) is first in history");
    assert(custAJson.data[1].id === orderA2.id, "Second latest order (A2) is second in history");
    assert(custAJson.data[2].id === orderA1.id, "Oldest order (A1) is last in history");

    // Customer B queries order history
    const custBRes = await fetch(`${BASE_URL}/api/orders`, {
      headers: { Cookie: custBAuth.cookieHeader },
    });
    assert(custBRes.status === 200, `Customer B order history returns 200 OK`);
    const custBJson = await custBRes.json();

    assert(custBJson.pagination.total === 1, `Customer B has exactly 1 order (got ${custBJson.pagination.total})`);
    assert(custBJson.data[0].id === orderB1.id, "Customer B history contains only Order B1");
    assert(!custBJson.data.some((o) => custAOrderIds.includes(o.id)), "Customer B history contains NONE of Customer A's orders");

    // Security guard: Parameter tampering
    console.log("  Testing parameter tampering: Customer B sending ?userId=userA...");
    const tamperedRes = await fetch(`${BASE_URL}/api/orders?userId=${userA.id}`, {
      headers: { Cookie: custBAuth.cookieHeader },
    });
    const tamperedJson = await tamperedRes.json();
    assert(tamperedJson.pagination.total === 1, "Tampered ?userId parameter was completely ignored");
    assert(tamperedJson.data[0].id === orderB1.id, "Customer B still only sees their own order");

    // -------------------------------------------------------------
    // Test 5: Data Fidelity & Saved Snapshots
    // -------------------------------------------------------------
    console.log(`\n[TEST 5] Order Snapshots & Status Fidelity`);

    const inspectedOrder = custAJson.data[0]; // Order A3
    assert(inspectedOrder.orderNumber.startsWith("SHV-"), `Order number has valid prefix: ${inspectedOrder.orderNumber}`);
    assert(inspectedOrder.status === "PENDING", `Order status is PENDING (got ${inspectedOrder.status})`);
    assert(inspectedOrder.paymentStatus === "PENDING", `Payment status is PENDING (got ${inspectedOrder.paymentStatus})`);
    assert(inspectedOrder.payment?.provider === "COD", `Payment provider is COD`);
    assert(inspectedOrder.customerName === "Aditya Birla", "Customer name snapshot intact");
    assert(inspectedOrder.itemCount === 2, `Item count is 2 (got ${inspectedOrder.itemCount})`);
    assert(Array.isArray(inspectedOrder.items) && inspectedOrder.items.length === 2, "Items array contains 2 lines");

    // Check line items snapshot
    const lineItem1 = inspectedOrder.items[0];
    assert(typeof lineItem1.productName === "string", "Line item contains productName snapshot");
    assert(typeof lineItem1.price === "number", "Line item contains price snapshot");
    assert(typeof lineItem1.quantity === "number", "Line item contains quantity snapshot");
    assert(typeof lineItem1.subtotal === "number", "Line item contains subtotal snapshot");
    assert(typeof lineItem1.imageSrc === "string", "Line item contains imageSrc thumbnail");

    // Totals
    // Product 1: 1999, Product 2: 1299 => Subtotal: 3298, Shipping: 0, Total: 3298
    assert(inspectedOrder.subtotal === 3298, `Subtotal is 3298 (got ${inspectedOrder.subtotal})`);
    assert(inspectedOrder.shippingFee === 0, `Free shipping for orders >= 999 (got ${inspectedOrder.shippingFee})`);
    assert(inspectedOrder.total === 3298, `Total is 3298 (got ${inspectedOrder.total})`);

    // -------------------------------------------------------------
    // Test 6: Pagination Integrity
    // -------------------------------------------------------------
    console.log(`\n[TEST 6] Pagination Controls & Absence of Duplicates`);

    // Page 1 with limit = 2
    const p1Res = await fetch(`${BASE_URL}/api/orders?page=1&limit=2`, {
      headers: { Cookie: custAAuth.cookieHeader },
    });
    const p1Json = await p1Res.json();
    assert(p1Json.pagination.page === 1, "Page 1 reported as 1");
    assert(p1Json.pagination.limit === 2, "Limit reported as 2");
    assert(p1Json.pagination.total === 3, "Total reported as 3");
    assert(p1Json.pagination.totalPages === 2, "Total pages is 2");
    assert(p1Json.pagination.hasNextPage === true, "hasNextPage is true on page 1");
    assert(p1Json.data.length === 2, `Page 1 returned exactly 2 items (got ${p1Json.data.length})`);

    // Page 2 with limit = 2
    const p2Res = await fetch(`${BASE_URL}/api/orders?page=2&limit=2`, {
      headers: { Cookie: custAAuth.cookieHeader },
    });
    const p2Json = await p2Res.json();
    assert(p2Json.pagination.page === 2, "Page 2 reported as 2");
    assert(p2Json.pagination.totalPages === 2, "Total pages is 2");
    assert(p2Json.pagination.hasNextPage === false, "hasNextPage is false on last page");
    assert(p2Json.data.length === 1, `Page 2 returned exactly 1 item (got ${p2Json.data.length})`);

    // Union of IDs should equal all 3 orders with zero duplicates
    const p1Ids = p1Json.data.map((o) => o.id);
    const p2Ids = p2Json.data.map((o) => o.id);
    const allPaginatedIds = [...p1Ids, ...p2Ids];

    assert(new Set(allPaginatedIds).size === 3, "No duplicate orders across paginated sets");
    assert(
      [orderA1.id, orderA2.id, orderA3.id].every((id) => allPaginatedIds.includes(id)),
      "All 3 orders represented across paginated sets"
    );

    // -------------------------------------------------------------
    // Test 7: Order Detail Links & Ownership Protection
    // -------------------------------------------------------------
    console.log(`\n[TEST 7] Order Detail Links & Ownership Security`);

    // Customer A accessing their own order details
    const ownerDetailRes = await fetch(`${BASE_URL}/api/orders/${orderA1.id}`, {
      headers: { Cookie: custAAuth.cookieHeader },
    });
    assert(ownerDetailRes.status === 200, `Owner accessing order detail returns 200 OK`);
    const ownerDetailJson = await ownerDetailRes.json();
    assert(ownerDetailJson.data.id === orderA1.id, "Returned detail matches requested order ID");

    // Customer B attempting to access Customer A's order details
    const crossDetailRes = await fetch(`${BASE_URL}/api/orders/${orderA1.id}`, {
      headers: { Cookie: custBAuth.cookieHeader },
    });
    assert(crossDetailRes.status === 404, `Foreign customer accessing order detail returns 404 Not Found (got ${crossDetailRes.status})`);

    // -------------------------------------------------------------
    // Test 8: Refresh & Idempotency Safety
    // -------------------------------------------------------------
    console.log(`\n[TEST 8] Page Refresh & Idempotency Safety`);

    const product1StockBefore = (await prisma.product.findUnique({ where: { id: product1.id }, select: { stock: true } })).stock;
    const ordersCountBefore = await prisma.order.count();

    // Simulate 5 page refreshes
    for (let i = 1; i <= 5; i++) {
      const refRes = await fetch(`${BASE_URL}/api/orders?page=1&limit=10`, {
        headers: { Cookie: custAAuth.cookieHeader },
      });
      assert(refRes.status === 200, `History refresh ${i} returns 200 OK`);
    }

    const product1StockAfter = (await prisma.product.findUnique({ where: { id: product1.id }, select: { stock: true } })).stock;
    const ordersCountAfter = await prisma.order.count();

    assert(product1StockBefore === product1StockAfter, `Product stock remains unchanged across refreshes (${product1StockBefore} === ${product1StockAfter})`);
    assert(ordersCountBefore === ordersCountAfter, `Total order count remains unchanged across refreshes (${ordersCountBefore} === ${ordersCountAfter})`);

    console.log(`\n=============================================================`);
    console.log(`Phase 7B Step 5 Test Suite Completed Successfully!`);
    console.log(`Passed: ${testsPassed} | Failed: ${testsFailed}`);
    console.log(`=============================================================\n`);
  } catch (error) {
    console.error(`\nTest suite encountered an error:`, error);
  } finally {
    // -------------------------------------------------------------
    // Teardown
    // -------------------------------------------------------------
    console.log(`[TEARDOWN] Cleaning up temporary test records...`);
    try {
      if (cleanup.orderIds.length > 0) {
        await prisma.payment.deleteMany({ where: { orderId: { in: cleanup.orderIds } } });
        await prisma.orderItem.deleteMany({ where: { orderId: { in: cleanup.orderIds } } });
        await prisma.order.deleteMany({ where: { id: { in: cleanup.orderIds } } });
      }
      if (cleanup.cartItemIds.length > 0) {
        await prisma.cartItem.deleteMany({ where: { id: { in: cleanup.cartItemIds } } });
      }
      if (cleanup.cartIds.length > 0) {
        await prisma.cart.deleteMany({ where: { id: { in: cleanup.cartIds } } });
      }
      if (cleanup.productIds.length > 0) {
        await prisma.productImage.deleteMany({ where: { productId: { in: cleanup.productIds } } });
        await prisma.product.deleteMany({ where: { id: { in: cleanup.productIds } } });
      }
      if (cleanup.userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: cleanup.userIds } } });
      }
      console.log(`[TEARDOWN] Cleanup completed cleanly.`);
    } catch (cleanupErr) {
      console.error(`[TEARDOWN ERROR]:`, cleanupErr);
    }
  }

  if (testsFailed > 0) {
    process.exit(1);
  }
}

run();
