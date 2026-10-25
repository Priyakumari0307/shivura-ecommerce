"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface SettingsData {
  storeInfo: {
    storeName: string;
    tagline: string;
    contactEmail: string;
    contactPhone: string;
    address: {
      line1: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      formatted: string;
    };
    operatingHours: string;
    persistenceType: string;
    schemaRequirementNote: string;
  };
  adminAccount: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    createdAt: string;
    updatedAt: string;
    passwordRotationMethod: string;
  };
  preferences: {
    currency: {
      code: string;
      symbol: string;
      locale: string;
      description: string;
      isHardened: boolean;
    };
    orders: {
      preDispatchRestockEnabled: boolean;
      preDispatchRestockPolicy: string;
      postDispatchRestockPolicy: string;
      paymentEvidenceRequiredForPaid: boolean;
      paymentEvidencePolicy: string;
    };
    security: {
      sessionCipher: string;
      rateLimitingEnabled: boolean;
      adminQuota: string;
    };
  };
  notifications: {
    conciergeInquiries: {
      active: boolean;
      channel: string;
      description: string;
    };
    orderConfirmation: {
      active: boolean;
      channel: string;
      description: string;
    };
    automatedOutboundMail: {
      active: boolean;
      channel: string;
      description: string;
      isConfigured: boolean;
    };
  };
}

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState<"store" | "admin" | "preferences" | "notifications">("store");

  // Settings data state
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin form state
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");

  // Saving state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch settings from API
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/crm/settings");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch settings (${res.status})`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        const name = json.data.adminAccount.name || "";
        const phone = json.data.adminAccount.phone || "";
        setAdminName(name);
        setAdminPhone(phone);
        setOriginalName(name);
        setOriginalPhone(phone);
      } else {
        throw new Error(json.error || "Failed to load settings data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error connecting to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      await Promise.resolve();
      if (!ignore) {
        await fetchSettings();
      }
    })();
    return () => {
      ignore = true;
    };
  }, [fetchSettings]);

  // Check unsaved changes
  const hasUnsavedChanges = adminName !== originalName || adminPhone !== originalPhone;

  // Handle Admin Profile Update
  const handleSaveAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasUnsavedChanges) return;

    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const res = await fetch("/api/crm/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: adminName.trim(),
          phone: adminPhone.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update admin profile");
      }

      setSaveSuccess(json.message || "Admin profile updated successfully in database");
      setOriginalName(json.data.name || "");
      setOriginalPhone(json.data.phone || "");

      // Clear success notification after 4 seconds
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error updating admin profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Navigation Trail */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DFCBB8]/50">
        <div>
          <div className="flex items-center space-x-2 text-xs text-[#7E6955] mb-1 font-sans">
            <Link href="/CRM" className="hover:text-[#161514] transition-colors">
              CRM
            </Link>
            <span>/</span>
            <span className="text-[#161514] font-medium">Settings</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#161514] tracking-tight">
            System &amp; Store Settings
          </h1>
          <p className="text-xs sm:text-sm text-[#7E6955] mt-1 font-sans">
            Manage administrative profile details, review store configuration, and audit active application policies.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => fetchSettings()}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#DFCBB8] text-xs font-sans text-[#161514] hover:bg-[#FAF8F5] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh settings records"
          >
            <svg
              className={`w-3.5 h-3.5 stroke-current ${loading ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center space-x-1 sm:space-x-2 border-b border-[#DFCBB8]/70 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("store")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-sans font-medium transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === "store"
              ? "text-[#161514] border-[#B88746] font-semibold"
              : "text-[#7E6955] border-transparent hover:text-[#161514] hover:border-[#DFCBB8]"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Store Information</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("admin")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-sans font-medium transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === "admin"
              ? "text-[#161514] border-[#B88746] font-semibold"
              : "text-[#7E6955] border-transparent hover:text-[#161514] hover:border-[#DFCBB8]"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Admin Account</span>
          {hasUnsavedChanges && (
            <span className="w-2 h-2 rounded-full bg-[#B88746] animate-pulse" title="Unsaved changes" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-sans font-medium transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === "preferences"
              ? "text-[#161514] border-[#B88746] font-semibold"
              : "text-[#7E6955] border-transparent hover:text-[#161514] hover:border-[#DFCBB8]"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Store Preferences</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-sans font-medium transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === "notifications"
              ? "text-[#161514] border-[#B88746] font-semibold"
              : "text-[#7E6955] border-transparent hover:text-[#161514] hover:border-[#DFCBB8]"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span>Notifications</span>
        </button>
      </div>

      {/* 3. Error Alert State */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-sans flex items-start space-x-3">
          <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold">Unable to load settings</p>
            <p className="mt-0.5 text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => fetchSettings()}
              className="mt-2 text-rose-900 underline font-semibold hover:text-rose-950 cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* 4. Loading Skeleton */}
      {loading && (
        <div className="bg-white rounded-2xl border border-[#DFCBB8]/70 p-6 sm:p-8 space-y-6 animate-pulse">
          <div className="h-6 bg-stone-200 rounded w-1/4" />
          <div className="space-y-4">
            <div className="h-10 bg-stone-100 rounded-xl w-full" />
            <div className="h-10 bg-stone-100 rounded-xl w-full" />
            <div className="h-10 bg-stone-100 rounded-xl w-3/4" />
          </div>
        </div>
      )}

      {/* 5. Tab Content Panes */}
      {!loading && data && (
        <>
          {/* ===================================================
             TAB A: STORE INFORMATION
             =================================================== */}
          {activeTab === "store" && (
            <div className="space-y-6">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#DFCBB8]/80 shadow-2xs space-y-6">
                <div className="flex items-start justify-between gap-4 border-b border-[#DFCBB8]/50 pb-5">
                  <div>
                    <span className="text-[10px] font-sans font-semibold uppercase tracking-widest text-[#B88746]">
                      Boutique Store Identity
                    </span>
                    <h2 className="text-xl sm:text-2xl font-serif text-[#161514] tracking-tight mt-1">
                      Store Information
                    </h2>
                    <p className="text-xs sm:text-sm text-[#7E6955] font-sans mt-0.5">
                      Core brand details, verified concierge contacts, and design studio location.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Live Storefront
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-sans">
                  {/* Store Name */}
                  <div className="space-y-1.5 p-4 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/60">
                    <span className="text-[10.5px] uppercase tracking-wider text-[#8C7560] font-semibold block">
                      Store Name
                    </span>
                    <div className="text-base font-serif text-[#161514] font-medium tracking-wide">
                      {data.storeInfo.storeName}
                    </div>
                    <p className="text-[11px] text-[#7E6955]">Brand Tagline: &quot;{data.storeInfo.tagline}&quot;</p>
                  </div>

                  {/* Contact Email */}
                  <div className="space-y-1.5 p-4 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/60">
                    <span className="text-[10.5px] uppercase tracking-wider text-[#8C7560] font-semibold block">
                      Contact Email
                    </span>
                    <div className="text-sm font-medium text-[#161514]">
                      <a href={`mailto:${data.storeInfo.contactEmail}`} className="text-[#B88746] hover:underline">
                        {data.storeInfo.contactEmail}
                      </a>
                    </div>
                    <p className="text-[11px] text-[#7E6955]">Primary concierge and customer support inbox</p>
                  </div>

                  {/* Contact Phone */}
                  <div className="space-y-1.5 p-4 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/60">
                    <span className="text-[10.5px] uppercase tracking-wider text-[#8C7560] font-semibold block">
                      Contact Phone &amp; WhatsApp
                    </span>
                    <div className="text-sm font-mono font-medium text-[#161514]">
                      <a href={`tel:${data.storeInfo.contactPhone}`} className="hover:text-[#B88746] transition-colors">
                        {data.storeInfo.contactPhone}
                      </a>
                    </div>
                    <p className="text-[11px] text-[#7E6955]">Official concierge WhatsApp line</p>
                  </div>

                  {/* Operating Hours */}
                  <div className="space-y-1.5 p-4 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/60">
                    <span className="text-[10.5px] uppercase tracking-wider text-[#8C7560] font-semibold block">
                      Concierge Hours
                    </span>
                    <div className="text-sm text-[#161514] leading-relaxed">
                      {data.storeInfo.operatingHours}
                    </div>
                  </div>

                  {/* Store Address */}
                  <div className="md:col-span-2 space-y-1.5 p-4 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/60">
                    <span className="text-[10.5px] uppercase tracking-wider text-[#8C7560] font-semibold block">
                      Design Studio &amp; Registered Address
                    </span>
                    <div className="text-sm text-[#161514] font-medium leading-relaxed">
                      {data.storeInfo.address.formatted}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] text-[#7E6955] border-t border-[#DFCBB8]/40">
                      <div><strong className="text-[#5C4A3A]">City:</strong> {data.storeInfo.address.city}</div>
                      <div><strong className="text-[#5C4A3A]">State:</strong> {data.storeInfo.address.state}</div>
                      <div><strong className="text-[#5C4A3A]">PIN:</strong> {data.storeInfo.address.postalCode}</div>
                      <div><strong className="text-[#5C4A3A]">Country:</strong> {data.storeInfo.address.country}</div>
                    </div>
                  </div>
                </div>

                {/* Architecture & Persistence Notice */}
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#DFCBB8]/70 text-xs font-sans text-[#7E6955] flex items-start space-x-3">
                  <span className="text-[#B88746] text-base shrink-0">✦</span>
                  <div className="space-y-1">
                    <p className="font-semibold text-[#161514]">
                      System Configuration &amp; Database Architecture Note
                    </p>
                    <p className="leading-relaxed text-[11.5px]">
                      {data.storeInfo.schemaRequirementNote}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================
             TAB B: ADMIN ACCOUNT
             =================================================== */}
          {activeTab === "admin" && (
            <div className="space-y-6">
              {/* Profile Editor Card */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#DFCBB8]/80 shadow-2xs space-y-6">
                <div className="flex items-start justify-between gap-4 border-b border-[#DFCBB8]/50 pb-5">
                  <div>
                    <span className="text-[10px] font-sans font-semibold uppercase tracking-widest text-[#B88746]">
                      Administrative Profile
                    </span>
                    <h2 className="text-xl sm:text-2xl font-serif text-[#161514] tracking-tight mt-1">
                      Admin Account
                    </h2>
                    <p className="text-xs sm:text-sm text-[#7E6955] font-sans mt-0.5">
                      Update your administrator display name and contact phone, persisted directly to PostgreSQL.
                    </p>
                  </div>
                  <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Role: {data.adminAccount.role}</span>
                  </div>
                </div>

                <form onSubmit={handleSaveAdminProfile} className="space-y-5 text-xs font-sans">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Admin Display Name */}
                    <div className="space-y-1.5">
                      <label htmlFor="adminNameInput" className="font-semibold text-[#5C4A3A] block">
                        Admin Display Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="adminNameInput"
                        type="text"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="e.g. Shivura CRM Administrator"
                        maxLength={100}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFCBB8] bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 text-xs sm:text-sm text-[#161514] transition-all font-sans"
                      />
                      <p className="text-[11px] text-[#7E6955]">Visible across CRM audit logs and topbar identity</p>
                    </div>

                    {/* Admin Contact Phone */}
                    <div className="space-y-1.5">
                      <label htmlFor="adminPhoneInput" className="font-semibold text-[#5C4A3A] block">
                        Admin Contact Phone (Optional)
                      </label>
                      <input
                        id="adminPhoneInput"
                        type="text"
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value)}
                        placeholder="+91 9650218876"
                        maxLength={25}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFCBB8] bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 text-xs sm:text-sm text-[#161514] transition-all font-mono"
                      />
                      <p className="text-[11px] text-[#7E6955]">Direct telephone number for administrative contact</p>
                    </div>

                    {/* Admin Email (Read-Only) */}
                    <div className="space-y-1.5">
                      <label htmlFor="adminEmailInput" className="font-semibold text-[#5C4A3A] block">
                        Admin Email (Anchor Identity)
                      </label>
                      <input
                        id="adminEmailInput"
                        type="email"
                        value={data.adminAccount.email}
                        readOnly
                        disabled
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFCBB8]/70 bg-stone-100 text-stone-600 text-xs sm:text-sm font-sans cursor-not-allowed select-none"
                      />
                      <p className="text-[11px] text-[#7E6955]">
                        Anchored to server environment <code>ADMIN_EMAIL</code> configuration
                      </p>
                    </div>

                    {/* Session Encryption */}
                    <div className="space-y-1.5">
                      <label htmlFor="sessionSecurityInput" className="font-semibold text-[#5C4A3A] block">
                        Session Encryption
                      </label>
                      <input
                        id="sessionSecurityInput"
                        type="text"
                        value="256-bit JWE (AES-256-GCM authenticated cipher)"
                        readOnly
                        disabled
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFCBB8]/70 bg-stone-100 text-stone-600 text-xs sm:text-sm font-mono cursor-not-allowed select-none"
                      />
                      <p className="text-[11px] text-[#7E6955]">HTTP-only cookie with strict SameSite protection</p>
                    </div>
                  </div>

                  {/* Feedback Notifications */}
                  {saveSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-sans flex items-center space-x-2">
                      <span className="font-bold">✓</span>
                      <span>{saveSuccess}</span>
                    </div>
                  )}

                  {saveError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-sans flex items-center space-x-2">
                      <span className="font-bold">✕</span>
                      <span>{saveError}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#DFCBB8]/50">
                    <span className="text-[11px] text-[#7E6955]">
                      {hasUnsavedChanges ? (
                        <span className="text-amber-800 font-medium">● Unsaved changes detected</span>
                      ) : (
                        <span>Database profile in sync</span>
                      )}
                    </span>

                    <button
                      type="submit"
                      disabled={saving || !hasUnsavedChanges}
                      className="px-5 py-2.5 rounded-xl bg-[#161514] hover:bg-[#2C2117] text-[#FAF5EB] text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    >
                      {saving ? "Saving to Database..." : "Save Profile Changes"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Password Management & Security Architecture Card */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#DFCBB8]/80 shadow-2xs space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[#B88746] text-sm">✦</span>
                      <h3 className="font-serif text-lg sm:text-xl text-[#161514]">
                        Password Security &amp; Rotation Policy
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-[#7E6955] font-sans leading-relaxed">
                      Cryptographic authentication boundaries protect administrative access against runtime database tampering.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                    bcrypt (Cost 12)
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/70 space-y-3 text-xs font-sans text-[#5C4A3A]">
                  <p className="leading-relaxed">
                    <strong>Zero-Secret Exposure Guarantee:</strong> In accordance with Shivura luxury security architecture, administrator passwords and password hashes are never rendered in client markup or exposed through API endpoints.
                  </p>
                  <p className="leading-relaxed">
                    <strong>Secure Rotation Procedure:</strong> Administrator credentials are cryptographically verified against <code>ADMIN_PASSWORD_HASH</code> in server environment variables. To rotate administrative credentials:
                  </p>
                  <div className="p-3 rounded-xl bg-[#161514] text-stone-200 font-mono text-[11px] overflow-x-auto">
                    <code>node scripts/generate-admin-hash.mjs &quot;&lt;your-new-password&gt;&quot;</code>
                  </div>
                  <p className="text-[11px] text-[#7E6955] leading-relaxed">
                    Update the generated 60-character bcrypt hash in the deployment environment and restart the service. Runtime database password updates for administrators are disabled to prevent credential desynchronization.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================
             TAB C: STORE PREFERENCES
             =================================================== */}
          {activeTab === "preferences" && (
            <div className="space-y-6">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#DFCBB8]/80 shadow-2xs space-y-6">
                <div className="flex items-start justify-between gap-4 border-b border-[#DFCBB8]/50 pb-5">
                  <div>
                    <span className="text-[10px] font-sans font-semibold uppercase tracking-widest text-[#B88746]">
                      Application Engine Policies
                    </span>
                    <h2 className="text-xl sm:text-2xl font-serif text-[#161514] tracking-tight mt-1">
                      Store Preferences &amp; Policies
                    </h2>
                    <p className="text-xs sm:text-sm text-[#7E6955] font-sans mt-0.5">
                      Verified operational parameters actively enforced across catalog, checkout, and inventory subsystems.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Active &amp; Enforced
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                  {/* Currency Policy */}
                  <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] uppercase tracking-wider text-[#8C7560] font-semibold">
                        Base Store Currency
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-stone-200 text-stone-700 font-mono font-semibold">
                        {data.preferences.currency.code} ({data.preferences.currency.symbol})
                      </span>
                    </div>
                    <div className="text-sm font-medium text-[#161514]">
                      {data.preferences.currency.description}
                    </div>
                    <p className="text-[11px] text-[#7E6955] leading-relaxed">
                      All storefront pricing, cart totals, discount vouchers, and payment gateway authorizations are strictly standardized in Indian Rupees.
                    </p>
                  </div>

                  {/* Pre-Dispatch Restocking Policy */}
                  <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] uppercase tracking-wider text-[#8C7560] font-semibold">
                        Pre-Dispatch Restock Guard
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                        Automated
                      </span>
                    </div>
                    <div className="text-sm font-medium text-[#161514]">
                      ACID Inventory Reversion
                    </div>
                    <p className="text-[11px] text-[#7E6955] leading-relaxed">
                      {data.preferences.orders.preDispatchRestockPolicy}
                    </p>
                  </div>

                  {/* Post-Dispatch Restocking Policy */}
                  <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] uppercase tracking-wider text-[#8C7560] font-semibold">
                        Post-Dispatch Return Policy
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-stone-200 text-stone-700 font-semibold">
                        Manual Verification
                      </span>
                    </div>
                    <div className="text-sm font-medium text-[#161514]">
                      Physical Inspection Gate
                    </div>
                    <p className="text-[11px] text-[#7E6955] leading-relaxed">
                      {data.preferences.orders.postDispatchRestockPolicy}
                    </p>
                  </div>

                  {/* Payment Evidence Guard */}
                  <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] uppercase tracking-wider text-[#8C7560] font-semibold">
                        Payment Auditing Guard
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-semibold">
                        Required
                      </span>
                    </div>
                    <div className="text-sm font-medium text-[#161514]">
                      Verified Audit Trail
                    </div>
                    <p className="text-[11px] text-[#7E6955] leading-relaxed">
                      {data.preferences.orders.paymentEvidencePolicy}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================
             TAB D: NOTIFICATIONS
             =================================================== */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#DFCBB8]/80 shadow-2xs space-y-6">
                <div className="flex items-start justify-between gap-4 border-b border-[#DFCBB8]/50 pb-5">
                  <div>
                    <span className="text-[10px] font-sans font-semibold uppercase tracking-widest text-[#B88746]">
                      Communication Subsystems
                    </span>
                    <h2 className="text-xl sm:text-2xl font-serif text-[#161514] tracking-tight mt-1">
                      Notification Services Status
                    </h2>
                    <p className="text-xs sm:text-sm text-[#7E6955] font-sans mt-0.5">
                      Authentic status report of active communication mechanisms. No nonfunctional switches or simulated background mailers.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-200">
                    System Audit
                  </span>
                </div>

                <div className="space-y-4 text-xs font-sans">
                  {/* Concierge Inquiries */}
                  <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/60 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <h4 className="text-sm font-medium text-[#161514]">
                          Concierge Inquiries &amp; Collaboration Requests
                        </h4>
                      </div>
                      <p className="text-[11.5px] text-[#7E6955] leading-relaxed">
                        {data.notifications.conciergeInquiries.description}
                      </p>
                      <div className="text-[10.5px] font-mono text-stone-500 pt-1">
                        Pipeline: {data.notifications.conciergeInquiries.channel}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                      Active
                    </span>
                  </div>

                  {/* Order Confirmation */}
                  <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/60 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <h4 className="text-sm font-medium text-[#161514]">
                          Customer Order Confirmation Receipt
                        </h4>
                      </div>
                      <p className="text-[11.5px] text-[#7E6955] leading-relaxed">
                        {data.notifications.orderConfirmation.description}
                      </p>
                      <div className="text-[10.5px] font-mono text-stone-500 pt-1">
                        Pipeline: {data.notifications.orderConfirmation.channel}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                      Active
                    </span>
                  </div>

                  {/* Automated Outbound SMTP / SMS Webhook */}
                  <div className="p-5 rounded-2xl bg-amber-50/40 border border-amber-200/70 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <h4 className="text-sm font-medium text-amber-950">
                          Automated Outbound SMTP &amp; WhatsApp Notifications
                        </h4>
                      </div>
                      <p className="text-[11.5px] text-amber-900/80 leading-relaxed">
                        {data.notifications.automatedOutboundMail.description}
                      </p>
                      <div className="text-[10.5px] font-mono text-stone-500 pt-1">
                        Channel: Direct WhatsApp Concierge Link (Active at +91 9650218876) • Automated Gateway (Unconfigured)
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase bg-stone-200/80 text-stone-700 shrink-0">
                      Pending Provider
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
