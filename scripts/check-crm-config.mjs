#!/usr/bin/env node

/**
 * Safe Configuration Health Check for Shivura CRM
 *
 * Verifies environment variable presence and format without revealing secrets.
 * Usage:
 *   node scripts/check-crm-config.mjs
 */

import fs from "fs";
import pkg from "@next/env";
const { loadEnvConfig } = pkg;

console.log("\n=======================================================");
console.log("Shivura CRM - Configuration Diagnostic Checker");
console.log("=======================================================\n");

if (!fs.existsSync(".env")) {
  console.error("❌ FAILED: .env file is missing in the workspace root.");
  process.exit(1);
}

const envConfig = loadEnvConfig(".");
const combined = envConfig.combinedEnv;

let allChecksPass = true;

// 1. Check AUTH_SECRET
if (!combined.AUTH_SECRET || combined.AUTH_SECRET.trim().length === 0) {
  console.log("❌ AUTH_SECRET: Missing or empty (required for AES-256 session encryption)");
  allChecksPass = false;
} else if (combined.AUTH_SECRET.length < 32) {
  console.log(`⚠️  AUTH_SECRET: Configured, but shorter than recommended 32 bytes (${combined.AUTH_SECRET.length} chars)`);
} else {
  console.log("✅ AUTH_SECRET: Present and sufficiently long");
}

// 2. Check ADMIN_EMAIL
const email = combined.ADMIN_EMAIL?.trim();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!email) {
  console.log("❌ ADMIN_EMAIL: Missing or empty in .env");
  allChecksPass = false;
} else if (!emailRegex.test(email)) {
  console.log("❌ ADMIN_EMAIL: Present, but not a valid email address format");
  allChecksPass = false;
} else {
  console.log(`✅ ADMIN_EMAIL: Configured as valid email (${email.split("@")[0]}@...)`);
}

// 3. Check ADMIN_PASSWORD_HASH
const rawHash = combined.ADMIN_PASSWORD_HASH?.trim();
const bcryptRegex = /^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/;

if (!rawHash) {
  console.log("❌ ADMIN_PASSWORD_HASH: Missing or empty in .env");
  allChecksPass = false;
} else {
  let normalizedHash = rawHash;
  if ((normalizedHash.startsWith('"') && normalizedHash.endsWith('"')) || (normalizedHash.startsWith("'") && normalizedHash.endsWith("'"))) {
    normalizedHash = normalizedHash.slice(1, -1);
  }
  if (normalizedHash.includes("\\$")) {
    normalizedHash = normalizedHash.replace(/\\(\$)/g, "$1");
  }

  if (bcryptRegex.test(normalizedHash)) {
    console.log(`✅ ADMIN_PASSWORD_HASH: Valid 60-character bcrypt hash structure ($2a/$2b)`);
  } else {
    console.log(`❌ ADMIN_PASSWORD_HASH: Invalid format (length: ${rawHash.length})`);
    if (rawHash.length < 40) {
      console.log("   -> Root Cause: It appears a plaintext password was entered into .env instead of a bcrypt hash.");
      console.log("   -> Action: Run `node scripts/generate-admin-hash.mjs \"<YourPassword>\"` and copy the generated line into .env.");
    } else {
      console.log("   -> Root Cause: The hash appears truncated or malformed.");
      console.log("   -> Action: Ensure all $ characters are escaped with \\ ($ -> \\$) when defined in .env.");
    }
    allChecksPass = false;
  }
}

console.log("\n=======================================================");
if (allChecksPass) {
  console.log("Result: ALL CRM CONFIGURATION CHECKS PASSED ✅");
} else {
  console.log("Result: CONFIGURATION ISSUES DETECTED ❌");
}
console.log("=======================================================\n");

process.exit(allChecksPass ? 0 : 1);
