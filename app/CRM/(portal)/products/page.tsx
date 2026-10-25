import React from "react";
import { Metadata } from "next";
import ProductManagementClient from "@/components/crm/ProductManagementClient";

export const metadata: Metadata = {
  title: "Product Catalog Management | Shivura CRM",
  description: "Administrative catalog management, inventory control, variant pricing, and storefront publication states.",
};

export default function CrmProductsPage() {
  return <ProductManagementClient />;
}
