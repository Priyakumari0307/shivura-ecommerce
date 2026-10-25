import React from "react";
import { Metadata } from "next";
import ProductForm from "@/components/crm/ProductForm";

export const metadata: Metadata = {
  title: "Add New Product | Shivura CRM",
  description: "Create and configure a new luxury catalog item with pricing, imagery, and inventory variants.",
};

export default function NewProductPage() {
  return <ProductForm mode="create" />;
}
