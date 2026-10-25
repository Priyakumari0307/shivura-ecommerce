"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  OrderStatusType,
  PaymentStatusType,
} from "@/lib/validation/order";

export interface OrderItemData {
  id: string;
  productId: string | null;
  productName: string;
  sku: string | null;
  variantInfo: string | null;
  price: number;
  quantity: number;
  subtotal: number;
  product?: {
    id: string;
    name: string;
    slug: string;
    sku: string | null;
    primaryImage: { url: string; altText: string | null } | null;
  } | null;
}

export interface PaymentRecordData {
  id: string;
  provider: string;
  paymentId: string | null;
  providerOrderId: string | null;
  amount: number;
  status: PaymentStatusType;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  status: OrderStatusType;
  paymentStatus: PaymentStatusType;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  itemCount: number;
  items: OrderItemData[];
  payments: PaymentRecordData[];
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrdersSummaryStats {
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  paidOrders: number;
  collectedRevenue: number;
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

export default function OrdersManagementClient() {
  const [, startTransition] = useTransition();

  // Data states
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [summary, setSummary] = useState<OrdersSummaryStats>({
    totalOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    paidOrders: 0,
    collectedRevenue: 0,
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
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortOption, setSortOption] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderListItem | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Status update dialog state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newOrderStatus, setNewOrderStatus] = useState<OrderStatusType | "">("");
  const [newPaymentStatus, setNewPaymentStatus] = useState<PaymentStatusType | "">("");
  const [paymentEvidence, setPaymentEvidence] = useState("");
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

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (paymentFilter && paymentFilter !== "ALL") params.set("paymentStatus", paymentFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (sortOption) params.set("sort", sortOption);
      params.set("page", currentPage.toString());
      params.set("limit", "10");

      const response = await fetch(`/api/crm/orders?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch orders (${response.status})`);
      }

      const json = await response.json();
      if (json.success) {
        startTransition(() => {
          setOrders(json.data || []);
          if (json.pagination) setPagination(json.pagination);
          if (json.summary) setSummary(json.summary);
        });
      } else {
        throw new Error(json.error || "Unexpected response while loading orders");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error connecting to server");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, paymentFilter, dateFrom, dateTo, sortOption, currentPage]);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      await Promise.resolve();
      if (!ignore) {
        await fetchOrders();
      }
    })();
    return () => {
      ignore = true;
    };
  }, [fetchOrders]);

  // Fetch single order details
  const openOrderDetails = async (orderId: string) => {
    setDetailsLoading(true);
    setUpdateError(null);
    setUpdateSuccess(null);

    try {
      const res = await fetch(`/api/crm/orders/${orderId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load order details");
      }
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedOrder(json.data);
        setNewOrderStatus(json.data.status);
        setNewPaymentStatus(json.data.paymentStatus);
        setPaymentEvidence("");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not open order details");
    } finally {
      setDetailsLoading(false);
    }
  };

  // Submit status update
  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setUpdatingStatus(true);
    setUpdateError(null);
    setUpdateSuccess(null);

    try {
      const payload: {
        status?: OrderStatusType;
        paymentStatus?: PaymentStatusType;
        paymentEvidence?: string;
      } = {};

      if (newOrderStatus && newOrderStatus !== selectedOrder.status) {
        payload.status = newOrderStatus;
      }
      if (newPaymentStatus && newPaymentStatus !== selectedOrder.paymentStatus) {
        payload.paymentStatus = newPaymentStatus;
      }
      if (paymentEvidence.trim()) {
        payload.paymentEvidence = paymentEvidence.trim();
      }

      if (!payload.status && !payload.paymentStatus) {
        setUpdateError("No changes detected. Select a different order or payment status.");
        setUpdatingStatus(false);
        return;
      }

      const res = await fetch(`/api/crm/orders/${selectedOrder.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || `Status update failed (${res.status})`);
      }

      setUpdateSuccess(json.message || "Order status updated successfully.");
      // Refresh single order details and list
      await openOrderDetails(selectedOrder.id);
      fetchOrders();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Error executing status update");
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

  // Reset filters
  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSortOption("newest");
    setCurrentPage(1);
  };

  // Status badge styling helper
  const getOrderStatusBadge = (status: OrderStatusType) => {
    switch (status) {
      case "DELIVERED":
        return "bg-emerald-50 text-emerald-800 border-emerald-300";
      case "SHIPPED":
        return "bg-indigo-50 text-indigo-800 border-indigo-300";
      case "PROCESSING":
      case "CONFIRMED":
        return "bg-sky-50 text-sky-800 border-sky-300";
      case "PENDING":
        return "bg-amber-50 text-amber-800 border-amber-300";
      case "CANCELLED":
        return "bg-rose-50 text-rose-800 border-rose-300";
      case "REFUNDED":
        return "bg-purple-50 text-purple-800 border-purple-300";
      default:
        return "bg-stone-50 text-stone-700 border-stone-200";
    }
  };

  const getPaymentStatusBadge = (status: PaymentStatusType) => {
    switch (status) {
      case "PAID":
        return "bg-emerald-50 text-emerald-800 border-emerald-300";
      case "PENDING":
        return "bg-amber-50 text-amber-800 border-amber-300";
      case "FAILED":
        return "bg-rose-50 text-rose-800 border-rose-300";
      case "REFUNDED":
        return "bg-purple-50 text-purple-800 border-purple-300";
      default:
        return "bg-stone-50 text-stone-700 border-stone-200";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
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

  const isFiltersActive =
    Boolean(search) ||
    statusFilter !== "ALL" ||
    paymentFilter !== "ALL" ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    sortOption !== "newest";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DFCBB8]/50">
        <div>
          <div className="flex items-center space-x-2 text-xs text-[#7E6955] mb-1 font-sans">
            <Link href="/CRM" className="hover:text-[#1C2820] transition-colors">
              CRM
            </Link>
            <span>/</span>
            <span className="text-[#1C2820] font-medium">Orders Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#1C2820] tracking-tight">
            Orders Management
          </h1>
          <p className="text-xs sm:text-sm text-[#7E6955] mt-1 font-sans">
            Monitor customer purchases, fulfill shipment states, and verify collected revenue.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => fetchOrders()}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#DFCBB8] text-xs font-sans text-[#1C2820] hover:bg-[#FAF7F2] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh order records"
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

      {/* 2. Real-Time Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFCBB8]/70 shadow-2xs relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#7E6955] mb-2">
            <span className="text-[11px] sm:text-xs font-sans uppercase tracking-wider font-medium">
              Total Orders
            </span>
            <span className="p-1.5 rounded-lg bg-[#FAF5EB] text-[#B88746]">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-serif text-[#1C2820] font-normal tracking-tight">
            {summary.totalOrders}
          </div>
          <p className="text-[11px] text-[#7E6955] mt-1 font-sans">All customer orders</p>
        </div>

        {/* Pending Fulfillment */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFCBB8]/70 shadow-2xs relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#7E6955] mb-2">
            <span className="text-[11px] sm:text-xs font-sans uppercase tracking-wider font-medium">
              Pending Fulfillment
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-serif text-amber-900 font-normal tracking-tight">
            {summary.pendingOrders}
          </div>
          <p className="text-[11px] text-[#7E6955] mt-1 font-sans">Pending or in processing</p>
        </div>

        {/* Delivered Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFCBB8]/70 shadow-2xs relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#7E6955] mb-2">
            <span className="text-[11px] sm:text-xs font-sans uppercase tracking-wider font-medium">
              Delivered
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-serif text-emerald-950 font-normal tracking-tight">
            {summary.deliveredOrders}
          </div>
          <p className="text-[11px] text-[#7E6955] mt-1 font-sans">Completed deliveries</p>
        </div>

        {/* Collected Revenue */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFCBB8]/70 shadow-2xs relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#7E6955] mb-2">
            <span className="text-[11px] sm:text-xs font-sans uppercase tracking-wider font-medium">
              Collected Revenue
            </span>
            <span className="p-1.5 rounded-lg bg-[#FAF5EB] text-[#B88746]">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-serif text-[#1C2820] font-normal tracking-tight">
            {formatCurrency(summary.collectedRevenue)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-emerald-800 font-sans font-medium mt-1 truncate">
            ✓ Verified Paid Orders ({summary.paidOrders})
          </p>
        </div>
      </div>

      {/* 3. Search, Filter & Date Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFCBB8]/70 shadow-2xs space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Keyword Search */}
          <div className="md:col-span-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7E6955]">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order #, name, email, phone..."
              className="w-full pl-9 pr-3 py-2 text-xs font-sans rounded-xl border border-[#DFCBB8] bg-[#FAF7F2]/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1C2820] focus:border-[#1C2820] transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#7E6955] hover:text-[#1C2820]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Fulfillment Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 text-xs font-sans rounded-xl border border-[#DFCBB8] bg-[#FAF7F2]/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1C2820] transition-colors"
            >
              <option value="ALL">All Order Statuses</option>
              {ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st.charAt(0) + st.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div className="md:col-span-2">
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 text-xs font-sans rounded-xl border border-[#DFCBB8] bg-[#FAF7F2]/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1C2820] transition-colors"
            >
              <option value="ALL">All Payment Statuses</option>
              {PAYMENT_STATUSES.map((pst) => (
                <option key={pst} value={pst}>
                  {pst.charAt(0) + pst.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: From */}
          <div className="md:col-span-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              title="Filter orders from date"
              className="w-full py-2 px-2.5 text-xs font-sans rounded-xl border border-[#DFCBB8] bg-[#FAF7F2]/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1C2820] text-[#1C2820] transition-colors"
            />
          </div>

          {/* Date Range: To */}
          <div className="md:col-span-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              title="Filter orders to date"
              className="w-full py-2 px-2.5 text-xs font-sans rounded-xl border border-[#DFCBB8] bg-[#FAF7F2]/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1C2820] text-[#1C2820] transition-colors"
            />
          </div>
        </div>

        {/* Secondary Row: Active Filter Summary & Sort */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-[#DFCBB8]/40 text-xs text-[#7E6955]">
          <div className="flex items-center space-x-2 flex-wrap">
            <span>
              Showing <strong className="text-[#1C2820]">{pagination.total}</strong> matching order(s)
            </span>
            {isFiltersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-[#B88746] hover:text-[#9C6E33] underline font-medium cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <span className="text-xs">Sort:</span>
            <select
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value);
                setCurrentPage(1);
              }}
              className="py-1 px-2.5 text-xs font-sans rounded-lg border border-[#DFCBB8] bg-white focus:outline-none text-[#1C2820]"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="total-desc">Highest Total</option>
              <option value="total-asc">Lowest Total</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchOrders()}
            className="underline font-medium hover:text-rose-950 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. Orders Data Table & Mobile Cards */}
      <div className="bg-white rounded-2xl border border-[#DFCBB8]/70 shadow-2xs overflow-hidden">
        {loading ? (
          /* Skeletons */
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between py-3 border-b border-stone-100">
                <div className="space-y-2 w-1/4">
                  <div className="h-4 bg-stone-200 rounded w-3/4"></div>
                  <div className="h-3 bg-stone-100 rounded w-1/2"></div>
                </div>
                <div className="h-4 bg-stone-200 rounded w-1/5"></div>
                <div className="h-4 bg-stone-200 rounded w-1/6"></div>
                <div className="h-7 bg-stone-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          /* Empty States */
          <div className="py-16 px-6 text-center max-w-md mx-auto">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#FAF5EB] text-[#B88746] flex items-center justify-center mb-4">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            {summary.totalOrders === 0 ? (
              <>
                <h3 className="font-serif text-lg text-[#1C2820] font-normal">
                  No Customer Orders Yet
                </h3>
                <p className="text-xs text-[#7E6955] mt-2 font-sans leading-relaxed">
                  No real customer orders have been placed in the catalog yet. When purchases are completed or manual orders recorded, they will appear here with fulfillment and payment tracking.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-serif text-lg text-[#1C2820] font-normal">
                  No Orders Match Filter
                </h3>
                <p className="text-xs text-[#7E6955] mt-2 font-sans leading-relaxed">
                  We couldn&apos;t find any orders matching your search or status filters.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#FAF5EB] hover:bg-[#F4EBE1] text-[#B88746] text-xs font-sans font-medium transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              </>
            )}
          </div>
        ) : (
          /* Desktop Table & Mobile Card View */
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#FAF7F2] text-[#7E6955] border-b border-[#DFCBB8]/70">
                  <tr>
                    <th className="py-3.5 px-4 font-medium uppercase tracking-wider text-[11px]">
                      Order # & Date
                    </th>
                    <th className="py-3.5 px-4 font-medium uppercase tracking-wider text-[11px]">
                      Customer
                    </th>
                    <th className="py-3.5 px-4 font-medium uppercase tracking-wider text-[11px]">
                      Items
                    </th>
                    <th className="py-3.5 px-4 font-medium uppercase tracking-wider text-[11px]">
                      Total
                    </th>
                    <th className="py-3.5 px-4 font-medium uppercase tracking-wider text-[11px]">
                      Payment Status
                    </th>
                    <th className="py-3.5 px-4 font-medium uppercase tracking-wider text-[11px]">
                      Fulfillment Status
                    </th>
                    <th className="py-3.5 px-4 font-medium uppercase tracking-wider text-[11px] text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFCBB8]/40">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-[#FAF7F2]/50 transition-colors group cursor-pointer"
                      onClick={() => openOrderDetails(order.id)}
                    >
                      {/* Order # and Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-serif font-medium text-[#1C2820] group-hover:text-[#B88746] transition-colors">
                          {order.orderNumber}
                        </div>
                        <div className="text-[11px] text-[#7E6955] mt-0.5">
                          {formatDate(order.createdAt)}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#1C2820]">{order.customerName}</div>
                        <div className="text-[11px] text-[#7E6955] truncate max-w-[180px]">
                          {order.customerEmail}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4">
                        <div className="text-[#1C2820] font-medium">
                          {order.itemCount} unit(s)
                        </div>
                        <div className="text-[11px] text-[#7E6955] truncate max-w-[160px]">
                          {order.items[0]?.productName || "Direct Order"}
                          {order.items.length > 1 && ` +${order.items.length - 1} more`}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4">
                        <div className="font-serif font-medium text-[#1C2820]">
                          {formatCurrency(order.total)}
                        </div>
                        {order.discount > 0 && (
                          <div className="text-[10px] text-emerald-700">
                            Disc: {formatCurrency(order.discount)}
                          </div>
                        )}
                      </td>

                      {/* Payment Status Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${getPaymentStatusBadge(
                            order.paymentStatus
                          )}`}
                        >
                          {order.paymentStatus}
                        </span>
                      </td>

                      {/* Fulfillment Status Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${getOrderStatusBadge(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrderDetails(order.id);
                          }}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#FAF5EB] hover:bg-[#F4EBE1] text-[#B88746] font-medium text-xs transition-colors cursor-pointer"
                        >
                          <span>Inspect</span>
                          <span>→</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-[#DFCBB8]/40">
              {orders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => openOrderDetails(order.id)}
                  className="p-4 space-y-3 hover:bg-[#FAF7F2]/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-serif font-medium text-[#1C2820] text-sm">
                        {order.orderNumber}
                      </span>
                      <div className="text-[11px] text-[#7E6955]">{formatDate(order.createdAt)}</div>
                    </div>
                    <div className="text-right font-serif text-sm font-medium text-[#1C2820]">
                      {formatCurrency(order.total)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#7E6955]">
                    <div>
                      <div className="text-[#1C2820] font-medium">{order.customerName}</div>
                      <div className="text-[11px]">{order.customerPhone}</div>
                    </div>
                    <div className="text-right text-[11px]">
                      {order.itemCount} unit(s)
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${getPaymentStatusBadge(
                          order.paymentStatus
                        )}`}
                      >
                        {order.paymentStatus}
                      </span>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${getOrderStatusBadge(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openOrderDetails(order.id);
                      }}
                      className="text-xs text-[#B88746] font-medium hover:underline"
                    >
                      Inspect →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="p-4 bg-[#FAF7F2]/60 border-t border-[#DFCBB8]/50 flex items-center justify-between text-xs font-sans text-[#7E6955]">
                <div>
                  Page <strong className="text-[#1C2820]">{pagination.page}</strong> of{" "}
                  <strong className="text-[#1C2820]">{pagination.totalPages}</strong>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={!pagination.hasPrevPage || loading}
                    className="px-3 py-1.5 rounded-lg border border-[#DFCBB8] bg-white hover:bg-[#FAF7F2] text-[#1C2820] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={!pagination.hasNextPage || loading}
                    className="px-3 py-1.5 rounded-lg border border-[#DFCBB8] bg-white hover:bg-[#FAF7F2] text-[#1C2820] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Order Details Modal / Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-[#FAF7F2] w-full max-w-3xl rounded-2xl border border-[#DFCBB8] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-white border-b border-[#DFCBB8]/70 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-serif text-lg sm:text-xl font-medium text-[#1C2820]">
                    {selectedOrder.orderNumber}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${getOrderStatusBadge(
                      selectedOrder.status
                    )}`}
                  >
                    {selectedOrder.status}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${getPaymentStatusBadge(
                      selectedOrder.paymentStatus
                    )}`}
                  >
                    {selectedOrder.paymentStatus}
                  </span>
                </div>
                <p className="text-[11px] text-[#7E6955] mt-1 font-sans">
                  Placed on {formatDate(selectedOrder.createdAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-[#DFCBB8]/50 flex items-center justify-center text-[#7E6955] hover:text-[#1C2820] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content Scrollable Area */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs font-sans">
              {detailsLoading ? (
                <div className="py-12 text-center text-[#7E6955] animate-pulse">
                  Loading order intelligence...
                </div>
              ) : (
                <>
                  {/* Customer Snapshot & Shipping Address */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Customer Info */}
                    <div className="p-4 bg-white rounded-xl border border-[#DFCBB8]/70 space-y-2">
                      <div className="text-[11px] font-sans uppercase font-medium text-[#B88746] tracking-wider">
                        Customer Snapshot
                      </div>
                      <div className="text-sm font-medium text-[#1C2820]">
                        {selectedOrder.customerName}
                      </div>
                      <div className="text-[#7E6955] flex items-center justify-between">
                        <span>Email:</span>
                        <span className="text-[#1C2820] font-mono">{selectedOrder.customerEmail}</span>
                      </div>
                      <div className="text-[#7E6955] flex items-center justify-between">
                        <span>Phone:</span>
                        <span className="text-[#1C2820] font-mono">{selectedOrder.customerPhone}</span>
                      </div>
                      <div className="text-[#7E6955] flex items-center justify-between pt-1 border-t border-stone-100">
                        <span>Account Type:</span>
                        <span className="text-[#1C2820]">
                          {selectedOrder.userId ? "Registered Customer" : "Guest Checkout"}
                        </span>
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div className="p-4 bg-white rounded-xl border border-[#DFCBB8]/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-sans uppercase font-medium text-[#B88746] tracking-wider">
                          Shipping Address
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const fullAddr = `${selectedOrder.shippingAddressLine1}, ${
                              selectedOrder.shippingAddressLine2 ? selectedOrder.shippingAddressLine2 + ", " : ""
                            }${selectedOrder.shippingCity}, ${selectedOrder.shippingState} - ${
                              selectedOrder.shippingPostalCode
                            }, ${selectedOrder.shippingCountry}`;
                            copyToClipboard(fullAddr, "address");
                          }}
                          className="text-[11px] text-[#B88746] hover:underline"
                        >
                          {copiedField === "address" ? "✓ Copied" : "Copy Address"}
                        </button>
                      </div>
                      <div className="text-[#1C2820] leading-relaxed">
                        <div>{selectedOrder.shippingAddressLine1}</div>
                        {selectedOrder.shippingAddressLine2 && (
                          <div>{selectedOrder.shippingAddressLine2}</div>
                        )}
                        <div>
                          {selectedOrder.shippingCity}, {selectedOrder.shippingState} -{" "}
                          <span className="font-mono">{selectedOrder.shippingPostalCode}</span>
                        </div>
                        <div className="text-[#7E6955]">{selectedOrder.shippingCountry}</div>
                      </div>
                    </div>
                  </div>

                  {/* Purchased Items List */}
                  <div className="bg-white rounded-xl border border-[#DFCBB8]/70 overflow-hidden">
                    <div className="p-3 bg-[#FAF7F2] border-b border-[#DFCBB8]/60 text-[11px] font-medium text-[#7E6955] uppercase tracking-wider">
                      Itemized Purchased Units ({selectedOrder.items.length})
                    </div>
                    <div className="divide-y divide-stone-100">
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} className="p-3.5 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {item.product?.primaryImage ? (
                              <div className="w-10 h-10 rounded-lg overflow-hidden relative bg-stone-100 flex-shrink-0">
                                <Image
                                  src={item.product.primaryImage.url}
                                  alt={item.product.primaryImage.altText || item.productName}
                                  fill
                                  sizes="40px"
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 flex-shrink-0">
                                🛍️
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-[#1C2820]">{item.productName}</div>
                              <div className="text-[11px] text-[#7E6955]">
                                {item.sku ? `SKU: ${item.sku}` : "No SKU"}
                                {item.variantInfo && ` | ${item.variantInfo}`}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-medium text-[#1C2820]">
                              {formatCurrency(item.subtotal)}
                            </div>
                            <div className="text-[11px] text-[#7E6955]">
                              {item.quantity} × {formatCurrency(item.price)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pricing Summary */}
                    <div className="p-4 bg-[#FAF7F2]/60 border-t border-[#DFCBB8]/50 space-y-1.5 text-xs">
                      <div className="flex justify-between text-[#7E6955]">
                        <span>Items Subtotal:</span>
                        <span className="font-mono">{formatCurrency(selectedOrder.subtotal)}</span>
                      </div>
                      {selectedOrder.discount > 0 && (
                        <div className="flex justify-between text-emerald-800">
                          <span>Discount Deduction:</span>
                          <span className="font-mono">-{formatCurrency(selectedOrder.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[#7E6955]">
                        <span>Shipping Freight:</span>
                        <span className="font-mono">{formatCurrency(selectedOrder.shippingFee)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-serif font-medium text-[#1C2820] pt-2 border-t border-[#DFCBB8]/60">
                        <span>Total Payable:</span>
                        <span className="text-[#B88746] font-mono">
                          {formatCurrency(selectedOrder.total)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Records Section */}
                  <div className="bg-white rounded-xl border border-[#DFCBB8]/70 p-4 space-y-3">
                    <div className="text-[11px] font-sans uppercase font-medium text-[#B88746] tracking-wider">
                      Payment Verification Records
                    </div>
                    {selectedOrder.payments.length === 0 ? (
                      <div className="text-[#7E6955] text-xs py-2 italic">
                        No online or manual gateway transactions recorded for this order yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-stone-100 text-xs">
                        {selectedOrder.payments.map((p) => (
                          <div key={p.id} className="py-2.5 flex items-center justify-between">
                            <div>
                              <div className="font-medium text-[#1C2820]">
                                Provider: {p.provider} ({p.status})
                              </div>
                              <div className="text-[11px] text-[#7E6955] font-mono">
                                Ref ID: {p.paymentId || "None"}
                                {p.providerOrderId && ` | Order: ${p.providerOrderId}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium font-serif text-[#1C2820]">
                                {formatCurrency(p.amount)}
                              </div>
                              <div className="text-[10px] text-[#7E6955]">{formatDate(p.createdAt)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Administrative Status Transition Management */}
                  <form onSubmit={handleStatusUpdate} className="bg-white rounded-xl border border-[#DFCBB8]/70 p-4 sm:p-5 space-y-4">
                    <div className="text-[11px] font-sans uppercase font-medium text-[#1C2820] tracking-wider pb-1 border-b border-stone-100">
                      Administrative Status Transitions
                    </div>

                    {updateError && (
                      <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                        ⚠️ {updateError}
                      </div>
                    )}

                    {updateSuccess && (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                        ✓ {updateSuccess}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Order Fulfillment Status */}
                      <div>
                        <label className="block text-xs font-medium text-[#1C2820] mb-1">
                          Order Fulfillment Status
                        </label>
                        <select
                          value={newOrderStatus}
                          onChange={(e) => setNewOrderStatus(e.target.value as OrderStatusType)}
                          className="w-full py-2 px-3 text-xs rounded-xl border border-[#DFCBB8] bg-[#FAF7F2]/60 focus:bg-white text-[#1C2820]"
                        >
                          {ORDER_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Payment Status */}
                      <div>
                        <label className="block text-xs font-medium text-[#1C2820] mb-1">
                          Payment Status
                        </label>
                        <select
                          value={newPaymentStatus}
                          onChange={(e) => setNewPaymentStatus(e.target.value as PaymentStatusType)}
                          className="w-full py-2 px-3 text-xs rounded-xl border border-[#DFCBB8] bg-[#FAF7F2]/60 focus:bg-white text-[#1C2820]"
                        >
                          {PAYMENT_STATUSES.map((pst) => (
                            <option key={pst} value={pst}>
                              {pst}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Conditional Payment Evidence Input */}
                    {newPaymentStatus === "PAID" && selectedOrder.paymentStatus !== "PAID" && (
                      <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
                        <label className="block text-xs font-medium text-amber-900">
                          Payment Verification Evidence (Required)
                        </label>
                        <input
                          type="text"
                          required
                          value={paymentEvidence}
                          onChange={(e) => setPaymentEvidence(e.target.value)}
                          placeholder="e.g. Bank UTR, Razorpay Payment ID, or manual receipt #"
                          className="w-full py-2 px-3 text-xs rounded-lg border border-amber-300 bg-white text-[#1C2820] focus:outline-none"
                        />
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          🛡️ Per security and audit policy, orders cannot be marked as PAID without verified evidence.
                        </p>
                      </div>
                    )}

                    {/* Stock Policy Callout */}
                    <div className="text-[11px] text-[#7E6955] bg-[#FAF5EB]/60 p-3 rounded-lg border border-[#DFCBB8]/40 leading-relaxed">
                      ℹ️ <strong>Stock Policy Notice</strong>: Product catalog inventory is not automatically decremented or restored in Stage 7A because storefront checkout operates without an automated stock reservation system.
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={updatingStatus}
                        className="px-5 py-2.5 rounded-xl bg-[#1C2820] hover:bg-[#2B3B30] text-[#FAF5EB] text-xs font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {updatingStatus ? "Saving Changes..." : "Save Status Changes"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-white border-t border-[#DFCBB8]/60 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#DFCBB8]/50 text-[#1C2820] text-xs font-medium cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
