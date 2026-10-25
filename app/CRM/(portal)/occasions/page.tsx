import React from "react";
import { Metadata } from "next";
import CategoriesManagementClient from "@/components/crm/CategoriesManagementClient";

export const metadata: Metadata = {
  title: "Occasions | Shivura CRM",
  description:
    "Administrative occasion management, festive collections, and celebration curation.",
};

export default function CrmOccasionsPage() {
  return <CategoriesManagementClient type="occasions" />;
}
