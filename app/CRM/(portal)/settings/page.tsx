import React from "react";
import { Metadata } from "next";
import SettingsClient from "@/components/crm/SettingsClient";

export const metadata: Metadata = {
  title: "Settings | Shivura CRM",
  description:
    "Administrative profile settings, store information, and verified system configuration.",
};

export default function CrmSettingsPage() {
  return <SettingsClient />;
}
