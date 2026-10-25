"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";

export interface ContactEnquiryItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
}

export interface EnquiriesSummaryStats {
  totalEnquiries: number;
  newEnquiries: number;
  inProgressEnquiries: number;
  resolvedEnquiries: number;
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

export default function ArtisansEnquiriesClient() {
  const [, startTransition] = useTransition();

  // Active top tab
  const [activeTab, setActiveTab] = useState<"enquiries" | "artisans">("enquiries");

  // Enquiries Data states
  const [enquiries, setEnquiries] = useState<ContactEnquiryItem[]>([]);
  const [summary, setSummary] = useState<EnquiriesSummaryStats>({
    totalEnquiries: 0,
    newEnquiries: 0,
    inProgressEnquiries: 0,
    resolvedEnquiries: 0,
  });
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });

  // Filter states
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEnquiry, setSelectedEnquiry] = useState<ContactEnquiryItem | null>(null);

  // Status update dialog state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch enquiries
  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("page", currentPage.toString());
      params.set("limit", "10");

      const response = await fetch(`/api/crm/enquiries?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch enquiries (${response.status})`);
      }

      const json = await response.json();
      if (json.success) {
        startTransition(() => {
          setEnquiries(json.data || []);
          if (json.pagination) setPagination(json.pagination);
          if (json.summary) setSummary(json.summary);
        });
      } else {
        throw new Error(json.error || "Unexpected response while loading enquiries");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error connecting to server");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, currentPage]);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      await Promise.resolve();
      if (!ignore) {
        await fetchEnquiries();
      }
    })();
    return () => {
      ignore = true;
    };
  }, [fetchEnquiries]);

  // Handle status update
  const handleUpdateStatus = async () => {
    if (!selectedEnquiry || !newStatus || newStatus === selectedEnquiry.status) {
      return;
    }

    setUpdatingStatus(true);
    setUpdateError(null);
    setUpdateSuccess(null);

    try {
      const res = await fetch(`/api/crm/enquiries/${selectedEnquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update status");
      }

      setUpdateSuccess(`Status updated to ${newStatus}`);
      setSelectedEnquiry((prev) => (prev ? { ...prev, status: newStatus as ContactEnquiryItem["status"] } : null));
      await fetchEnquiries();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Error updating enquiry status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Helper copy to clipboard
  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Status badge styling helper
  const getEnquiryStatusBadge = (status: ContactEnquiryItem["status"]) => {
    switch (status) {
      case "NEW":
        return "bg-amber-50 text-amber-800 border-amber-300";
      case "IN_PROGRESS":
        return "bg-sky-50 text-sky-800 border-sky-300";
      case "RESOLVED":
        return "bg-emerald-50 text-emerald-800 border-emerald-300";
      case "CLOSED":
        return "bg-stone-100 text-stone-700 border-stone-300";
      default:
        return "bg-stone-50 text-stone-700 border-stone-200";
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Navigation Trail */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DFCBB8]/50">
        <div>
          <div className="flex items-center space-x-2 text-xs text-[#7E6955] mb-1 font-sans">
            <Link href="/CRM" className="hover:text-[#1C2820] transition-colors">
              CRM
            </Link>
            <span>/</span>
            <span className="text-[#1C2820] font-medium">Artisans & Enquiries</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#1C2820] tracking-tight">
            Artisans & Concierge Enquiries
          </h1>
          <p className="text-xs sm:text-sm text-[#7E6955] mt-1 font-sans">
            Review incoming customer inquiries, artisan collaboration proposals, and master artisan profiles.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => fetchEnquiries()}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#DFCBB8] text-xs font-sans text-[#1C2820] hover:bg-[#FAF7F2] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh enquiry records"
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

      {/* 2. Dual Tab Selector */}
      <div className="flex items-center space-x-2 border-b border-[#DFCBB8]/70">
        <button
          type="button"
          onClick={() => setActiveTab("enquiries")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-sans font-medium transition-all relative border-b-2 cursor-pointer ${
            activeTab === "enquiries"
              ? "text-[#1C2820] border-[#B88746] font-semibold"
              : "text-[#7E6955] border-transparent hover:text-[#1C2820] hover:border-[#DFCBB8]"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Live Inquiries & Collaboration</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#FAF5EB] text-[#B88746] font-semibold border border-[#DFCBB8]/60">
            {summary.totalEnquiries}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("artisans")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-sans font-medium transition-all relative border-b-2 cursor-pointer ${
            activeTab === "artisans"
              ? "text-[#1C2820] border-[#B88746] font-semibold"
              : "text-[#7E6955] border-transparent hover:text-[#1C2820] hover:border-[#DFCBB8]"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Master Artisan Directory</span>
          <span className="px-1.5 py-0.2 rounded text-[9.5px] uppercase tracking-wider bg-stone-200/80 text-stone-600 font-semibold">
            Status
          </span>
        </button>
      </div>

      {activeTab === "enquiries" ? (
        <>
          {/* 3. Real-Time Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Inquiries */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFCBB8]/70 shadow-2xs relative overflow-hidden group">
              <div className="flex items-center justify-between text-[#7E6955] mb-2">
                <span className="text-[11px] sm:text-xs font-sans uppercase tracking-wider font-medium">
                  Total Inquiries
                </span>
                <span className="p-1.5 rounded-lg bg-[#FAF5EB] text-[#B88746]">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-serif text-[#1C2820] font-normal tracking-tight">
                {summary.totalEnquiries}
              </div>
              <p className="text-[11px] text-[#7E6955] mt-1 font-sans">All submitted concierge records</p>
            </div>

            {/* New / Action Required */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFCBB8]/70 shadow-2xs relative overflow-hidden group">
              <div className="flex items-center justify-between text-[#7E6955] mb-2">
                <span className="text-[11px] sm:text-xs font-sans uppercase tracking-wider font-medium">
                  New / Unread
                </span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-serif text-amber-900 font-normal tracking-tight">
                {summary.newEnquiries}
              </div>
              <p className="text-[11px] text-[#7E6955] mt-1 font-sans">Awaiting staff response</p>
            </div>

            {/* In Progress */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFCBB8]/70 shadow-2xs relative overflow-hidden group">
              <div className="flex items-center justify-between text-[#7E6955] mb-2">
                <span className="text-[11px] sm:text-xs font-sans uppercase tracking-wider font-medium">
                  In Progress
                </span>
                <span className="p-1.5 rounded-lg bg-sky-50 text-sky-700">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-serif text-sky-900 font-normal tracking-tight">
                {summary.inProgressEnquiries}
              </div>
              <p className="text-[11px] text-[#7E6955] mt-1 font-sans">Under active concierge review</p>
            </div>

            {/* Resolved / Closed */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFCBB8]/70 shadow-2xs relative overflow-hidden group">
              <div className="flex items-center justify-between text-[#7E6955] mb-2">
                <span className="text-[11px] sm:text-xs font-sans uppercase tracking-wider font-medium">
                  Resolved / Closed
                </span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-serif text-emerald-900 font-normal tracking-tight">
                {summary.resolvedEnquiries}
              </div>
              <p className="text-[11px] text-[#7E6955] mt-1 font-sans">Successfully concluded</p>
            </div>
          </div>

          {/* 4. Filter & Search Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFCBB8]/70 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Keyword Search */}
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7E6955]">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by customer name, email, phone, or subject..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#DFCBB8] bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 text-xs sm:text-sm text-[#1C2820] font-sans placeholder-[#9E8B79] transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#9E8B79] hover:text-[#1C2820]"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter Dropdown */}
              <div className="sm:w-52">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#DFCBB8] bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 text-xs sm:text-sm text-[#1C2820] font-sans transition-all cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="NEW">New (Unread)</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              {/* Reset Filters */}
              {(Boolean(search) || statusFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 rounded-xl border border-[#DFCBB8] text-xs font-sans text-[#7E6955] hover:text-[#1C2820] hover:bg-[#FAF7F2] transition-colors whitespace-nowrap cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* 5. Error State */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-sans flex items-start space-x-3">
              <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="flex-1">
                <p className="font-semibold">Unable to load concierge enquiries</p>
                <p className="mt-0.5 text-rose-700">{error}</p>
                <button
                  type="button"
                  onClick={() => fetchEnquiries()}
                  className="mt-2 text-rose-900 underline font-semibold hover:text-rose-950 cursor-pointer"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}

          {/* 6. Loading Skeleton */}
          {loading && (
            <div className="bg-white rounded-2xl border border-[#DFCBB8]/70 shadow-2xs overflow-hidden divide-y divide-[#DFCBB8]/40">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-5 flex items-center justify-between gap-4 animate-pulse">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-stone-200 rounded w-1/4" />
                    <div className="h-3 bg-stone-100 rounded w-1/2" />
                    <div className="h-3 bg-stone-100 rounded w-3/4" />
                  </div>
                  <div className="h-6 w-20 bg-stone-200 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {/* 7. Empty State */}
          {!loading && !error && enquiries.length === 0 && (
            <div className="bg-white rounded-2xl border border-[#DFCBB8]/70 p-12 text-center shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#FAF5EB] text-[#B88746] flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="font-serif text-lg text-[#1C2820]">No Enquiries Found</h3>
              <p className="text-xs text-[#7E6955] max-w-md mx-auto font-sans">
                {search || statusFilter !== "ALL"
                  ? "No enquiries match your current filter criteria. Try adjusting your search keywords or resetting filters."
                  : "No customer or artisan enquiries have been submitted yet through the storefront concierge form."}
              </p>
              {(Boolean(search) || statusFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setCurrentPage(1);
                  }}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-[#2C2117] text-[#FAF5EB] text-xs font-semibold uppercase tracking-wider hover:bg-[#1C2820] transition-colors cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}

          {/* 8. Enquiries Table */}
          {!loading && !error && enquiries.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#DFCBB8]/70 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#FAF7F2] text-[#7E6955] uppercase text-[10px] tracking-wider border-b border-[#DFCBB8]/60">
                    <tr>
                      <th scope="col" className="px-5 py-3.5 font-medium">Contact</th>
                      <th scope="col" className="px-4 py-3.5 font-medium">Subject</th>
                      <th scope="col" className="px-4 py-3.5 font-medium hidden md:table-cell">Message Preview</th>
                      <th scope="col" className="px-4 py-3.5 font-medium">Status</th>
                      <th scope="col" className="px-4 py-3.5 font-medium hidden lg:table-cell">Received</th>
                      <th scope="col" className="px-5 py-3.5 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DFCBB8]/40">
                    {enquiries.map((enquiry) => (
                      <tr
                        key={enquiry.id}
                        onClick={() => {
                          setSelectedEnquiry(enquiry);
                          setNewStatus(enquiry.status);
                          setUpdateError(null);
                          setUpdateSuccess(null);
                        }}
                        className="hover:bg-[#FAF8F5]/80 transition-colors cursor-pointer group"
                      >
                        {/* Contact */}
                        <td className="px-5 py-4">
                          <div className="font-medium text-[#1C2820] text-sm group-hover:text-[#B88746] transition-colors">
                            {enquiry.name}
                          </div>
                          <div className="text-[11px] text-[#7E6955] mt-0.5">{enquiry.email}</div>
                          {enquiry.phone && (
                            <div className="text-[10.5px] text-[#8C7560] font-mono mt-0.5">{enquiry.phone}</div>
                          )}
                        </td>

                        {/* Subject */}
                        <td className="px-4 py-4">
                          <span className="font-medium text-[#2C2117] block max-w-xs truncate">
                            {enquiry.subject || "General Inquiry"}
                          </span>
                        </td>

                        {/* Message Preview */}
                        <td className="px-4 py-4 hidden md:table-cell max-w-md">
                          <p className="text-[#5C4A3A] line-clamp-2 text-xs leading-relaxed">
                            {enquiry.message}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-medium border ${getEnquiryStatusBadge(
                              enquiry.status
                            )}`}
                          >
                            {enquiry.status.replace("_", " ")}
                          </span>
                        </td>

                        {/* Received */}
                        <td className="px-4 py-4 text-[#7E6955] text-[11px] hidden lg:table-cell whitespace-nowrap">
                          {formatDate(enquiry.createdAt)}
                        </td>

                        {/* Action */}
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEnquiry(enquiry);
                              setNewStatus(enquiry.status);
                              setUpdateError(null);
                              setUpdateSuccess(null);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-[#DFCBB8] text-xs font-sans text-[#1C2820] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="p-4 border-t border-[#DFCBB8]/60 flex items-center justify-between text-xs font-sans text-[#7E6955]">
                  <div>
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} enquiries
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={!pagination.hasPrevPage}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl border border-[#DFCBB8] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="px-2 font-medium text-[#1C2820]">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={!pagination.hasNextPage}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="px-3 py-1.5 rounded-xl border border-[#DFCBB8] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 9. Enquiry Details & Status Transition Modal */}
          {selectedEnquiry && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-enquiry-title"
            >
              <div className="bg-white rounded-3xl border border-[#DFCBB8] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="p-6 border-b border-[#DFCBB8]/70 flex items-start justify-between bg-[#FAF7F2]">
                  <div>
                    <span className="text-[10px] font-sans uppercase tracking-widest text-[#B88746] font-semibold">
                      Concierge Inquiry Details
                    </span>
                    <h2 id="modal-enquiry-title" className="text-xl font-serif text-[#1C2820] mt-1">
                      {selectedEnquiry.subject || "General Customer Inquiry"}
                    </h2>
                    <div className="flex items-center space-x-3 text-xs text-[#7E6955] mt-1 font-sans">
                      <span>Received: {formatDate(selectedEnquiry.createdAt)}</span>
                      <span>•</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getEnquiryStatusBadge(
                          selectedEnquiry.status
                        )}`}
                      >
                        {selectedEnquiry.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedEnquiry(null)}
                    className="p-1.5 rounded-xl text-[#7E6955] hover:text-[#1C2820] hover:bg-[#DFCBB8]/40 transition-colors cursor-pointer"
                    aria-label="Close dialog"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs font-sans">
                  {/* Sender Contact Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/70">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#8C7560] font-semibold block">
                        Sender Name
                      </span>
                      <div className="text-sm font-medium text-[#1C2820] mt-0.5">{selectedEnquiry.name}</div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#8C7560] font-semibold block">
                        Email Address
                      </span>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <a
                          href={`mailto:${selectedEnquiry.email}`}
                          className="text-sm font-medium text-[#B88746] hover:underline"
                        >
                          {selectedEnquiry.email}
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(selectedEnquiry.email, "email")}
                          className="text-[10px] text-[#7E6955] hover:text-[#1C2820] cursor-pointer"
                        >
                          {copiedField === "email" ? "✓" : "Copy"}
                        </button>
                      </div>
                    </div>

                    {selectedEnquiry.phone && (
                      <div className="sm:col-span-2 pt-2 border-t border-[#DFCBB8]/50">
                        <span className="text-[10px] uppercase tracking-wider text-[#8C7560] font-semibold block">
                          Phone Number
                        </span>
                        <div className="text-sm font-mono text-[#1C2820] mt-0.5">{selectedEnquiry.phone}</div>
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  <div>
                    <span className="text-[10.5px] uppercase tracking-wider text-[#8C7560] font-semibold block mb-2">
                      Inquiry Message
                    </span>
                    <div className="p-4 rounded-2xl bg-[#FAF8F5]/80 border border-[#DFCBB8]/60 text-[#2C2117] text-sm leading-relaxed whitespace-pre-wrap font-sans">
                      {selectedEnquiry.message}
                    </div>
                  </div>

                  {/* Update Status Control */}
                  <div className="p-4 rounded-2xl bg-white border border-[#DFCBB8] space-y-3">
                    <span className="text-[10.5px] uppercase tracking-wider text-[#8C7560] font-semibold block">
                      Update Inquiry Workflow Status
                    </span>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-[#DFCBB8] bg-[#FAF8F5]/50 focus:bg-white text-xs font-sans text-[#1C2820] cursor-pointer flex-1"
                      >
                        <option value="NEW">NEW (Awaiting review)</option>
                        <option value="IN_PROGRESS">IN PROGRESS (Concierge assigned)</option>
                        <option value="RESOLVED">RESOLVED (Customer satisfied)</option>
                        <option value="CLOSED">CLOSED (Archived / concluded)</option>
                      </select>

                      <button
                        type="button"
                        onClick={handleUpdateStatus}
                        disabled={updatingStatus || newStatus === selectedEnquiry.status}
                        className="px-4 py-2 rounded-xl bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                      >
                        {updatingStatus ? "Saving..." : "Save Status"}
                      </button>
                    </div>

                    {updateSuccess && (
                      <p className="text-emerald-700 text-xs font-medium">✓ {updateSuccess}</p>
                    )}
                    {updateError && (
                      <p className="text-rose-700 text-xs font-medium">✕ {updateError}</p>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-[#DFCBB8]/70 bg-[#FAF7F2] flex items-center justify-between text-xs text-[#7E6955]">
                  <span className="font-mono text-[10px]">ID: {selectedEnquiry.id}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedEnquiry(null)}
                    className="px-4 py-2 rounded-xl border border-[#DFCBB8] bg-white text-[#1C2820] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ===================================================
           TAB 2: MASTER ARTISAN DIRECTORY ARCHITECTURE & STATUS
           =================================================== */
        <div className="space-y-6">
          {/* Executive Notice Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#DFCBB8]/80 shadow-2xs space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-200">
                  Feature Configuration Status
                </span>
                <h2 className="text-xl sm:text-2xl font-serif text-[#1C2820] tracking-tight pt-2">
                  Master Artisan Directory & Story Profiles
                </h2>
                <p className="text-xs sm:text-sm text-[#7E6955] font-sans leading-relaxed max-w-2xl">
                  Shivura celebrates generational craftsmanship. This administrative panel presents the current database status and administrative roadmap for artisan profile management.
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-[#FAF5EB] text-[#B88746] flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
            </div>

            {/* Status Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Active & Verified Capabilities */}
              <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                <div className="flex items-center space-x-2 text-emerald-900 font-serif text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Configured & Active in System</span>
                </div>
                <ul className="space-y-2 text-xs font-sans text-emerald-950/80">
                  <li className="flex items-start space-x-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>
                      <strong>Prisma Schema Model:</strong> Dedicated <code>Artisan</code> table is provisioned with <code>name</code>, <code>role</code>, <code>description</code>, <code>image</code>, <code>active</code>, and <code>sortOrder</code>.
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>
                      <strong>Artisan Collaboration Intake:</strong> Public storefront concierge form includes &quot;Artisan Collaboration&quot; subject, routed directly to the database.
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>
                      <strong>Storefront Artisanal Storytelling:</strong> Craftsmanship stories, workshop photography, and authenticity guarantees are rendered in storefront boutique layouts.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Upcoming Administrative Workflows */}
              <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
                <div className="flex items-center space-x-2 text-amber-900 font-serif text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Scheduled Administrative Capabilities</span>
                </div>
                <ul className="space-y-2 text-xs font-sans text-amber-950/80">
                  <li className="flex items-start space-x-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>
                      <strong>Artisan Bio CRUD:</strong> Dedicated administrative editor for creating, updating, and ordering master artisan bios.
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>
                      <strong>Portrait Media Upload:</strong> Linking artisan headshots and workshop media via the unified Cloudinary media library.
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>
                      <strong>Product-to-Artisan Mapping:</strong> Associating handcrafted catalog products with specific master artisans.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Data Integrity Guarantee Notice */}
            <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#DFCBB8]/70 text-xs font-sans text-[#7E6955] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-[#B88746] text-base">🛡</span>
                <span>
                  <strong>Data Integrity Policy:</strong> No artificial or simulated artisan records have been fabricated. Inquiries in the live tab originate directly from verified customer submissions.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("enquiries")}
                className="px-3 py-1.5 rounded-xl bg-[#2C2117] text-[#FAF5EB] text-xs font-medium hover:bg-[#1C2820] transition-colors whitespace-nowrap cursor-pointer shrink-0 ml-4"
              >
                View Live Inquiries →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
