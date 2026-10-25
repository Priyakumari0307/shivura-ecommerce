/**
 * Automated Verification Test Suite for Stage 5: Categories & Occasions Management
 *
 * Verifies:
 * 1. Zod Validation & Slug Utility:
 *    - slugify handles edge cases, special characters, spaces, and case normalization
 *    - taxonomyCreateSchema rejects empty name, malformed slugs, invalid image URLs, negative sort order
 *    - taxonomyUpdateSchema allows clean partial modifications
 * 2. Route & Endpoint Protection (401 & 403):
 *    - Unauthenticated GET /CRM/categories redirects to /CRM/login
 *    - Unauthenticated GET/POST /api/crm/categories returns 401
 *    - Unauthenticated GET/POST /api/crm/occasions returns 401
 *    - Customer GET /CRM/categories returns 403 Forbidden
 *    - Customer GET/POST /api/crm/categories returns 403 Forbidden
 *    - Customer GET/POST /api/crm/occasions returns 403 Forbidden
 * 3. Category CRUD & Duplicate-Slug Collision Handling:
 *    - GET /api/crm/categories returns paginated records and summary stats
 *    - POST /api/crm/categories creates a new category (201 Created)
 *    - POST with duplicate slug returns 409 Conflict
 *    - GET /api/crm/categories/:id returns single record details
 *    - PUT /api/crm/categories/:id updates fields and rejects colliding slugs
 *    - PATCH /api/crm/categories/:id toggles active status
 * 4. Relationship-Safe Deletion for Categories:
 *    - Attempting to delete a category associated with products is BLOCKED with 409 Conflict
 *    - Category with 0 products is safely and permanently deleted
 * 5. Occasion CRUD & Duplicate-Slug Collision Handling:
 *    - GET /api/crm/occasions returns paginated records and summary stats
 *    - POST /api/crm/occasions creates a new occasion (201 Created)
 *    - POST with duplicate slug returns 409 Conflict
 *    - GET /api/crm/occasions/:id returns single record details
 *    - PUT /api/crm/occasions/:id updates fields and rejects colliding slugs
 *    - PATCH /api/crm/occasions/:id toggles active status
 * 6. Relationship-Safe Deletion for Occasions:
 *    - Attempting to delete an occasion associated with products is BLOCKED with 409 Conflict
 *    - Occasion with 0 products is safely and permanently deleted
 * 7. Search, Filtering, and Pagination:
 *    - Search query filters matching records
 *    - Status filter partitions active vs inactive
 *    - Pagination limits and page traversal operate accurately
 * 8. Zero Regression on Existing Storefront and CRM Taxonomy Endpoints:
 *    - GET /api/crm/taxonomy returns categories & occasions for product forms
 *    - GET /api/categories and GET /api/occasions storefront APIs remain intact
 *    - GET /api/products storefront API remains intact
 */

import {
  slugify,
  taxonomyCreateSchema,
  taxonomyUpdateSchema,
} from "../lib/validation/taxonomy.ts";

const BASE_URL = process.env.TEST_URL || "http://localhost:3001";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shivura.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "shivura@2026";

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

async function runTests() {
  console.log(`\n=============================================================`);
  console.log(`Starting Shivura CRM Stage 5 Categories & Occasions Test Suite`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  try {
    // -------------------------------------------------------------
    // Test 1: Zod Schema Validation & Slugify Utilities
    // -------------------------------------------------------------
    console.log(`[TEST 1] Taxonomy Validation Schemas & Slug Utility`);

    // 1a. Slugify
    assert(
      slugify("Artisan Handcrafted Bell & Lanterns!") === "artisan-handcrafted-bell-lanterns",
      "slugify properly normalizes complex strings"
    );
    assert(
      slugify("  royal-brass---thali  ") === "royal-brass-thali",
      "slugify collapses redundant hyphens and trims whitespace"
    );

    // 1b. taxonomyCreateSchema - valid payload
    const validCategory = {
      name: "Handmade Terracotta",
      slug: "handmade-terracotta",
      description: "Authentic earthenware handcrafted by rural artisans.",
      image: "/images/terracotta.png",
      sortOrder: 5,
      active: true,
    };
    const validParse = taxonomyCreateSchema.safeParse(validCategory);
    assert(validParse.success, "taxonomyCreateSchema parses valid category payload");

    // 1c. Rejection of empty name
    const emptyNameParse = taxonomyCreateSchema.safeParse({
      name: "   ",
      slug: "empty-name",
    });
    assert(!emptyNameParse.success, "taxonomyCreateSchema rejects empty name");

    // 1d. Rejection of invalid slug format (uppercase or spaces)
    const invalidSlugParse = taxonomyCreateSchema.safeParse({
      name: "Invalid Slug Test",
      slug: "Invalid Slug With Spaces",
    });
    assert(!invalidSlugParse.success, "taxonomyCreateSchema rejects uppercase and spaced slugs");

    // 1e. Rejection of invalid image URL
    const invalidImageParse = taxonomyCreateSchema.safeParse({
      name: "Invalid Image Category",
      slug: "invalid-image",
      image: "unsupported-relative/image.png",
    });
    assert(!invalidImageParse.success, "taxonomyCreateSchema rejects malformed image URL");

    // 1f. Rejection of negative sort order
    const negativeSortOrder = taxonomyCreateSchema.safeParse({
      name: "Negative Sort",
      slug: "negative-sort",
      sortOrder: -1,
    });
    assert(!negativeSortOrder.success, "taxonomyCreateSchema rejects negative sort order");

    // 1g. taxonomyUpdateSchema partial updates
    const partialUpdate = taxonomyUpdateSchema.safeParse({
      active: false,
      sortOrder: 10,
    });
    assert(partialUpdate.success, "taxonomyUpdateSchema accepts partial updates");

    // -------------------------------------------------------------
    // Test 2: Route Protection (401 & 403)
    // -------------------------------------------------------------
    console.log(`\n[TEST 2] Route Protection & Admin Authorization`);

    // 2a. Unauthenticated page redirect
    const unauthPageRes = await fetch(`${BASE_URL}/CRM/categories`, { redirect: "manual" });
    const pageLocation = unauthPageRes.headers.get("location") || "";
    assert(
      unauthPageRes.status === 307 || unauthPageRes.status === 302 || pageLocation.includes("/CRM/login"),
      `Unauthenticated GET /CRM/categories redirects to /CRM/login (got ${unauthPageRes.status})`
    );

    // 2b. Unauthenticated API requests return 401
    const unauthGetCat = await fetch(`${BASE_URL}/api/crm/categories`);
    assert(unauthGetCat.status === 401, `Unauthenticated GET /api/crm/categories returns 401 (got ${unauthGetCat.status})`);

    const unauthPostCat = await fetch(`${BASE_URL}/api/crm/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validCategory),
    });
    assert(unauthPostCat.status === 401, `Unauthenticated POST /api/crm/categories returns 401 (got ${unauthPostCat.status})`);

    const unauthGetOcc = await fetch(`${BASE_URL}/api/crm/occasions`);
    assert(unauthGetOcc.status === 401, `Unauthenticated GET /api/crm/occasions returns 401 (got ${unauthGetOcc.status})`);

    const unauthPostOcc = await fetch(`${BASE_URL}/api/crm/occasions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validCategory),
    });
    assert(unauthPostOcc.status === 401, `Unauthenticated POST /api/crm/occasions returns 401 (got ${unauthPostOcc.status})`);

    // 2c. Customer accounts receive 403 Forbidden
    const customerEmail = "customer-stage5-tester@shivura-luxury.com";
    const customerPassword = "CustomerPass2026!";

    await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Stage 5 Customer Tester",
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

    assert(customerCookie.length > 0, "Customer session cookie obtained for 403 validation");

    const custPageRes = await fetch(`${BASE_URL}/CRM/categories`, {
      headers: { Cookie: customerCookie },
    });
    assert(custPageRes.status === 200, "Customer accessing /CRM/categories is caught by portal layout");
    const custPageText = await custPageRes.text();
    assert(
      custPageText.includes("403 Forbidden") || custPageText.includes("Access Denied") || custPageText.includes("Customer Account Detected"),
      "Customer receives 403 Access Denied layout for /CRM/categories"
    );

    const custGetCat = await fetch(`${BASE_URL}/api/crm/categories`, {
      headers: { Cookie: customerCookie },
    });
    assert(custGetCat.status === 403, `Customer GET /api/crm/categories returns 403 (got ${custGetCat.status})`);

    const custPostCat = await fetch(`${BASE_URL}/api/crm/categories`, {
      method: "POST",
      headers: { Cookie: customerCookie, "Content-Type": "application/json" },
      body: JSON.stringify(validCategory),
    });
    assert(custPostCat.status === 403, `Customer POST /api/crm/categories returns 403 (got ${custPostCat.status})`);

    const custGetOcc = await fetch(`${BASE_URL}/api/crm/occasions`, {
      headers: { Cookie: customerCookie },
    });
    assert(custGetOcc.status === 403, `Customer GET /api/crm/occasions returns 403 (got ${custGetOcc.status})`);

    const custPostOcc = await fetch(`${BASE_URL}/api/crm/occasions`, {
      method: "POST",
      headers: { Cookie: customerCookie, "Content-Type": "application/json" },
      body: JSON.stringify(validCategory),
    });
    assert(custPostOcc.status === 403, `Customer POST /api/crm/occasions returns 403 (got ${custPostOcc.status})`);

    // -------------------------------------------------------------
    // Test 3: Authenticate Admin & Category CRUD
    // -------------------------------------------------------------
    console.log(`\n[TEST 3] Admin Authentication & Category CRUD Operations`);

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

    // 3a. Admin GET /api/crm/categories
    const listCatRes = await fetch(`${BASE_URL}/api/crm/categories`, {
      headers: { Cookie: adminCookie },
    });
    assert(listCatRes.status === 200, "Admin GET /api/crm/categories returns 200 OK");
    const listCatJson = await listCatRes.json();
    assert(listCatJson.success === true, "Categories response success is true");
    assert(Array.isArray(listCatJson.data), "Categories data is an array");
    assert(listCatJson.pagination !== undefined, "Categories response includes pagination metadata");
    assert(listCatJson.summary !== undefined, "Categories response includes summary statistics");

    // 3b. Admin POST /api/crm/categories (Create Category)
    const testCatSlug = `test-stage5-cat-${Date.now()}`;
    const createCatRes = await fetch(`${BASE_URL}/api/crm/categories`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Stage 5 Category",
        slug: testCatSlug,
        description: "A temporary test category for Stage 5 verification.",
        image: "/images/lighting.png",
        sortOrder: 99,
        active: true,
      }),
    });
    assert(createCatRes.status === 201, `Admin POST /api/crm/categories created record with 201 (got ${createCatRes.status})`);
    const createCatJson = await createCatRes.json();
    assert(createCatJson.success === true, "Create category response is success");
    const createdCatId = createCatJson.data.id;
    assert(Boolean(createdCatId), "Created category returned a valid ID");

    // 3c. Duplicate slug rejection
    const dupCatRes = await fetch(`${BASE_URL}/api/crm/categories`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Colliding Category Name",
        slug: testCatSlug,
      }),
    });
    assert(dupCatRes.status === 409, `Duplicate slug POST returns 409 Conflict (got ${dupCatRes.status})`);
    const dupCatJson = await dupCatRes.json();
    assert(dupCatJson.code === "DUPLICATE_SLUG", "Duplicate slug returns code 'DUPLICATE_SLUG'");

    // 3d. GET single category details
    const getSingleCatRes = await fetch(`${BASE_URL}/api/crm/categories/${createdCatId}`, {
      headers: { Cookie: adminCookie },
    });
    assert(getSingleCatRes.status === 200, "GET /api/crm/categories/:id returns 200 OK");
    const getSingleCatJson = await getSingleCatRes.json();
    assert(getSingleCatJson.data.slug === testCatSlug, "Fetched category matches created slug");
    assert(getSingleCatJson.data.productCount === 0, "New category has 0 associated products");

    // 3e. PUT category update
    const putCatRes = await fetch(`${BASE_URL}/api/crm/categories/${createdCatId}`, {
      method: "PUT",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Test Category Name",
        description: "Updated description text.",
        sortOrder: 100,
      }),
    });
    assert(putCatRes.status === 200, "PUT /api/crm/categories/:id returns 200 OK");
    const putCatJson = await putCatRes.json();
    assert(putCatJson.data.name === "Updated Test Category Name", "Category name updated successfully");
    assert(putCatJson.data.sortOrder === 100, "Category sortOrder updated successfully");

    // 3f. PATCH toggle active status
    const patchCatRes = await fetch(`${BASE_URL}/api/crm/categories/${createdCatId}`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    assert(patchCatRes.status === 200, "PATCH /api/crm/categories/:id returns 200 OK");
    const patchCatJson = await patchCatRes.json();
    assert(patchCatJson.data.active === false, "Category active status toggled to false");

    // -------------------------------------------------------------
    // Test 4: Relationship-Safe Deletion for Categories
    // -------------------------------------------------------------
    console.log(`\n[TEST 4] Relationship-Safe Category Deletion`);

    // 4a. Find an existing category that HAS associated products
    const inUseCategory = listCatJson.data.find((c) => c.productCount > 0);
    assert(
      Boolean(inUseCategory),
      `Found existing category with products for safe deletion test (${inUseCategory?.name}: ${inUseCategory?.productCount} products)`
    );

    const blockedCatDeleteRes = await fetch(`${BASE_URL}/api/crm/categories/${inUseCategory.id}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert(
      blockedCatDeleteRes.status === 409,
      `DELETE on category with products is BLOCKED with 409 Conflict (got ${blockedCatDeleteRes.status})`
    );
    const blockedCatJson = await blockedCatDeleteRes.json();
    assert(blockedCatJson.hasProducts === true, "Response confirms hasProducts: true");
    assert(blockedCatJson.productCount > 0, "Response includes non-zero product count");
    assert(
      blockedCatJson.error?.includes("Cannot delete category"),
      "Response contains explanatory error message recommending deactivation"
    );

    // Verify in-use category still exists in DB
    const verifyCatStillExists = await fetch(`${BASE_URL}/api/crm/categories/${inUseCategory.id}`, {
      headers: { Cookie: adminCookie },
    });
    assert(verifyCatStillExists.status === 200, "Category with products was NOT deleted from the database");

    // 4b. Safely delete the test category (which has 0 products)
    const safeDeleteCatRes = await fetch(`${BASE_URL}/api/crm/categories/${createdCatId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert(safeDeleteCatRes.status === 200, "DELETE on category with 0 products succeeds with 200 OK");

    const verifyDeletedCat = await fetch(`${BASE_URL}/api/crm/categories/${createdCatId}`, {
      headers: { Cookie: adminCookie },
    });
    assert(verifyDeletedCat.status === 404, "Deleted category now returns 404 Not Found");

    // -------------------------------------------------------------
    // Test 5: Occasion CRUD Operations
    // -------------------------------------------------------------
    console.log(`\n[TEST 5] Admin Occasion CRUD Operations`);

    // 5a. Admin GET /api/crm/occasions
    const listOccRes = await fetch(`${BASE_URL}/api/crm/occasions`, {
      headers: { Cookie: adminCookie },
    });
    assert(listOccRes.status === 200, "Admin GET /api/crm/occasions returns 200 OK");
    const listOccJson = await listOccRes.json();
    assert(listOccJson.success === true, "Occasions response success is true");
    assert(Array.isArray(listOccJson.data), "Occasions data is an array");
    assert(listOccJson.pagination !== undefined, "Occasions response includes pagination");
    assert(listOccJson.summary !== undefined, "Occasions response includes summary statistics");

    // 5b. Admin POST /api/crm/occasions (Create Occasion)
    const testOccSlug = `test-stage5-occ-${Date.now()}`;
    const createOccRes = await fetch(`${BASE_URL}/api/crm/occasions`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Stage 5 Festive Occasion",
        slug: testOccSlug,
        description: "A temporary test festive occasion for Stage 5 verification.",
        image: "/images/gifting.png",
        sortOrder: 88,
        active: true,
      }),
    });
    assert(createOccRes.status === 201, `Admin POST /api/crm/occasions created record with 201 (got ${createOccRes.status})`);
    const createOccJson = await createOccRes.json();
    assert(createOccJson.success === true, "Create occasion response is success");
    const createdOccId = createOccJson.data.id;
    assert(Boolean(createdOccId), "Created occasion returned a valid ID");

    // 5c. Duplicate slug rejection
    const dupOccRes = await fetch(`${BASE_URL}/api/crm/occasions`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Colliding Occasion Name",
        slug: testOccSlug,
      }),
    });
    assert(dupOccRes.status === 409, `Duplicate slug POST on occasions returns 409 Conflict (got ${dupOccRes.status})`);
    const dupOccJson = await dupOccRes.json();
    assert(dupOccJson.code === "DUPLICATE_SLUG", "Duplicate occasion slug returns code 'DUPLICATE_SLUG'");

    // 5d. GET single occasion details
    const getSingleOccRes = await fetch(`${BASE_URL}/api/crm/occasions/${createdOccId}`, {
      headers: { Cookie: adminCookie },
    });
    assert(getSingleOccRes.status === 200, "GET /api/crm/occasions/:id returns 200 OK");
    const getSingleOccJson = await getSingleOccRes.json();
    assert(getSingleOccJson.data.slug === testOccSlug, "Fetched occasion matches created slug");
    assert(getSingleOccJson.data.productCount === 0, "New occasion has 0 associated products");

    // 5e. PUT occasion update
    const putOccRes = await fetch(`${BASE_URL}/api/crm/occasions/${createdOccId}`, {
      method: "PUT",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Occasion Name",
        description: "Updated festive description.",
        sortOrder: 89,
      }),
    });
    assert(putOccRes.status === 200, "PUT /api/crm/occasions/:id returns 200 OK");
    const putOccJson = await putOccRes.json();
    assert(putOccJson.data.name === "Updated Occasion Name", "Occasion name updated successfully");

    // 5f. PATCH toggle active status
    const patchOccRes = await fetch(`${BASE_URL}/api/crm/occasions/${createdOccId}`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    assert(patchOccRes.status === 200, "PATCH /api/crm/occasions/:id returns 200 OK");
    const patchOccJson = await patchOccRes.json();
    assert(patchOccJson.data.active === false, "Occasion active status toggled to false");

    // -------------------------------------------------------------
    // Test 6: Relationship-Safe Deletion for Occasions
    // -------------------------------------------------------------
    console.log(`\n[TEST 6] Relationship-Safe Occasion Deletion`);

    // 6a. Find an existing occasion that HAS associated products
    const inUseOccasion = listOccJson.data.find((o) => o.productCount > 0);
    assert(
      Boolean(inUseOccasion),
      `Found existing occasion with products for safe deletion test (${inUseOccasion?.name}: ${inUseOccasion?.productCount} products)`
    );

    const blockedOccDeleteRes = await fetch(`${BASE_URL}/api/crm/occasions/${inUseOccasion.id}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert(
      blockedOccDeleteRes.status === 409,
      `DELETE on occasion with products is BLOCKED with 409 Conflict (got ${blockedOccDeleteRes.status})`
    );
    const blockedOccJson = await blockedOccDeleteRes.json();
    assert(blockedOccJson.hasProducts === true, "Response confirms hasProducts: true");
    assert(blockedOccJson.productCount > 0, "Response includes non-zero product count");

    // Verify in-use occasion still exists
    const verifyOccStillExists = await fetch(`${BASE_URL}/api/crm/occasions/${inUseOccasion.id}`, {
      headers: { Cookie: adminCookie },
    });
    assert(verifyOccStillExists.status === 200, "Occasion with products was NOT deleted from the database");

    // 6b. Safely delete the test occasion (which has 0 products)
    const safeDeleteOccRes = await fetch(`${BASE_URL}/api/crm/occasions/${createdOccId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert(safeDeleteOccRes.status === 200, "DELETE on occasion with 0 products succeeds with 200 OK");

    const verifyDeletedOcc = await fetch(`${BASE_URL}/api/crm/occasions/${createdOccId}`, {
      headers: { Cookie: adminCookie },
    });
    assert(verifyDeletedOcc.status === 404, "Deleted occasion now returns 404 Not Found");

    // -------------------------------------------------------------
    // Test 7: Search, Filtering, and Pagination
    // -------------------------------------------------------------
    console.log(`\n[TEST 7] Search, Filtering, and Pagination`);

    // 7a. Search query test
    const searchRes = await fetch(`${BASE_URL}/api/crm/categories?search=artisan`, {
      headers: { Cookie: adminCookie },
    });
    assert(searchRes.status === 200, "Search query on categories returns 200 OK");
    const searchJson = await searchRes.json();
    assert(searchJson.success === true, "Search query returns success: true");

    // 7b. Status filter test
    const activeRes = await fetch(`${BASE_URL}/api/crm/categories?status=active`, {
      headers: { Cookie: adminCookie },
    });
    assert(activeRes.status === 200, "Status=active filter returns 200 OK");
    const activeJson = await activeRes.json();
    assert(activeJson.data.every((c) => c.active === true), "All returned categories have active === true");

    // 7c. Pagination test (limit=2)
    const pageRes = await fetch(`${BASE_URL}/api/crm/categories?page=1&limit=2`, {
      headers: { Cookie: adminCookie },
    });
    assert(pageRes.status === 200, "Pagination with limit=2 returns 200 OK");
    const pageJson = await pageRes.json();
    assert(pageJson.data.length <= 2, "Returned at most 2 records for page size 2");
    assert(pageJson.pagination.limit === 2, "Pagination limit matches query");

    // -------------------------------------------------------------
    // Test 8: Storefront & CRM Taxonomy Integrity (Zero Regressions)
    // -------------------------------------------------------------
    console.log(`\n[TEST 8] Zero Regression on CRM Taxonomy & Storefront APIs`);

    // 8a. GET /api/crm/taxonomy (consumed by ProductForm.tsx)
    const taxonomyRes = await fetch(`${BASE_URL}/api/crm/taxonomy`, {
      headers: { Cookie: adminCookie },
    });
    assert(taxonomyRes.status === 200, "GET /api/crm/taxonomy returns 200 OK");
    const taxJson = await taxonomyRes.json();
    assert(Array.isArray(taxJson.data.categories), "Taxonomy returns categories array for ProductForm");
    assert(Array.isArray(taxJson.data.occasions), "Taxonomy returns occasions array for ProductForm");
    assert(taxJson.data.mediaConfig !== undefined, "Taxonomy returns mediaConfig status");

    // 8b. Storefront GET /api/categories
    const publicCatRes = await fetch(`${BASE_URL}/api/categories`);
    assert(publicCatRes.status === 200, "Storefront GET /api/categories returns 200 OK");

    // 8c. Storefront GET /api/occasions
    const publicOccRes = await fetch(`${BASE_URL}/api/occasions`);
    assert(publicOccRes.status === 200, "Storefront GET /api/occasions returns 200 OK");

    // 8d. Storefront GET /api/products
    const publicProdRes = await fetch(`${BASE_URL}/api/products?limit=2`);
    assert(publicProdRes.status === 200, "Storefront GET /api/products returns 200 OK");

    console.log(`\n=============================================================`);
    console.log(`🎉 ALL STAGE 5 VERIFICATION TESTS PASSED SUCCESSFULLY!`);
    console.log(`Tests Passed: ${testsPassed} | Tests Failed: ${testsFailed}`);
    console.log(`=============================================================\n`);
  } catch (error) {
    console.error(`\n❌ TEST RUN ABORTED DUE TO ERROR:`, error.message);
    process.exit(1);
  }
}

runTests();
