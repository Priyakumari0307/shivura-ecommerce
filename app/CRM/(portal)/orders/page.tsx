import React from "react";
import { Metadata } from "next";
import OrdersManagementClient from "@/components/crm/OrdersManagementClient";

export const metadata: Metadata = {
  title: "Orders Management | Shivura CRM",
  description:
    "Administrative customer order processing, fulfillment status transitions, verified revenue intelligence, and payment auditing.",
};

export default function CrmOrdersPage() {
  return <OrdersManagementClient />;
}
