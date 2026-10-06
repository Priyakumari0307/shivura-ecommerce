import { Metadata } from "next";
import { ShopCatalog } from "@/components/shop";

export const metadata: Metadata = {
  title: "Home Decor | Shivura Handcrafted Luxury",
  description: "Handcrafted acrylic photo frames, bohemian wall art, ceramic accents, and artisanal home decor.",
};

export default function HomeDecorPage() {
  return (
    <div className="bg-[#FAF8F5] min-h-screen">
      <ShopCatalog initialCategory="home-decor" />
    </div>
  );
}
