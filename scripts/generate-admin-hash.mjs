#!/usr/bin/env node

/**
 * Local Admin Password Hash Generator for Shivura CRM
 *
 * Usage:
 *   node scripts/generate-admin-hash.mjs "YourStrongAdminPassword"
 *
 * This generates a bcrypt hash using cost factor 12 suitable for the
 * ADMIN_PASSWORD_HASH environment variable.
 * Do not commit your actual password or share it.
 */

import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password || password.trim().length === 0) {
  console.error("Error: Please provide a password argument.");
  console.error("Usage: node scripts/generate-admin-hash.mjs \"<YOUR_PASSWORD>\"");
  process.exit(1);
}

if (password.length < 8) {
  console.warn("Warning: Recommended minimum password length for CRM administration is 12 characters.");
}

const saltRounds = 12;
const hash = bcrypt.hashSync(password, saltRounds);
const isSelfVerified = bcrypt.compareSync(password, hash);
// Next.js uses dotenv-expand where $ triggers variable expansion unless escaped with \
const escapedHash = hash.replace(/\$/g, "\\$");

console.log("\n=======================================================");
console.log("Shivura CRM - Local Admin Password Hash Generator");
console.log("=======================================================");
console.log(`Bcrypt Salt Rounds : ${saltRounds}`);
console.log(`Hash Length        : ${hash.length} characters`);
console.log(`Verification Check : ${isSelfVerified ? "PASSED (hash matches password)" : "FAILED"}`);
console.log("=======================================================");
console.log("Copy and paste this line into your root .env file:");
console.log(`ADMIN_PASSWORD_HASH="${escapedHash}"`);
console.log("=======================================================");
console.log("Note: Bcrypt hashes start with $2a$ or $2b$. In Next.js .env,");
console.log("dollar signs are escaped with \\ ($ -> \\$) to prevent Next.js");
console.log("dotenv-expand from clearing or truncating your hash.");
console.log("=======================================================\n");

