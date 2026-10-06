import { Metadata } from "next";
import { ShopCatalog } from "@/components/shop";

export const metadata: Metadata = {
  title: "All Products | Shivura Handcrafted Luxury",
  description:
    "Explore our complete handcrafted collection of Indian home decor, festive living essentials, artisanal pottery, lighting, and thoughtful gifts.",
};

interface ShopPageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const resolvedParams = await searchParams;
  const query = resolvedParams?.q || "";
  const category = resolvedParams?.category || "all";

  return (
    <div className="bg-[#FAF8F5] min-h-screen">
      {/* Main Catalog with Category Filter, Search Bar, Sort & Full Width Grid */}
      <ShopCatalog initialCategory={category} initialQuery={query} />
    </div>
  );
}
