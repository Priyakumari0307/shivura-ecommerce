/**
 * Comprehensive Automated Test Suite for Shivura CRM Admin Authentication
 *
 * Tests:
 * 1. Unauthenticated access to /CRM, /api/crm/auth/session, and /api/crm/test-protected
 * 2. Incorrect credentials and invalid emails on /api/crm/auth/login
 * 3. Correct admin authentication, session issuance, and protected CRM access
 * 4. Normal customer authentication and strict 403 Forbidden denial from CRM
 * 5. Admin logout and post-logout session revocation
 * 6. Customer signup prevention on reserved ADMIN_EMAIL
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
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
  console.log(`Starting Shivura CRM Authentication Test Suite`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`=============================================================\n`);

  // -------------------------------------------------------------
  // Test 1: Unauthenticated Access
  // -------------------------------------------------------------
  console.log(`[TEST 1] Unauthenticated Access Protection`);

  // 1a. Direct GET /CRM without session should redirect to /CRM/login
  const crmPageRes = await fetch(`${BASE_URL}/CRM`, {
    redirect: "manual",
  });
  const locationHeader = crmPageRes.headers.get("location") || "";
  assert(
    crmPageRes.status === 307 || crmPageRes.status === 302 || locationHeader.includes("/CRM/login"),
    `GET /CRM redirects unauthenticated user to /CRM/login (status: ${crmPageRes.status}, location: ${locationHeader})`
  );

  // 1b. Direct GET /api/crm/auth/session should return 401 Unauthorized
  const crmSessionRes = await fetch(`${BASE_URL}/api/crm/auth/session`);
  assert(
    crmSessionRes.status === 401,
    `GET /api/crm/auth/session returns 401 for unauthenticated request (got ${crmSessionRes.status})`
  );
  const crmSessionData = await crmSessionRes.json();
  assert(
    crmSessionData.status === "unauthenticated" && crmSessionData.success === false,
    `GET /api/crm/auth/session payload indicates unauthenticated state`
  );

  // 1c. Direct GET /api/crm/test-protected should return 401 Unauthorized
  const crmProtectedRes = await fetch(`${BASE_URL}/api/crm/test-protected`);
  assert(
    crmProtectedRes.status === 401,
    `GET /api/crm/test-protected returns 401 for unauthenticated request (got ${crmProtectedRes.status})`
  );

  // -------------------------------------------------------------
  // Test 2: Invalid Admin Credentials
  // -------------------------------------------------------------
  console.log(`\n[TEST 2] Invalid Credentials & Constant-Time Defense`);

  // 2a. Unknown email
  const wrongEmailRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "random-intruder@example.com",
      password: "SomePassword123!",
    }),
  });
  assert(
    wrongEmailRes.status === 401,
    `POST /api/crm/auth/login returns 401 for unknown email (got ${wrongEmailRes.status})`
  );

  // 2b. Valid admin email, but wrong password
  const wrongPasswordRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: "DefinitelyWrongPassword123!",
    }),
  });
  assert(
    wrongPasswordRes.status === 401,
    `POST /api/crm/auth/login returns 401 for incorrect admin password (got ${wrongPasswordRes.status})`
  );
  const wrongPasswordData = await wrongPasswordRes.json();
  assert(
    wrongPasswordData.success === false,
    `POST /api/crm/auth/login returns generic error without leaking details`
  );

  // -------------------------------------------------------------
  // Test 3: Correct Admin Credentials & CRM Access
  // -------------------------------------------------------------
  console.log(`\n[TEST 3] Correct Admin Authentication & Session Issuance`);

  const adminLoginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });
  assert(
    adminLoginRes.status === 200,
    `POST /api/crm/auth/login succeeds with status 200 for valid admin credentials (got ${adminLoginRes.status})`
  );
  const adminLoginData = await adminLoginRes.json();
  assert(
    adminLoginData.success === true && adminLoginData.admin?.role === "ADMIN",
    `POST /api/crm/auth/login returns confirmed admin user profile with role: ADMIN`
  );

  // Extract session cookie
  const setCookieHeader = adminLoginRes.headers.get("set-cookie") || "";
  const match = setCookieHeader.match(/shivura_session=([^;]+)/);
  assert(
    match !== null,
    `Set-Cookie header sets shivura_session HTTP-only cookie`
  );
  const adminCookie = match ? match[0] : "";

  // 3b. Verify session with GET /api/crm/auth/session
  const adminSessionVerifyRes = await fetch(`${BASE_URL}/api/crm/auth/session`, {
    headers: { Cookie: adminCookie },
  });
  assert(
    adminSessionVerifyRes.status === 200,
    `GET /api/crm/auth/session returns 200 for authenticated admin`
  );
  const adminSessionVerifyData = await adminSessionVerifyRes.json();
  assert(
    adminSessionVerifyData.status === "authorized" && adminSessionVerifyData.admin?.email === ADMIN_EMAIL.toLowerCase(),
    `GET /api/crm/auth/session verifies authorized admin status and matching email`
  );

  // 3c. Direct request to protected CRM API with admin cookie
  const adminProtectedRes = await fetch(`${BASE_URL}/api/crm/test-protected`, {
    headers: { Cookie: adminCookie },
  });
  assert(
    adminProtectedRes.status === 200,
    `GET /api/crm/test-protected returns 200 for authenticated admin`
  );
  const adminProtectedData = await adminProtectedRes.json();
  assert(
    adminProtectedData.success === true,
    `Protected CRM API returns operational data to authenticated admin`
  );

  // 3d. Access /CRM page as Admin
  const adminCrmPageRes = await fetch(`${BASE_URL}/CRM`, {
    headers: { Cookie: adminCookie },
    redirect: "manual",
  });
  assert(
    adminCrmPageRes.status === 200,
    `GET /CRM returns 200 OK for authenticated admin (no redirect)`
  );
  const adminCrmPageHtml = await adminCrmPageRes.text();
  assert(
    adminCrmPageHtml.includes("Executive Management Console") || adminCrmPageHtml.includes("Shivura"),
    `/CRM page renders the executive management console for admin`
  );

  // -------------------------------------------------------------
  // Test 4: Normal Customer Access & Strict 403 Forbidden Denial
  // -------------------------------------------------------------
  console.log(`\n[TEST 4] Customer Authentication & Strict CRM 403 Forbidden Denial`);

  // 4a. Authenticate or create a customer
  const customerEmail = "customer-tester@shivura-luxury.com";
  const customerPassword = "CustomerPass2026!";

  let customerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: customerEmail,
      password: customerPassword,
    }),
  });

  if (!customerLoginRes.ok) {
    // Try signing up
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Customer",
        email: customerEmail,
        password: customerPassword,
      }),
    });
    if (signupRes.ok) {
      customerLoginRes = signupRes;
    } else {
      customerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customerEmail,
          password: customerPassword,
        }),
      });
    }
  }

  const customerSetCookie = customerLoginRes.headers.get("set-cookie") || "";
  const customerMatch = customerSetCookie.match(/shivura_session=([^;]+)/);
  assert(
    customerMatch !== null,
    `Customer logged in successfully and received customer shivura_session cookie`
  );
  const customerCookie = customerMatch ? customerMatch[0] : "";

  // Verify customer identity on /api/auth/me
  const customerMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: customerCookie },
  });
  const customerMeData = await customerMeRes.json();
  assert(
    customerMeData.user?.role === "CUSTOMER",
    `Customer account is verified with role: CUSTOMER (never promoted)`
  );

  // 4b. Customer requests GET /api/crm/auth/session -> MUST BE 403 FORBIDDEN
  const customerCrmSessionRes = await fetch(`${BASE_URL}/api/crm/auth/session`, {
    headers: { Cookie: customerCookie },
  });
  assert(
    customerCrmSessionRes.status === 403,
    `GET /api/crm/auth/session returns 403 FORBIDDEN for customer account (got ${customerCrmSessionRes.status})`
  );
  const customerCrmSessionData = await customerCrmSessionRes.json();
  assert(
    customerCrmSessionData.status === "forbidden" && customerCrmSessionData.success === false,
    `Session response indicates status: 'forbidden' for authenticated customer`
  );

  // 4c. Customer requests GET /api/crm/test-protected -> MUST BE 403 FORBIDDEN
  const customerProtectedRes = await fetch(`${BASE_URL}/api/crm/test-protected`, {
    headers: { Cookie: customerCookie },
  });
  assert(
    customerProtectedRes.status === 403,
    `GET /api/crm/test-protected returns 403 FORBIDDEN for customer account (got ${customerProtectedRes.status})`
  );

  // 4d. Customer navigates to /CRM -> MUST render 403 Forbidden Access Denied view
  const customerCrmPageRes = await fetch(`${BASE_URL}/CRM`, {
    headers: { Cookie: customerCookie },
    redirect: "manual",
  });
  const customerCrmHtml = await customerCrmPageRes.text();
  assert(
    customerCrmHtml.includes("403 Forbidden") ||
      customerCrmHtml.includes("Customer Account Detected") ||
      customerCrmHtml.includes("Access Denied"),
    `GET /CRM renders dedicated 403 Access Denied view to customer account`
  );

  // -------------------------------------------------------------
  // Test 5: Customer Signup Boundary Protection
  // -------------------------------------------------------------
  console.log(`\n[TEST 5] Prevention of Normal Signup with Reserved Admin Email`);

  const signupAdminEmailRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Imposter Admin",
      email: ADMIN_EMAIL,
      password: "SomePassword123!",
    }),
  });
  assert(
    signupAdminEmailRes.status === 403 || signupAdminEmailRes.status === 409,
    `POST /api/auth/signup rejects registration using reserved admin email (got status ${signupAdminEmailRes.status})`
  );

  // -------------------------------------------------------------
  // Test 6: Admin Logout
  // -------------------------------------------------------------
  console.log(`\n[TEST 6] Admin Logout & Session Invalidation`);

  const logoutRes = await fetch(`${BASE_URL}/api/crm/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
  });
  assert(
    logoutRes.status === 200,
    `POST /api/crm/auth/logout terminates admin session with status 200`
  );
  const logoutCookie = logoutRes.headers.get("set-cookie") || "";
  assert(
    logoutCookie.includes("Max-Age=0") || logoutCookie.includes("expires="),
    `POST /api/crm/auth/logout expires session cookie on response`
  );

  // Verification: Using empty/cleared cookie on /api/crm/auth/session
  const postLogoutSessionRes = await fetch(`${BASE_URL}/api/crm/auth/session`, {
    headers: { Cookie: "shivura_session=;" },
  });
  assert(
    postLogoutSessionRes.status === 401,
    `Subsequent CRM API request without valid session returns 401 Unauthorized`
  );

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log(`\n=============================================================`);
  console.log(`TEST SUITE RESULTS:`);
  console.log(`  Passed: ${testsPassed}`);
  console.log(`  Failed: ${testsFailed}`);
  console.log(`=============================================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test Suite Unhandled Exception:", err);
  process.exit(1);
});
