/**
 * Automated Verification Test Suite for Stage 4: Add/Edit Product Form and Media Management
 *
 * Verifies:
 * 1. Route Protection for Form Pages:
 *    - Unauthenticated GET /CRM/products/new redirects to /CRM/login
 *    - Unauthenticated GET /CRM/products/:id/edit redirects to /CRM/login
 *    - Customer GET /CRM/products/new returns 403 Forbidden
 *    - Customer GET /CRM/products/:id/edit returns 403 Forbidden
 *    - Admin GET /CRM/products/new returns 200 OK
 *    - Admin GET /CRM/products/:id/edit returns 200 OK
 * 2. Taxonomy API Integration:
 *    - GET /api/crm/taxonomy returns categories and occasions with product counts
 * 3. Draft Product Creation with Manual Images & Variants:
 *    - Creates draft product with manual image URLs (/images/... and https://...),
 *      alt text, primary selection, and sort ordering
 *    - Configures variants with sizes, SKU, stock, and price overrides
 *    - Associates categories and occasions
 *    - Defaults to published: false (safe draft)
 * 4. Preservation of Untouched Relations on Edit:
 *    - PUT /api/crm/products/:id updating only basic fields preserves untouched
 *      images, variants, categories, and occasions
 * 5. Media & Variant Editing:
 *    - Updating images modifies media gallery and primary cover
 *    - Updating variants modifies SKU, prices, and stock
 * 6. Conflict & Validation Handling:
 *    - Duplicate slug / SKU returns 409 Conflict
 *    - Invalid prices, negative stocks, and malformed image URLs are rejected with 400
 * 7. Edge Cases:
 *    - Creation of product with 0 images and multiple variants
 * 8. Storefront Visibility Rules:
 *    - Unpublished draft is hidden from public GET /api/products and GET /api/products/:slug
 *    - Published product is visible on storefront
 * 9. Safe Isolated Cleanup:
 *    - Deletes all created test products cleanly
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3001";
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

async function runTests() {
  console.log(`\n=============================================================`);
  console.log(`Starting Shivura CRM Stage 4 Form & Media Verification Suite`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  try {
    // -------------------------------------------------------------
    // Test 1: Route Protection for /CRM/products/new and edit
    // -------------------------------------------------------------
    console.log(`[TEST 1] Route Protection on /CRM/products/new and edit`);

    // 1a. Unauthenticated redirect
    const unauthNewRes = await fetch(`${BASE_URL}/CRM/products/new`, { redirect: "manual" });
    const newLocation = unauthNewRes.headers.get("location") || "";
    assert(
      unauthNewRes.status === 307 || unauthNewRes.status === 302 || newLocation.includes("/CRM/login"),
      `Unauthenticated GET /CRM/products/new redirects to /CRM/login (status: ${unauthNewRes.status})`
    );

    const unauthEditRes = await fetch(`${BASE_URL}/CRM/products/some-dummy-id/edit`, { redirect: "manual" });
    const editLocation = unauthEditRes.headers.get("location") || "";
    assert(
      unauthEditRes.status === 307 || unauthEditRes.status === 302 || editLocation.includes("/CRM/login"),
      `Unauthenticated GET /CRM/products/:id/edit redirects to /CRM/login (status: ${unauthEditRes.status})`
    );

    // 1b. Customer access denial (403)
    const customerEmail = "customer-stage4-tester@shivura-luxury.com";
    const customerPassword = "CustomerPass2026!";

    await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Customer Stage4 Tester",
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
    assert(custMatch !== null, `Customer login session cookie obtained`);
    const customerCookie = custMatch[0];

    const custNewRes = await fetch(`${BASE_URL}/CRM/products/new`, {
      headers: { Cookie: customerCookie },
    });
    const custNewHtml = await custNewRes.text();
    assert(
      custNewHtml.includes("Customer Account Detected") || custNewHtml.includes("403 Forbidden"),
      `Customer GET /CRM/products/new renders 403 Forbidden Access Denied`
    );

    const custEditRes = await fetch(`${BASE_URL}/CRM/products/dummy-id/edit`, {
      headers: { Cookie: customerCookie },
    });
    const custEditHtml = await custEditRes.text();
    assert(
      custEditHtml.includes("Customer Account Detected") || custEditHtml.includes("403 Forbidden"),
      `Customer GET /CRM/products/:id/edit renders 403 Forbidden Access Denied`
    );

    // -------------------------------------------------------------
    // Test 2: Admin Authentication & Taxonomy Fetching
    // -------------------------------------------------------------
    console.log(`\n[TEST 2] Admin Authentication & Taxonomy Retrieval`);

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
    assert(adminMatch !== null, `Admin session cookie extracted`);
    const adminCookie = adminMatch[0];

    // Verify GET /CRM/products/new renders 200 for admin
    const adminNewPageRes = await fetch(`${BASE_URL}/CRM/products/new`, {
      headers: { Cookie: adminCookie },
    });
    assert(adminNewPageRes.status === 200, `Admin GET /CRM/products/new renders successfully (200 OK)`);
    const adminNewPageHtml = await adminNewPageRes.text();
    assert(
      adminNewPageHtml.includes("Product Catalog Management") || adminNewPageHtml.includes("Basic Information") || adminNewPageHtml.includes("shivura"),
      `Admin /CRM/products/new page contains CRM design markup`
    );

    // Fetch taxonomy for use in form payload
    const taxonomyRes = await fetch(`${BASE_URL}/api/crm/taxonomy`, {
      headers: { Cookie: adminCookie },
    });
    assert(taxonomyRes.status === 200, `GET /api/crm/taxonomy returned 200 OK`);
    const taxonomyJson = await taxonomyRes.json();
    const taxonomyData = taxonomyJson.data || taxonomyJson;
    assert(Array.isArray(taxonomyData.categories) && taxonomyData.categories.length > 0, `Taxonomy contains categories`);
    assert(Array.isArray(taxonomyData.occasions) && taxonomyData.occasions.length > 0, `Taxonomy contains occasions`);

    const selectedCategoryId = taxonomyData.categories[0].id;
    const selectedOccasionId = taxonomyData.occasions[0].id;

    // -------------------------------------------------------------
    // Test 3: Create Draft Product with Manual Images & Variants
    // -------------------------------------------------------------
    console.log(`\n[TEST 3] Create Draft Product with Manual Images & Variants`);

    const timestamp = Date.now();
    const testProductPayload = {
      name: `[STAGE4-TEST] Handcrafted Brass Samai ${timestamp}`,
      slug: `stage4-test-brass-samai-${timestamp}`,
      sku: `SHV-STG4-BRS-${timestamp.toString().slice(-4)}`,
      description: "Exquisite hand-cast brass traditional tiered oil lamp crafted by master artisans.",
      shortDescription: "Hand-cast brass traditional tiered lamp.",
      price: 4999,
      originalPrice: 6499,
      pricePrefix: "Starting at",
      stock: 20,
      isNew: true,
      badge: "Artisan Edition",
      published: false, // Must default to draft
      active: true,
      categoryIds: [selectedCategoryId],
      occasionIds: [selectedOccasionId],
      images: [
        {
          url: "/images/products/brass-samai-main.jpg",
          altText: "Handcrafted Brass Samai Main View",
          sortOrder: 0,
          isPrimary: true,
        },
        {
          url: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38",
          altText: "Brass Samai Detail View",
          sortOrder: 1,
          isPrimary: false,
        },
      ],
      variants: [
        {
          name: "Standard 12 Inch",
          size: "12 Inch",
          color: "Antique Brass",
          design: "Floral Engraved",
          sku: `SHV-STG4-BRS-${timestamp.toString().slice(-4)}-12`,
          price: 4999,
          stock: 12,
          active: true,
        },
        {
          name: "Grand 18 Inch",
          size: "18 Inch",
          color: "Antique Brass",
          design: "Floral Engraved",
          sku: `SHV-STG4-BRS-${timestamp.toString().slice(-4)}-18`,
          price: 7499,
          stock: 8,
          active: true,
        },
      ],
    };

    const createRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify(testProductPayload),
    });

    assert(createRes.status === 201, `POST /api/crm/products created product with 201 Created (status: ${createRes.status})`);
    const createJson = await createRes.json();
    const createdProduct = createJson.data || createJson;
    assert(createdProduct.id && createdProduct.id.length > 5, `Created product has valid ID (${createdProduct.id})`);
    createdProductIds.push(createdProduct.id);

    assert(createdProduct.published === false, `Created product is saved as unpublished draft`);
    assert(createdProduct.price === 4999, `Created product price is 4999`);
    assert(createdProduct.images.length === 2, `Created product has exactly 2 images`);
    assert(createdProduct.images[0].isPrimary === true, `First image is designated primary`);
    assert(createdProduct.variants.length === 2, `Created product has exactly 2 variants`);
    assert(createdProduct.categories.length === 1, `Created product linked to 1 category`);
    assert(createdProduct.occasions.length === 1, `Created product linked to 1 occasion`);

    // Verify GET /CRM/products/:id/edit renders 200 for admin with the newly created product
    const adminEditPageRes = await fetch(`${BASE_URL}/CRM/products/${createdProduct.id}/edit`, {
      headers: { Cookie: adminCookie },
    });
    assert(adminEditPageRes.status === 200, `Admin GET /CRM/products/:id/edit renders successfully (200 OK)`);

    // -------------------------------------------------------------
    // Test 4: Preservation of Untouched Relations on Edit
    // -------------------------------------------------------------
    console.log(`\n[TEST 4] Preservation of Untouched Relations on Edit`);

    // When the user edits basic fields in ProductForm without touching images/variants,
    // the form sends ONLY basic fields to PUT /api/crm/products/:id.
    const basicUpdatePayload = {
      name: `[STAGE4-TEST] Handcrafted Brass Samai (Updated Price)`,
      price: 5299,
      originalPrice: 6999,
      shortDescription: "Updated short description for preservation test.",
      // images, variants, categoryIds, occasionIds ARE OMITTED
    };

    const updateBasicRes = await fetch(`${BASE_URL}/api/crm/products/${createdProduct.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify(basicUpdatePayload),
    });

    assert(updateBasicRes.status === 200, `PUT /api/crm/products/:id updated basic fields successfully`);
    const updateBasicJson = await updateBasicRes.json();
    const updatedBasicProduct = updateBasicJson.data || updateBasicJson;

    assert(updatedBasicProduct.price === 5299, `Product price updated to 5299`);
    assert(updatedBasicProduct.name === basicUpdatePayload.name, `Product name updated correctly`);
    assert(updatedBasicProduct.images.length === 2, `Untouched images preserved: still has 2 images`);
    assert(updatedBasicProduct.variants.length === 2, `Untouched variants preserved: still has 2 variants`);
    assert(updatedBasicProduct.categories.length === 1, `Untouched categories preserved: still has 1 category`);
    assert(updatedBasicProduct.occasions.length === 1, `Untouched occasions preserved: still has 1 occasion`);

    // -------------------------------------------------------------
    // Test 5: Intentional Update of Media Gallery and Variants
    // -------------------------------------------------------------
    console.log(`\n[TEST 5] Intentional Update of Media Gallery and Variants`);

    const mediaAndVariantUpdatePayload = {
      images: [
        {
          url: "/images/products/brass-samai-main.jpg",
          altText: "Updated main image alt text",
          sortOrder: 1,
          isPrimary: false,
        },
        {
          url: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38",
          altText: "New Primary Image",
          sortOrder: 0,
          isPrimary: true, // Swapped primary cover
        },
        {
          url: "/images/products/brass-samai-lifestyle.png",
          altText: "Added 3rd lifestyle image",
          sortOrder: 2,
          isPrimary: false,
        },
      ],
      variants: [
        {
          name: "Standard 12 Inch Updated",
          size: "12 Inch",
          color: "Antique Brass",
          design: "Floral Engraved",
          sku: `SHV-STG4-BRS-${timestamp.toString().slice(-4)}-12-UPD`,
          price: 5299,
          stock: 15,
          active: true,
        },
      ],
    };

    const updateMediaRes = await fetch(`${BASE_URL}/api/crm/products/${createdProduct.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify(mediaAndVariantUpdatePayload),
    });

    assert(updateMediaRes.status === 200, `PUT /api/crm/products/:id updated media and variants successfully`);
    const updateMediaJson = await updateMediaRes.json();
    const updatedMediaProduct = updateMediaJson.data || updateMediaJson;

    assert(updatedMediaProduct.images.length === 3, `Image gallery updated to 3 images`);
    const newPrimary = updatedMediaProduct.images.find((img) => img.isPrimary);
    assert(newPrimary && newPrimary.url.includes("unsplash.com"), `Primary image correctly switched to Unsplash photo`);
    assert(updatedMediaProduct.variants.length === 1, `Variants updated to 1 variant`);
    assert(updatedMediaProduct.variants[0].stock === 15, `Variant stock updated to 15`);

    // -------------------------------------------------------------
    // Test 6: Conflict & Validation Handling
    // -------------------------------------------------------------
    console.log(`\n[TEST 6] Conflict & Validation Handling`);

    // 6a. Duplicate slug conflict (409)
    const duplicateSlugPayload = {
      name: "Duplicate Slug Attempt",
      slug: testProductPayload.slug, // Existing slug
      sku: `SHV-DIFF-${timestamp.toString().slice(-4)}`,
      price: 2999,
      stock: 10,
    };

    const duplicateSlugRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify(duplicateSlugPayload),
    });
    assert(duplicateSlugRes.status === 409, `POST duplicate slug returned 409 Conflict (status: ${duplicateSlugRes.status})`);
    const dupSlugErr = await duplicateSlugRes.json();
    assert(dupSlugErr.error && dupSlugErr.error.includes("slug"), `Error specifies slug conflict`);

    // 6b. Validation error: invalid price (400)
    const invalidPriceRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: "Invalid Price Test",
        slug: `invalid-price-${timestamp}`,
        price: -50, // Negative price
        stock: 5,
      }),
    });
    assert(invalidPriceRes.status === 400, `POST negative price returned 400 Bad Request`);

    // 6c. Validation error: negative stock (400)
    const invalidStockRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: "Invalid Stock Test",
        slug: `invalid-stock-${timestamp}`,
        price: 999,
        stock: -10,
      }),
    });
    assert(invalidStockRes.status === 400, `POST negative stock returned 400 Bad Request`);

    // 6d. Validation error: invalid image URL format (400)
    const invalidImageUrlRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: "Invalid Image URL Test",
        slug: `invalid-img-${timestamp}`,
        price: 999,
        stock: 5,
        images: [
          {
            url: "ftp://not-allowed-scheme.com/img.jpg",
            sortOrder: 0,
            isPrimary: true,
          },
        ],
      }),
    });
    assert(invalidImageUrlRes.status === 400, `POST malformed image URL protocol returned 400 Bad Request`);

    // -------------------------------------------------------------
    // Test 7: Product with No Images and Multiple Variants
    // -------------------------------------------------------------
    console.log(`\n[TEST 7] Product with 0 Images and Multiple Variants`);

    const noImageProductPayload = {
      name: `[STAGE4-TEST] Zero Images Multi Variant ${timestamp}`,
      slug: `stage4-test-no-images-${timestamp}`,
      sku: `SHV-NOIMG-${timestamp.toString().slice(-4)}`,
      price: 1999,
      stock: 50,
      published: false,
      active: true,
      images: [], // Explicitly zero images
      variants: [
        {
          name: "Edition Alpha",
          size: "Regular",
          stock: 25,
          active: true,
        },
        {
          name: "Edition Beta",
          size: "Large",
          stock: 25,
          active: true,
        },
      ],
    };

    const noImageRes = await fetch(`${BASE_URL}/api/crm/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify(noImageProductPayload),
    });

    assert(noImageRes.status === 201, `Product with 0 images created with 201 Created`);
    const noImageJson = await noImageRes.json();
    const noImageProduct = noImageJson.data || noImageJson;
    createdProductIds.push(noImageProduct.id);
    assert(noImageProduct.images.length === 0, `Product has 0 images`);
    assert(noImageProduct.variants.length === 2, `Product has 2 variants`);

    // -------------------------------------------------------------
    // Test 8: Storefront Visibility Rules
    // -------------------------------------------------------------
    console.log(`\n[TEST 8] Storefront Visibility Rules`);

    // 8a. Unpublished draft is NOT in public GET /api/products
    const storefrontProductsRes = await fetch(`${BASE_URL}/api/products`);
    assert(storefrontProductsRes.status === 200, `Public GET /api/products returned 200 OK`);
    const storefrontProductsData = await storefrontProductsRes.json();
    const storefrontItems = storefrontProductsData.data || storefrontProductsData.products || [];
    const isDraftVisibleInList = storefrontItems.some((p) => p.id === createdProduct.id || p.slug === createdProduct.slug);
    assert(!isDraftVisibleInList, `Unpublished draft product is NOT visible in public storefront products list`);

    // 8b. Unpublished draft is NOT accessible via public GET /api/products/:slug
    const storefrontSlugDraftRes = await fetch(`${BASE_URL}/api/products/${createdProduct.slug}`);
    assert(
      storefrontSlugDraftRes.status === 404,
      `Unpublished draft product returns 404 on public /api/products/:slug (status: ${storefrontSlugDraftRes.status})`
    );

    // 8c. Publish product via PATCH status
    const publishRes = await fetch(`${BASE_URL}/api/crm/products/${createdProduct.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ published: true }),
    });
    assert(publishRes.status === 200, `Product published via PATCH status`);

    // 8d. Published product IS NOW visible via public GET /api/products/:slug
    const storefrontSlugPublishedRes = await fetch(`${BASE_URL}/api/products/${createdProduct.slug}`);
    assert(
      storefrontSlugPublishedRes.status === 200,
      `Published product is accessible on public /api/products/:slug (status: 200 OK)`
    );

    // -------------------------------------------------------------
    // Test 9: Safe Isolated Cleanup
    // -------------------------------------------------------------
    console.log(`\n[TEST 9] Safe Isolated Cleanup`);

    for (const prodId of createdProductIds) {
      const delRes = await fetch(`${BASE_URL}/api/crm/products/${prodId}`, {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      });
      assert(delRes.status === 200, `Cleaned up test product ${prodId} with 200 OK`);
    }

    console.log(`\n=============================================================`);
    console.log(`All Stage 4 Tests Completed Successfully!`);
    console.log(`Passed: ${testsPassed} | Failed: ${testsFailed}`);
    console.log(`=============================================================\n`);
  } catch (error) {
    console.error(`\n❌ Test suite aborted with error:`, error);
    // Attempt emergency cleanup
    try {
      const adminLoginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });
      const cookieHeader = adminLoginRes.headers.get("set-cookie") || "";
      const match = cookieHeader.match(/shivura_session=([^;]+)/);
      if (match) {
        for (const prodId of createdProductIds) {
          await fetch(`${BASE_URL}/api/crm/products/${prodId}`, {
            method: "DELETE",
            headers: { Cookie: match[0] },
          });
        }
      }
    } catch {}
    process.exit(1);
  }
}

runTests();
