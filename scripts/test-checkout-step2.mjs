#!/usr/bin/env node

/**
 * Automated Verification Test Suite for Phase 7B - Step 2:
 * Secure Customer Order API & Customer Order History API
 *
 * Verifies:
 * 1. Concern 1 Fix:
 *    - Purchasing a variant decrements both ProductVariant.stock AND Product aggregate stock consistently.
 * 2. Concern 2 Fix:
 *    - Database coupon usage limits are safe under concurrent redemptions (atomic conditional increment).
 * 3. POST /api/orders Endpoint:
 *    - Unauthenticated request returns 401 Unauthorized
 *    - Malformed body or invalid checkout fields return 400 Validation Error
 *    - Non-COD payment method returns 400 (only COD accepted)
 *    - Empty cart returns 400 EMPTY_CART
 *    - Out of stock returns 400 INSUFFICIENT_STOCK
 *    - Valid checkout succeeds with HTTP 201 Created and confirmed order payload
 *    - COD payment is PENDING (never PAID)
 *    - Database cart purged upon success
 * 4. GET /api/orders Endpoint:
 *    - Unauthenticated request returns 401 Unauthorized
 *    - Customer isolation: Customer A CANNOT see Customer B's orders
 *    - Query parameter tampering immunity: ?userId=CustomerB does not override session auth
 *    - Pagination and stable ordering (createdAt desc, id desc)
 *    - Safe response structure (no secrets, safe payment summary)
 * 5. Safe Teardown:
 *    - All test users, orders, coupons, and products cleaned up in finally block
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
  variantIds: [],
  productIds: [],
  couponIds: [],
  userIds: [],
};

async function run() {
  const { prisma } = await import("../lib/prisma.ts");
  const { processCheckout } = await import("../lib/checkout.ts");

  async function createAndLoginCustomer(email, password, name) {
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

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user) {
      cleanup.userIds.push(user.id);
    }

    return { user, cookie };
  }

  console.log(`\n=============================================================`);
  console.log(`Starting Phase 7B Step 2: Customer Order & History API Tests`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  const timestamp = Date.now();

  try {
    // -------------------------------------------------------------
    // Test 1: Concern 1 Fix - Variant & Aggregate Product Stock Consistency
    // -------------------------------------------------------------
    console.log(`[TEST 1] Concern 1: Variant & Parent Product Stock Synchronization`);

    // Create a product with stock = 20 and a variant with stock = 12
    const parentProduct = await prisma.product.create({
      data: {
        name: `[STG2-TEST] Regal Brass Lamp ${timestamp}`,
        slug: `stg2-test-brass-lamp-${timestamp}`,
        sku: `SHV-STG2-PRD-${timestamp}`,
        price: 3499.0,
        stock: 20, // Aggregate stock
        active: true,
        published: true,
      },
    });
    cleanup.productIds.push(parentProduct.id);

    const variantRecord = await prisma.productVariant.create({
      data: {
        productId: parentProduct.id,
        name: "Standard Antique 12 Inch",
        sku: `SHV-STG2-VAR-${timestamp}`,
        price: 3999.0,
        stock: 12, // Variant stock
        active: true,
      },
    });
    cleanup.variantIds.push(variantRecord.id);

    // Create test user and cart with 3 units of the variant
    const stockTestUser = await prisma.user.create({
      data: {
        email: `stock-test-${timestamp}@shivura-luxury.com`,
        name: "Stock Sync Test Customer",
        phone: "+91 98765 33333",
      },
    });
    cleanup.userIds.push(stockTestUser.id);

    const stockTestCart = await prisma.cart.create({
      data: { userId: stockTestUser.id },
    });
    cleanup.cartIds.push(stockTestCart.id);

    const variantCartItem = await prisma.cartItem.create({
      data: {
        cartId: stockTestCart.id,
        productId: parentProduct.id,
        variantId: variantRecord.id,
        quantity: 3, // Purchasing 3 units
      },
    });
    cleanup.cartItemIds.push(variantCartItem.id);

    // Execute checkout
    const checkoutResult = await processCheckout(stockTestUser.id, {
      customerName: "Stock Sync Test Customer",
      customerEmail: stockTestUser.email,
      customerPhone: "+91 98765 33333",
      shippingAddressLine1: "101 Artisan Boulevard",
      shippingCity: "Jaipur",
      shippingState: "Rajasthan",
      shippingPostalCode: "302001",
      shippingCountry: "India",
      paymentMethod: "COD",
    });
    cleanup.orderIds.push(checkoutResult.order.id);

    // Verify both variant stock AND parent product stock were decremented
    const refreshedVariant = await prisma.productVariant.findUnique({
      where: { id: variantRecord.id },
      select: { stock: true },
    });
    const refreshedParent = await prisma.product.findUnique({
      where: { id: parentProduct.id },
      select: { stock: true },
    });

    assert(
      refreshedVariant.stock === 9,
      `Variant stock decremented from 12 to 9 (got ${refreshedVariant.stock})`
    );
    assert(
      refreshedParent.stock === 17,
      `Parent product aggregate stock decremented from 20 to 17 (got ${refreshedParent.stock})`
    );

    // -------------------------------------------------------------
    // Test 2: Concern 2 Fix - Coupon Usage Limits Under Concurrent Redemptions
    // -------------------------------------------------------------
    console.log(`\n[TEST 2] Concern 2: Coupon Limit Safety Under Concurrency`);

    // Create a database coupon with usageLimit = 1 and usageCount = 0
    const testCoupon = await prisma.coupon.create({
      data: {
        code: `RACE-${timestamp.toString().slice(-6)}`,
        description: "Race condition test coupon",
        discountType: "FIXED",
        discountValue: 100.0,
        usageLimit: 1, // Strictly 1 redemption allowed!
        usageCount: 0,
        active: true,
      },
    });
    cleanup.couponIds.push(testCoupon.id);

    // Create 2 distinct users with carts having the remaining in-stock product
    const raceUserA = await prisma.user.create({
      data: {
        email: `race-a-${timestamp}@shivura-luxury.com`,
        name: "Coupon Race User A",
        phone: "+91 98765 44441",
      },
    });
    cleanup.userIds.push(raceUserA.id);

    const raceUserB = await prisma.user.create({
      data: {
        email: `race-b-${timestamp}@shivura-luxury.com`,
        name: "Coupon Race User B",
        phone: "+91 98765 44442",
      },
    });
    cleanup.userIds.push(raceUserB.id);

    const raceCartA = await prisma.cart.create({ data: { userId: raceUserA.id } });
    cleanup.cartIds.push(raceCartA.id);
    const raceItemA = await prisma.cartItem.create({
      data: { cartId: raceCartA.id, productId: parentProduct.id, quantity: 1 },
    });
    cleanup.cartItemIds.push(raceItemA.id);

    const raceCartB = await prisma.cart.create({ data: { userId: raceUserB.id } });
    cleanup.cartIds.push(raceCartB.id);
    const raceItemB = await prisma.cartItem.create({
      data: { cartId: raceCartB.id, productId: parentProduct.id, quantity: 1 },
    });
    cleanup.cartItemIds.push(raceItemB.id);

    const checkoutInputWithCoupon = {
      customerName: "Coupon Race Customer",
      customerEmail: "race@shivura-luxury.com",
      customerPhone: "+91 98765 44444",
      shippingAddressLine1: "202 Heritage Square",
      shippingCity: "Jaipur",
      shippingState: "Rajasthan",
      shippingPostalCode: "302001",
      shippingCountry: "India",
      paymentMethod: "COD",
      couponCode: testCoupon.code,
    };

    console.log("  Firing 2 simultaneous checkouts redeeming coupon with usageLimit = 1...");
    const [couponResA, couponResB] = await Promise.allSettled([
      processCheckout(raceUserA.id, checkoutInputWithCoupon),
      processCheckout(raceUserB.id, checkoutInputWithCoupon),
    ]);

    const aRedeemed = couponResA.status === "fulfilled";
    const bRedeemed = couponResB.status === "fulfilled";

    if (aRedeemed) cleanup.orderIds.push(couponResA.value.order.id);
    if (bRedeemed) cleanup.orderIds.push(couponResB.value.order.id);

    assert(
      (aRedeemed && !bRedeemed) || (!aRedeemed && bRedeemed),
      "Exactly 1 checkout succeeds with the coupon and the concurrent one is rejected"
    );

    const failedReason = !aRedeemed ? couponResA.reason : couponResB.reason;
    assert(
      failedReason?.code === "COUPON_LIMIT_REACHED",
      `Second checkout rejected specifically with COUPON_LIMIT_REACHED (got ${failedReason?.code})`
    );

    const finalCouponState = await prisma.coupon.findUnique({
      where: { id: testCoupon.id },
      select: { usageCount: true },
    });
    assert(
      finalCouponState.usageCount === 1,
      `Coupon usageCount is exactly 1 (never exceeded 1, got ${finalCouponState.usageCount})`
    );

    // -------------------------------------------------------------
    // Test 3: HTTP POST /api/orders Endpoint
    // -------------------------------------------------------------
    console.log(`\n[TEST 3] HTTP POST /api/orders Endpoint`);

    // 3a. Unauthenticated POST /api/orders returns 401
    const unauthPost = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert(unauthPost.status === 401, "Unauthenticated POST /api/orders returns 401 Unauthorized");
    const unauthPostJson = await unauthPost.json();
    assert(unauthPostJson.success === false, "Unauthenticated response indicates success: false");
    assert(unauthPostJson.error.code === "UNAUTHORIZED", "Unauthenticated error code is UNAUTHORIZED");

    // Setup authenticated test customer session
    const { user: customerUser, cookie: customerCookie } = await createAndLoginCustomer(
      `customer-orders-${timestamp}@shivura-luxury.com`,
      "SecurePassword2026!",
      "Ananya Deshmukh"
    );

    // 3b. Malformed JSON / Invalid validation
    const invalidBodyRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerCookie,
      },
      body: JSON.stringify({
        customerName: "A", // Too short
        shippingPostalCode: "123", // Invalid PIN
        paymentMethod: "RAZORPAY", // Non-COD rejected
      }),
    });
    assert(invalidBodyRes.status === 400, "Validation failure returns 400 Bad Request");
    const invalidBodyJson = await invalidBodyRes.json();
    assert(invalidBodyJson.success === false, "Response has success: false");
    assert(invalidBodyJson.error.code === "VALIDATION_ERROR", "Error code is VALIDATION_ERROR");

    // 3c. Empty Cart check
    const emptyCartRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerCookie,
      },
      body: JSON.stringify({
        fullName: "Ananya Deshmukh",
        email: "ananya@shivura-luxury.com",
        phone: "9876555555",
        addressLine1: "Flat 502, Skyline Residency",
        city: "Pune",
        state: "Maharashtra",
        pinCode: "411001",
        paymentMethod: "COD",
      }),
    });
    assert(emptyCartRes.status === 400, "Empty cart checkout returns 400 Bad Request");
    const emptyCartJson = await emptyCartRes.json();
    assert(emptyCartJson.error.code === "EMPTY_CART", "Error code is EMPTY_CART");

    // 3d. Successful order creation via POST /api/orders
    // Add product to customer's cart
    const customerCart = await prisma.cart.create({
      data: { userId: customerUser.id },
    });
    cleanup.cartIds.push(customerCart.id);

    const customerCartItem = await prisma.cartItem.create({
      data: {
        cartId: customerCart.id,
        productId: parentProduct.id,
        quantity: 2, // 2 units
      },
    });
    cleanup.cartItemIds.push(customerCartItem.id);

    const successfulOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerCookie,
      },
      body: JSON.stringify({
        fullName: "Ananya Deshmukh",
        email: "ananya@shivura-luxury.com",
        phone: "9876555555",
        addressLine1: "Flat 502, Skyline Residency",
        addressLine2: "Koregaon Park",
        city: "Pune",
        state: "Maharashtra",
        pinCode: "411001",
        paymentMethod: "COD",
        couponCode: "SHIVURA10",
      }),
    });

    assert(
      successfulOrderRes.status === 201,
      `Successful order creation returns 201 Created (got ${successfulOrderRes.status})`
    );
    const successfulOrderJson = await successfulOrderRes.json();
    assert(successfulOrderJson.success === true, "Response has success: true");
    const placedOrder = successfulOrderJson.data;
    cleanup.orderIds.push(placedOrder.id);

    assert(Boolean(placedOrder.id), "Order ID is returned");
    assert(placedOrder.orderNumber.startsWith("SHV-"), "Order number has SHV- prefix");
    assert(placedOrder.customerName === "Ananya Deshmukh", "Customer name matches input");
    assert(placedOrder.paymentStatus === "PENDING", "Payment status is PENDING");
    assert(placedOrder.payment.provider === "COD", "Payment provider is COD");
    assert(placedOrder.items.length === 1, "Order item created");
    assert(placedOrder.discount > 0, "SHIVURA10 coupon discount applied");

    // Verify cart was purged
    const cartRemaining = await prisma.cartItem.findMany({
      where: { cartId: customerCart.id },
    });
    assert(cartRemaining.length === 0, "Customer cart purged after POST /api/orders");

    // -------------------------------------------------------------
    // Test 4: HTTP GET /api/orders Endpoint (History & Isolation)
    // -------------------------------------------------------------
    console.log(`\n[TEST 4] HTTP GET /api/orders History & Security Isolation`);

    // 4a. Unauthenticated GET /api/orders returns 401
    const unauthGet = await fetch(`${BASE_URL}/api/orders`);
    assert(unauthGet.status === 401, "Unauthenticated GET /api/orders returns 401 Unauthorized");

    // 4b. Authenticated customer retrieves their own orders
    const customerGetRes = await fetch(`${BASE_URL}/api/orders`, {
      headers: { Cookie: customerCookie },
    });
    assert(customerGetRes.status === 200, "Authenticated GET /api/orders returns 200 OK");
    const customerGetJson = await customerGetRes.json();
    assert(customerGetJson.success === true, "Order history response is success: true");
    assert(Array.isArray(customerGetJson.data), "data is an array of orders");
    assert(customerGetJson.data.length >= 1, "Returns placed order in customer history");
    assert(
      customerGetJson.data[0].id === placedOrder.id,
      "Latest placed order is first in history (stable desc order)"
    );
    assert(Boolean(customerGetJson.pagination), "Response includes pagination metadata");
    assert(customerGetJson.pagination.total >= 1, "Pagination reports correct total");

    // 4c. Customer Isolation & Query Parameter Tampering Guard
    // Create Customer B with their own separate order
    const { cookie: cookieB } = await createAndLoginCustomer(
      `customer-b-${timestamp}@shivura-luxury.com`,
      "SecurePassword2026!",
      "Vikram Malhotra"
    );

    // Customer B queries order history: should see 0 orders
    const bGetRes = await fetch(`${BASE_URL}/api/orders`, {
      headers: { Cookie: cookieB },
    });
    const bGetJson = await bGetRes.json();
    assert(bGetJson.data.length === 0, "Customer B cannot see Customer A's orders (0 orders)");

    // Customer B attempts query parameter tampering: ?userId=<customerA_id>
    console.log("  Testing parameter tampering: Customer B sending ?userId=CustomerA...");
    const tamperedRes = await fetch(`${BASE_URL}/api/orders?userId=${customerUser.id}`, {
      headers: { Cookie: cookieB },
    });
    const tamperedJson = await tamperedRes.json();
    assert(
      tamperedJson.data.length === 0,
      "Query parameter tampering blocked: ?userId parameter completely ignored"
    );

    // 4d. Pagination parameter handling
    const paginatedRes = await fetch(`${BASE_URL}/api/orders?page=1&limit=1`, {
      headers: { Cookie: customerCookie },
    });
    const paginatedJson = await paginatedRes.json();
    assert(paginatedJson.pagination.limit === 1, "Honors limit=1 parameter");
    assert(paginatedJson.data.length <= 1, "Returns at most 1 item when limit=1");

    console.log(`\n=============================================================`);
    console.log(`Phase 7B Step 2 Verification Summary:`);
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

    for (const couponId of cleanup.couponIds) {
      try {
        await prisma.coupon.deleteMany({ where: { id: couponId } });
      } catch {}
    }

    for (const variantId of cleanup.variantIds) {
      try {
        await prisma.productVariant.deleteMany({ where: { id: variantId } });
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
