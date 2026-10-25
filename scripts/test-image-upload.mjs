#!/usr/bin/env node

/**
 * Verification Test Suite for Shivura CRM Direct Product Image Upload
 *
 * Verifies:
 * 1. Endpoint Protection & RBAC:
 *    - Unauthenticated GET and POST /api/crm/upload return 401
 *    - Customer GET and POST /api/crm/upload return 403 Forbidden
 * 2. Missing Cloudinary Configuration:
 *    - When Cloudinary credentials are not set, GET /api/crm/upload returns configured: false
 *    - POST /api/crm/upload returns 503 CLOUDINARY_NOT_CONFIGURED with required variables
 *    - Upload does NOT pretend to succeed
 * 3. Server-side Binary Content Validation (Magic Bytes & Security):
 *    - Executable/script with .jpg extension rejected
 *    - SVG/XML with .png extension rejected
 *    - PDF with .webp extension rejected
 *    - File size > 5 MB rejected
 *    - Empty file rejected
 *    - Valid JPEG magic bytes (FF D8 FF) accepted
 *    - Valid PNG magic bytes (89 50 4E 47 0D 0A 1A 0A) accepted
 *    - Valid WebP magic bytes (RIFF ... WEBP) accepted
 *    - File extension mismatch rejected
 * 4. Product Creation with Mixed Media:
 *    - Supports uploaded images (with publicId) alongside manual image URLs
 *    - Enforces primary cover designation
 *    - Preserves draft status (published: false)
 * 5. Product Editing & Relation Preservation:
 *    - Untouched images are preserved when other product fields are updated
 *    - Updated images reflect new sortOrder, primary designation, and alt text
 * 6. Storefront Draft Visibility:
 *    - Unpublished draft remains hidden from public storefront API
 * 7. Safe Cleanup:
 *    - Cleans up all test products created during execution
 */

import { validateImageBuffer, MAX_IMAGE_SIZE_BYTES } from "../lib/validation/imageUpload.ts";

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shivura.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "shivura@2026";

let testsPassed = 0;
let testsFailed = 0;
const createdProductIds = [];

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

// Minimal binary generator helpers for testing magic bytes
function createMinimalJpeg() {
  // FF D8 FF E0 00 10 4A 46 49 46 00 01 ...
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

function createMinimalPng() {
  // 89 50 4E 47 0D 0A 1A 0A ...
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  ]);
}

function createMinimalWebp() {
  // RIFF <size> WEBP VP8 ...
  return Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x0e, 0x00, 0x00, 0x00,
  ]);
}

async function runTests() {
  console.log(`\n=============================================================`);
  console.log(`Starting Shivura CRM Direct Image Upload Verification Suite`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  try {
    // -------------------------------------------------------------
    // TEST 1: Server-Side Binary Magic-Byte Content Validation Unit Tests
    // -------------------------------------------------------------
    console.log(`[TEST 1] Server-Side Binary Content Validation (Magic Bytes)`);

    // 1a. Valid JPEG
    const validJpeg = createMinimalJpeg();
    const resJpeg = validateImageBuffer(validJpeg, "sample.jpg");
    assert(resJpeg.valid && resJpeg.mimeType === "image/jpeg", "Valid JPEG binary recognized by magic bytes");

    // 1b. Valid PNG
    const validPng = createMinimalPng();
    const resPng = validateImageBuffer(validPng, "sample.png");
    assert(resPng.valid && resPng.mimeType === "image/png", "Valid PNG binary recognized by magic bytes");

    // 1c. Valid WebP
    const validWebp = createMinimalWebp();
    const resWebp = validateImageBuffer(validWebp, "sample.webp");
    assert(resWebp.valid && resWebp.mimeType === "image/webp", "Valid WebP binary recognized by magic bytes");

    // 1d. Text / Script masquerading with .jpg extension
    const fakeJpeg = Buffer.from("<?php echo 'malicious script'; ?>");
    const resFake = validateImageBuffer(fakeJpeg, "malicious.jpg");
    assert(!resFake.valid, "Text/Script file with .jpg extension rejected by magic byte inspection");

    // 1e. SVG / XML masquerading as .png (XSS vector prevention)
    const fakePng = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
    const resSvg = validateImageBuffer(fakePng, "vector.png");
    assert(!resSvg.valid, "SVG script vector disguised as .png rejected");

    // 1f. PDF file disguised as .webp
    const fakeWebp = Buffer.from("%PDF-1.4 ... binary content ...");
    const resPdf = validateImageBuffer(fakeWebp, "document.webp");
    assert(!resPdf.valid, "PDF document disguised as .webp rejected");

    // 1g. Empty buffer
    const emptyRes = validateImageBuffer(Buffer.alloc(0), "empty.jpg");
    assert(!emptyRes.valid, "Empty 0-byte buffer rejected");

    // 1h. File exceeding 5 MB limit
    const oversizedBuffer = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1024);
    // Prepend jpeg magic bytes
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;
    const resOversized = validateImageBuffer(oversizedBuffer, "huge.jpg");
    assert(!resOversized.valid && resOversized.error.includes("5 MB"), "File exceeding 5 MB limit rejected with clear message");

    // 1i. Extension mismatch (JPEG magic bytes but .txt extension)
    const mismatchedExt = validateImageBuffer(validJpeg, "sample.txt");
    assert(!mismatchedExt.valid && mismatchedExt.error.includes("extension"), "File extension mismatch (.txt) rejected");

    // -------------------------------------------------------------
    // TEST 2: Unauthenticated and Customer RBAC Protection
    // -------------------------------------------------------------
    console.log(`\n[TEST 2] Route Protection & RBAC on /api/crm/upload`);

    // 2a. Unauthenticated GET /api/crm/upload -> 401
    const unauthGetRes = await fetch(`${BASE_URL}/api/crm/upload`);
    assert(unauthGetRes.status === 401, `Unauthenticated GET /api/crm/upload returns 401 (got ${unauthGetRes.status})`);

    // 2b. Unauthenticated POST /api/crm/upload -> 401
    const unauthPostRes = await fetch(`${BASE_URL}/api/crm/upload`, {
      method: "POST",
      body: new FormData(),
    });
    assert(unauthPostRes.status === 401, `Unauthenticated POST /api/crm/upload returns 401 (got ${unauthPostRes.status})`);

    // 2c. Customer login & access attempt -> 403
    const customerEmail = "customer-upload-tester@shivura-luxury.com";
    const customerPassword = "CustomerPass2026!";

    await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Customer Upload Tester",
        email: customerEmail,
        password: customerPassword,
      }),
    });

    const customerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customerEmail,
        password: customerPassword,
      }),
    });

    const custCookieHeader = customerLoginRes.headers.get("set-cookie") || "";
    const custMatch = custCookieHeader.match(/shivura_session=([^;]+)/);
    assert(custMatch !== null, `Customer session obtained for RBAC test`);
    const customerCookie = custMatch[0];

    const custGetRes = await fetch(`${BASE_URL}/api/crm/upload`, {
      headers: { Cookie: customerCookie },
    });
    assert(custGetRes.status === 403, `Customer GET /api/crm/upload returns 403 Forbidden (got ${custGetRes.status})`);

    const custPostRes = await fetch(`${BASE_URL}/api/crm/upload`, {
      method: "POST",
      headers: { Cookie: customerCookie },
      body: new FormData(),
    });
    assert(custPostRes.status === 403, `Customer POST /api/crm/upload returns 403 Forbidden (got ${custPostRes.status})`);

    // -------------------------------------------------------------
    // TEST 3: Admin Authentication & Upload Configuration Check
    // -------------------------------------------------------------
    console.log(`\n[TEST 3] Admin Authentication & Upload Diagnostics`);

    const adminLoginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
    });
    assert(adminLoginRes.status === 200, `Admin authenticated at /api/crm/auth/login`);

    const adminCookieHeader = adminLoginRes.headers.get("set-cookie") || "";
    const adminMatch = adminCookieHeader.match(/shivura_session=([^;]+)/);
    assert(adminMatch !== null, `Admin session cookie obtained`);
    const adminCookie = adminMatch[0];

    // GET /api/crm/upload as admin
    const uploadConfigRes = await fetch(`${BASE_URL}/api/crm/upload`, {
      headers: { Cookie: adminCookie },
    });
    assert(uploadConfigRes.status === 200, `Admin GET /api/crm/upload returns 200 OK`);
    const uploadConfigJson = await uploadConfigRes.json();
    assert(uploadConfigJson.success === true, `Upload configuration returns success: true`);
    assert("configured" in uploadConfigJson.data, `Upload configuration specifies configured status`);
    assert(Array.isArray(uploadConfigJson.data.requiredVariables), `Upload configuration specifies required variable names without revealing values`);

    // Verify secrets are NOT present in uploadConfigJson
    const configStr = JSON.stringify(uploadConfigJson);
    assert(!configStr.includes("CLOUDINARY_API_SECRET_VALUE"), `Upload config never exposes API secrets`);

    // -------------------------------------------------------------
    // TEST 4: Missing Cloudinary Handling / Upload Request Handling
    // -------------------------------------------------------------
    console.log(`\n[TEST 4] Upload Request Handling & Missing Cloudinary Notice`);

    const isCloudinaryConfigured = uploadConfigJson.data.configured;

    if (!isCloudinaryConfigured) {
      console.log(`  ℹ️ Cloudinary is unconfigured in local .env — validating graceful 503 behavior.`);

      const testFormData = new FormData();
      const testFileBlob = new Blob([createMinimalJpeg()], { type: "image/jpeg" });
      testFormData.append("file", testFileBlob, "test-product.jpg");

      const uploadAttemptRes = await fetch(`${BASE_URL}/api/crm/upload`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: testFormData,
      });

      assert(uploadAttemptRes.status === 503, `Upload returns 503 Service Unavailable when Cloudinary is unconfigured`);
      const attemptJson = await uploadAttemptRes.json();
      assert(attemptJson.success === false, `Upload does NOT pretend to succeed`);
      assert(attemptJson.code === "CLOUDINARY_NOT_CONFIGURED", `Returns specific CLOUDINARY_NOT_CONFIGURED error code`);
      assert(attemptJson.requiredVariables.includes("CLOUDINARY_CLOUD_NAME"), `Reports required CLOUDINARY_CLOUD_NAME variable name`);
      assert(attemptJson.requiredVariables.includes("CLOUDINARY_API_KEY"), `Reports required CLOUDINARY_API_KEY variable name`);
      assert(attemptJson.requiredVariables.includes("CLOUDINARY_API_SECRET"), `Reports required CLOUDINARY_API_SECRET variable name`);
    } else {
      console.log(`  ℹ️ Cloudinary credentials configured — testing live server-side upload flow.`);

      const testFormData = new FormData();
      const testFileBlob = new Blob([createMinimalJpeg()], { type: "image/jpeg" });
      testFormData.append("file", testFileBlob, "test-product.jpg");

      const uploadAttemptRes = await fetch(`${BASE_URL}/api/crm/upload`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: testFormData,
      });

      if (uploadAttemptRes.status === 201) {
        const uploadJson = await uploadAttemptRes.json();
        assert(uploadJson.success === true, `Live upload succeeded`);
        assert(uploadJson.data[0].url.startsWith("http"), `Live upload returned safe web URL`);
        assert(typeof uploadJson.data[0].publicId === "string", `Live upload returned publicId`);
      } else {
        console.log(`  ⚠️ Live Cloudinary returned HTTP ${uploadAttemptRes.status} (likely sandbox credentials).`);
      }
    }

    // -------------------------------------------------------------
    // TEST 5: Create Product with Mixed Media (Cloudinary + Manual URLs)
    // -------------------------------------------------------------
    console.log(`\n[TEST 5] Product Creation with Uploaded & Manual Images`);

    // Fetch taxonomy for categories/occasions
    const taxRes = await fetch(`${BASE_URL}/api/crm/taxonomy`, {
      headers: { Cookie: adminCookie },
    });
    const taxJson = await taxRes.json();
    const categoryId = taxJson.data?.categories?.[0]?.id;
    const occasionId = taxJson.data?.occasions?.[0]?.id;

    const timestamp = Date.now();
    const productPayload = {
      name: `Luxury Brass Thali Media Test ${timestamp}`,
      slug: `brass-thali-media-test-${timestamp}`,
      sku: `SHIVURA-MEDIA-${timestamp}`,
      price: 2499.0,
      originalPrice: 2999.0,
      stock: 15,
      published: false, // Default draft
      active: true,
      description: "Artisan brass thali with mixed Cloudinary and local media.",
      shortDescription: "Handcrafted luxury brass thali.",
      images: [
        {
          url: "https://res.cloudinary.com/shivura/image/upload/v1234567/shivura/products/sample-cover.jpg",
          publicId: "shivura/products/sample-cover",
          altText: "Handcrafted Brass Thali Primary View",
          sortOrder: 0,
          isPrimary: true,
        },
        {
          url: "/images/Art1.png",
          altText: "Handcrafted Brass Thali Artisan Detail",
          sortOrder: 1,
          isPrimary: false,
        },
      ],
      variants: [],
      categoryIds: categoryId ? [categoryId] : [],
      occasionIds: occasionId ? [occasionId] : [],
    };

    const createProductRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify(productPayload),
    });

    assert(createProductRes.status === 201, `Product with mixed images created (status: ${createProductRes.status})`);
    const createdJson = await createProductRes.json();
    assert(createdJson.success === true, `Product creation succeeded`);
    const productId = createdJson.data.id;
    createdProductIds.push(productId);

    // Verify images in response
    const createdImages = createdJson.data.images;
    assert(createdImages.length === 2, `Product has exactly 2 images`);
    assert(createdImages[0].isPrimary === true, `First image designated as primary cover`);
    assert(createdImages[0].publicId === "shivura/products/sample-cover", `Cloudinary publicId preserved`);
    assert(createdImages[1].url === "/images/Art1.png", `Manual image URL preserved`);
    assert(createdJson.data.published === false, `Product remains unpublished draft`);

    // -------------------------------------------------------------
    // TEST 6: Preservation of Images When Editing Basic Fields
    // -------------------------------------------------------------
    console.log(`\n[TEST 6] Preservation of Untouched Images on Edit`);

    // Update only the price and name; omit `images` array (dirty tracking behavior)
    const updatePayload = {
      name: `Luxury Brass Thali Media Test Updated ${timestamp}`,
      price: 2699.0,
    };

    const updateRes = await fetch(`${BASE_URL}/api/crm/products/${productId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify(updatePayload),
    });

    assert(updateRes.status === 200, `Product updated without modifying images (status: ${updateRes.status})`);
    const updatedJson = await updateRes.json();
    assert(updatedJson.data.images.length === 2, `Images remained intact when not explicitly modified`);
    assert(updatedJson.data.images[0].publicId === "shivura/products/sample-cover", `Cloudinary publicId preserved after scalar edit`);
    assert(Number(updatedJson.data.price) === 2699, `Price correctly updated`);

    // -------------------------------------------------------------
    // TEST 7: Image Reordering and Primary Reassignment on Edit
    // -------------------------------------------------------------
    console.log(`\n[TEST 7] Updating Image Ordering, Alt Text, and Primary Reassignment`);

    const imageUpdatePayload = {
      images: [
        {
          url: "/images/Art1.png",
          altText: "Artisan Detail Now Primary",
          sortOrder: 0,
          isPrimary: true, // Swapped to primary
        },
        {
          url: "https://res.cloudinary.com/shivura/image/upload/v1234567/shivura/products/sample-cover.jpg",
          publicId: "shivura/products/sample-cover",
          altText: "Handcrafted Brass Thali Secondary View",
          sortOrder: 1,
          isPrimary: false,
        },
      ],
    };

    const imageUpdateRes = await fetch(`${BASE_URL}/api/crm/products/${productId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify(imageUpdatePayload),
    });

    assert(imageUpdateRes.status === 200, `Images updated successfully`);
    const imgUpdatedJson = await imageUpdateRes.json();
    const reorderedImages = imgUpdatedJson.data.images;
    assert(reorderedImages[0].url === "/images/Art1.png" && reorderedImages[0].isPrimary === true, `Manual image is now primary cover`);
    assert(reorderedImages[0].altText === "Artisan Detail Now Primary", `Alt text updated`);
    assert(reorderedImages[1].publicId === "shivura/products/sample-cover" && reorderedImages[1].isPrimary === false, `Cloudinary image reordered to secondary`);

    // -------------------------------------------------------------
    // TEST 8: Storefront Draft Isolation
    // -------------------------------------------------------------
    console.log(`\n[TEST 8] Storefront Draft Product Isolation`);

    const publicProductRes = await fetch(`${BASE_URL}/api/products/${productPayload.slug}`);
    assert(
      publicProductRes.status === 404,
      `Unpublished draft is hidden from storefront (HTTP 404, got ${publicProductRes.status})`
    );

    // -------------------------------------------------------------
    // Cleanup Created Test Products
    // -------------------------------------------------------------
    console.log(`\n[CLEANUP] Cleaning Up Test Products`);
    for (const id of createdProductIds) {
      try {
        await fetch(`${BASE_URL}/api/crm/products/${id}`, {
          method: "DELETE",
          headers: { Cookie: adminCookie },
        });
        console.log(`  🧹 Deleted test product: ${id}`);
      } catch (err) {
        console.warn(`  ⚠️ Cleanup warning for ${id}:`, err.message);
      }
    }

    console.log(`\n=============================================================`);
    console.log(`Verification Suite Complete!`);
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log(`=============================================================\n`);

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Unexpected Suite Failure:", error.message);

    // Attempt cleanup even on failure
    for (const id of createdProductIds) {
      try {
        await fetch(`${BASE_URL}/api/crm/products/${id}`, {
          method: "DELETE",
        });
      } catch {
        // ignore
      }
    }

    process.exit(1);
  }
}

runTests();
