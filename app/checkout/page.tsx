import { Metadata } from "next";
import CheckoutClient from "@/components/checkout/CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout | Shivura Luxury Crafts",
  description: "Complete your order with secure Cash on Delivery delivery across India.",
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
