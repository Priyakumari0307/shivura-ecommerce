import React from "react";
import { Metadata } from "next";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getCrmCatalogAnalytics } from "@/lib/crm/analytics";
import CrmDashboardOverview from "@/components/crm/CrmDashboardOverview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Store Overview | Shivura CRM",
  description: "Administrative catalog intelligence, inventory alerts, and taxonomy distribution.",
};

export default async function CrmDashboardPage() {
  const auth = await verifyAdminSession();
  const adminName = auth.admin?.name || auth.admin?.email || "Administrator";

  // Server-side database analytics fetch
  const analyticsData = await getCrmCatalogAnalytics();

  return (
    <CrmDashboardOverview
      initialData={analyticsData}
      adminName={adminName}
    />
  );
}
