import React from "react";
import { Metadata } from "next";
import MediaLibraryClient from "@/components/crm/MediaLibraryClient";

export const metadata: Metadata = {
  title: "Media Library | Shivura CRM",
  description:
    "Cloudinary digital asset management, catalog photography storage, and relational safety monitoring.",
};

export default function CrmMediaPage() {
  return <MediaLibraryClient />;
}
