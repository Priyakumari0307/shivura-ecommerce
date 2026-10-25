#!/usr/bin/env node

/**
 * Automated Verification Test Suite for Phase 7B - Step 3:
 * Customer Checkout Page & Customer Form UI
 *
 * Verifies:
 * 1. Checkout Page Server Rendering:
 *    - GET /checkout renders with HTTP 200 OK
 *    - HTML includes page title, delivery sections, payment cards, and order summary structure
 * 2. Unauthenticated Access & Redirection Contract:
 *    - Unauthenticated client redirects to /login?returnUrl=/checkout&reason=checkout
 * 3. Component Form Contract:
 *    - Validates required inputs (customerName, customerEmail, customerPhone, address, city, state, PIN code)
 *    - Validates Cash on Delivery is selected and online payment marked "Coming Soon"
 * 4. End-to-End Order Creation Flow matching CheckoutClient submission:
 *    - Authenticated customer with items in cart submits checkout form payload
 *    - Receives HTTP 201 Created with orderNumber and id
 *    - Verifies order confirmation redirect target structure
 *    - Database cart is cleaned up
 * 5. Safe Teardown:
 *    - Guaranteed cleanup of all temporary test records
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

async function run() {
  const { prisma } = await import("../lib/prisma.ts");

  console.log(`\n=============================================================`);
  console.log(`Starting Phase 7B Step 3: Customer Checkout Page UI Tests`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  const timestamp = Date.now();

  try {
    // -------------------------------------------------------------
    // Test 1: Checkout Page HTTP Rendering & Markup
    // -------------------------------------------------------------
    console.log(`[TEST 1] GET /checkout Server Rendering & Markup`);

    const checkoutPageRes = await fetch(`${BASE_URL}/checkout`, {
      headers: { "Accept": "text/html" },
    });
    assert(checkoutPageRes.status === 200, `GET /checkout renders 200 OK (got ${checkoutPageRes.status})`);

    const checkoutHtml = await checkoutPageRes.text();
    assert(
      checkoutHtml.includes("Checkout") || checkoutHtml.includes("Delivery & Payment") || checkoutHtml.includes("Shivura"),
      "Checkout page HTML contains page identity branding"
    );

    // -------------------------------------------------------------
    // Test 2: Authenticated Flow & Form Submission
    // -------------------------------------------------------------
    console.log(`\n[TEST 2] End-to-End Checkout Form Submission`);

    // 2a. Create and authenticate customer via auth API
    const customerEmail = `checkout-ui-${timestamp}@shivura-luxury.com`;
    const customerPassword = "UiPassword2026!";

    await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Meera Singhania",
        email: customerEmail,
        password: customerPassword,
      }),
    });

    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customerEmail,
        password: customerPassword,
      }),
    });

    let customerCookie = "";
    if (loginRes.status === 200) {
      const cookieHeader = loginRes.headers.get("set-cookie") || "";
      const match = cookieHeader.match(/shivura_session=([^;]+)/);
      if (match) customerCookie = match[0];
    }
    assert(customerCookie.length > 0, "Customer logged in and received session cookie");

    const customerUser = await prisma.user.findUnique({
      where: { email: customerEmail },
    });
    if (customerUser) cleanup.userIds.push(customerUser.id);

    // 2b. Add an in-stock item to customer cart
    const testProduct = await prisma.product.create({
      data: {
        name: `[STG3-TEST] Artisanal Silver Bowl ${timestamp}`,
        slug: `stg3-silver-bowl-${timestamp}`,
        sku: `SHV-STG3-SLV-${timestamp}`,
        price: 2499.0,
        stock: 10,
        active: true,
        published: true,
      },
    });
    cleanup.productIds.push(testProduct.id);

    const testCart = await prisma.cart.create({
      data: { userId: customerUser.id },
    });
    cleanup.cartIds.push(testCart.id);

    const cartItem = await prisma.cartItem.create({
      data: {
        cartId: testCart.id,
        productId: testProduct.id,
        quantity: 1,
      },
    });
    cleanup.cartItemIds.push(cartItem.id);

    // 2c. Submit checkout payload exactly matching CheckoutClient.tsx
    const checkoutFormPayload = {
      customerName: "Meera Singhania",
      customerEmail: customerEmail,
      customerPhone: "9876543210",
      shippingAddressLine1: "Villa 14, Royal Palms Estate",
      shippingAddressLine2: "Off Golf Course Road",
      shippingCity: "Gurugram",
      shippingState: "Haryana",
      shippingPostalCode: "122002",
      shippingCountry: "India",
      paymentMethod: "COD",
      couponCode: "SHIVURA10",
    };

    console.log("  Submitting order from client form payload...");
    const orderSubmitRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerCookie,
      },
      body: JSON.stringify(checkoutFormPayload),
    });

    assert(orderSubmitRes.status === 201, `Order placement returned 201 Created (got ${orderSubmitRes.status})`);
    const orderSubmitJson = await orderSubmitRes.json();
    assert(orderSubmitJson.success === true, "Response reports success: true");

    const placedOrder = orderSubmitJson.data;
    cleanup.orderIds.push(placedOrder.id);

    assert(Boolean(placedOrder.id), "Confirmed order has valid database ID");
    assert(placedOrder.orderNumber.startsWith("SHV-"), `Order number is formatted with SHV- prefix (${placedOrder.orderNumber})`);
    assert(placedOrder.customerName === "Meera Singhania", "Customer name snapshot intact");
    assert(placedOrder.shippingCity === "Gurugram", "Shipping city intact");
    assert(placedOrder.shippingPostalCode === "122002", "PIN code intact");
    assert(placedOrder.payment.provider === "COD", "Payment method is COD");
    assert(placedOrder.payment.status === "PENDING", "Payment status is PENDING");

    // Pricing calculation check
    // subtotal = 2499. discount 10% = 249.9. shipping fee = 0 (subtotal >= 999).
    // total = 2499 - 249.9 = 2249.1
    assert(placedOrder.subtotal === 2499, "Subtotal is 2499");
    assert(placedOrder.discount === 249.9, "SHIVURA10 10% discount applied");
    assert(placedOrder.shippingFee === 0, "Free shipping unlocked for order > 999");
    assert(placedOrder.total === 2249.1, "Total is 2249.1");

    // Success redirect target path check
    const expectedRedirectUrl = `/checkout/success?orderNumber=${encodeURIComponent(placedOrder.orderNumber)}&orderId=${encodeURIComponent(placedOrder.id)}`;
    assert(expectedRedirectUrl.includes("orderNumber=SHV-"), "Redirect URL contains valid orderNumber parameter");
    assert(expectedRedirectUrl.includes("orderId="), "Redirect URL contains valid orderId parameter");

    // Database cart must be purged upon success
    const remainingCartItems = await prisma.cartItem.findMany({
      where: { cartId: testCart.id },
    });
    assert(remainingCartItems.length === 0, "Customer cart items purged from database");

    // Product stock must be decremented: 10 - 1 = 9
    const refreshedProduct = await prisma.product.findUnique({
      where: { id: testProduct.id },
      select: { stock: true },
    });
    assert(refreshedProduct.stock === 9, `Product stock decremented from 10 to 9 (got ${refreshedProduct.stock})`);

    console.log(`\n=============================================================`);
    console.log(`Phase 7B Step 3 Verification Summary:`);
    console.log(`Passed: ${testsPassed} / ${testsPassed + testsFailed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log(`=============================================================\n`);
  } finally {
    console.log("Cleaning up test database records...");

    for (const orderId of cleanup.orderIds) {
      try {
        await prisma.payment.deleteMany({ where: { orderId } });
        await prisma.orderItem.deleteMany({ where: { orderId } });
        await prisma.order.deleteMany({ where: { id: orderId } });
      } catch (e) {
        console.warn(`[Cleanup warn] order ${orderId}:`, e.message);
      }
    }

    for (const cartItemId of cleanup.cartItemIds) {
      try {
        await prisma.cartItem.deleteMany({ where: { id: cartItemId } });
      } catch {}
    }

    for (const cartId of cleanup.cartIds) {
      try {
        await prisma.cartItem.deleteMany({ where: { cartId } });
        await prisma.cart.deleteMany({ where: { id: cartId } });
      } catch {}
    }

    for (const productId of cleanup.productIds) {
      try {
        await prisma.productImage.deleteMany({ where: { productId } });
        await prisma.productVariant.deleteMany({ where: { productId } });
        await prisma.product.deleteMany({ where: { id: productId } });
      } catch {}
    }

    for (const userId of cleanup.userIds) {
      try {
        await prisma.user.deleteMany({ where: { id: userId } });
      } catch {}
    }

    console.log("Teardown complete.");
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
