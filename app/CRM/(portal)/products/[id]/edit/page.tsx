import React from "react";
import { Metadata } from "next";
import ProductForm from "@/components/crm/ProductForm";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Edit Product | Shivura CRM",
  description: "Update product details, pricing, media gallery, inventory variants, and category taxonomy.",
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const resolvedParams = await params;
  return <ProductForm mode="edit" productId={resolvedParams.id} />;
}
