import React from "react";
import { Metadata } from "next";
import CategoriesManagementClient from "@/components/crm/CategoriesManagementClient";

export const metadata: Metadata = {
  title: "Categories | Shivura CRM",
  description:
    "Administrative category management, collection organization, and catalog hierarchy.",
};

export default function CrmCategoriesPage() {
  return <CategoriesManagementClient type="categories" />;
}
