import React from "react";
import { Metadata } from "next";
import HomepageManagementClient from "@/components/crm/HomepageManagementClient";

export const metadata: Metadata = {
  title: "Homepage Management | Shivura CRM",
  description:
    "Merchandising administration, homepage hero banner photography, and brand presentation.",
};

export default function CrmHomepagePage() {
  return <HomepageManagementClient />;
}
