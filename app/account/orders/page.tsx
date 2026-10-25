import { Metadata } from "next";
import { Suspense } from "react";
import OrderHistoryClient from "@/components/account/OrderHistoryClient";

export const metadata: Metadata = {
  title: "My Orders | Shivura Luxury Crafts",
  description: "View your order history, shipment status, and item details with Shivura.",
};

export default function AccountOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF8F5] py-20 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-2 border-[#B88746] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs uppercase tracking-widest text-[#7E6955] font-sans">
              Loading Orders...
            </p>
          </div>
        </div>
      }
    >
      <OrderHistoryClient />
    </Suspense>
  );
}
