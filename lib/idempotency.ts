import "server-only";
import crypto from "node:crypto";
import { prisma, Prisma } from "@/lib/prisma";
import { CheckoutError } from "@/lib/checkout";

export const LEASE_DURATION_MS = 120_000; // 120 seconds

export type IdempotencyClaimResult =
  | {
      action: "PROCEED";
      leaseToken: string;
      expiresAt: Date;
    }
  | {
      action: "REPLAY";
      responseBody: unknown;
      statusCode: number;
    }
  | {
      action: "ERROR";
      error: {
        code: string;
        message: string;
        status: number;
        headers?: Record<string, string>;
      };
    };

export type DurableRecoveryResult =
  | {
      recovered: true;
      responseBody: unknown;
      statusCode: number;
    }
  | {
      recovered: false;
    };

/**
 * Pre-flight idempotency claim coordinator:
 * 1. Atomically inserts a new PROCESSING record if no record exists for (userId, key).
 * 2. If a record already exists:
 *    - Verifies immutable requestHash. Returns 422 on payload mismatch for ALL statuses.
 *    - If COMPLETED, immediately returns cached response for replay (no cart required).
 *    - If active PROCESSING (lease unexpired), returns 409 Conflict with Retry-After: 5.
 *    - If FAILED or expired PROCESSING, atomically claims the record with a fresh leaseToken.
 *    - If claim update affects 0 rows, rereads the record and resolves race cleanly.
 */
export async function claimIdempotencyRecord(
  userId: string,
  idempotencyKey: string,
  requestHash: string
): Promise<IdempotencyClaimResult> {
  const leaseToken = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);

  // 1. Attempt initial atomic creation
  try {
    await prisma.idempotencyRecord.create({
      data: {
        userId,
        key: idempotencyKey,
        requestHash,
        status: "PROCESSING",
        leaseToken,
        expiresAt,
      },
    });

    return {
      action: "PROCEED",
      leaseToken,
      expiresAt,
    };
  } catch (err: unknown) {
    // Prisma unique constraint violation code is P2002 on (userId, key)
    const isUniqueViolation =
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002";

    if (!isUniqueViolation) {
      throw err;
    }
  }

  // 2. Record already exists for (userId, idempotencyKey). Fetch existing state.
  const existing = await prisma.idempotencyRecord.findUnique({
    where: {
      userId_key: {
        userId,
        key: idempotencyKey,
      },
    },
  });

  if (!existing) {
    // Record was deleted concurrently; return 409 so client retries
    return {
      action: "ERROR",
      error: {
        code: "CONCURRENT_PROCESSING",
        message: "A concurrent checkout collision was detected. Please retry.",
        status: 409,
        headers: { "Retry-After": "2" },
      },
    };
  }

  // Rule A: Immutable request hash check. Same key + different payload = HTTP 422
  if (existing.requestHash !== requestHash) {
    return {
      action: "ERROR",
      error: {
        code: "PAYLOAD_MISMATCH",
        message:
          "Idempotency key was previously used with a different request payload.",
        status: 422,
      },
    };
  }

  // Rule B: Completed replay: Return cached response directly without cart dependency
  if (existing.status === "COMPLETED") {
    return {
      action: "REPLAY",
      responseBody: existing.responseBody,
      statusCode: 201,
    };
  }

  // Rule C: Active PROCESSING record with unexpired lease
  if (existing.status === "PROCESSING" && existing.expiresAt > now) {
    return {
      action: "ERROR",
      error: {
        code: "CONCURRENT_PROCESSING",
        message:
          "A checkout request with this idempotency key is currently processing. Please wait.",
        status: 409,
        headers: { "Retry-After": "5" },
      },
    };
  }

  // Rule D: Expired PROCESSING lease or FAILED record: claim atomically with fresh leaseToken
  const claimResult = await prisma.idempotencyRecord.updateMany({
    where: {
      userId,
      key: idempotencyKey,
      requestHash, // Preserve immutable hash
      OR: [
        { status: "FAILED" },
        { status: "PROCESSING", expiresAt: { lte: now } },
      ],
    },
    data: {
      status: "PROCESSING",
      leaseToken,
      expiresAt,
    },
  });

  if (claimResult.count === 1) {
    return {
      action: "PROCEED",
      leaseToken,
      expiresAt,
    };
  }

  // Rule E: Zero rows affected during claim: another concurrent worker won the race or completed
  const recheck = await prisma.idempotencyRecord.findUnique({
    where: {
      userId_key: {
        userId,
        key: idempotencyKey,
      },
    },
  });

  if (recheck?.status === "COMPLETED") {
    return {
      action: "REPLAY",
      responseBody: recheck.responseBody,
      statusCode: 201,
    };
  }

  if (recheck && recheck.requestHash !== requestHash) {
    return {
      action: "ERROR",
      error: {
        code: "PAYLOAD_MISMATCH",
        message:
          "Idempotency key was previously used with a different request payload.",
        status: 422,
      },
    };
  }

  return {
    action: "ERROR",
    error: {
      code: "CONCURRENT_PROCESSING",
      message:
        "A checkout request with this idempotency key is currently processing. Please wait.",
      status: 409,
      headers: { "Retry-After": "5" },
    },
  };
}

/**
 * PostgreSQL Row Locking and Lease Fencing Verification:
 * Executes SELECT ... FOR UPDATE on IdempotencyRecord inside transaction.
 * Confirms status is PROCESSING, leaseToken matches current worker, and requestHash matches.
 * Throws CheckoutError if lease was reclaimed or stolen before the row lock was acquired.
 */
export async function verifyAndLockIdempotencyRecord(
  tx: Prisma.TransactionClient,
  userId: string,
  idempotencyKey: string,
  leaseToken: string,
  requestHash: string
): Promise<void> {
  const lockedRows = await tx.$queryRaw<
    Array<{
      id: string;
      userId: string;
      key: string;
      requestHash: string;
      status: string;
      leaseToken: string;
      expiresAt: Date;
      orderId: string | null;
    }>
  >`
    SELECT 
      id, 
      "userId", 
      key, 
      "requestHash", 
      status, 
      "leaseToken", 
      "expiresAt", 
      "orderId" 
    FROM "IdempotencyRecord" 
    WHERE "userId" = ${userId} AND key = ${idempotencyKey} 
    FOR UPDATE
  `;

  if (!lockedRows || lockedRows.length === 0) {
    throw new CheckoutError(
      "IDEMPOTENCY_NOT_FOUND",
      "Idempotency record not found under row lock.",
      409
    );
  }

  const row = lockedRows[0];

  // Fencing check 1: Status must still be PROCESSING
  if (row.status !== "PROCESSING") {
    throw new CheckoutError(
      "IDEMPOTENCY_FENCING_FAILED",
      `Idempotency record status is ${row.status}, expected PROCESSING.`,
      409
    );
  }

  // Fencing check 2: Worker's leaseToken must match
  if (row.leaseToken !== leaseToken) {
    throw new CheckoutError(
      "IDEMPOTENCY_FENCING_FAILED",
      "Idempotency lease was reclaimed by a concurrent worker.",
      409
    );
  }

  // Fencing check 3: Request hash must remain identical
  if (row.requestHash !== requestHash) {
    throw new CheckoutError(
      "PAYLOAD_MISMATCH",
      "Request payload hash mismatch detected under row lock.",
      422
    );
  }
}

/**
 * Completes the idempotency record inside the checkout transaction.
 * Requires the final update to affect exactly one row matching (userId, key, leaseToken, PROCESSING).
 * If affectedRows !== 1, throws to automatically trigger transaction rollback.
 */
export async function completeIdempotencyRecord(
  tx: Prisma.TransactionClient,
  userId: string,
  idempotencyKey: string,
  leaseToken: string,
  orderId: string,
  responseBody: unknown
): Promise<void> {
  const updateResult = await tx.idempotencyRecord.updateMany({
    where: {
      userId,
      key: idempotencyKey,
      leaseToken,
      status: "PROCESSING",
    },
    data: {
      status: "COMPLETED",
      orderId,
      responseBody: responseBody as Prisma.InputJsonValue,
    },
  });

  if (updateResult.count !== 1) {
    throw new CheckoutError(
      "IDEMPOTENCY_COMPLETION_FAILED",
      "Failed to transition idempotency record to COMPLETED atomically. Transaction rolled back.",
      500
    );
  }
}

/**
 * Safe failure cleanup:
 * Transitions record from PROCESSING to FAILED ONLY if leaseToken matches this worker's token.
 * Prevents overwriting a COMPLETED record or a lease held by a newer worker.
 */
export async function failIdempotencyRecord(
  userId: string,
  idempotencyKey: string,
  leaseToken: string
): Promise<void> {
  try {
    await prisma.idempotencyRecord.updateMany({
      where: {
        userId,
        key: idempotencyKey,
        leaseToken,
        status: "PROCESSING",
      },
      data: {
        status: "FAILED",
      },
    });
  } catch (err) {
    console.warn("[failIdempotencyRecord] Cleanup warning:", err);
  }
}

/**
 * Durable state recovery when transaction outcome is uncertain (e.g. network disconnect during commit):
 * Checks whether an order or COMPLETED idempotency record committed before failing the attempt.
 */
export async function checkDurableCheckoutRecovery(
  userId: string,
  idempotencyKey: string
): Promise<DurableRecoveryResult> {
  try {
    // 1. Check if IdempotencyRecord committed as COMPLETED
    const record = await prisma.idempotencyRecord.findUnique({
      where: {
        userId_key: {
          userId,
          key: idempotencyKey,
        },
      },
      include: {
        order: {
          include: {
            items: true,
            payments: true,
          },
        },
      },
    });

    if (record?.status === "COMPLETED" && record.responseBody) {
      return {
        recovered: true,
        responseBody: record.responseBody,
        statusCode: 201,
      };
    }

    // 2. Check if Order committed with this idempotency key
    const committedOrder = await prisma.order.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey,
        },
      },
      include: {
        items: true,
        payments: true,
      },
    });

    if (committedOrder) {
      const primaryPayment = committedOrder.payments[0] || null;
      const reconstructedResponse = {
        success: true,
        message: "Order placed successfully.",
        data: {
          id: committedOrder.id,
          orderNumber: committedOrder.orderNumber,
          status: committedOrder.status,
          paymentStatus: committedOrder.paymentStatus,
          subtotal: Number(committedOrder.subtotal),
          discount: Number(committedOrder.discount),
          shippingFee: Number(committedOrder.shippingFee),
          total: Number(committedOrder.total),
          customerName: committedOrder.customerName,
          customerEmail: committedOrder.customerEmail,
          customerPhone: committedOrder.customerPhone,
          shippingAddressLine1: committedOrder.shippingAddressLine1,
          shippingAddressLine2: committedOrder.shippingAddressLine2,
          shippingCity: committedOrder.shippingCity,
          shippingState: committedOrder.shippingState,
          shippingPostalCode: committedOrder.shippingPostalCode,
          shippingCountry: committedOrder.shippingCountry,
          createdAt: committedOrder.createdAt,
          items: committedOrder.items.map((ci) => ({
            id: ci.id,
            productId: ci.productId,
            productName: ci.productName,
            sku: ci.sku,
            variantInfo: ci.variantInfo,
            price: Number(ci.price),
            quantity: ci.quantity,
            subtotal: Number(ci.subtotal),
          })),
          payment: primaryPayment
            ? {
                id: primaryPayment.id,
                provider: primaryPayment.provider,
                amount: Number(primaryPayment.amount),
                status: primaryPayment.status,
              }
            : null,
        },
      };

      // Repair idempotency record to COMPLETED in the background if needed
      prisma.idempotencyRecord
        .updateMany({
          where: {
            userId,
            key: idempotencyKey,
            status: "PROCESSING",
          },
          data: {
            status: "COMPLETED",
            orderId: committedOrder.id,
            responseBody: reconstructedResponse as Prisma.InputJsonValue,
          },
        })
        .catch(() => {});

      return {
        recovered: true,
        responseBody: reconstructedResponse,
        statusCode: 201,
      };
    }
  } catch (recoveryErr) {
    console.warn("[checkDurableCheckoutRecovery] Recovery check failed:", recoveryErr);
  }

  return { recovered: false };
}
