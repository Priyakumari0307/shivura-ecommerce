import { prisma } from "@/lib/prisma";
import { Prisma, type User } from "@/lib/generated/prisma/client";

export interface GoogleUserProfile {
  sub: string;
  email: string;
  name?: string | null;
  picture?: string | null;
}

export type HandleGoogleUserResult =
  | { success: true; user: User; isNewUser: boolean }
  | {
      success: false;
      error: "ACCOUNT_EXISTS" | "DATABASE_ERROR";
      message: string;
    };

class AccountExistsConflictError extends Error {
  constructor(message: string = "An account with this email already exists.") {
    super(message);
    this.name = "AccountExistsConflictError";
  }
}

/**
 * Handles account lookup, creation, and secure account linking boundaries for Google OAuth.
 *
 * Rules:
 * 1. If Google Account exists (matching provider 'google' and providerAccountId 'sub'),
 *    logs into associated User.
 * 2. If NO Google Account exists, looks up existing User by verified email.
 *    If an existing User is found:
 *    STRICT SECURITY RULE: NEVER automatically link Google to that account based on email alone.
 *    Rejects with ACCOUNT_EXISTS error to prevent automated account takeover.
 * 3. If NO User exists, creates User with role strictly set to CUSTOMER and creates Account
 *    record inside an atomic Prisma transaction.
 * 4. Safely handles concurrency and unique constraint collisions.
 */
export async function handleGoogleUser(
  profile: GoogleUserProfile
): Promise<HandleGoogleUserResult> {
  const normalizedEmail = profile.email.toLowerCase().trim();
  const provider = "google";
  const providerAccountId = profile.sub.trim();

  // Disallow Google OAuth authentication or registration for the reserved admin email
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && normalizedEmail === adminEmail) {
    return {
      success: false,
      error: "ACCOUNT_EXISTS",
      message:
        "The administrative email address is reserved and cannot be accessed via Google OAuth. Please sign in via the Shivura CRM portal.",
    };
  }

  try {
    // 1. Check if Google Account record already exists
    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      include: {
        user: true,
      },
    });

    if (existingAccount?.user) {
      return {
        success: true,
        user: existingAccount.user,
        isNewUser: false,
      };
    }

    // 2. Check if a User with the verified Google email already exists
    const existingUserByEmail = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (existingUserByEmail) {
      // SECURITY REQUIREMENT:
      // Email verification from Google does not by itself authorize taking over an existing local account.
      // Require an explicit, authenticated account-linking flow or ask the user to sign in with their existing method.
      return {
        success: false,
        error: "ACCOUNT_EXISTS",
        message:
          "An account with this email already exists. Please sign in with your email and password.",
      };
    }

    // 3. Create new User and associated Account record in an atomic transaction
    const newUser = await prisma.$transaction(async (tx) => {
      // Re-check email inside the transaction to prevent race conditions
      const raceCheckUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (raceCheckUser) {
        throw new AccountExistsConflictError();
      }

      // Create new user with role strictly set to CUSTOMER
      const createdUser = await tx.user.create({
        data: {
          name: profile.name?.trim() || null,
          email: normalizedEmail,
          emailVerified: new Date(),
          image: profile.picture?.trim() || null,
          role: "CUSTOMER", // Server-enforced role
        },
      });

      // Create associated OAuth Account record
      // Tokens remain null as they are not needed for session authentication
      await tx.account.create({
        data: {
          userId: createdUser.id,
          type: "oauth",
          provider,
          providerAccountId,
        },
      });

      return createdUser;
    });

    return {
      success: true,
      user: newUser,
      isNewUser: true,
    };
  } catch (error) {
    if (error instanceof AccountExistsConflictError) {
      return {
        success: false,
        error: "ACCOUNT_EXISTS",
        message:
          "An account with this email already exists. Please sign in with your email and password.",
      };
    }

    // Handle concurrent request race conditions (Prisma P2002: unique constraint failed)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Check if the account was created concurrently
      const concurrentAccount = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
        include: {
          user: true,
        },
      });

      if (concurrentAccount?.user) {
        return {
          success: true,
          user: concurrentAccount.user,
          isNewUser: false,
        };
      }

      return {
        success: false,
        error: "ACCOUNT_EXISTS",
        message:
          "An account with this email already exists. Please sign in with your email and password.",
      };
    }

    console.error("[Google OAuth User Handler] Database error:", error);
    return {
      success: false,
      error: "DATABASE_ERROR",
      message: "An unexpected error occurred while processing your account.",
    };
  }
}
