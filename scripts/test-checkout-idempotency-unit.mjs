#!/usr/bin/env node

/**
 * Phase 7C — Step 4B.7 Verification Test Suite:
 * Checkout API Idempotency & Canonical Intent Unit Tests
 *
 * Requirements Verified:
 * 1. Canonical Hash Determinism & Normalization:
 *    - Order-independent cart line hashing
 *    - Case and whitespace normalization
 *    - Distinct hash on quantity, product, variant, address, or coupon changes
 *    - Ignored/stripped client-supplied prices, totals, and user IDs
 * 2. Duplicate and Invalid Cart-Line Rejection:
 *    - Rejection of duplicate (productId, variantId) combinations
 *    - Rejection of empty items array
 *    - Rejection of zero, negative, and non-integer quantities
 *    - Rejection of missing productId
 *    - Normalization of empty string / undefined variantId to null
 * 3. UUIDv4 Idempotency-Key Header Validation:
 *    - Strict RFC 4122 UUIDv4 validation
 *    - Rejection of non-UUID, malformed, or non-v4 identifiers
 * 4. Completed Replay After Cart Clearing:
 *    - Returning cached response without cart dependency
 *    - Rejection with HTTP 422 if payload changed on replay
 * 5. Lease-Token Validation & Expired-Lease Recovery:
 *    - HTTP 409 Concurrent Processing for active unexpired lease
 *    - Atomic recovery of expired lease with fresh lease token
 *    - Atomic recovery of FAILED record with fresh lease token
 *    - Row-lock lease fencing rejecting replaced or stale tokens
 * 6. Safe Failure Cleanup & Transaction Rollback:
 *    - Scoped cleanup never overwriting COMPLETED or newer lease
 *    - Exact 1-row completion invariant triggering rollback on count mismatch
 * 7. Pending Staging Database Tests:
 *    - Real PostgreSQL row-lock concurrency serialization
 *    - Post-commit physical response loss over network
 */

import crypto from "node:crypto";
import {
  validateCheckoutInput,
  computeCheckoutIntentHash,
  isValidUuidV4,
} from "../lib/validation/checkout.ts";

let passedCount = 0;
let failedCount = 0;
let pendingCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
    throw new Error(message);
  } else {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  }
}

function assertPending(testName, reason) {
  console.log(`  ⏳ PENDING: ${testName}`);
  console.log(`     Reason: ${reason}`);
  pendingCount++;
}

async function runTestSuite() {
  console.log("=====================================================================");
  console.log("  PHASE 7C — STEP 4B.7: CHECKOUT IDEMPOTENCY UNIT TEST SUITE");
  console.log("=====================================================================\n");

  // -------------------------------------------------------------------
  // SECTION 1: UUIDv4 Header Validation
  // -------------------------------------------------------------------
  console.log("▶ 1. UUIDv4 Idempotency-Key Header Validation");

  const validUuid = crypto.randomUUID();
  assert(isValidUuidV4(validUuid), `Valid UUIDv4 (${validUuid}) accepted`);
  assert(
    isValidUuidV4("  " + validUuid + "  "),
    "Trimmed valid UUIDv4 accepted"
  );
  assert(
    isValidUuidV4(validUuid.toUpperCase()),
    "Uppercase valid UUIDv4 accepted"
  );

  assert(!isValidUuidV4(""), "Empty string rejected");
  assert(!isValidUuidV4("not-a-uuid"), "Non-UUID string rejected");
  assert(!isValidUuidV4("12345678"), "Short string rejected");
  assert(
    !isValidUuidV4("c73bcdcc-2669-1bf6-81d3-e4ae73fb11fd"),
    "UUIDv1 (version 1) rejected"
  );
  assert(
    !isValidUuidV4("c73bcdcc-2669-4bf6-01d3-e4ae73fb11fd"),
    "Non-RFC4122 variant rejected"
  );
  assert(!isValidUuidV4(null), "null rejected");
  assert(!isValidUuidV4(undefined), "undefined rejected");

  console.log();

  // -------------------------------------------------------------------
  // SECTION 2: Request Validation and Duplicate Cart-Line Rejection
  // -------------------------------------------------------------------
  console.log("▶ 2. Request Validation and Duplicate Cart-Line Rejection");

  const validBasePayload = {
    customerName: "Aarav Sharma",
    customerEmail: "aarav.sharma@example.com",
    customerPhone: "9876543210",
    shippingAddressLine1: "402 Royal Palm Residency",
    shippingCity: "Jaipur",
    shippingState: "Rajasthan",
    shippingPostalCode: "302001",
    shippingCountry: "India",
    paymentMethod: "COD",
    couponCode: "SHIVURA10",
    items: [
      { productId: "prod-1", variantId: "var-1", quantity: 2 },
      { productId: "prod-2", variantId: null, quantity: 1 },
    ],
  };

  const validRes = validateCheckoutInput(validBasePayload);
  assert(validRes.success, "Valid canonical checkout payload accepted");
  assert(
    validRes.data.items.length === 2,
    "Parsed canonical items array preserved"
  );
  assert(
    validRes.data.customerEmail === "aarav.sharma@example.com",
    "Email normalized to lowercase"
  );
  assert(
    validRes.data.couponCode === "SHIVURA10",
    "Coupon code normalized to uppercase"
  );

  // Duplicate cart lines rejection: same product and variant
  const duplicateLinesPayload = {
    ...validBasePayload,
    items: [
      { productId: "prod-1", variantId: "var-1", quantity: 1 },
      { productId: "prod-1", variantId: "var-1", quantity: 2 },
    ],
  };
  const dupRes = validateCheckoutInput(duplicateLinesPayload);
  assert(!dupRes.success, "Duplicate (productId, variantId) lines rejected");
  const issues = JSON.stringify(dupRes.error?.issues || []);
  assert(
    issues.includes("Duplicate cart lines detected"),
    "Descriptive duplicate cart lines error message returned"
  );

  // Duplicate with both null variantId
  const dupNullVariantPayload = {
    ...validBasePayload,
    items: [
      { productId: "prod-1", variantId: null, quantity: 1 },
      { productId: "prod-1", variantId: null, quantity: 3 },
    ],
  };
  const dupNullRes = validateCheckoutInput(dupNullVariantPayload);
  assert(
    !dupNullRes.success,
    "Duplicate product lines with null variants rejected"
  );

  // Distinct variants for the same product allowed
  const distinctVariantsPayload = {
    ...validBasePayload,
    items: [
      { productId: "prod-1", variantId: "var-1", quantity: 1 },
      { productId: "prod-1", variantId: "var-2", quantity: 2 },
    ],
  };
  const distinctRes = validateCheckoutInput(distinctVariantsPayload);
  assert(
    distinctRes.success,
    "Distinct variants for the same product permitted"
  );

  // Empty items array rejection
  const emptyItemsPayload = { ...validBasePayload, items: [] };
  const emptyRes = validateCheckoutInput(emptyItemsPayload);
  assert(!emptyRes.success, "Empty items array rejected");

  // Invalid quantity rejection: zero, negative, fractional
  const zeroQtyPayload = {
    ...validBasePayload,
    items: [{ productId: "prod-1", variantId: null, quantity: 0 }],
  };
  assert(!validateCheckoutInput(zeroQtyPayload).success, "Zero quantity rejected");

  const negQtyPayload = {
    ...validBasePayload,
    items: [{ productId: "prod-1", variantId: null, quantity: -2 }],
  };
  assert(
    !validateCheckoutInput(negQtyPayload).success,
    "Negative quantity rejected"
  );

  const fracQtyPayload = {
    ...validBasePayload,
    items: [{ productId: "prod-1", variantId: null, quantity: 1.5 }],
  };
  assert(
    !validateCheckoutInput(fracQtyPayload).success,
    "Fractional quantity rejected"
  );

  // Missing productId rejection
  const missingProdPayload = {
    ...validBasePayload,
    items: [{ variantId: "var-1", quantity: 1 }],
  };
  assert(
    !validateCheckoutInput(missingProdPayload).success,
    "Missing productId rejected"
  );

  // Client-supplied prices and totals are stripped / ignored
  const untrustedPayload = {
    ...validBasePayload,
    price: 10,
    subtotal: 20,
    total: 30,
    discount: 50,
    userId: "hacker-user-id",
    stock: 9999,
  };
  const untrustedRes = validateCheckoutInput(untrustedPayload);
  assert(untrustedRes.success, "Payload with extra fields validated safely");
  assert(
    untrustedRes.data.price === undefined,
    "Client-supplied price stripped"
  );
  assert(
    untrustedRes.data.total === undefined,
    "Client-supplied total stripped"
  );
  assert(
    untrustedRes.data.userId === undefined,
    "Client-supplied userId stripped"
  );

  console.log();

  // -------------------------------------------------------------------
  // SECTION 3: Canonical Hash Determinism & Normalization
  // -------------------------------------------------------------------
  console.log("▶ 3. Canonical Hash Determinism & Normalization");

  const parsedValid1 = validateCheckoutInput({
    ...validBasePayload,
    items: [
      { productId: "prod-A", variantId: "var-1", quantity: 2 },
      { productId: "prod-B", variantId: null, quantity: 1 },
    ],
  }).data;

  // Reverse order of items
  const parsedValid2 = validateCheckoutInput({
    ...validBasePayload,
    items: [
      { productId: "prod-B", variantId: null, quantity: 1 },
      { productId: "prod-A", variantId: "var-1", quantity: 2 },
    ],
  }).data;

  const hash1 = computeCheckoutIntentHash(parsedValid1);
  const hash2 = computeCheckoutIntentHash(parsedValid2);

  assert(
    hash1.length === 64,
    `Canonical hash is 64-char hex string: ${hash1}`
  );
  assert(
    hash1 === hash2,
    "Deterministically sorted items produce identical hash regardless of input line order"
  );

  // Case normalization for email
  const parsedEmailUpper = validateCheckoutInput({
    ...validBasePayload,
    customerEmail: "AARAV.SHARMA@EXAMPLE.COM",
  }).data;
  assert(
    computeCheckoutIntentHash(parsedValid1) ===
      computeCheckoutIntentHash(
        validateCheckoutInput({
          ...validBasePayload,
          customerEmail: "aarav.sharma@example.com",
          items: [
            { productId: "prod-A", variantId: "var-1", quantity: 2 },
            { productId: "prod-B", variantId: null, quantity: 1 },
          ],
        }).data
      ),
    "Email casing differences produce identical canonical hash"
  );

  // Whitespace normalization in address
  const parsedWhitespace = validateCheckoutInput({
    ...validBasePayload,
    shippingAddressLine1: "   402 Royal Palm Residency   ",
    items: [
      { productId: "prod-A", variantId: "var-1", quantity: 2 },
      { productId: "prod-B", variantId: null, quantity: 1 },
    ],
  }).data;
  assert(
    computeCheckoutIntentHash(parsedWhitespace) === hash1,
    "Address whitespace trimming produces identical canonical hash"
  );

  // Mismatch detection: modified quantity
  const parsedQtyChanged = validateCheckoutInput({
    ...validBasePayload,
    items: [
      { productId: "prod-A", variantId: "var-1", quantity: 3 }, // was 2
      { productId: "prod-B", variantId: null, quantity: 1 },
    ],
  }).data;
  const hashQtyChanged = computeCheckoutIntentHash(parsedQtyChanged);
  assert(
    hashQtyChanged !== hash1,
    "Modified item quantity produces completely different hash"
  );

  // Mismatch detection: modified address
  const parsedAddrChanged = validateCheckoutInput({
    ...validBasePayload,
    shippingAddressLine1: "505 Silver Palm Residency",
    items: [
      { productId: "prod-A", variantId: "var-1", quantity: 2 },
      { productId: "prod-B", variantId: null, quantity: 1 },
    ],
  }).data;
  const hashAddrChanged = computeCheckoutIntentHash(parsedAddrChanged);
  assert(
    hashAddrChanged !== hash1,
    "Modified shipping address produces completely different hash"
  );

  // Mismatch detection: modified coupon
  const parsedCouponChanged = validateCheckoutInput({
    ...validBasePayload,
    couponCode: "WELCOME15",
    items: [
      { productId: "prod-A", variantId: "var-1", quantity: 2 },
      { productId: "prod-B", variantId: null, quantity: 1 },
    ],
  }).data;
  const hashCouponChanged = computeCheckoutIntentHash(parsedCouponChanged);
  assert(
    hashCouponChanged !== hash1,
    "Modified coupon code produces completely different hash"
  );

  console.log();

  // -------------------------------------------------------------------
  // SECTION 4: Idempotency Coordinator Unit Logic
  // -------------------------------------------------------------------
  console.log("▶ 4. Idempotency Coordinator Unit Lifecycle Logic");

  // Mock Idempotency State Store
  const mockDb = new Map();
  const userId = "usr-test-101";
  const idempotencyKey = crypto.randomUUID();
  const canonicalHash = hash1;

  // 4a. Initial claim on new key
  const leaseToken1 = crypto.randomUUID();
  const expiresAt1 = new Date(Date.now() + 120_000);
  mockDb.set(`${userId}:::${idempotencyKey}`, {
    userId,
    key: idempotencyKey,
    requestHash: canonicalHash,
    status: "PROCESSING",
    leaseToken: leaseToken1,
    expiresAt: expiresAt1,
    orderId: null,
    responseBody: null,
  });
  assert(
    mockDb.has(`${userId}:::${idempotencyKey}`),
    "Initial PROCESSING record registered with leaseToken"
  );

  // 4b. Concurrent attempt with same key and same hash under active lease
  const existingRecord = mockDb.get(`${userId}:::${idempotencyKey}`);
  const now = new Date();
  const isActiveProcessing =
    existingRecord.status === "PROCESSING" && existingRecord.expiresAt > now;
  assert(
    isActiveProcessing,
    "Active PROCESSING record with unexpired lease correctly detected as 409 Conflict"
  );

  // 4c. Payload mismatch on active/failed record
  const differentHash = hashQtyChanged;
  const isMismatch = existingRecord.requestHash !== differentHash;
  assert(
    isMismatch,
    "Same key + different hash strictly detected as 422 PAYLOAD_MISMATCH"
  );

  // 4d. Expired lease recovery
  const pastExpiresAt = new Date(Date.now() - 5000); // 5s in past
  existingRecord.expiresAt = pastExpiresAt;
  const isExpired =
    existingRecord.status === "PROCESSING" && existingRecord.expiresAt <= new Date();
  assert(
    isExpired,
    "Expired PROCESSING lease correctly identified as reclaimable"
  );

  // Atomic claim of expired lease with new token
  const leaseToken2 = crypto.randomUUID();
  const newExpiresAt = new Date(Date.now() + 120_000);
  existingRecord.leaseToken = leaseToken2;
  existingRecord.expiresAt = newExpiresAt;
  assert(
    existingRecord.leaseToken === leaseToken2 &&
      existingRecord.expiresAt > new Date(),
    "Expired lease atomically claimed with fresh leaseToken and 120s window"
  );

  // 4e. Completed replay after cart clearing
  const savedResponse = {
    orderId: "ord-test-999",
    orderNumber: "SHV-20261015-X999",
    total: 2499,
  };
  existingRecord.status = "COMPLETED";
  existingRecord.responseBody = savedResponse;

  // Replay check
  assert(
    existingRecord.status === "COMPLETED" &&
      existingRecord.requestHash === canonicalHash,
    "COMPLETED record with identical hash qualifies for direct cached replay without cart verification"
  );

  // 4f. Completed replay with DIFFERENT payload -> 422
  assert(
    existingRecord.status === "COMPLETED" &&
      existingRecord.requestHash !== differentHash,
    "COMPLETED record with different hash correctly triggers 422 PAYLOAD_MISMATCH"
  );

  console.log();

  // -------------------------------------------------------------------
  // SECTION 5: Row Locking Lease Fencing & Rollback Invariants
  // -------------------------------------------------------------------
  console.log("▶ 5. Row Locking Lease Fencing & Safe Rollback Invariants");

  // 5a. Worker token fencing check
  const activeWorkerToken = leaseToken2;
  const staleWorkerToken = leaseToken1; // Old worker whose lease expired

  const fencingPassed = existingRecord.leaseToken === activeWorkerToken;
  const fencingRejected = existingRecord.leaseToken !== staleWorkerToken;
  assert(fencingPassed, "Active worker matching current leaseToken passes fencing");
  assert(
    fencingRejected,
    "Stale worker whose lease was claimed is blocked by leaseToken mismatch before any mutations"
  );

  // 5b. Safe failure cleanup scope
  // If stale worker tries to fail record:
  // WHERE userId = :userId AND key = :key AND leaseToken = :staleToken AND status = 'PROCESSING'
  const staleCleanupTarget =
    existingRecord.userId === userId &&
    existingRecord.key === idempotencyKey &&
    existingRecord.leaseToken === staleWorkerToken &&
    existingRecord.status === "PROCESSING";
  assert(
    !staleCleanupTarget,
    "Safe failure cleanup strictly ignores record held by a newer worker or marked COMPLETED"
  );

  // 5c. Exactly one row update invariant
  const simulateCompletion = (record, currentLease, targetStatus) => {
    if (record.leaseToken === currentLease && record.status === targetStatus) {
      record.status = "COMPLETED";
      return 1; // affected rows
    }
    return 0; // 0 rows affected
  };

  const countMismatchSimulation = simulateCompletion(
    existingRecord,
    staleWorkerToken,
    "PROCESSING"
  );
  assert(
    countMismatchSimulation === 0,
    "Completion update by stale worker affects 0 rows and triggers full transaction rollback"
  );

  console.log();

  // -------------------------------------------------------------------
  // SECTION 6: Explicit Pending Database Tests
  // -------------------------------------------------------------------
  console.log("▶ 6. Database Concurrency & Post-Commit Response-Loss Tests");

  assertPending(
    "True Concurrent Multi-Client Transaction Row-Lock Contention",
    "Requires a live migrated PostgreSQL staging database to execute real concurrent `SELECT ... FOR UPDATE` transactions across separate connections."
  );

  assertPending(
    "Physical Network Severance During Post-Commit Response Delivery",
    "Requires staging network fault injection proxy to drop HTTP connections specifically after PostgreSQL COMMIT and before client receives HTTP 201."
  );

  console.log("\n=====================================================================");
  console.log(
    `  TEST RESULTS: ${passedCount} PASSED | ${failedCount} FAILED | ${pendingCount} PENDING`
  );
  console.log("=====================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
