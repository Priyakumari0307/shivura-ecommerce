import { Metadata } from "next";
import { ShopCatalog } from "@/components/shop";

export const metadata: Metadata = {
  title: "Lighting & Lanterns | Shivura Handcrafted Luxury",
  description: "Enchanting fairy string lights, Moroccan lanterns, leaf lights, and warm ambient home illumination.",
};

export default function LightingPage() {
  return (
    <div className="bg-[#FAF8F5] min-h-screen">
      <ShopCatalog initialCategory="lighting" />
    </div>
  );
}
