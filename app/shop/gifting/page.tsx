import { Metadata } from "next";
import { ShopCatalog } from "@/components/shop";

export const metadata: Metadata = {
  title: "Artisanal Gifting | Shivura Handcrafted Luxury",
  description: "Curated artisanal gift boxes, hampers, handcrafted keepsakes, and festive tokens of love.",
};

export default function GiftingPage() {
  return (
    <div className="bg-[#FAF8F5] min-h-screen">
      <ShopCatalog initialCategory="gifting" />
    </div>
  );
}
