import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/adminAuth";
import CrmLogoutButton from "./CrmLogoutButton";
import CrmSidebarLayout from "@/components/crm/CrmSidebarLayout";

export default async function CrmPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await verifyAdminSession();

  // 1. Unauthenticated -> redirect to /CRM/login
  if (auth.status === "unauthenticated") {
    redirect("/CRM/login?returnUrl=/CRM&reason=unauthorized");
  }

  // 2. Authenticated Customer -> 403 Forbidden Access Denied screen
  if (auth.status === "forbidden") {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-md p-8 sm:p-10 rounded-3xl border border-rose-200/80 shadow-[0_8px_32px_rgba(225,29,72,0.06)] max-w-lg w-full text-center space-y-5">
          <div className="w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto text-2xl text-rose-600 shadow-2xs">
            ⛔
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-rose-600">
              403 Forbidden • Access Denied
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#2C2117] font-normal">
              Customer Account Detected
            </h1>
            <p className="text-xs text-[#7E6955] font-light max-w-md mx-auto leading-relaxed">
              You are currently authenticated as{" "}
              <strong className="font-medium text-[#2C2117]">
                {auth.customer?.email}
              </strong>{" "}
              with role <span className="font-mono text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-[11px]">{auth.customer?.role}</span>.
              This account does not have authorization for the Shivura CRM administrative portal.
            </p>
          </div>

          <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-100 text-left text-[11.5px] text-rose-900/90 leading-relaxed space-y-1 font-sans">
            <p className="font-medium">Strict Administrative Security Policy:</p>
            <p className="text-rose-800/80 font-light">
              Executive CRM permissions are not granted to customer profiles. To access internal administration, you must log in with authorized CRM credentials.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <CrmLogoutButton variant="forbidden" className="w-full sm:w-auto" />
            <Link
              href="/"
              className="w-full sm:w-auto px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs uppercase tracking-wider font-sans font-medium transition-colors text-center"
            >
              Return to Boutique
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Admin -> render executive sidebar layout
  const admin = auth.admin!;

  return (
    <CrmSidebarLayout admin={admin}>
      {children}
    </CrmSidebarLayout>
  );
}
