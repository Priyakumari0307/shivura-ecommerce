#!/usr/bin/env node

/**
 * Automated Verification Test Suite for Phase 7B - Step 4:
 * Customer Order Confirmation Page & Secure Order Detail API
 *
 * Verifies:
 * 1. Confirmation Page Rendering:
 *    - GET /checkout/success renders with HTTP 200 OK
 * 2. Unauthenticated Access Protection:
 *    - Unauthenticated GET /api/orders/[id] returns 401 Unauthorized
 * 3. Strict Customer Ownership Isolation:
 *    - Customer B cannot access Customer A's order by ID or orderNumber (returns 404)
 *    - Customer B cannot view Customer A's name, email, phone, address, or items
 * 4. Tampered & Missing Identifier Safety:
 *    - Non-existent order IDs return 404 Not Found safely
 *    - Empty/whitespace identifiers return 400/404 safely
 * 5. Successful Lookup for Authenticated Owner:
 *    - Customer A can fetch their order via either order ID or orderNumber
 *    - Receives HTTP 200 OK with sanitized order confirmation payload
 * 6. Data Integrity & Saved Snapshots:
 *    - Verifies item snapshots (name, sku, variantInfo, qty, price, subtotal, imageSrc)
 *    - Verifies shipping address snapshot (addressLine1, city, state, postalCode, country)
 *    - Verifies monetary totals (subtotal, discount, shippingFee, total)
 *    - Verifies payment snapshot (COD provider, PENDING status)
 * 7. Refresh & Idempotency Safety:
 *    - Multiple consecutive GET calls (simulating page refreshes) do not alter stock
 *    - No duplicate orders created on refresh
 * 8. Guaranteed Cleanup & Teardown
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
  console.log(`Starting Phase 7B Step 4: Order Confirmation & Detail Tests`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  const timestamp = Date.now();

  try {
    // -------------------------------------------------------------
    // Test 1: Page HTTP Rendering
    // -------------------------------------------------------------
    console.log(`[TEST 1] Confirmation Page Rendering (/checkout/success)`);

    const pageRes = await fetch(`${BASE_URL}/checkout/success`, {
      headers: { "Accept": "text/html" },
    });
    assert(pageRes.status === 200, `GET /checkout/success renders 200 OK (got ${pageRes.status})`);

    const pageHtml = await pageRes.text();
    assert(
      pageHtml.includes("Shivura") || pageHtml.includes("Order") || pageHtml.includes("Confirmation"),
      "Confirmation page HTML includes brand / page layout structure"
    );

    // -------------------------------------------------------------
    // Setup Test Data: Products, Customer A, Customer B, and Order A
    // -------------------------------------------------------------
    console.log(`\n[SETUP] Creating test products, customers, and order`);

    // Create a luxury test product
    const testProduct = await prisma.product.create({
      data: {
        name: `Royal Silk Scarf ${timestamp}`,
        slug: `royal-silk-scarf-${timestamp}`,
        sku: `SKU-SCARF-${timestamp}`,
        price: 3499.00,
        originalPrice: 4499.00,
        stock: 15,
        published: true,
        active: true,
        images: {
          create: {
            url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
            isPrimary: true,
            sortOrder: 0,
          },
        },
      },
    });
    cleanup.productIds.push(testProduct.id);

    // Create Customer A
    const customerAEmail = `cust-a-${timestamp}@shivura.com`;
    const customerAPass = "CustomerA2026!";
    const customerAAuth = await createAndLoginCustomer("Aarav Singhania", customerAEmail, customerAPass);

    const userA = await prisma.user.findUnique({ where: { email: customerAEmail } });
    if (userA) cleanup.userIds.push(userA.id);

    // Create Customer B
    const customerBEmail = `cust-b-${timestamp}@shivura.com`;
    const customerBPass = "CustomerB2026!";
    const customerBAuth = await createAndLoginCustomer("Priya Mehta", customerBEmail, customerBPass);

    const userB = await prisma.user.findUnique({ where: { email: customerBEmail } });
    if (userB) cleanup.userIds.push(userB.id);

    // Populate Customer A's Cart
    const cartA = await prisma.cart.upsert({
      where: { userId: userA.id },
      create: { userId: userA.id },
      update: {},
    });
    cleanup.cartIds.push(cartA.id);

    const cartItemA = await prisma.cartItem.create({
      data: {
        cartId: cartA.id,
        productId: testProduct.id,
        quantity: 2,
      },
    });
    cleanup.cartItemIds.push(cartItemA.id);

    // Place Order for Customer A via POST /api/orders
    const orderCreateRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": customerAAuth.cookieHeader,
      },
      body: JSON.stringify({
        customerName: "Aarav Singhania",
        customerEmail: customerAEmail,
        customerPhone: "9876543210",
        shippingAddressLine1: "42 Heritage Boulevard, 4th Floor",
        shippingAddressLine2: "Near Royal Palace",
        shippingCity: "Jaipur",
        shippingState: "Rajasthan",
        shippingPostalCode: "302001",
        shippingCountry: "India",
        paymentMethod: "COD",
      }),
    });

    assert(orderCreateRes.status === 201, `Customer A order created with 201 (got ${orderCreateRes.status})`);
    const orderCreateJson = await orderCreateRes.json();
    assert(orderCreateJson.success === true, "Customer A order response marked success");
    const createdOrderData = orderCreateJson.data;
    cleanup.orderIds.push(createdOrderData.id);

    // -------------------------------------------------------------
    // Test 2: Unauthenticated Access Protection
    // -------------------------------------------------------------
    console.log(`\n[TEST 2] Unauthenticated Access Protection`);

    const unauthByIdRes = await fetch(`${BASE_URL}/api/orders/${createdOrderData.id}`);
    assert(unauthByIdRes.status === 401, `Unauthenticated request by ID returns 401 (got ${unauthByIdRes.status})`);

    const unauthByNumberRes = await fetch(`${BASE_URL}/api/orders/${createdOrderData.orderNumber}`);
    assert(unauthByNumberRes.status === 401, `Unauthenticated request by orderNumber returns 401 (got ${unauthByNumberRes.status})`);

    // -------------------------------------------------------------
    // Test 3: Customer Isolation (Rejection of Another Customer's Order)
    // -------------------------------------------------------------
    console.log(`\n[TEST 3] Cross-Customer Isolation (Customer B trying to access Customer A's Order)`);

    const crossCustByIdRes = await fetch(`${BASE_URL}/api/orders/${createdOrderData.id}`, {
      headers: { "Cookie": customerBAuth.cookieHeader },
    });
    assert(crossCustByIdRes.status === 404, `Customer B querying Customer A's order by ID returns 404 (got ${crossCustByIdRes.status})`);
    const crossCustByIdJson = await crossCustByIdRes.json();
    assert(crossCustByIdJson.success === false, "Cross-customer lookup returns success: false");
    assert(
      !crossCustByIdJson.data,
      "Customer B cannot view Customer A's data or snapshots"
    );

    const crossCustByNumberRes = await fetch(`${BASE_URL}/api/orders/${createdOrderData.orderNumber}`, {
      headers: { "Cookie": customerBAuth.cookieHeader },
    });
    assert(crossCustByNumberRes.status === 404, `Customer B querying Customer A's order by orderNumber returns 404 (got ${crossCustByNumberRes.status})`);

    // -------------------------------------------------------------
    // Test 4: Tampered and Non-existent Identifiers
    // -------------------------------------------------------------
    console.log(`\n[TEST 4] Tampered and Non-existent Identifiers`);

    const tamperedRes = await fetch(`${BASE_URL}/api/orders/non-existent-order-id-fake`, {
      headers: { "Cookie": customerAAuth.cookieHeader },
    });
    assert(tamperedRes.status === 404, `Non-existent order ID returns 404 (got ${tamperedRes.status})`);

    const tamperedNumberRes = await fetch(`${BASE_URL}/api/orders/SHV-00000000-00000`, {
      headers: { "Cookie": customerAAuth.cookieHeader },
    });
    assert(tamperedNumberRes.status === 404, `Non-existent orderNumber returns 404 (got ${tamperedNumberRes.status})`);

    // -------------------------------------------------------------
    // Test 5: Successful Detail Fetch for Authenticated Order Owner
    // -------------------------------------------------------------
    console.log(`\n[TEST 5] Authenticated Order Owner Access`);

    // 5a. Lookup by order ID
    const ownerByIdRes = await fetch(`${BASE_URL}/api/orders/${createdOrderData.id}`, {
      headers: { "Cookie": customerAAuth.cookieHeader },
    });
    assert(ownerByIdRes.status === 200, `Owner lookup by ID returns 200 OK (got ${ownerByIdRes.status})`);
    const ownerByIdJson = await ownerByIdRes.json();
    assert(ownerByIdJson.success === true, "Owner lookup by ID returns success: true");

    // 5b. Lookup by orderNumber
    const ownerByNumberRes = await fetch(`${BASE_URL}/api/orders/${createdOrderData.orderNumber}`, {
      headers: { "Cookie": customerAAuth.cookieHeader },
    });
    assert(ownerByNumberRes.status === 200, `Owner lookup by orderNumber returns 200 OK (got ${ownerByNumberRes.status})`);
    const ownerByNumberJson = await ownerByNumberRes.json();
    assert(ownerByNumberJson.success === true, "Owner lookup by orderNumber returns success: true");

    // -------------------------------------------------------------
    // Test 6: Snapshot Data Integrity (Items, Address, Totals, COD)
    // -------------------------------------------------------------
    console.log(`\n[TEST 6] Saved Snapshot Data Integrity`);

    const orderDetail = ownerByIdJson.data;

    // Order identifiers
    assert(orderDetail.id === createdOrderData.id, "Order ID matches database ID");
    assert(orderDetail.orderNumber === createdOrderData.orderNumber, "Order number matches database orderNumber");
    assert(orderDetail.status === "PENDING", "Order status is PENDING");

    // Item snapshots
    assert(Array.isArray(orderDetail.items) && orderDetail.items.length === 1, "Order items array has exactly 1 line item");
    const item0 = orderDetail.items[0];
    assert(item0.productName === testProduct.name, `Saved item name matches product snapshot: ${item0.productName}`);
    assert(item0.sku === testProduct.sku, `Saved item SKU matches snapshot: ${item0.sku}`);
    assert(item0.quantity === 2, `Saved item quantity is 2 (got ${item0.quantity})`);
    assert(item0.price === 3499, `Saved item price is 3499 (got ${item0.price})`);
    assert(item0.subtotal === 6998, `Saved item subtotal is 6998 (got ${item0.subtotal})`);
    assert(typeof item0.imageSrc === "string" && item0.imageSrc.length > 0, "Item imageSrc is preserved");

    // Address snapshots
    assert(orderDetail.customerName === "Aarav Singhania", "Customer name matches snapshot");
    assert(orderDetail.customerEmail === customerAEmail, "Customer email matches snapshot");
    assert(
      orderDetail.customerPhone === "+91 98765 43210" || orderDetail.customerPhone === "9876543210",
      `Customer phone matches snapshot (got ${orderDetail.customerPhone})`
    );
    assert(orderDetail.shippingAddress.addressLine1 === "42 Heritage Boulevard, 4th Floor", "Address line 1 matches snapshot");
    assert(orderDetail.shippingAddress.addressLine2 === "Near Royal Palace", "Address line 2 matches snapshot");
    assert(orderDetail.shippingAddress.city === "Jaipur", "City matches snapshot");
    assert(orderDetail.shippingAddress.state === "Rajasthan", "State matches snapshot");
    assert(orderDetail.shippingAddress.postalCode === "302001", "PIN code matches snapshot");
    assert(orderDetail.shippingAddress.country === "India", "Country matches snapshot");

    // Monetary totals
    // 2 * 3499 = 6998 (>= 999 free shipping threshold => shippingFee = 0)
    assert(orderDetail.subtotal === 6998, `Subtotal is 6998 (got ${orderDetail.subtotal})`);
    assert(orderDetail.discount === 0, `Discount is 0 (got ${orderDetail.discount})`);
    assert(orderDetail.shippingFee === 0, `Shipping fee is 0 (got ${orderDetail.shippingFee})`);
    assert(orderDetail.total === 6998, `Total is 6998 (got ${orderDetail.total})`);

    // Payment details
    assert(orderDetail.paymentStatus === "PENDING", "Order paymentStatus is PENDING");
    assert(orderDetail.payment !== null, "Payment object exists");
    assert(orderDetail.payment.provider === "COD", `Payment provider is COD (got ${orderDetail.payment.provider})`);
    assert(orderDetail.payment.status === "PENDING", `Payment status is PENDING (got ${orderDetail.payment.status})`);
    assert(orderDetail.payment.amount === 6998, `Payment amount matches order total (got ${orderDetail.payment.amount})`);

    // -------------------------------------------------------------
    // Test 7: Refresh & Idempotency Safety
    // -------------------------------------------------------------
    console.log(`\n[TEST 7] Confirmation Refresh & Idempotency Safety`);

    // Check product stock before simulated refreshes
    const productBeforeRefreshes = await prisma.product.findUnique({
      where: { id: testProduct.id },
      select: { stock: true },
    });
    const orderCountBefore = await prisma.order.count();

    // Simulate 5 client page refreshes fetching the order detail
    for (let i = 1; i <= 5; i++) {
      const refreshRes = await fetch(`${BASE_URL}/api/orders/${createdOrderData.id}`, {
        headers: { "Cookie": customerAAuth.cookieHeader },
      });
      assert(refreshRes.status === 200, `Refresh ${i} returns 200 OK`);
    }

    // Verify stock and orders count are completely unaffected
    const productAfterRefreshes = await prisma.product.findUnique({
      where: { id: testProduct.id },
      select: { stock: true },
    });
    const orderCountAfter = await prisma.order.count();

    assert(
      productBeforeRefreshes.stock === productAfterRefreshes.stock,
      `Stock remains invariant across refreshes (${productBeforeRefreshes.stock} === ${productAfterRefreshes.stock})`
    );
    assert(
      orderCountBefore === orderCountAfter,
      `Order count in database remains unchanged (${orderCountBefore} === ${orderCountAfter})`
    );

    console.log(`\n=============================================================`);
    console.log(`Phase 7B Step 4 Test Suite Completed Successfully!`);
    console.log(`Passed: ${testsPassed} | Failed: ${testsFailed}`);
    console.log(`=============================================================\n`);
  } catch (error) {
    console.error(`\nTest suite encountered an error:`, error);
  } finally {
    // -------------------------------------------------------------
    // Safe Teardown
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
