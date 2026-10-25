import React from "react";
import { Metadata } from "next";
import ArtisansEnquiriesClient from "@/components/crm/ArtisansEnquiriesClient";

export const metadata: Metadata = {
  title: "Artisans & Enquiries | Shivura CRM",
  description:
    "Administrative concierge inquiries, customer feedback management, artisan collaboration proposals, and master artisan directory status.",
};

export default function CrmArtisansPage() {
  return <ArtisansEnquiriesClient />;
}
