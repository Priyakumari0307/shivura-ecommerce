#!/usr/bin/env node

/**
 * Automated Verification Test Suite for Stage 6: Media Library
 *
 * Verifies:
 * 1. Route Protection & RBAC (401 & 403):
 *    - Unauthenticated GET /CRM/media redirects to /CRM/login
 *    - Unauthenticated GET /api/crm/media returns 401
 *    - Unauthenticated DELETE /api/crm/media returns 401
 *    - Customer account accessing /CRM/media returns 403 Forbidden layout
 *    - Customer account GET /api/crm/media returns 403 Forbidden
 *    - Customer account DELETE /api/crm/media returns 403 Forbidden
 * 2. Media Asset Listing & Metadata Extraction:
 *    - Admin GET /api/crm/media returns 200 OK
 *    - Cloudinary credentials verification (configured: true)
 *    - Authorized namespace enforcement (prefix: shivura/)
 *    - Metadata properties present: publicId, url, format, width, height, bytes, createdAt, fileName
 *    - Summary metrics present: totalAssets, inUseAssets, unusedAssets, totalBytes
 * 3. Search, Filtering, Sorting & Pagination:
 *    - Filter by in_use returns only items with inUse === true
 *    - Filter by unused returns only items with inUse === false
 *    - Keyword search filters filenames/publicIds
 *    - Pagination metadata and limit slicing
 * 4. Reusing Upload Flow (/api/crm/upload):
 *    - Uploads a test image using the existing protected /api/crm/upload endpoint
 *    - Confirms generated asset starts with shivura/
 *    - Confirms asset becomes available in /api/crm/media
 * 5. Safe Deletion & Reference Guard (Database Protection):
 *    - Attempting to delete an in-use image (linked to ProductImage) is BLOCKED with 409 Conflict
 *    - Response explains referencing products, categories, or occasions
 *    - Database records remain 100% intact and uncascaded
 *    - Attempting to delete an unused image succeeds with 200 OK
 *    - Attempting to delete without publicId returns 400 Bad Request
 *    - Attempting to delete assets outside shivura/ returns 403 Forbidden
 * 6. Storefront & Catalog Regression Check:
 *    - Public /api/products, /api/categories, and /api/occasions APIs remain intact
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shivura.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "shivura@2026";

let testsPassed = 0;
let testsFailed = 0;
const cleanupProductIds = [];
const cleanupImagePublicIds = [];
let adminCookieGlobal = "";

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

// Minimal binary generator for PNG upload testing
function createMinimalPng() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02,
    0x08, 0x02, 0x00, 0x00, 0x00, 0xfd, 0xd4, 0x9a, 0x73, 0x00, 0x00, 0x00,
    0x09, 0x70, 0x48, 0x59, 0x73, 0x00, 0x00, 0x0e, 0xc4, 0x00, 0x00, 0x0e,
    0xc4, 0x01, 0x95, 0x2b, 0x0e, 0x1b, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44,
    0x41, 0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01,
    0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

async function runTests() {
  console.log(`\n=============================================================`);
  console.log(`Starting Shivura CRM Stage 6 Media Library Test Suite`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  try {
    // -------------------------------------------------------------
    // Test 1: Route Protection & Admin Authorization (401 & 403)
    // -------------------------------------------------------------
    console.log(`[TEST 1] Route Protection & Admin Authorization`);

    // 1a. Unauthenticated page redirect
    const unauthPageRes = await fetch(`${BASE_URL}/CRM/media`, { redirect: "manual" });
    const pageLocation = unauthPageRes.headers.get("location") || "";
    assert(
      unauthPageRes.status === 307 || unauthPageRes.status === 302 || pageLocation.includes("/CRM/login"),
      `Unauthenticated GET /CRM/media redirects to /CRM/login (got ${unauthPageRes.status})`
    );

    // 1b. Unauthenticated API requests return 401
    const unauthGetMedia = await fetch(`${BASE_URL}/api/crm/media`);
    assert(unauthGetMedia.status === 401, `Unauthenticated GET /api/crm/media returns 401 (got ${unauthGetMedia.status})`);

    const unauthDeleteMedia = await fetch(`${BASE_URL}/api/crm/media?publicId=test`, {
      method: "DELETE",
    });
    assert(unauthDeleteMedia.status === 401, `Unauthenticated DELETE /api/crm/media returns 401 (got ${unauthDeleteMedia.status})`);

    // 1c. Customer accounts receive 403 Forbidden
    const customerEmail = "customer-stage6-tester@shivura-luxury.com";
    const customerPassword = "CustomerPass2026!";

    await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Stage 6 Customer Tester",
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

    let customerCookie = "";
    if (customerLoginRes.status === 200) {
      const custCookieHeader = customerLoginRes.headers.get("set-cookie") || "";
      const custMatch = custCookieHeader.match(/shivura_session=([^;]+)/);
      if (custMatch) customerCookie = custMatch[0];
    }
    assert(customerCookie.length > 0, "Customer session cookie obtained for 403 verification");

    const custPageRes = await fetch(`${BASE_URL}/CRM/media`, {
      headers: { Cookie: customerCookie },
    });
    assert(custPageRes.status === 200, "Customer accessing /CRM/media is caught by CRM portal layout");
    const custPageText = await custPageRes.text();
    assert(
      custPageText.includes("403 Forbidden") || custPageText.includes("Access Denied") || custPageText.includes("Customer Account Detected"),
      "Customer receives 403 Access Denied layout for /CRM/media"
    );

    const custGetMedia = await fetch(`${BASE_URL}/api/crm/media`, {
      headers: { Cookie: customerCookie },
    });
    assert(custGetMedia.status === 403, `Customer GET /api/crm/media returns 403 (got ${custGetMedia.status})`);

    const custDeleteMedia = await fetch(`${BASE_URL}/api/crm/media?publicId=test`, {
      method: "DELETE",
      headers: { Cookie: customerCookie },
    });
    assert(custDeleteMedia.status === 403, `Customer DELETE /api/crm/media returns 403 (got ${custDeleteMedia.status})`);

    // -------------------------------------------------------------
    // Test 2: Admin Authentication & Media Asset Listing
    // -------------------------------------------------------------
    console.log(`\n[TEST 2] Admin Authentication & Media Library API`);

    const adminLoginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
    });
    assert(adminLoginRes.status === 200, "Admin login succeeded");

    const adminSetCookie = adminLoginRes.headers.get("set-cookie") || "";
    const adminMatch = adminSetCookie.match(/shivura_session=([^;]+)/);
    assert(adminMatch !== null, "Admin session cookie obtained");
    const adminCookie = adminMatch[0];
    adminCookieGlobal = adminCookie;

    // 2a. Admin GET /api/crm/media
    const listMediaRes = await fetch(`${BASE_URL}/api/crm/media`, {
      headers: { Cookie: adminCookie },
    });
    assert(listMediaRes.status === 200, "Admin GET /api/crm/media returns 200 OK");
    const listMediaJson = await listMediaRes.json();
    assert(listMediaJson.success === true, "Media response success is true");
    assert(listMediaJson.configured === true, "Cloudinary configuration is active");
    assert(Array.isArray(listMediaJson.data), "Media response data is an array");
    assert(listMediaJson.pagination !== undefined, "Media response includes pagination metadata");
    assert(listMediaJson.summary !== undefined, "Media response includes summary statistics");
    assert(typeof listMediaJson.summary.totalAssets === "number", "summary.totalAssets is a number");
    assert(typeof listMediaJson.summary.inUseAssets === "number", "summary.inUseAssets is a number");
    assert(typeof listMediaJson.summary.unusedAssets === "number", "summary.unusedAssets is a number");
    assert(typeof listMediaJson.summary.totalBytes === "number", "summary.totalBytes is a number");

    console.log(`  📊 Found ${listMediaJson.summary.totalAssets} assets in Cloudinary (in-use: ${listMediaJson.summary.inUseAssets}, unused: ${listMediaJson.summary.unusedAssets})`);

    // Check individual asset shape
    if (listMediaJson.data.length > 0) {
      const sampleAsset = listMediaJson.data[0];
      assert(typeof sampleAsset.publicId === "string", "Asset publicId is string");
      assert(sampleAsset.publicId.startsWith("shivura"), "Asset belongs to authorized 'shivura' prefix");
      assert(typeof sampleAsset.url === "string", "Asset url is string");
      assert(typeof sampleAsset.format === "string", "Asset format is string");
      assert(typeof sampleAsset.width === "number", "Asset width is number");
      assert(typeof sampleAsset.height === "number", "Asset height is number");
      assert(typeof sampleAsset.bytes === "number", "Asset bytes is number");
      assert(typeof sampleAsset.inUse === "boolean", "Asset inUse is boolean");
      assert(typeof sampleAsset.references === "object", "Asset references object is present");
      assert(typeof sampleAsset.references.summaryText === "string", "Asset references.summaryText is string");
    }

    // -------------------------------------------------------------
    // Test 3: Search, Filtering, Sorting, and Pagination
    // -------------------------------------------------------------
    console.log(`\n[TEST 3] Search, Filtering, Sorting & Pagination`);

    // 3a. Filter in_use
    const inUseRes = await fetch(`${BASE_URL}/api/crm/media?filter=in_use`, {
      headers: { Cookie: adminCookie },
    });
    assert(inUseRes.status === 200, "GET /api/crm/media?filter=in_use returns 200 OK");
    const inUseJson = await inUseRes.json();
    const allInUse = inUseJson.data.every((item) => item.inUse === true);
    assert(allInUse, "filter=in_use returns exclusively in-use assets");

    // 3b. Filter unused
    const unusedRes = await fetch(`${BASE_URL}/api/crm/media?filter=unused`, {
      headers: { Cookie: adminCookie },
    });
    assert(unusedRes.status === 200, "GET /api/crm/media?filter=unused returns 200 OK");
    const unusedJson = await unusedRes.json();
    const allUnused = unusedJson.data.every((item) => item.inUse === false);
    assert(allUnused, "filter=unused returns exclusively unused assets");

    // 3c. Pagination limits
    const pagedRes = await fetch(`${BASE_URL}/api/crm/media?page=1&limit=5`, {
      headers: { Cookie: adminCookie },
    });
    assert(pagedRes.status === 200, "GET /api/crm/media?page=1&limit=5 returns 200 OK");
    const pagedJson = await pagedRes.json();
    assert(pagedJson.data.length <= 5, "Pagination limit=5 restricts page slice size");
    assert(pagedJson.pagination.limit === 5, "Pagination metadata reflects requested limit");

    // 3d. Sort by size_desc
    const sortRes = await fetch(`${BASE_URL}/api/crm/media?sort=size_desc`, {
      headers: { Cookie: adminCookie },
    });
    assert(sortRes.status === 200, "GET /api/crm/media?sort=size_desc returns 200 OK");
    const sortJson = await sortRes.json();
    if (sortJson.data.length >= 2) {
      assert(
        sortJson.data[0].bytes >= sortJson.data[1].bytes,
        "sort=size_desc correctly sorts largest assets first"
      );
    }

    // -------------------------------------------------------------
    // Test 4: Upload Flow Reusability (Reusing POST /api/crm/upload)
    // -------------------------------------------------------------
    console.log(`\n[TEST 4] Authenticated Upload Action via Existing /api/crm/upload`);

    const pngBuffer = createMinimalPng();
    const formData = new FormData();
    const pngBlob = new Blob([pngBuffer], { type: "image/png" });
    formData.append("file", pngBlob, `stage6-test-${Date.now()}.png`);

    const uploadRes = await fetch(`${BASE_URL}/api/crm/upload`, {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: formData,
    });
    assert(
      uploadRes.status === 200 || uploadRes.status === 201,
      `POST /api/crm/upload succeeded with 200/201 (got ${uploadRes.status})`
    );
    const uploadJson = await uploadRes.json();
    assert(uploadJson.success === true, "Upload response is success: true");
    assert(Array.isArray(uploadJson.data) && uploadJson.data.length > 0, "Upload response returned array of uploaded images");

    const uploadedItem = uploadJson.data[0];
    assert(Boolean(uploadedItem.publicId), "Upload response returned valid publicId");
    assert(uploadedItem.publicId.startsWith("shivura/"), "Uploaded asset stored in 'shivura/' namespace");
    assert(Boolean(uploadedItem.url), "Upload response returned secureUrl");

    const uploadedPublicId = uploadedItem.publicId;
    const uploadedUrl = uploadedItem.url;
    cleanupImagePublicIds.push(uploadedPublicId);

    console.log(`  Uploaded test asset: ${uploadedPublicId}`);

    // Verify the newly uploaded asset is immediately recognized as unused
    const checkFreshRes = await fetch(`${BASE_URL}/api/crm/media?search=${encodeURIComponent(uploadedPublicId.split("/").pop())}`, {
      headers: { Cookie: adminCookie },
    });
    assert(checkFreshRes.status === 200, "Search query finds newly uploaded asset");
    const checkFreshJson = await checkFreshRes.json();
    const foundFresh = checkFreshJson.data.find((item) => item.publicId === uploadedPublicId);
    assert(foundFresh !== undefined, "Newly uploaded asset found in media library listing");
    assert(foundFresh.inUse === false, "Newly uploaded asset is initially marked unused");

    // -------------------------------------------------------------
    // Test 5: Safe Deletion & Reference Guard (Database Protection)
    // -------------------------------------------------------------
    console.log(`\n[TEST 5] Safe Deletion & Reference Guard (Database Protection)`);

    // 5a. Block deletion without publicId (400)
    const missingIdRes = await fetch(`${BASE_URL}/api/crm/media`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert(missingIdRes.status === 400, `DELETE /api/crm/media without publicId returns 400 (got ${missingIdRes.status})`);

    // 5b. Block deletion outside shivura/ namespace (403)
    const outsideNsRes = await fetch(`${BASE_URL}/api/crm/media?publicId=sample_outside_folder`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert(outsideNsRes.status === 403, `DELETE asset outside shivura/ returns 403 (got ${outsideNsRes.status})`);

    // 5c. SCENARIO A: Block deletion when asset is IN USE by a Product
    console.log("  Testing reference guard: associating uploaded asset with test product via CRM API...");
    const testProductRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: `Stage 6 Test Royal Bell ${Date.now()}`,
        slug: `stage6-test-bell-${Date.now()}`,
        sku: `S6-BELL-${Date.now().toString().slice(-6)}`,
        price: 4999,
        stock: 10,
        published: true,
        images: [
          {
            url: uploadedUrl,
            publicId: uploadedPublicId,
            altText: "Stage 6 Reference Guard Test Image",
            isPrimary: true,
            sortOrder: 0,
          },
        ],
      }),
    });
    assert(testProductRes.status === 201, `Created test product referencing image (got ${testProductRes.status})`);
    const testProductJson = await testProductRes.json();
    const createdProduct = testProductJson.data;
    cleanupProductIds.push(createdProduct.id);

    // Now attempt to delete the referenced asset
    const blockedDeleteRes = await fetch(`${BASE_URL}/api/crm/media?publicId=${encodeURIComponent(uploadedPublicId)}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert(blockedDeleteRes.status === 409, `Attempt to delete in-use asset BLOCKED with 409 Conflict (got ${blockedDeleteRes.status})`);
    const blockedJson = await blockedDeleteRes.json();
    assert(blockedJson.code === "IMAGE_IN_USE", "Blocked response code is 'IMAGE_IN_USE'");
    assert(blockedJson.inUse === true, "Blocked response inUse flag is true");
    assert(blockedJson.references.products.length > 0, "Blocked response accurately identifies referencing product");
    assert(
      blockedJson.references.products[0].id === createdProduct.id,
      "Referencing product ID matches created test product"
    );
    assert(
      blockedJson.error.includes("broken images"),
      "Blocked response contains clear explanation preventing catalog breakage"
    );

    // Verify product record is still completely intact in CRM API
    const checkProdRes = await fetch(`${BASE_URL}/api/crm/products/${createdProduct.id}`, {
      headers: { Cookie: adminCookie },
    });
    assert(checkProdRes.status === 200, "Referencing product remains intact and unaffected");

    // 5d. SCENARIO B: Safe deletion of UNUSED asset
    console.log("  Deleting test product to make asset unused, then testing safe deletion...");
    const delProdRes = await fetch(`${BASE_URL}/api/crm/products/${createdProduct.id}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert(delProdRes.status === 200, "Cleaned up referencing product record");
    cleanupProductIds.pop();

    // Now asset is unused, deletion must succeed
    const safeDeleteRes = await fetch(`${BASE_URL}/api/crm/media?publicId=${encodeURIComponent(uploadedPublicId)}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert(safeDeleteRes.status === 200, `Deleting unused asset returns 200 OK (got ${safeDeleteRes.status})`);
    const safeDeleteJson = await safeDeleteRes.json();
    assert(safeDeleteJson.success === true, "Safe delete response success is true");
    assert(safeDeleteJson.publicId === uploadedPublicId, "Safe delete confirms deleted publicId");

    // Remove from cleanup list since successfully deleted from Cloudinary
    cleanupImagePublicIds.pop();

    // Verify asset is no longer returned in media library listing
    const verifyGoneRes = await fetch(`${BASE_URL}/api/crm/media?search=${encodeURIComponent(uploadedPublicId.split("/").pop())}`, {
      headers: { Cookie: adminCookie },
    });
    assert(verifyGoneRes.status === 200, "Media search after deletion returns 200 OK");
    const verifyGoneJson = await verifyGoneRes.json();
    const stillPresent = verifyGoneJson.data.some((item) => item.publicId === uploadedPublicId);
    assert(!stillPresent, "Deleted asset is no longer present in media library");

    // -------------------------------------------------------------
    // Test 6: Zero Regression on Storefront APIs
    // -------------------------------------------------------------
    console.log(`\n[TEST 6] Storefront APIs Regression Check`);

    const productsRes = await fetch(`${BASE_URL}/api/products`);
    assert(productsRes.status === 200, "Storefront /api/products returns 200 OK");

    const categoriesRes = await fetch(`${BASE_URL}/api/categories`);
    assert(categoriesRes.status === 200, "Storefront /api/categories returns 200 OK");

    const occasionsRes = await fetch(`${BASE_URL}/api/occasions`);
    assert(occasionsRes.status === 200, "Storefront /api/occasions returns 200 OK");

    console.log(`\n=============================================================`);
    console.log(`✅ STAGE 6 MEDIA LIBRARY VERIFICATION COMPLETED SUCCESSFULLY`);
    console.log(`Total assertions passed: ${testsPassed}`);
    console.log(`Total assertions failed: ${testsFailed}`);
    console.log(`=============================================================\n`);
  } catch (err) {
    console.error(`\n❌ Test suite failed with exception:`, err);
    testsFailed++;
  } finally {
    // Clean up any remaining test products
    if (cleanupProductIds.length > 0 && adminCookieGlobal) {
      console.log(`Cleaning up ${cleanupProductIds.length} test products...`);
      for (const id of cleanupProductIds) {
        try {
          await fetch(`${BASE_URL}/api/crm/products/${id}`, {
            method: "DELETE",
            headers: { Cookie: adminCookieGlobal },
          });
        } catch {}
      }
    }
  }

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
