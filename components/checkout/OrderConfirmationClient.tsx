"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

interface OrderItemDetail {
  id: string;
  productId: string | null;
  productName: string;
  sku: string | null;
  variantInfo: string | null;
  price: number;
  quantity: number;
  subtotal: number;
  imageSrc: string;
  slug: string | null;
}

interface ShippingAddressDetail {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface PaymentDetail {
  id: string;
  provider: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface OrderDetail {
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
  shippingAddress: ShippingAddressDetail;
  itemCount: number;
  items: OrderItemDetail[];
  payment: PaymentDetail | null;
  createdAt: string;
}

export default function OrderConfirmationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Read URL query parameters as lookup hints only
  const orderNumberParam = searchParams.get("orderNumber");
  const orderIdParam = searchParams.get("orderId");
  const lookupIdentifier = orderIdParam || orderNumberParam;

  const fetchOrderDetails = useCallback(async () => {
    if (!lookupIdentifier) {
      setIsLoadingOrder(false);
      setErrorMessage("No order identifier provided.");
      return;
    }

    try {
      setIsLoadingOrder(true);
      setErrorMessage(null);

      const response = await fetch(
        `/api/orders/${encodeURIComponent(lookupIdentifier)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );

      const json = await response.json();

      if (response.status === 401) {
        // Unauthenticated access: redirect to login preserving current URL
        const returnUrl = encodeURIComponent(
          window.location.pathname + window.location.search
        );
        router.replace(`/login?returnUrl=${returnUrl}`);
        return;
      }

      if (!response.ok || !json.success) {
        setErrorMessage(
          json.error?.message ||
            "Order not found or you do not have permission to view it."
        );
        setIsLoadingOrder(false);
        return;
      }

      setOrder(json.data);
      setIsLoadingOrder(false);
    } catch (err) {
      console.error("[Order Confirmation Fetch Error]:", err);
      setErrorMessage(
        "Unable to retrieve order details at this moment. Please try again."
      );
      setIsLoadingOrder(false);
    }
  }, [lookupIdentifier, router]);

  // Auth & fetch effect
  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(
        window.location.pathname + window.location.search
      );
      router.replace(`/login?returnUrl=${returnUrl}`);
      return;
    }

    let ignore = false;
    void (async () => {
      await Promise.resolve();
      if (!ignore) {
        fetchOrderDetails();
      }
    })();
    return () => {
      ignore = true;
    };
  }, [isAuthLoading, isAuthenticated, fetchOrderDetails, router]);

  // Copy order number handler
  const handleCopyOrderNumber = () => {
    if (!order?.orderNumber) return;
    navigator.clipboard.writeText(order.orderNumber);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2200);
  };

  // Print receipt handler
  const handlePrint = () => {
    window.print();
  };

  // 1. Loading Skeleton State
  if (isAuthLoading || isLoadingOrder) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] py-16 sm:py-24">
        <Container size="narrow">
          <div className="flex flex-col items-center text-center space-y-4 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-[#E5DCD1]" />
            <div className="h-8 w-64 bg-[#E5DCD1] rounded-lg" />
            <div className="h-4 w-96 max-w-full bg-[#E5DCD1] rounded" />
            <div className="w-full max-w-2xl mt-8 p-8 rounded-3xl bg-white/70 border border-[#DFCBB8]/50 space-y-6">
              <div className="h-6 w-48 bg-[#E5DCD1] rounded" />
              <div className="h-20 bg-[#FAF8F5] rounded-xl" />
              <div className="h-20 bg-[#FAF8F5] rounded-xl" />
              <div className="h-10 bg-[#E5DCD1] rounded-xl" />
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // 2. Safe Fallback State (Order Missing, Invalid, Tampered, or Forbidden)
  if (errorMessage || !order) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] py-16 sm:py-24 flex items-center">
        <Container size="narrow">
          <div className="bg-white/95 border border-[#DFCBB8]/80 rounded-3xl p-8 sm:p-12 shadow-sm text-center max-w-xl mx-auto space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#F5EBE1] text-[#9A3412] flex items-center justify-center mx-auto ring-8 ring-[#F5EBE1]/60">
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
              <h1 className="font-serif text-2xl sm:text-3xl text-[#2C2117]">
                Order Details Unavailable
              </h1>
              <p className="text-sm text-[#7E6955] leading-relaxed">
                {errorMessage ||
                  "We could not locate this order under your account, or the identifier is invalid. If you recently completed a purchase, please verify that you are logged into the correct customer account."}
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button href="/shop" variant="primary" size="md" className="w-full sm:w-auto">
                Continue Shopping
              </Button>
              <Button href="/" variant="outline" size="md" className="w-full sm:w-auto">
                Return Home
              </Button>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // Formatted date
  const orderDateFormatted = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 3. Polished, Luxury Order Confirmation State
  return (
    <div className="min-h-screen bg-[#FAF8F5] py-12 sm:py-16 selection:bg-[#B88746]/20">
      <Container size="default">
        {/* Celebration Header Section */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#1C2820] text-[#FAF5EB] shadow-xl ring-8 ring-[#1C2820]/10 mb-2">
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10 text-[#DFCBB8]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[#B88746] bg-[#FAF5EB] px-3.5 py-1 rounded-full border border-[#DFCBB8]/70 inline-block">
              Order Confirmed
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#2C2117] tracking-tight">
              Thank You for Your Order
            </h1>
            <p className="text-sm sm:text-base text-[#7E6955] leading-relaxed max-w-lg mx-auto">
              Your order has been placed successfully. Our master artisans are curating your handcrafted pieces with utmost dedication.
            </p>
          </div>

          {/* Order ID Pill with Copy Action */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex items-center space-x-2 bg-white border border-[#DFCBB8] rounded-full px-4 py-2 shadow-2xs">
              <span className="text-xs text-[#7E6955]">Order No:</span>
              <span className="font-mono text-xs font-semibold text-[#2C2117]">
                #{order.orderNumber}
              </span>
              <button
                type="button"
                onClick={handleCopyOrderNumber}
                aria-label="Copy order number"
                className="text-stone-400 hover:text-[#B88746] transition-colors p-1 -mr-1"
                title="Copy order number"
              >
                {isCopied ? (
                  <span className="text-[10px] font-sans font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Copied!
                  </span>
                ) : (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            </div>

            <div className="inline-flex items-center text-xs text-[#7E6955] bg-white/70 border border-[#DFCBB8]/60 rounded-full px-3.5 py-2">
              <span>{orderDateFormatted}</span>
            </div>
          </div>
        </div>

        {/* Confirmation Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column (7 cols): Order Items & Shipping Address Snapshot */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Items Snapshot */}
            <div className="bg-white/95 border border-[#DFCBB8]/70 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#EFE7DC]">
                <div>
                  <h2 className="font-serif text-lg sm:text-xl text-[#2C2117]">
                    Handcrafted Treasures
                  </h2>
                  <p className="text-xs text-[#7E6955]">
                    Saved snapshot of items included in this order
                  </p>
                </div>
                <span className="text-xs font-sans font-medium text-[#2C2117] bg-[#FAF5EB] px-3 py-1 rounded-full border border-[#DFCBB8]">
                  {order.itemCount} {order.itemCount === 1 ? "Item" : "Items"}
                </span>
              </div>

              <div className="divide-y divide-[#EFE7DC]/80">
                {order.items.map((item) => (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center space-x-4">
                    {/* Item Thumbnail */}
                    <div className="relative w-16 h-20 sm:w-20 sm:h-24 bg-[#FAF8F5] rounded-xl overflow-hidden border border-[#DFCBB8]/60 shrink-0">
                      <Image
                        src={item.imageSrc}
                        alt={item.productName}
                        fill
                        sizes="(max-width: 640px) 64px, 80px"
                        className="object-cover object-center"
                      />
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {item.slug ? (
                        <Link
                          href={`/shop/${item.slug}`}
                          className="font-serif text-sm sm:text-base text-[#2C2117] hover:text-[#B88746] transition-colors line-clamp-1"
                        >
                          {item.productName}
                        </Link>
                      ) : (
                        <h3 className="font-serif text-sm sm:text-base text-[#2C2117] line-clamp-1">
                          {item.productName}
                        </h3>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#7E6955]">
                        {item.variantInfo && (
                          <span className="inline-block bg-[#FAF5EB] text-[#2C2117] px-2 py-0.5 rounded border border-[#DFCBB8]/70 text-[11px]">
                            {item.variantInfo}
                          </span>
                        )}
                        {item.sku && (
                          <span className="font-mono text-[10px] text-stone-400">
                            SKU: {item.sku}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[#7E6955] pt-0.5">
                        Qty: <span className="font-medium text-[#2C2117]">{item.quantity}</span> × ₹
                        {item.price.toLocaleString("en-IN")}
                      </div>
                    </div>

                    {/* Item Line Total */}
                    <div className="text-right shrink-0">
                      <span className="font-serif font-medium text-sm sm:text-base text-[#2C2117]">
                        ₹{item.subtotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Shipping Address & Delivery Details Snapshot */}
            <div className="bg-white/95 border border-[#DFCBB8]/70 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6">
              <div className="flex items-center space-x-3 pb-4 border-b border-[#EFE7DC]">
                <div className="w-8 h-8 rounded-full bg-[#FAF5EB] text-[#B88746] flex items-center justify-center border border-[#DFCBB8]">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="font-serif text-lg sm:text-xl text-[#2C2117]">
                    Delivery Destination
                  </h2>
                  <p className="text-xs text-[#7E6955]">
                    Saved shipping address snapshot for this order
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-[#2C2117]">
                <div className="space-y-1">
                  <p className="text-[11px] font-sans font-medium uppercase tracking-wider text-[#7E6955]">
                    Recipient
                  </p>
                  <p className="font-medium text-sm text-[#2C2117]">{order.customerName}</p>
                  <p className="text-stone-600">{order.customerPhone}</p>
                  <p className="text-stone-500 text-xs">{order.customerEmail}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-sans font-medium uppercase tracking-wider text-[#7E6955]">
                    Shipping Address
                  </p>
                  <p className="text-stone-800">{order.shippingAddress.addressLine1}</p>
                  {order.shippingAddress.addressLine2 && (
                    <p className="text-stone-800">{order.shippingAddress.addressLine2}</p>
                  )}
                  <p className="text-stone-800">
                    {order.shippingAddress.city}, {order.shippingAddress.state} –{" "}
                    {order.shippingAddress.postalCode}
                  </p>
                  <p className="text-stone-500 font-medium">{order.shippingAddress.country}</p>
                </div>
              </div>

              {/* Delivery Estimation Note (Strict requirement: do NOT invent date) */}
              <div className="bg-[#FAF5EB]/80 border border-[#DFCBB8]/70 rounded-2xl p-4 flex items-start space-x-3.5">
                <svg
                  className="w-5 h-5 text-[#B88746] shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20"
                  />
                </svg>
                <div className="space-y-0.5 text-xs text-[#2C2117]">
                  <p className="font-medium text-[#2C2117]">Delivery Updates & Tracking</p>
                  <p className="text-[#7E6955] leading-relaxed">
                    Live courier tracking details and dispatch updates will be shared separately via SMS and email once your package leaves our fulfillment atelier.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Payment Summary, Totals & CTAs */}
          <div className="lg:col-span-5 space-y-6">
            {/* 1. Payment Summary Card */}
            <div className="bg-white/95 border border-[#DFCBB8]/70 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6">
              <div className="flex items-center space-x-3 pb-4 border-b border-[#EFE7DC]">
                <div className="w-8 h-8 rounded-full bg-[#FAF5EB] text-[#B88746] flex items-center justify-center border border-[#DFCBB8]">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="font-serif text-lg sm:text-xl text-[#2C2117]">
                    Payment Details
                  </h2>
                  <p className="text-xs text-[#7E6955]">Verified payment snapshot</p>
                </div>
              </div>

              {/* Payment Method & Status */}
              <div className="bg-[#FAF8F5] border border-[#DFCBB8]/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#7E6955]">Payment Mode</span>
                  <span className="text-xs font-semibold text-[#2C2117] flex items-center space-x-1">
                    <span>Cash on Delivery</span>
                    <span className="text-[10px] text-[#B88746]">(COD)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#DFCBB8]/30">
                  <span className="text-xs text-[#7E6955]">Payment Status</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
                    {order.paymentStatus === "PENDING"
                      ? "Pending (Pay on delivery)"
                      : order.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-xs sm:text-sm text-[#7E6955]">
                  <span>Subtotal</span>
                  <span className="font-medium text-[#2C2117]">
                    ₹{order.subtotal.toLocaleString("en-IN")}
                  </span>
                </div>

                {order.discount > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-emerald-800">
                    <span>Promotional Discount</span>
                    <span className="font-medium">
                      -₹{order.discount.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-xs sm:text-sm text-[#7E6955]">
                  <span>Shipping & Delivery</span>
                  <span className="font-medium text-[#2C2117]">
                    {order.shippingFee === 0 ? (
                      <span className="text-emerald-700 font-medium">FREE</span>
                    ) : (
                      `₹${order.shippingFee.toLocaleString("en-IN")}`
                    )}
                  </span>
                </div>

                <div className="pt-3 border-t border-[#DFCBB8]/80 flex justify-between items-baseline">
                  <div>
                    <span className="font-serif text-base sm:text-lg text-[#2C2117]">
                      Order Total
                    </span>
                    <p className="text-[10px] text-[#7E6955]">Inclusive of all applicable taxes</p>
                  </div>
                  <span className="font-serif text-xl sm:text-2xl text-[#1C2820] font-semibold">
                    ₹{order.total.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Action CTAs */}
            <div className="bg-white/95 border border-[#DFCBB8]/70 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-4">
              {/* Primary Continue Shopping CTA */}
              <Button
                href="/shop"
                variant="primary"
                size="lg"
                className="w-full justify-center group text-xs sm:text-sm"
              >
                <span>Continue Shopping</span>
                <svg
                  className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Button>

              {/* Secondary Print Receipt CTA */}
              <button
                type="button"
                onClick={handlePrint}
                className="w-full inline-flex items-center justify-center py-3 px-4 rounded-xl border border-[#DFCBB8] text-xs font-sans font-medium uppercase tracking-wider text-[#2C2117] hover:bg-[#FAF8F5] transition-colors"
              >
                <svg
                  className="w-4 h-4 mr-2 text-[#7E6955]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Print / Save Receipt
              </button>

              {/* Concierge Assistance Info */}
              <div className="pt-2 text-center text-xs text-[#7E6955] space-y-1">
                <p>Need assistance with your handcrafted pieces?</p>
                <p className="text-[11px]">
                  Contact our concierge at{" "}
                  <a
                    href="mailto:support@shivura.com"
                    className="underline text-[#2C2117] hover:text-[#B88746]"
                  >
                    support@shivura.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
