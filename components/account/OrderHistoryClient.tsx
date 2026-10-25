"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

interface OrderItemSummary {
  id: string;
  productId: string | null;
  productName: string;
  sku: string | null;
  variantInfo: string | null;
  price: number;
  quantity: number;
  subtotal: number;
  imageSrc?: string;
}

interface PaymentSummary {
  id: string;
  provider: string;
  amount: number;
  status: string;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  itemCount: number;
  items: OrderItemSummary[];
  payment: PaymentSummary | null;
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

const getOrderStatusBadge = (status: string) => {
  switch (status.toUpperCase()) {
    case "DELIVERED":
      return {
        label: "Delivered",
        classes: "bg-emerald-50 text-emerald-800 border-emerald-200",
        dot: "bg-emerald-500",
      };
    case "SHIPPED":
      return {
        label: "Shipped",
        classes: "bg-sky-50 text-sky-800 border-sky-200",
        dot: "bg-sky-500",
      };
    case "PROCESSING":
      return {
        label: "Processing",
        classes: "bg-amber-50 text-amber-800 border-amber-200",
        dot: "bg-amber-500",
      };
    case "CONFIRMED":
      return {
        label: "Confirmed",
        classes: "bg-indigo-50 text-indigo-800 border-indigo-200",
        dot: "bg-indigo-500",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        classes: "bg-rose-50 text-rose-800 border-rose-200",
        dot: "bg-rose-500",
      };
    case "REFUNDED":
      return {
        label: "Refunded",
        classes: "bg-stone-100 text-stone-700 border-stone-300",
        dot: "bg-stone-500",
      };
    case "PENDING":
    default:
      return {
        label: "Pending",
        classes: "bg-[#FAF5EB] text-[#8B6B38] border-[#DFCBB8]",
        dot: "bg-[#B88746]",
      };
  }
};

const getPaymentStatusBadge = (status: string, provider?: string) => {
  switch (status.toUpperCase()) {
    case "PAID":
      return {
        label: "Paid",
        classes: "bg-emerald-50 text-emerald-800 border-emerald-200",
      };
    case "FAILED":
      return {
        label: "Payment Failed",
        classes: "bg-rose-50 text-rose-800 border-rose-200",
      };
    case "REFUNDED":
      return {
        label: "Refunded",
        classes: "bg-stone-100 text-stone-700 border-stone-300",
      };
    case "PENDING":
    default:
      return {
        label: provider === "COD" ? "Cash on Delivery (Pending)" : "Pending",
        classes: "bg-amber-50/80 text-amber-900 border-amber-200/80",
      };
  }
};

export default function OrderHistoryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Read current page from URL search params
  const urlPage = parseInt(searchParams.get("page") || "1", 10);
  const currentPage = Number.isInteger(urlPage) && urlPage > 0 ? urlPage : 1;

  const fetchOrders = useCallback(async (pageToLoad: number) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await fetch(`/api/orders?page=${pageToLoad}&limit=10`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (response.status === 401) {
        router.replace("/login?returnUrl=/account/orders");
        return;
      }

      const json = await response.json();

      if (!response.ok || !json.success) {
        setErrorMessage(
          json.error?.message || "Unable to load your order history. Please try again."
        );
        setIsLoading(false);
        return;
      }

      setOrders(json.data || []);
      if (json.pagination) {
        setPagination(json.pagination);
      }
      setIsLoading(false);
    } catch (err) {
      console.error("[Order History Fetch Error]:", err);
      setErrorMessage("Network error occurred while retrieving orders. Please try again.");
      setIsLoading(false);
    }
  }, [router]);

  // Auth guard & initial data fetch
  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated) {
      router.replace("/login?returnUrl=/account/orders");
      return;
    }

    let ignore = false;
    void (async () => {
      await Promise.resolve();
      if (!ignore) {
        fetchOrders(currentPage);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [isAuthLoading, isAuthenticated, currentPage, fetchOrders, router]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === currentPage) return;
    router.push(`/account/orders?page=${newPage}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 1. Loading Skeleton State
  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] py-12 sm:py-16">
        <Container size="default">
          <div className="max-w-4xl mx-auto space-y-8 animate-pulse">
            <div className="space-y-3">
              <div className="h-4 w-32 bg-[#E5DCD1] rounded" />
              <div className="h-9 w-64 bg-[#E5DCD1] rounded-lg" />
              <div className="h-4 w-80 bg-[#E5DCD1] rounded" />
            </div>

            <div className="space-y-4">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="bg-white/80 border border-[#DFCBB8]/60 rounded-3xl p-6 sm:p-8 space-y-4"
                >
                  <div className="flex justify-between items-center pb-4 border-b border-[#EFE7DC]">
                    <div className="h-5 w-44 bg-[#E5DCD1] rounded" />
                    <div className="h-6 w-24 bg-[#E5DCD1] rounded-full" />
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-20 bg-[#E5DCD1] rounded-xl shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-48 bg-[#E5DCD1] rounded" />
                      <div className="h-3 w-32 bg-[#FAF5EB] rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // 2. Error State
  if (errorMessage) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] py-16 sm:py-24 flex items-center">
        <Container size="narrow">
          <div className="bg-white/95 border border-[#DFCBB8]/80 rounded-3xl p-8 sm:p-12 shadow-sm text-center max-w-lg mx-auto space-y-6">
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center mx-auto ring-8 ring-rose-50/60">
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="font-serif text-2xl text-[#2C2117]">Something Went Wrong</h1>
              <p className="text-sm text-[#7E6955]">{errorMessage}</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => fetchOrders(currentPage)}
                className="w-full sm:w-auto"
              >
                Try Again
              </Button>
              <Button href="/shop" variant="outline" size="md" className="w-full sm:w-auto">
                Explore Shop
              </Button>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // 3. Empty Orders State
  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] py-16 sm:py-24">
        <Container size="narrow">
          <div className="bg-white/95 border border-[#DFCBB8]/70 rounded-3xl p-8 sm:p-16 text-center max-w-xl mx-auto shadow-2xs space-y-6">
            <div className="w-20 h-20 rounded-full bg-[#FAF5EB] text-[#B88746] flex items-center justify-center mx-auto border border-[#DFCBB8]/80 ring-8 ring-[#FAF5EB]/60">
              <svg
                className="w-10 h-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[#B88746] bg-[#FAF5EB] px-3.5 py-1 rounded-full border border-[#DFCBB8]/70 inline-block">
                Order History
              </span>
              <h1 className="font-serif text-3xl text-[#2C2117]">No Orders Yet</h1>
              <p className="text-sm text-[#7E6955] leading-relaxed max-w-md mx-auto">
                You haven&apos;t placed any orders yet. Explore our handcrafted collection of luxury artisanal frames, photo keepsakes, and festival treasures.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button href="/shop" variant="primary" size="lg" className="w-full sm:w-auto">
                Start Shopping
              </Button>
              <Button href="/wishlist" variant="outline" size="lg" className="w-full sm:w-auto">
                View Wishlist
              </Button>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // 4. Polished Order History List
  return (
    <div className="min-h-screen bg-[#FAF8F5] py-12 sm:py-16 selection:bg-[#B88746]/20">
      <Container size="default">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-[#DFCBB8]/70">
            <div>
              <span className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[#B88746] bg-[#FAF5EB] px-3 py-1 rounded-full border border-[#DFCBB8]/70 inline-block mb-2">
                Customer Account
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl text-[#2C2117] tracking-tight">
                My Orders
              </h1>
              <p className="text-sm text-[#7E6955] pt-1">
                View your past purchases, delivery progress, and verified order details.
              </p>
            </div>

            <div className="shrink-0 flex items-center space-x-2 text-xs text-[#7E6955] bg-white border border-[#DFCBB8] rounded-full px-4 py-2">
              <span>Total Orders:</span>
              <span className="font-mono font-semibold text-[#2C2117]">{pagination.total}</span>
            </div>
          </div>

          {/* Orders Cards List */}
          <div className="space-y-6">
            {orders.map((order) => {
              const orderBadge = getOrderStatusBadge(order.status);
              const paymentBadge = getPaymentStatusBadge(
                order.paymentStatus,
                order.payment?.provider
              );
              const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              const viewOrderHref = `/checkout/success?orderNumber=${encodeURIComponent(
                order.orderNumber
              )}&orderId=${encodeURIComponent(order.id)}`;

              return (
                <div
                  key={order.id}
                  className="bg-white/95 border border-[#DFCBB8]/70 rounded-3xl p-6 sm:p-8 shadow-2xs hover:border-[#B88746]/60 transition-all duration-200 space-y-6"
                >
                  {/* Order Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#EFE7DC]">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-[#7E6955]">Order No:</span>
                        <span className="font-mono text-sm font-semibold text-[#2C2117]">
                          #{order.orderNumber}
                        </span>
                      </div>
                      <p className="text-xs text-[#7E6955]">Placed on {orderDate}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Order Status Badge */}
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-sans font-medium border ${orderBadge.classes}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${orderBadge.dot}`} />
                        {orderBadge.label}
                      </span>

                      {/* Payment Status Badge */}
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-sans font-medium border ${paymentBadge.classes}`}
                      >
                        {paymentBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="space-y-3">
                    {order.items.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center space-x-4">
                        {/* Thumbnail */}
                        <div className="relative w-14 h-16 sm:w-16 sm:h-20 bg-[#FAF8F5] rounded-xl overflow-hidden border border-[#DFCBB8]/60 shrink-0">
                          <Image
                            src={item.imageSrc || "/images/Product1.png"}
                            alt={item.productName}
                            fill
                            sizes="64px"
                            className="object-cover object-center"
                          />
                        </div>

                        {/* Title & Variant Details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <h2 className="font-serif text-sm sm:text-base text-[#2C2117] line-clamp-1">
                            {item.productName}
                          </h2>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#7E6955]">
                            {item.variantInfo && (
                              <span className="bg-[#FAF5EB] text-[#2C2117] px-2 py-0.5 rounded border border-[#DFCBB8]/60 text-[11px]">
                                {item.variantInfo}
                              </span>
                            )}
                            <span>
                              Qty: <strong className="text-[#2C2117]">{item.quantity}</strong>
                            </span>
                            <span>•</span>
                            <span>₹{item.price.toLocaleString("en-IN")} each</span>
                          </div>
                        </div>

                        {/* Item Total */}
                        <div className="text-right shrink-0">
                          <span className="font-serif text-sm sm:text-base font-medium text-[#2C2117]">
                            ₹{item.subtotal.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* More items indicator if order has more than 3 distinct line items */}
                    {order.items.length > 3 && (
                      <p className="text-xs text-[#7E6955] italic pt-1">
                        + {order.items.length - 3} additional handcrafted item(s) in this order
                      </p>
                    )}
                  </div>

                  {/* Order Footer: Total, Item Count & Action CTA */}
                  <div className="pt-4 border-t border-[#EFE7DC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xs text-[#7E6955]">Order Total:</span>
                        <span className="font-serif text-lg sm:text-xl font-semibold text-[#1C2820]">
                          ₹{order.total.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7E6955]">
                        {order.itemCount} {order.itemCount === 1 ? "item" : "items"} total • Free Delivery
                      </p>
                    </div>

                    <div className="w-full sm:w-auto flex items-center justify-end space-x-3">
                      <Button
                        href={viewOrderHref}
                        variant="primary"
                        size="sm"
                        className="w-full sm:w-auto text-xs py-2.5 px-5"
                      >
                        View Order Details
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="pt-4 flex items-center justify-between border-t border-[#DFCBB8]/70 text-xs text-[#7E6955]">
              <div className="flex items-center space-x-2">
                <span>
                  Page <strong className="text-[#2C2117]">{pagination.page}</strong> of{" "}
                  <strong className="text-[#2C2117]">{pagination.totalPages}</strong>
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNextPage}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
