import { Metadata } from "next";
import { ShopCatalog } from "@/components/shop";

export const metadata: Metadata = {
  title: "Festival Living | Shivura Handcrafted Luxury",
  description: "Explore festive living decor, handcrafted diyas, pooja essentials, and celebration pieces.",
};

export default function FestivalLivingPage() {
  return (
    <div className="bg-[#FAF8F5] min-h-screen">
      <ShopCatalog initialCategory="festive-living" />
    </div>
  );
}
