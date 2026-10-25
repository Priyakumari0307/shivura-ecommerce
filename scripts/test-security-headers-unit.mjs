/**
 * Targeted Unit Tests for Security Headers & CSP Configuration (Phase 7C - Step 4C.2D)
 *
 * Verifies:
 * 1. Baseline security headers: X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy.
 * 2. CSP Directives completeness: script-src, style-src, img-src (blob, data, cloudinary, google), font-src, connect-src, frame-ancestors, object-src, base-uri, form-action.
 * 3. CSP Mode toggling: Report-Only by default, enforced ONLY when ENFORCE_CSP="true". Invalid/unexpected values fail-safe to Report-Only.
 * 4. Production vs Development CSP: Production strictly EXCLUDES 'unsafe-eval' while retaining 'unsafe-inline'. Development retains 'unsafe-eval' for HMR/tooling.
 * 5. HSTS: max-age=31536000 in production, no premature includeSubDomains/preload, omitted in non-production.
 * 6. Image remote patterns: res.cloudinary.com and lh3.googleusercontent.com.
 */

import assert from "node:assert/strict";

async function loadConfigWithEnv(envOverrides = {}) {
  const originalEnv = { ...process.env };
  try {
    Object.assign(process.env, envOverrides);
    // Dynamic cache-busting import or evaluate using fresh query
    const cacheBuster = `?t=${Date.now()}_${Math.random()}`;
    const importedConfig = await import(`../next.config.ts${cacheBuster}`);
    const nextConfig = importedConfig.default;
    const cspDirectives = importedConfig.cspDirectives;
    const buildCspDirectives = importedConfig.buildCspDirectives;
    const headerConfigs = typeof nextConfig.headers === "function" ? await nextConfig.headers() : [];
    return { nextConfig, cspDirectives, buildCspDirectives, headerConfigs };
  } finally {
    process.env = originalEnv;
  }
}

async function runTests() {
  console.log("=== Security Headers & CSP Unit Tests (Step 4C.2D) ===\n");

  // Test 1: Baseline Security Headers in default/dev environment
  {
    console.log("Test 1: Default/dev environment baseline security headers and dev CSP");
    const { headerConfigs, cspDirectives } = await loadConfigWithEnv({
      NODE_ENV: "development",
      ENFORCE_CSP: "false",
    });

    assert.equal(headerConfigs.length, 1, "Should have 1 header route configuration block");
    const routeConfig = headerConfigs[0];
    assert.equal(routeConfig.source, "/:path*", "Headers should apply to all paths /:path*");

    const headersMap = new Map(routeConfig.headers.map((h) => [h.key, h.value]));

    // Baseline headers
    assert.equal(headersMap.get("X-Content-Type-Options"), "nosniff", "X-Content-Type-Options must be nosniff");
    assert.equal(headersMap.get("Referrer-Policy"), "strict-origin-when-cross-origin", "Referrer-Policy must be strict-origin-when-cross-origin");
    assert.equal(headersMap.get("X-Frame-Options"), "DENY", "X-Frame-Options must be DENY");
    assert.equal(headersMap.get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()", "Permissions-Policy must disable camera, microphone, geolocation");

    // In development, HSTS must NOT be set
    assert.equal(headersMap.has("Strict-Transport-Security"), false, "HSTS must NOT be set in non-production");

    // CSP must be Report-Only
    assert.equal(headersMap.has("Content-Security-Policy-Report-Only"), true, "CSP should default to Report-Only mode");
    assert.equal(headersMap.has("Content-Security-Policy"), false, "CSP should not be enforced by default");
    assert.equal(headersMap.get("Content-Security-Policy-Report-Only"), cspDirectives, "Report-only header should match cspDirectives");

    // Development CSP should retain 'unsafe-eval' for HMR/tooling
    const devCsp = headersMap.get("Content-Security-Policy-Report-Only");
    assert.ok(devCsp.includes("'unsafe-eval'"), "Development CSP must retain 'unsafe-eval' for Turbopack/HMR tooling");
    assert.ok(devCsp.includes("'unsafe-inline'"), "Development CSP must retain 'unsafe-inline'");

    console.log("  [PASS] Baseline security headers, no HSTS in dev, and Report-Only CSP with dev tooling verified.\n");
  }

  // Test 2: Production environment HSTS and exclusion of unsafe-eval
  {
    console.log("Test 2: Production environment HSTS and exclusion of 'unsafe-eval'");
    const { headerConfigs } = await loadConfigWithEnv({
      NODE_ENV: "production",
      ENFORCE_CSP: "false",
    });

    const routeConfig = headerConfigs[0];
    const headersMap = new Map(routeConfig.headers.map((h) => [h.key, h.value]));

    // HSTS assertions
    assert.equal(headersMap.has("Strict-Transport-Security"), true, "HSTS must be present in production");
    const hstsValue = headersMap.get("Strict-Transport-Security");
    assert.equal(hstsValue, "max-age=31536000", "HSTS must be exactly max-age=31536000");
    assert.ok(!hstsValue.includes("includeSubDomains"), "HSTS must NOT include includeSubDomains without subdomain verification");
    assert.ok(!hstsValue.includes("preload"), "HSTS must NOT include preload without verified domain readiness");

    // Production CSP assertions: MUST NOT include 'unsafe-eval', MUST include 'unsafe-inline'
    assert.equal(headersMap.has("Content-Security-Policy-Report-Only"), true, "CSP must be Report-Only when ENFORCE_CSP is false");
    const prodCsp = headersMap.get("Content-Security-Policy-Report-Only");
    assert.ok(!prodCsp.includes("'unsafe-eval'"), "Production CSP must strictly EXCLUDE 'unsafe-eval'");
    assert.ok(prodCsp.includes("'unsafe-inline'"), "Production CSP must retain 'unsafe-inline' for Next.js 16 hydration");
    assert.ok(prodCsp.includes("script-src 'self' 'unsafe-inline'"), "Production script-src must be exactly 'self' 'unsafe-inline'");

    console.log("  [PASS] Production HSTS verified and 'unsafe-eval' successfully excluded from production CSP.\n");
  }

  // Test 3: CSP Enforce Mode toggle & fail-safe defaults
  {
    console.log("Test 3: CSP Enforce Mode toggle via ENFORCE_CSP=true and fail-safe defaults");
    // Sub-case 3A: Valid enforcement toggle ENFORCE_CSP="true" in production
    {
      const { headerConfigs } = await loadConfigWithEnv({
        NODE_ENV: "production",
        ENFORCE_CSP: "true",
      });

      const routeConfig = headerConfigs[0];
      const headersMap = new Map(routeConfig.headers.map((h) => [h.key, h.value]));

      assert.equal(headersMap.has("Content-Security-Policy"), true, "Enforced CSP header must be present when ENFORCE_CSP=true");
      assert.equal(headersMap.has("Content-Security-Policy-Report-Only"), false, "Report-Only CSP header must be absent when ENFORCE_CSP=true");
      const enforcedCsp = headersMap.get("Content-Security-Policy");
      assert.ok(!enforcedCsp.includes("'unsafe-eval'"), "Enforced production CSP must strictly EXCLUDE 'unsafe-eval'");
      assert.ok(enforcedCsp.includes("'unsafe-inline'"), "Enforced production CSP must retain 'unsafe-inline'");
    }

    // Sub-case 3B: Unexpected, malformed, or inactive ENFORCE_CSP values must fail-safe to Report-Only
    const invalidValues = [undefined, "", "false", "0", "TRUE", "True", "1", "yes", "enabled", "on", "random"];
    for (const val of invalidValues) {
      const overrides = { NODE_ENV: "production" };
      if (val !== undefined) overrides.ENFORCE_CSP = val;
      const { headerConfigs } = await loadConfigWithEnv(overrides);
      const headersMap = new Map(headerConfigs[0].headers.map((h) => [h.key, h.value]));

      assert.equal(
        headersMap.has("Content-Security-Policy-Report-Only"),
        true,
        `ENFORCE_CSP=${JSON.stringify(val)} must default to Report-Only`
      );
      assert.equal(
        headersMap.has("Content-Security-Policy"),
        false,
        `ENFORCE_CSP=${JSON.stringify(val)} must NOT enforce CSP`
      );
    }

    console.log("  [PASS] CSP correctly enforces only on exact 'true', and safely defaults to Report-Only on all other values.\n");
  }

  // Test 4: CSP Directives granular comparison (production vs development)
  {
    console.log("Test 4: Granular CSP directives comparison between production and development");
    const { buildCspDirectives } = await loadConfigWithEnv();

    const parseDirectives = (cspStr) => {
      const map = new Map();
      for (const d of cspStr.split(";").map((s) => s.trim()).filter(Boolean)) {
        const parts = d.split(/\s+/);
        map.set(parts[0], parts.slice(1));
      }
      return map;
    };

    const prodDirectives = parseDirectives(buildCspDirectives(true));
    const devDirectives = parseDirectives(buildCspDirectives(false));

    // Common directives invariant check
    for (const dMap of [prodDirectives, devDirectives]) {
      assert.deepEqual(dMap.get("default-src"), ["'self'"], "default-src must be 'self'");
      assert.deepEqual(dMap.get("style-src"), ["'self'", "'unsafe-inline'"], "style-src must be 'self' 'unsafe-inline'");
      assert.deepEqual(
        dMap.get("img-src"),
        ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://lh3.googleusercontent.com"],
        "img-src must allow self, data, blob, cloudinary, and google"
      );
      assert.deepEqual(dMap.get("font-src"), ["'self'", "data:"], "font-src must be 'self' data:");
      assert.deepEqual(dMap.get("connect-src"), ["'self'"], "connect-src must be 'self'");
      assert.deepEqual(dMap.get("frame-ancestors"), ["'none'"], "frame-ancestors must be 'none'");
      assert.deepEqual(dMap.get("object-src"), ["'none'"], "object-src must be 'none'");
      assert.deepEqual(dMap.get("base-uri"), ["'self'"], "base-uri must be 'self'");
      assert.deepEqual(
        dMap.get("form-action"),
        ["'self'", "https://accounts.google.com"],
        "form-action must be 'self' https://accounts.google.com"
      );
    }

    // script-src differential check
    assert.deepEqual(
      prodDirectives.get("script-src"),
      ["'self'", "'unsafe-inline'"],
      "Production script-src must contain ONLY 'self' and 'unsafe-inline' (NO 'unsafe-eval')"
    );
    assert.deepEqual(
      devDirectives.get("script-src"),
      ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      "Development script-src must contain 'self', 'unsafe-inline', and 'unsafe-eval'"
    );

    console.log("  [PASS] All common directives intact; script-src cleanly differentiates prod vs dev.\n");
  }

  // Test 5: Next.js image remotePatterns configuration
  {
    console.log("Test 5: next.config.ts image remotePatterns");
    const { nextConfig } = await loadConfigWithEnv();
    const remotePatterns = nextConfig.images?.remotePatterns || [];

    const hostnames = remotePatterns.map((p) => p.hostname);
    assert.ok(hostnames.includes("res.cloudinary.com"), "remotePatterns must preserve res.cloudinary.com");
    assert.ok(hostnames.includes("lh3.googleusercontent.com"), "remotePatterns must include lh3.googleusercontent.com");

    console.log("  [PASS] Image remotePatterns correctly configured for Cloudinary and Google OAuth.\n");
  }

  console.log("All 5 security header and CSP unit tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
