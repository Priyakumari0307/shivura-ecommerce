import pkg from "@next/env";
const { loadEnvConfig } = pkg;
loadEnvConfig(".");

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shivura.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "shivura@2026";

const OCCASIONS_TO_SYNC = [
  {
    id: "diwali",
    name: "Diwali",
    slug: "diwali",
    image: "/images/festive living.png",
    sortOrder: 1,
  },
  {
    id: "rakhi",
    name: "Rakhi",
    slug: "rakhi",
    image: "/images/om-rakhi.jpg",
    sortOrder: 2,
  },
  {
    id: "festive-gifting",
    name: "Festive Gifting",
    slug: "festive-gifting",
    image: "/images/gifting.png",
    sortOrder: 3,
  },
  {
    id: "everyday-living",
    name: "Everyday Living",
    slug: "everyday-living",
    image: "/images/home decor.png",
    sortOrder: 4,
  },
  {
    id: "griha-pravesh",
    name: "Griha Pravesh",
    slug: "griha-pravesh",
    image: "/images/explore image.png",
    sortOrder: 5,
  },
  {
    id: "weddings",
    name: "Weddings",
    slug: "weddings",
    image: "/images/artisan-diya-woman.jpg",
    sortOrder: 6,
  },
  {
    id: "puja-rituals",
    name: "Puja & Rituals",
    slug: "puja-rituals",
    image: "/images/terracotta-diyas-cloth.jpg",
    sortOrder: 7,
  },
  {
    id: "new-beginnings",
    name: "New Beginnings",
    slug: "new-beginnings",
    image: "/images/Product1.png",
    sortOrder: 8,
  },
];

async function syncOccasions() {
  console.log(`Connecting to ${BASE_URL}...`);
  // 1. Admin Login
  const loginRes = await fetch(`${BASE_URL}/api/crm/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!loginRes.ok) {
    console.error("Admin login failed:", loginRes.status, await loginRes.text());
    return;
  }

  const setCookie = loginRes.headers.get("set-cookie") || "";
  const match = setCookie.match(/shivura_session=([^;]+)/);
  if (!match) {
    console.error("Could not extract session cookie from:", setCookie);
    return;
  }
  const cookieHeader = match[0];
  console.log("Logged in successfully as admin.");

  // 2. Fetch existing occasions
  const existingRes = await fetch(`${BASE_URL}/api/crm/occasions?all=true`, {
    headers: { Cookie: cookieHeader },
  });
  const existingData = await existingRes.json();
  const existingList = existingData?.data || [];
  console.log(`Found ${existingList.length} existing occasions.`);

  const existingMap = new Map();
  for (const item of existingList) {
    existingMap.set(item.slug, item);
  }

  // 3. Upsert occasions
  for (const occ of OCCASIONS_TO_SYNC) {
    if (existingMap.has(occ.slug)) {
      const existing = existingMap.get(occ.slug);
      console.log(`Updating existing occasion '${occ.slug}' (${existing.id})...`);
      const updateRes = await fetch(`${BASE_URL}/api/crm/occasions/${existing.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({
          name: occ.name,
          slug: occ.slug,
          image: occ.image,
          sortOrder: occ.sortOrder,
          active: true,
        }),
      });
      console.log(`Update status: ${updateRes.status}`);
    } else {
      console.log(`Creating new occasion '${occ.slug}'...`);
      const createRes = await fetch(`${BASE_URL}/api/crm/occasions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({
          name: occ.name,
          slug: occ.slug,
          image: occ.image,
          sortOrder: occ.sortOrder,
          active: true,
        }),
      });
      console.log(`Create status: ${createRes.status}`);
    }
  }

  console.log("Sync complete!");
}

syncOccasions().catch(console.error);
