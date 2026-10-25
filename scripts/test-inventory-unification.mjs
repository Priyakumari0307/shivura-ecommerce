#!/usr/bin/env node

/**
 * Automated Verification Test Suite for Phase 7C - Step 3:
 * Unification of Product and Variant Inventory Semantics
 *
 * Verifies:
 * 1. CRM Product Creation with Active & Inactive Variants (Server-enforced rollup)
 * 2. CRM Product Updates (Stock edits, variant activation/deactivation, variant deletion)
 * 3. Standalone Products (No variants) utilize Product.stock authoritatively
 * 4. Storefront Availability & Product Slug API reflect active-variant rollup
 * 5. Checkout Validation (Sufficient stock, insufficient stock, inactive variant block)
 * 6. Concurrent Checkout Race Conditions (Conditional atomic decrement prevention)
 * 7. Multi-Variant Single Order Checkout & Cancellation Restoration Symmetry
 * 8. Stock Analytics & CRM Dashboard Metrics consistency
 * 9. Guaranteed Safe Teardown
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
  cartIds: [],
};

async function run() {
  console.log(`\n=============================================================`);
  console.log(`Starting Phase 7C Step 3: Inventory Unification Test Suite`);
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
  const customerA = await getCustomerCookie(
    `cust-unify-a-${timestamp}@shivura-luxury.com`,
    "SecurePass2026!",
    "Unification Customer A"
  );
  const customerB = await getCustomerCookie(
    `cust-unify-b-${timestamp}@shivura-luxury.com`,
    "SecurePass2026!",
    "Unification Customer B"
  );

  try {
    // -----------------------------------------------------------------
    // TEST 1: CRM Product Creation with Active & Inactive Variants
    // -----------------------------------------------------------------
    console.log(`\n[TEST 1] CRM Product Creation Enforces Server Rollup of Active Variants`);

    const createPayload1 = {
      name: `[TEST-UNIFY-1] Brass Diya Set ${timestamp}`,
      slug: `test-unify-diya-${timestamp}`,
      price: 1999,
      stock: 9999, // Intentional arbitrary client input - server MUST overwrite this with active variants sum!
      isNew: true,
      published: true,
      active: true,
      variants: [
        { name: "Small (5 Inch)", sku: `DIYA-S-${timestamp}`, price: 1799, stock: 10, active: true },
        { name: "Medium (7 Inch)", sku: `DIYA-M-${timestamp}`, price: 1999, stock: 15, active: true },
        { name: "Large (9 Inch - Inactive)", sku: `DIYA-L-${timestamp}`, price: 2499, stock: 20, active: false },
      ],
      images: [],
      categoryIds: [],
      occasionIds: [],
    };

    const createRes1 = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify(createPayload1),
    });

    assert(createRes1.status === 201, `CRM product creation returns 201 (got ${createRes1.status})`);
    const createJson1 = await createRes1.json();
    const p1Id = createJson1.data.id;
    cleanup.productIds.push(p1Id);

    // Verify database record: Product.stock MUST equal 10 + 15 = 25 (inactive 20 excluded, arbitrary 9999 ignored)
    const [p1Db] = await sql`SELECT stock FROM "Product" WHERE id = ${p1Id}`;
    assert(
      p1Db.stock === 25,
      `Server derived Product.stock as 25 (10 active + 15 active; ignored client 9999 and inactive 20) (got ${p1Db.stock})`
    );

    const v1List = await sql`SELECT id, sku, stock, active FROM "ProductVariant" WHERE "productId" = ${p1Id} ORDER BY sku ASC`;
    assert(v1List.length === 3, "All 3 variant rows created in database");
    v1List.forEach((v) => cleanup.variantIds.push(v.id));

    // -----------------------------------------------------------------
    // TEST 2: CRM Product Updates (Stock, Activation/Deactivation, Deletion)
    // -----------------------------------------------------------------
    console.log(`\n[TEST 2] CRM Product Updates Recompute Rollup on Variant Mutations`);

    // 2A. Update variant stocks (Variant S: 10 -> 8, Variant M: 15 -> 12, Variant L: 20 -> 25 [still inactive])
    const updateRes2A = await fetch(`${BASE_URL}/api/crm/products/${p1Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        stock: 5555, // client attempt to tamper
        variants: [
          { name: "Small (5 Inch)", sku: `DIYA-S-${timestamp}`, price: 1799, stock: 8, active: true },
          { name: "Medium (7 Inch)", sku: `DIYA-M-${timestamp}`, price: 1999, stock: 12, active: true },
          { name: "Large (9 Inch - Inactive)", sku: `DIYA-L-${timestamp}`, price: 2499, stock: 25, active: false },
        ],
      }),
    });
    assert(updateRes2A.status === 200, "Variant stock update accepted with 200");
    const [p1DbAfter2A] = await sql`SELECT stock FROM "Product" WHERE id = ${p1Id}`;
    assert(
      p1DbAfter2A.stock === 20,
      `Product.stock recomputed to 20 (8 + 12 active) after variant edit (got ${p1DbAfter2A.stock})`
    );

    // 2B. Deactivate Variant M (active: false)
    const updateRes2B = await fetch(`${BASE_URL}/api/crm/products/${p1Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        variants: [
          { name: "Small (5 Inch)", sku: `DIYA-S-${timestamp}`, price: 1799, stock: 8, active: true },
          { name: "Medium (7 Inch)", sku: `DIYA-M-${timestamp}`, price: 1999, stock: 12, active: false }, // deactivated!
          { name: "Large (9 Inch - Inactive)", sku: `DIYA-L-${timestamp}`, price: 2499, stock: 25, active: false },
        ],
      }),
    });
    assert(updateRes2B.status === 200, "Variant deactivation accepted with 200");
    const [p1DbAfter2B] = await sql`SELECT stock FROM "Product" WHERE id = ${p1Id}`;
    assert(
      p1DbAfter2B.stock === 8,
      `Product.stock recomputed to 8 after deactivating Variant M (got ${p1DbAfter2B.stock})`
    );

    // 2C. Activate Variant L (active: true)
    const updateRes2C = await fetch(`${BASE_URL}/api/crm/products/${p1Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        variants: [
          { name: "Small (5 Inch)", sku: `DIYA-S-${timestamp}`, price: 1799, stock: 8, active: true },
          { name: "Medium (7 Inch)", sku: `DIYA-M-${timestamp}`, price: 1999, stock: 12, active: false },
          { name: "Large (9 Inch)", sku: `DIYA-L-${timestamp}`, price: 2499, stock: 25, active: true }, // activated!
        ],
      }),
    });
    assert(updateRes2C.status === 200, "Variant activation accepted with 200");
    const [p1DbAfter2C] = await sql`SELECT stock FROM "Product" WHERE id = ${p1Id}`;
    assert(
      p1DbAfter2C.stock === 33,
      `Product.stock recomputed to 33 (8 + 25 active) after activating Variant L (got ${p1DbAfter2C.stock})`
    );

    // 2D. Delete variants -> product transitions to standalone
    const updateRes2D = await fetch(`${BASE_URL}/api/crm/products/${p1Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        stock: 45,
        variants: [], // delete all variants
      }),
    });
    assert(updateRes2D.status === 200, "Transition to standalone accepted with 200");
    const [p1DbAfter2D] = await sql`SELECT stock FROM "Product" WHERE id = ${p1Id}`;
    const [vCountAfter2D] = await sql`SELECT count(*)::int as c FROM "ProductVariant" WHERE "productId" = ${p1Id}`;
    assert(vCountAfter2D.c === 0, "All variant rows deleted from database");
    assert(
      p1DbAfter2D.stock === 45,
      `Product.stock now reflects standalone inventory of 45 (got ${p1DbAfter2D.stock})`
    );

    // -----------------------------------------------------------------
    // TEST 3: Standalone Products Without Variants Use Product.stock Directly
    // -----------------------------------------------------------------
    console.log(`\n[TEST 3] Standalone Products Authoritatively Track Product.stock`);

    const pStandPayload = {
      name: `[TEST-UNIFY-STANDALONE] Silver Pooja Bell ${timestamp}`,
      slug: `test-unify-bell-${timestamp}`,
      price: 899,
      stock: 14,
      isNew: false,
      published: true,
      active: true,
      variants: [],
      images: [],
      categoryIds: [],
      occasionIds: [],
    };

    const standRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify(pStandPayload),
    });
    assert(standRes.status === 201, "Standalone product created with 201");
    const standJson = await standRes.json();
    const pStandId = standJson.data.id;
    cleanup.productIds.push(pStandId);

    const [pStandDb] = await sql`SELECT stock FROM "Product" WHERE id = ${pStandId}`;
    assert(pStandDb.stock === 14, `Standalone Product.stock matches input of 14 (got ${pStandDb.stock})`);

    // Update scalar field without variants: stock must be preserved
    await fetch(`${BASE_URL}/api/crm/products/${pStandId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ price: 949 }),
    });
    const [pStandAfterPrice] = await sql`SELECT stock, price FROM "Product" WHERE id = ${pStandId}`;
    assert(pStandAfterPrice.stock === 14, "Product.stock preserved when updating unrelated fields");
    assert(Number(pStandAfterPrice.price) === 949, "Price updated successfully");

    // -----------------------------------------------------------------
    // TEST 4: Storefront Availability & Slug Route Integration
    // -----------------------------------------------------------------
    console.log(`\n[TEST 4] Storefront Slug Route Returns Active Variant Rollup`);

    const pSlugPayload = {
      name: `[TEST-UNIFY-SLUG] Peacock Wall Hanging ${timestamp}`,
      slug: `test-unify-peacock-${timestamp}`,
      price: 3499,
      published: true,
      active: true,
      variants: [
        { name: "18 Inch", sku: `PEACOCK-18-${timestamp}`, price: 3499, stock: 7, active: true },
        { name: "24 Inch", sku: `PEACOCK-24-${timestamp}`, price: 4499, stock: 0, active: true },
        { name: "30 Inch (Inactive)", sku: `PEACOCK-30-${timestamp}`, price: 5499, stock: 10, active: false },
      ],
      images: [],
      categoryIds: [],
      occasionIds: [],
    };

    const pSlugRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify(pSlugPayload),
    });
    const pSlugJson = await pSlugRes.json();
    const pSlugId = pSlugJson.data.id;
    cleanup.productIds.push(pSlugId);
    pSlugJson.data.variants.forEach((v) => cleanup.variantIds.push(v.id));

    // Call storefront public route: GET /api/products/[slug]
    const sfRes = await fetch(`${BASE_URL}/api/products/test-unify-peacock-${timestamp}`);
    assert(sfRes.status === 200, "Storefront product detail route returns 200 OK");
    const sfJson = await sfRes.json();
    // Inactive variant must be excluded (only 2 active variants returned)
    assert(sfJson.data.variants.length === 2, "Inactive variant excluded from storefront variants list");
    // Authoritative active stock rollup: 7 + 0 = 7
    assert(sfJson.data.stock === 7, `Storefront reports active rollup stock of 7 (got ${sfJson.data.stock})`);

    // -----------------------------------------------------------------
    // TEST 5: Checkout Validation for Variant and Standalone Items
    // -----------------------------------------------------------------
    console.log(`\n[TEST 5] Checkout Validation Enforces Active Variant and Standalone Stock`);

    // Create fresh test product with Variant A (stock 10) and Variant B (stock 15) -> parent stock = 25
    const pOrderPayload = {
      name: `[TEST-UNIFY-ORD] Marble Urli ${timestamp}`,
      slug: `test-unify-urli-${timestamp}`,
      price: 2999,
      published: true,
      active: true,
      variants: [
        { name: "White Marble", sku: `URLI-W-${timestamp}`, price: 2999, stock: 10, active: true },
        { name: "Black Marble", sku: `URLI-B-${timestamp}`, price: 3499, stock: 15, active: true },
        { name: "Green Marble (Inactive)", sku: `URLI-G-${timestamp}`, price: 3999, stock: 20, active: false },
      ],
      images: [],
      categoryIds: [],
      occasionIds: [],
    };

    const pOrderRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify(pOrderPayload),
    });
    const pOrderJson = await pOrderRes.json();
    const pOrderId = pOrderJson.data.id;
    cleanup.productIds.push(pOrderId);
    const varWhite = pOrderJson.data.variants.find((v) => v.name.includes("White"));
    const varBlack = pOrderJson.data.variants.find((v) => v.name.includes("Black"));
    const varGreen = pOrderJson.data.variants.find((v) => v.name.includes("Green"));
    cleanup.variantIds.push(varWhite.id, varBlack.id, varGreen.id);

    // Helper to get or create cart for user idempotently
    async function getOrCreateCart(userId) {
      const existing = await sql`SELECT id FROM "Cart" WHERE "userId" = ${userId}`;
      if (existing.length > 0) {
        await sql`DELETE FROM "CartItem" WHERE "cartId" = ${existing[0].id}`;
        return existing[0].id;
      }
      const cartId = `cart_${userId.slice(-6)}_${Math.random().toString(36).slice(2, 8)}`;
      const [newCart] = await sql`
        INSERT INTO "Cart" ("id", "userId", "createdAt", "updatedAt")
        VALUES (${cartId}, ${userId}, NOW(), NOW())
        RETURNING id
      `;
      cleanup.cartIds.push(newCart.id);
      return newCart.id;
    }

    // 5A. Sufficient stock variant checkout (2 units of White Marble)
    // Setup cart for Customer A
    const cartAId = await getOrCreateCart(customerA.user.id);

    await sql`
      INSERT INTO "CartItem" ("id", "cartId", "productId", "variantId", "quantity", "createdAt", "updatedAt")
      VALUES (${`citem_a1_${timestamp}`}, ${cartAId}, ${pOrderId}, ${varWhite.id}, 2, NOW(), NOW())
    `;

    const checkoutResA = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerA.cookie },
      body: JSON.stringify({
        customerName: "Unification Customer A",
        customerEmail: customerA.user.email,
        customerPhone: "+91 98765 22222",
        shippingAddressLine1: "101 Luxury Court",
        shippingCity: "Jaipur",
        shippingState: "Rajasthan",
        shippingPostalCode: "302001",
        shippingCountry: "India",
        paymentMethod: "COD",
      }),
    });

    assert(checkoutResA.status === 201, `Checkout succeeds with 201 (got ${checkoutResA.status})`);
    const checkoutJsonA = await checkoutResA.json();
    cleanup.orderIds.push(checkoutJsonA.data.id);

    // Verify atomic decrement on both variant and parent rollup:
    // White Marble: 10 -> 8
    // Black Marble: 15 (unchanged)
    // Parent Product.stock: 25 -> 23 (8 + 15 = 23!)
    const [vWhiteAfter] = await sql`SELECT stock FROM "ProductVariant" WHERE id = ${varWhite.id}`;
    const [vBlackAfter] = await sql`SELECT stock FROM "ProductVariant" WHERE id = ${varBlack.id}`;
    const [pOrderAfter] = await sql`SELECT stock FROM "Product" WHERE id = ${pOrderId}`;
    assert(vWhiteAfter.stock === 8, `Variant White stock decremented 10 -> 8 (got ${vWhiteAfter.stock})`);
    assert(vBlackAfter.stock === 15, `Variant Black stock remains 15 (got ${vBlackAfter.stock})`);
    assert(pOrderAfter.stock === 23, `Parent Product.stock decremented 25 -> 23 (got ${pOrderAfter.stock})`);

    // 5B. Insufficient variant stock rejection (Attempt to buy 10 units when only 8 available)
    const cartA2Id = await getOrCreateCart(customerA.user.id);

    await sql`
      INSERT INTO "CartItem" ("id", "cartId", "productId", "variantId", "quantity", "createdAt", "updatedAt")
      VALUES (${`citem_a2_${timestamp}`}, ${cartA2Id}, ${pOrderId}, ${varWhite.id}, 10, NOW(), NOW())
    `;

    const checkoutFailStock = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerA.cookie },
      body: JSON.stringify({
        customerName: "Unification Customer A",
        customerEmail: customerA.user.email,
        customerPhone: "+91 98765 22222",
        shippingAddressLine1: "101 Luxury Court",
        shippingCity: "Jaipur",
        shippingState: "Rajasthan",
        shippingPostalCode: "302001",
        paymentMethod: "COD",
      }),
    });

    assert(checkoutFailStock.status === 400, `Insufficient variant stock returns 400 (got ${checkoutFailStock.status})`);
    const failJson = await checkoutFailStock.json();
    assert(failJson.error?.code === "INSUFFICIENT_STOCK", "Error code is INSUFFICIENT_STOCK");

    // 5C. Inactive variant purchase rejection
    const cartA3Id = await getOrCreateCart(customerA.user.id);

    await sql`
      INSERT INTO "CartItem" ("id", "cartId", "productId", "variantId", "quantity", "createdAt", "updatedAt")
      VALUES (${`citem_a3_${timestamp}`}, ${cartA3Id}, ${pOrderId}, ${varGreen.id}, 1, NOW(), NOW())
    `;

    const checkoutFailInactive = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerA.cookie },
      body: JSON.stringify({
        customerName: "Unification Customer A",
        customerEmail: customerA.user.email,
        customerPhone: "+91 98765 22222",
        shippingAddressLine1: "101 Luxury Court",
        shippingCity: "Jaipur",
        shippingState: "Rajasthan",
        shippingPostalCode: "302001",
        paymentMethod: "COD",
      }),
    });
    assert(checkoutFailInactive.status === 400, "Inactive variant purchase rejected with 400");

    // -----------------------------------------------------------------
    // TEST 6: Concurrent Checkout Race Conditions (Atomic Exactly-Once Protection)
    // -----------------------------------------------------------------
    console.log(`\n[TEST 6] Concurrent Checkout Requests Atomically Prevent Overselling`);

    // Product with a variant having stock = 3
    const pConcPayload = {
      name: `[TEST-UNIFY-CONC] Brass Katori ${timestamp}`,
      slug: `test-unify-katori-${timestamp}`,
      price: 599,
      published: true,
      active: true,
      variants: [
        { name: "Single Katori", sku: `KATORI-${timestamp}`, price: 599, stock: 3, active: true },
      ],
      images: [],
      categoryIds: [],
      occasionIds: [],
    };
    const pConcRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify(pConcPayload),
    });
    const pConcJson = await pConcRes.json();
    const pConcId = pConcJson.data.id;
    const vConcId = pConcJson.data.variants[0].id;
    cleanup.productIds.push(pConcId);
    cleanup.variantIds.push(vConcId);

    // Setup carts for Customer A (demand 2) and Customer B (demand 2)
    const cartConcAId = await getOrCreateCart(customerA.user.id);
    const cartConcBId = await getOrCreateCart(customerB.user.id);

    await sql`
      INSERT INTO "CartItem" ("id", "cartId", "productId", "variantId", "quantity", "createdAt", "updatedAt")
      VALUES (${`ci_conc_a_${timestamp}`}, ${cartConcAId}, ${pConcId}, ${vConcId}, 2, NOW(), NOW())
    `;
    await sql`
      INSERT INTO "CartItem" ("id", "cartId", "productId", "variantId", "quantity", "createdAt", "updatedAt")
      VALUES (${`ci_conc_b_${timestamp}`}, ${cartConcBId}, ${pConcId}, ${vConcId}, 2, NOW(), NOW())
    `;

    // Fire both checkouts concurrently
    const [concResA, concResB] = await Promise.all([
      fetch(`${BASE_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: customerA.cookie },
        body: JSON.stringify({
          customerName: "Customer A",
          customerEmail: customerA.user.email,
          customerPhone: "+91 98765 22222",
          shippingAddressLine1: "101 Luxury Court",
          shippingCity: "Jaipur",
          shippingState: "Rajasthan",
          shippingPostalCode: "302001",
          paymentMethod: "COD",
        }),
      }),
      fetch(`${BASE_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: customerB.cookie },
        body: JSON.stringify({
          customerName: "Customer B",
          customerEmail: customerB.user.email,
          customerPhone: "+91 98765 33333",
          shippingAddressLine1: "202 Royal Palace",
          shippingCity: "Jaipur",
          shippingState: "Rajasthan",
          shippingPostalCode: "302001",
          paymentMethod: "COD",
        }),
      }),
    ]);

    const statuses = [concResA.status, concResB.status].sort();
    assert(statuses[0] === 201 && statuses[1] === 400, `Exactly one checkout succeeded (201) and one rejected (400) (got ${statuses.join(", ")})`);

    const concJsonA = await concResA.json();
    const concJsonB = await concResB.json();
    if (concResA.status === 201) cleanup.orderIds.push(concJsonA.data.id);
    if (concResB.status === 201) cleanup.orderIds.push(concJsonB.data.id);

    // Verify stock in database: 3 - 2 = 1 (variant and parent both at 1, never negative!)
    const [vConcDb] = await sql`SELECT stock FROM "ProductVariant" WHERE id = ${vConcId}`;
    const [pConcDb] = await sql`SELECT stock FROM "Product" WHERE id = ${pConcId}`;
    assert(vConcDb.stock === 1, `Variant stock remaining is exactly 1 (got ${vConcDb.stock})`);
    assert(pConcDb.stock === 1, `Parent Product.stock remaining is exactly 1 (got ${pConcDb.stock})`);

    // -----------------------------------------------------------------
    // TEST 7: Multi-Variant Single Order Checkout & Cancellation Restoration
    // -----------------------------------------------------------------
    console.log(`\n[TEST 7] Multi-Variant Order Restoration Restores Variant & Parent Rollup Symmetrically`);

    // Product has Variant 1 (stock 10) and Variant 2 (stock 10) -> parent stock = 20
    const pMultiPayload = {
      name: `[TEST-UNIFY-MULTI] Royal Samai Lamp ${timestamp}`,
      slug: `test-unify-samai-${timestamp}`,
      price: 4999,
      published: true,
      active: true,
      variants: [
        { name: "Antique Gold", sku: `SAMAI-G-${timestamp}`, price: 4999, stock: 10, active: true },
        { name: "Silver Plated", sku: `SAMAI-S-${timestamp}`, price: 5499, stock: 10, active: true },
      ],
      images: [],
      categoryIds: [],
      occasionIds: [],
    };
    const pMultiRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify(pMultiPayload),
    });
    const pMultiJson = await pMultiRes.json();
    const pMultiId = pMultiJson.data.id;
    const vGId = pMultiJson.data.variants.find((v) => v.sku.includes("SAMAI-G")).id;
    const vSId = pMultiJson.data.variants.find((v) => v.sku.includes("SAMAI-S")).id;
    cleanup.productIds.push(pMultiId);
    cleanup.variantIds.push(vGId, vSId);

    // Cart with 3 units of Gold and 2 units of Silver
    const cartMultiId = await getOrCreateCart(customerA.user.id);

    await sql`
      INSERT INTO "CartItem" ("id", "cartId", "productId", "variantId", "quantity", "createdAt", "updatedAt")
      VALUES
        (${`ci_m1_${timestamp}`}, ${cartMultiId}, ${pMultiId}, ${vGId}, 3, NOW(), NOW()),
        (${`ci_m2_${timestamp}`}, ${cartMultiId}, ${pMultiId}, ${vSId}, 2, NOW(), NOW())
    `;

    const checkoutMultiRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerA.cookie },
      body: JSON.stringify({
        customerName: "Customer A",
        customerEmail: customerA.user.email,
        customerPhone: "+91 98765 22222",
        shippingAddressLine1: "101 Luxury Court",
        shippingCity: "Jaipur",
        shippingState: "Rajasthan",
        shippingPostalCode: "302001",
        paymentMethod: "COD",
      }),
    });
    assert(checkoutMultiRes.status === 201, "Multi-variant order created with 201");
    const checkoutMultiJson = await checkoutMultiRes.json();
    const multiOrderId = checkoutMultiJson.data.id;
    cleanup.orderIds.push(multiOrderId);

    // Verify decrements:
    // Gold: 10 - 3 = 7
    // Silver: 10 - 2 = 8
    // Parent Product.stock: 20 - 5 = 15
    const [vGAfter] = await sql`SELECT stock FROM "ProductVariant" WHERE id = ${vGId}`;
    const [vSAfter] = await sql`SELECT stock FROM "ProductVariant" WHERE id = ${vSId}`;
    const [pMultiAfter] = await sql`SELECT stock FROM "Product" WHERE id = ${pMultiId}`;
    assert(vGAfter.stock === 7, `Variant Gold decremented 10 -> 7 (got ${vGAfter.stock})`);
    assert(vSAfter.stock === 8, `Variant Silver decremented 10 -> 8 (got ${vSAfter.stock})`);
    assert(pMultiAfter.stock === 15, `Parent stock decremented 20 -> 15 (got ${pMultiAfter.stock})`);

    // Cancel order pre-dispatch
    const cancelMultiRes = await fetch(`${BASE_URL}/api/crm/orders/${multiOrderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    assert(cancelMultiRes.status === 200, "Pre-dispatch cancellation accepted with 200");
    const cancelMultiJson = await cancelMultiRes.json();
    assert(cancelMultiJson.inventoryReport?.restored === true, "inventoryReport confirms stock restored");
    assert(cancelMultiJson.inventoryReport?.itemsRestoredCount === 2, "Both distinct variant items restored");

    // Verify symmetrical increments:
    // Gold: 7 + 3 = 10
    // Silver: 8 + 2 = 10
    // Parent Product.stock: 15 + 5 = 20
    const [vGRestored] = await sql`SELECT stock FROM "ProductVariant" WHERE id = ${vGId}`;
    const [vSRestored] = await sql`SELECT stock FROM "ProductVariant" WHERE id = ${vSId}`;
    const [pMultiRestored] = await sql`SELECT stock FROM "Product" WHERE id = ${pMultiId}`;
    assert(vGRestored.stock === 10, `Variant Gold restored back to 10 (got ${vGRestored.stock})`);
    assert(vSRestored.stock === 10, `Variant Silver restored back to 10 (got ${vSRestored.stock})`);
    assert(pMultiRestored.stock === 20, `Parent Product.stock restored back to 20 (got ${pMultiRestored.stock})`);

    // -----------------------------------------------------------------
    // TEST 8: Stock Analytics & CRM Dashboard Metrics Consistency
    // -----------------------------------------------------------------
    console.log(`\n[TEST 8] Stock Analytics & Dashboard Metrics Reflect Unified Inventory`);

    // Create 1 product with 0 stock across all active variants -> must count as outOfStock
    const pOutPayload = {
      name: `[TEST-UNIFY-OUT] Out of Stock Idol ${timestamp}`,
      slug: `test-unify-out-${timestamp}`,
      price: 1500,
      published: true,
      active: true,
      variants: [
        { name: "Brass Finish", sku: `OUT-B-${timestamp}`, price: 1500, stock: 0, active: true },
        { name: "Copper Finish", sku: `OUT-C-${timestamp}`, price: 1500, stock: 0, active: true },
      ],
      images: [],
      categoryIds: [],
      occasionIds: [],
    };
    const pOutRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify(pOutPayload),
    });
    const pOutJson = await pOutRes.json();
    cleanup.productIds.push(pOutJson.data.id);
    pOutJson.data.variants.forEach((v) => cleanup.variantIds.push(v.id));

    // Create 1 product with total active variant stock = 3 (between 1 and 5) -> must count as lowStock
    const pLowPayload = {
      name: `[TEST-UNIFY-LOW] Low Stock Idol ${timestamp}`,
      slug: `test-unify-low-${timestamp}`,
      price: 1500,
      published: true,
      active: true,
      variants: [
        { name: "Small", sku: `LOW-S-${timestamp}`, price: 1500, stock: 2, active: true },
        { name: "Medium", sku: `LOW-M-${timestamp}`, price: 1500, stock: 1, active: true },
      ],
      images: [],
      categoryIds: [],
      occasionIds: [],
    };
    const pLowRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify(pLowPayload),
    });
    const pLowJson = await pLowRes.json();
    cleanup.productIds.push(pLowJson.data.id);
    pLowJson.data.variants.forEach((v) => cleanup.variantIds.push(v.id));

    // Call GET /api/crm/analytics
    const analyticsRes = await fetch(`${BASE_URL}/api/crm/analytics`, {
      headers: { Cookie: adminCookie },
    });
    assert(analyticsRes.status === 200, "GET /api/crm/analytics returns 200 OK");
    const analyticsJson = await analyticsRes.json();
    assert(typeof analyticsJson.data.metrics.outOfStock === "number", "metrics.outOfStock is a number");
    assert(typeof analyticsJson.data.metrics.lowStock === "number", "metrics.lowStock is a number");
    assert(analyticsJson.data.metrics.outOfStock >= 1, "outOfStockCount includes the zero-stock variant product");
    assert(analyticsJson.data.metrics.lowStock >= 1, "lowStockCount includes the low-stock variant product");

    console.log(`\n=============================================================`);
    console.log(`Inventory Unification Test Suite Completed: ALL ${testsPassed} CHECKS PASSED`);
    console.log(`=============================================================\n`);
  } finally {
    console.log("Cleaning up test fixtures...");
    try {
      if (cleanup.orderIds.length > 0) {
        await sql`DELETE FROM "Payment" WHERE "orderId" = ANY(${cleanup.orderIds})`;
        await sql`DELETE FROM "OrderItem" WHERE "orderId" = ANY(${cleanup.orderIds})`;
        await sql`DELETE FROM "Order" WHERE "id" = ANY(${cleanup.orderIds})`;
      }
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
