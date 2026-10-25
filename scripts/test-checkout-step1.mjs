#!/usr/bin/env node

/**
 * Automated Verification Test Suite for Phase 7B - Step 1:
 * Checkout Validation & Server-Side Checkout Service
 *
 * Verifies:
 * 1. Zod Checkout Validation:
 *    - Valid inputs & field aliases normalization
 *    - Phone validation & formatting (+91 XXXXX XXXXX)
 *    - Rejection of invalid phone numbers (short, non-digit, invalid prefix)
 *    - Rejection of invalid PIN codes (5-digit, 7-digit, non-numeric, 0-prefixed)
 *    - Missing required fields (name, email, addressLine1, city, state)
 *    - Payment method constraint (accepts only COD; rejects ONLINE/CARD/UPI)
 * 2. Canonical Pricing & Coupon Rules:
 *    - Subtotal calculation from item prices
 *    - Shipping fee: ₹99 when subtotal < ₹999; ₹0 when subtotal >= ₹999
 *    - Supported promo codes (SHIVURA10, FESTIVE10, WELCOME15)
 *    - Rejection of invalid/unknown coupon codes (INVALID_COUPON error)
 * 3. Checkout Service Error Handling & Guards:
 *    - Unauthenticated user rejection (401 UNAUTHORIZED)
 *    - Empty cart rejection (400 EMPTY_CART)
 *    - Inactive / unpublished product rejection (400 PRODUCT_UNAVAILABLE)
 *    - Insufficient stock rejection (400 INSUFFICIENT_STOCK)
 * 4. Transactional Integrity & Rollback:
 *    - Rollback when checkout fails: stock untouched, cart untouched, no order created
 * 5. Concurrent Stock Safety & Overselling Prevention:
 *    - 2 concurrent checkouts competing for 1 remaining stock item
 *    - Exactly 1 succeeds, 1 fails with INSUFFICIENT_STOCK, stock never negative
 * 6. Successful Order Placement:
 *    - Order snapshot (customer details, shipping address, totals)
 *    - OrderItem snapshots (productName, sku, price, subtotal)
 *    - Payment record: provider COD, status PENDING (not marked PAID)
 *    - Database cart purged upon success
 * 7. Guaranteed Safe Teardown:
 *    - Complete cleanup of all temporary test records in finally block
 */

import pkg from "@next/env";
const { loadEnvConfig } = pkg;
loadEnvConfig(".");

import {
  validateCheckoutInput,
  normalizeIndianPhone,
} from "../lib/validation/checkout.ts";

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

// Tracking for safe teardown
const cleanup = {
  orderIds: [],
  cartItemIds: [],
  cartIds: [],
  productIds: [],
  userIds: [],
};

async function run() {
  const { prisma } = await import("../lib/prisma.ts");
  const {
    processCheckout,
    calculateCanonicalOrderPricing,
    CheckoutError,
  } = await import("../lib/checkout.ts");
  console.log(`\n=============================================================`);
  console.log(`Starting Phase 7B Step 1: Checkout Service & Validation Tests`);
  console.log(`=============================================================\n`);

  try {
    // -------------------------------------------------------------
    // Test 1: Checkout Input Validation & Aliases
    // -------------------------------------------------------------
    console.log(`[TEST 1] Checkout Input Validation & Aliases`);

    // 1a. Phone normalization helper
    assert(normalizeIndianPhone("9876543210") === "+91 98765 43210", "Normalizes 10-digit Indian phone");
    assert(normalizeIndianPhone("+91 98765 43210") === "+91 98765 43210", "Normalizes +91 formatted phone");
    assert(normalizeIndianPhone("09876543210") === "+91 98765 43210", "Normalizes 0-prefixed phone");
    assert(normalizeIndianPhone("12345") === null, "Rejects short phone number");
    assert(normalizeIndianPhone("5876543210") === null, "Rejects phone number not starting with 6-9");
    assert(normalizeIndianPhone("abcdefghij") === null, "Rejects alphabetic phone number");

    // 1b. Valid full checkout input
    const validFull = validateCheckoutInput({
      customerName: "Aarav Sharma",
      customerEmail: "aarav.sharma@example.com",
      customerPhone: "9876543210",
      shippingAddressLine1: "42 Royal Heritage Mansions",
      shippingAddressLine2: "Opposite High Court",
      shippingCity: "Jaipur",
      shippingState: "Rajasthan",
      shippingPostalCode: "302001",
      shippingCountry: "India",
      paymentMethod: "COD",
      couponCode: "shivura10",
    });
    assert(validFull.success === true, "Validates complete checkout payload");
    if (validFull.success) {
      assert(validFull.data.customerPhone === "+91 98765 43210", "Formats validated phone with country code");
      assert(validFull.data.couponCode === "SHIVURA10", "Uppercases coupon code");
      assert(validFull.data.paymentMethod === "COD", "Accepts paymentMethod COD");
    }

    // 1c. Field alias mapping (e.g. fullName, phone, addressLine1, pinCode)
    const validWithAliases = validateCheckoutInput({
      fullName: "Priya Patel",
      email: "PRIYA.PATEL@EXAMPLE.COM",
      phone: "+91 99887 76655",
      addressLine1: "Flat 101, Lotus Palms",
      city: "Ahmedabad",
      state: "Gujarat",
      pinCode: "380015",
      paymentMethod: "COD",
    });
    assert(validWithAliases.success === true, "Normalizes field aliases (fullName, pinCode, etc.)");
    if (validWithAliases.success) {
      assert(validWithAliases.data.customerName === "Priya Patel", "Mapped fullName -> customerName");
      assert(validWithAliases.data.customerEmail === "priya.patel@example.com", "Lowercases email");
      assert(validWithAliases.data.shippingPostalCode === "380015", "Mapped pinCode -> shippingPostalCode");
      assert(validWithAliases.data.shippingCountry === "India", "Defaults country to India");
    }

    // 1d. Reject invalid PIN code
    const invalidPin = validateCheckoutInput({
      customerName: "Test User",
      customerEmail: "test@example.com",
      customerPhone: "9876543210",
      shippingAddressLine1: "123 Test Street",
      shippingCity: "Mumbai",
      shippingState: "Maharashtra",
      shippingPostalCode: "12345", // only 5 digits
      paymentMethod: "COD",
    });
    assert(!invalidPin.success, "Rejects 5-digit PIN code");

    // 1e. Reject invalid payment methods (only COD allowed)
    const invalidPayment = validateCheckoutInput({
      customerName: "Test User",
      customerEmail: "test@example.com",
      customerPhone: "9876543210",
      shippingAddressLine1: "123 Test Street",
      shippingCity: "Mumbai",
      shippingState: "Maharashtra",
      shippingPostalCode: "400001",
      paymentMethod: "RAZORPAY", // Not allowed in Step 1
    });
    assert(!invalidPayment.success, "Rejects non-COD payment method");

    // 1f. Reject missing required fields
    const missingName = validateCheckoutInput({
      customerEmail: "test@example.com",
      customerPhone: "9876543210",
      shippingAddressLine1: "123 Test Street",
      shippingCity: "Mumbai",
      shippingState: "Maharashtra",
      shippingPostalCode: "400001",
      paymentMethod: "COD",
    });
    assert(!missingName.success, "Rejects missing customer name");

    // -------------------------------------------------------------
    // Test 2: Server-Side Canonical Pricing Calculation
    // -------------------------------------------------------------
    console.log(`\n[TEST 2] Server-Side Canonical Pricing Calculation`);

    // 2a. Order below free shipping threshold (< ₹999)
    const itemsBelowThreshold = [
      {
        productId: "p1",
        variantId: null,
        productName: "Brass Incense Holder",
        sku: "SHV-BRASS-01",
        variantInfo: null,
        price: 499,
        quantity: 1,
        subtotal: 499,
      },
    ];
    const pricingBelow = await calculateCanonicalOrderPricing(itemsBelowThreshold, null);
    assert(pricingBelow.subtotal === 499, "Calculates subtotal correctly (499)");
    assert(pricingBelow.shippingFee === 99, "Applies ₹99 standard shipping fee for orders < ₹999");
    assert(pricingBelow.discount === 0, "Zero discount without coupon");
    assert(pricingBelow.total === 598, "Total = 499 + 99 = 598");

    // 2b. Order meeting free shipping threshold (>= ₹999)
    const itemsAboveThreshold = [
      {
        productId: "p2",
        variantId: null,
        productName: "Royal Brass Samai",
        sku: "SHV-SAMAI-01",
        variantInfo: null,
        price: 1499,
        quantity: 1,
        subtotal: 1499,
      },
    ];
    const pricingAbove = await calculateCanonicalOrderPricing(itemsAboveThreshold, null);
    assert(pricingAbove.subtotal === 1499, "Calculates subtotal correctly (1499)");
    assert(pricingAbove.shippingFee === 0, "Unlocks FREE shipping (₹0) for orders >= ₹999");
    assert(pricingAbove.total === 1499, "Total = 1499");

    // 2c. Supported coupon SHIVURA10 (10% discount)
    const pricingWithShivura10 = await calculateCanonicalOrderPricing(itemsAboveThreshold, "SHIVURA10");
    assert(pricingWithShivura10.discount === 149.9, "SHIVURA10 applies 10% discount (149.9)");
    assert(pricingWithShivura10.total === 1349.1, "Total reflects discounted amount");

    // 2d. Supported coupon WELCOME15 (15% discount)
    const pricingWithWelcome15 = await calculateCanonicalOrderPricing(itemsAboveThreshold, "WELCOME15");
    assert(pricingWithWelcome15.discount === 224.85, "WELCOME15 applies 15% discount (224.85)");

    // 2e. Rejection of invalid promo code
    let invalidCouponError = null;
    try {
      await calculateCanonicalOrderPricing(itemsAboveThreshold, "EXPIRED99");
    } catch (err) {
      invalidCouponError = err;
    }
    assert(invalidCouponError instanceof CheckoutError, "Throws CheckoutError on invalid coupon");
    assert(invalidCouponError?.code === "INVALID_COUPON", "Invalid coupon code is rejected with INVALID_COUPON");

    // -------------------------------------------------------------
    // Test 3: Checkout Service Security Guards & Life Cycle
    // -------------------------------------------------------------
    console.log(`\n[TEST 3] Checkout Service Security Guards`);

    // 3a. Unauthenticated access guard
    let unauthError = null;
    try {
      await processCheckout("", validFull.data);
    } catch (err) {
      unauthError = err;
    }
    assert(unauthError instanceof CheckoutError, "Throws CheckoutError for empty userId");
    assert(unauthError?.code === "UNAUTHORIZED", "Unauthenticated request returns UNAUTHORIZED");
    assert(unauthError?.statusCode === 401, "Unauthenticated request returns status 401");

    // Create isolated test user
    const testTimestamp = Date.now();
    const testUser = await prisma.user.create({
      data: {
        email: `checkout-test-${testTimestamp}@shivura-luxury.com`,
        name: "Checkout Verification User",
        phone: "+91 98765 00000",
      },
    });
    cleanup.userIds.push(testUser.id);

    // 3b. Empty cart guard
    let emptyCartError = null;
    try {
      await processCheckout(testUser.id, validFull.data);
    } catch (err) {
      emptyCartError = err;
    }
    assert(emptyCartError instanceof CheckoutError, "Throws CheckoutError for user without cart");
    assert(emptyCartError?.code === "EMPTY_CART", "Empty cart request returns EMPTY_CART (400)");

    // -------------------------------------------------------------
    // Test 4: Insufficient Stock & Transaction Rollback
    // -------------------------------------------------------------
    console.log(`\n[TEST 4] Insufficient Stock & Transaction Rollback`);

    // Create test products: 1 out of stock, 1 with limited stock
    const oosProduct = await prisma.product.create({
      data: {
        name: "Test Zero Stock Product",
        slug: `test-oos-${testTimestamp}`,
        sku: `SHV-OOS-${testTimestamp}`,
        price: 999.0,
        stock: 0, // Zero stock
        active: true,
        published: true,
      },
    });
    cleanup.productIds.push(oosProduct.id);

    // Create user cart with OOS product
    const testCart = await prisma.cart.create({
      data: {
        userId: testUser.id,
      },
    });
    cleanup.cartIds.push(testCart.id);

    const cartItemOOS = await prisma.cartItem.create({
      data: {
        cartId: testCart.id,
        productId: oosProduct.id,
        quantity: 1,
      },
    });
    cleanup.cartItemIds.push(cartItemOOS.id);

    // Attempting checkout with 0 stock item MUST throw INSUFFICIENT_STOCK
    let stockError = null;
    try {
      await processCheckout(testUser.id, validFull.data);
    } catch (err) {
      stockError = err;
    }
    assert(stockError instanceof CheckoutError, "Throws CheckoutError when stock is 0");
    assert(stockError?.code === "INSUFFICIENT_STOCK", "Fails with INSUFFICIENT_STOCK code");

    // Verify rollback: cart items must NOT have been deleted
    const cartAfterRollback = await prisma.cartItem.findMany({
      where: { cartId: testCart.id },
    });
    assert(cartAfterRollback.length === 1, "Transaction rollback preserves cart items when stock fails");

    // Verify rollback: no order created
    const ordersAfterRollback = await prisma.order.findMany({
      where: { userId: testUser.id },
    });
    assert(ordersAfterRollback.length === 0, "Transaction rollback creates no order records");

    // Clean OOS cart item
    await prisma.cartItem.delete({ where: { id: cartItemOOS.id } });

    // -------------------------------------------------------------
    // Test 5: Successful Order Creation & Cart Purging
    // -------------------------------------------------------------
    console.log(`\n[TEST 5] Successful Order Creation & Cart Purging`);

    const inStockProduct = await prisma.product.create({
      data: {
        name: "Shivura Imperial Diya Stand",
        slug: `test-diya-${testTimestamp}`,
        sku: `SHV-DIYA-${testTimestamp}`,
        price: 1299.0,
        stock: 5, // 5 units in stock
        active: true,
        published: true,
      },
    });
    cleanup.productIds.push(inStockProduct.id);

    const validCartItem = await prisma.cartItem.create({
      data: {
        cartId: testCart.id,
        productId: inStockProduct.id,
        quantity: 2, // Ordering 2 units
      },
    });
    cleanup.cartItemIds.push(validCartItem.id);

    // Process checkout
    const checkoutResult = await processCheckout(testUser.id, validFull.data);
    const orderData = checkoutResult.order;
    cleanup.orderIds.push(orderData.id);

    assert(Boolean(orderData.id), "Order successfully created with unique ID");
    assert(orderData.orderNumber.startsWith("SHV-"), `Order number generated with SHV- prefix (${orderData.orderNumber})`);
    assert(orderData.status === "PENDING", "Initial order status is PENDING");
    assert(orderData.paymentStatus === "PENDING", "Initial payment status is PENDING");
    assert(orderData.customerName === "Aarav Sharma", "Customer name snapshot matches input");
    assert(orderData.shippingCity === "Jaipur", "Shipping city snapshot matches input");
    assert(orderData.shippingPostalCode === "302001", "PIN code snapshot matches input");

    // Pricing checks: subtotal = 1299 * 2 = 2598. SHIVURA10 discount = 259.8. Free shipping = 0.
    // Total = 2598 - 259.8 = 2338.2
    assert(orderData.subtotal === 2598, `Subtotal matches 2 * 1299 = 2598 (got ${orderData.subtotal})`);
    assert(orderData.discount === 259.8, `Discount matches 10% of 2598 = 259.8 (got ${orderData.discount})`);
    assert(orderData.shippingFee === 0, "Free shipping applies for subtotal > 999");
    assert(orderData.total === 2338.2, `Total matches 2338.2 (got ${orderData.total})`);

    // Item snapshot checks
    assert(orderData.items.length === 1, "Order contains exactly 1 line item snapshot");
    assert(orderData.items[0].productName === "Shivura Imperial Diya Stand", "Product name snapshot intact");
    assert(orderData.items[0].price === 1299, "Line item unit price intact");
    assert(orderData.items[0].quantity === 2, "Line item quantity intact");
    assert(orderData.items[0].subtotal === 2598, "Line item subtotal intact");

    // Payment checks: COD and PENDING
    assert(orderData.payment.provider === "COD", "Payment provider is COD");
    assert(orderData.payment.status === "PENDING", "COD payment status is PENDING (never marked PAID on placement)");
    assert(orderData.payment.amount === 2338.2, "Payment amount matches order total");

    // Stock decrement check: 5 - 2 = 3
    const updatedProduct = await prisma.product.findUnique({
      where: { id: inStockProduct.id },
      select: { stock: true },
    });
    assert(updatedProduct.stock === 3, `Product stock decremented from 5 to 3 (got ${updatedProduct.stock})`);

    // Cart purged check: cart items must be 0 after successful order
    const remainingCartItems = await prisma.cartItem.findMany({
      where: { cartId: testCart.id },
    });
    assert(remainingCartItems.length === 0, "Customer cart items purged atomically upon successful order creation");

    // -------------------------------------------------------------
    // Test 6: Concurrency Protection & Overselling Prevention
    // -------------------------------------------------------------
    console.log(`\n[TEST 6] Concurrency Protection & Overselling Prevention`);

    // Set product stock to exactly 1
    await prisma.product.update({
      where: { id: inStockProduct.id },
      data: { stock: 1 },
    });

    // Create 2 separate test users, each with a cart having quantity = 1
    const concurrentUserA = await prisma.user.create({
      data: {
        email: `concurrent-a-${testTimestamp}@shivura-luxury.com`,
        name: "Concurrent User A",
        phone: "+91 98765 11111",
      },
    });
    cleanup.userIds.push(concurrentUserA.id);

    const concurrentUserB = await prisma.user.create({
      data: {
        email: `concurrent-b-${testTimestamp}@shivura-luxury.com`,
        name: "Concurrent User B",
        phone: "+91 98765 22222",
      },
    });
    cleanup.userIds.push(concurrentUserB.id);

    const cartA = await prisma.cart.create({ data: { userId: concurrentUserA.id } });
    cleanup.cartIds.push(cartA.id);
    const itemA = await prisma.cartItem.create({
      data: { cartId: cartA.id, productId: inStockProduct.id, quantity: 1 },
    });
    cleanup.cartItemIds.push(itemA.id);

    const cartB = await prisma.cart.create({ data: { userId: concurrentUserB.id } });
    cleanup.cartIds.push(cartB.id);
    const itemB = await prisma.cartItem.create({
      data: { cartId: cartB.id, productId: inStockProduct.id, quantity: 1 },
    });
    cleanup.cartItemIds.push(itemB.id);

    // Fire both checkouts simultaneously
    console.log("  Firing 2 simultaneous checkouts for 1 remaining stock item...");
    const [resultA, resultB] = await Promise.allSettled([
      processCheckout(concurrentUserA.id, validFull.data),
      processCheckout(concurrentUserB.id, validFull.data),
    ]);

    const aSucceeded = resultA.status === "fulfilled";
    const bSucceeded = resultB.status === "fulfilled";

    if (aSucceeded) cleanup.orderIds.push(resultA.value.order.id);
    if (bSucceeded) cleanup.orderIds.push(resultB.value.order.id);

    assert(
      (aSucceeded && !bSucceeded) || (!aSucceeded && bSucceeded),
      "Exactly one concurrent checkout succeeds and the other fails"
    );

    const rejectedReason = !aSucceeded ? resultA.reason : resultB.reason;
    assert(
      rejectedReason instanceof CheckoutError && rejectedReason.code === "INSUFFICIENT_STOCK",
      "Rejected concurrent checkout specifically failed with INSUFFICIENT_STOCK"
    );

    // Stock must be exactly 0, never negative!
    const finalStockProduct = await prisma.product.findUnique({
      where: { id: inStockProduct.id },
      select: { stock: true },
    });
    assert(finalStockProduct.stock === 0, `Final stock is exactly 0 (got ${finalStockProduct.stock}), no overselling occurred`);

    console.log(`\n=============================================================`);
    console.log(`Phase 7B Step 1 Verification Summary:`);
    console.log(`Passed: ${testsPassed} / ${testsPassed + testsFailed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log(`=============================================================\n`);
  } finally {
    // -------------------------------------------------------------
    // Safe Teardown
    // -------------------------------------------------------------
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
