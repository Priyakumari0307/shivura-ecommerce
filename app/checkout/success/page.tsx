import { Metadata } from "next";
import { Suspense } from "react";
import OrderConfirmationClient from "@/components/checkout/OrderConfirmationClient";

export const metadata: Metadata = {
  title: "Order Confirmed | Shivura Luxury Crafts",
  description:
    "Thank you for your order. We have received your request and our artisans are preparing your handcrafted treasures.",
};

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF8F5] py-20 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-2 border-[#B88746] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs uppercase tracking-widest text-[#7E6955] font-sans">
              Loading Order Confirmation...
            </p>
          </div>
        </div>
      }
    >
      <OrderConfirmationClient />
    </Suspense>
  );
}
