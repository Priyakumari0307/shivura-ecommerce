"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useShop } from "@/context/ShopContext";
import { useAuth } from "@/context/AuthContext";

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Chandigarh",
  "Jammu and Kashmir",
  "Ladakh",
  "Puducherry",
];

const FREE_SHIPPING_THRESHOLD = 999;
const STANDARD_SHIPPING_FEE = 99;

export default function CheckoutClient() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { cart, cartSubtotal, cartCount, clearCart } = useShop();

  // Form State
  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    shippingAddressLine1: "",
    shippingAddressLine2: "",
    shippingCity: "",
    shippingState: "",
    shippingPostalCode: "",
    shippingCountry: "India",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Idempotency tracking: preserves key across uncertain network retries
  const idempotencyKeyRef = useRef<string | null>(null);
  const lastPayloadRef = useRef<string | null>(null);

  // Coupon State
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountPercent: number;
    description: string;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");

  // Redirect unauthenticated customers using established returnUrl convention
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace("/login?returnUrl=/checkout&reason=checkout");
    }
  }, [isAuthLoading, isAuthenticated, router]);

  // Pre-fill customer details from authenticated session
  useEffect(() => {
    if (user) {
      queueMicrotask(() => {
        setFormData((prev) => ({
          ...prev,
          customerName: prev.customerName || user.name || "",
          customerEmail: prev.customerEmail || user.email || "",
        }));
      });
    }
  }, [user]);

  // Calculate estimated totals for display
  const shippingFee =
    cartSubtotal >= FREE_SHIPPING_THRESHOLD || cart.length === 0
      ? 0
      : STANDARD_SHIPPING_FEE;

  const discountAmount = appliedCoupon
    ? Math.round(((cartSubtotal * appliedCoupon.discountPercent) / 100) * 100) / 100
    : 0;

  const estimatedTotal = Math.max(
    0,
    Math.round((cartSubtotal - discountAmount + shippingFee) * 100) / 100
  );

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError("");
    setCouponSuccess("");

    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponError("Please enter a promo code");
      return;
    }

    if (code === "SHIVURA10" || code === "FESTIVE10") {
      setAppliedCoupon({
        code,
        discountPercent: 10,
        description: "10% luxury discount applied",
      });
      setCouponSuccess("10% luxury discount applied successfully!");
    } else if (code === "WELCOME15") {
      setAppliedCoupon({
        code,
        discountPercent: 15,
        description: "15% welcome discount applied",
      });
      setCouponSuccess("15% welcome discount applied successfully!");
    } else {
      setCouponError("Invalid promo code. Try 'SHIVURA10' or 'FESTIVE10'");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponSuccess("");
    setCouponError("");
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear field-level error on typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.customerName.trim() || formData.customerName.trim().length < 2) {
      errors.customerName = "Full name must be at least 2 characters";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.customerEmail.trim() || !emailRegex.test(formData.customerEmail.trim())) {
      errors.customerEmail = "Please enter a valid email address";
    }

    const cleanPhone = formData.customerPhone.replace(/\D/g, "");
    const corePhone =
      cleanPhone.length === 10
        ? cleanPhone
        : cleanPhone.length === 11 && cleanPhone.startsWith("0")
        ? cleanPhone.slice(1)
        : cleanPhone.length === 12 && cleanPhone.startsWith("91")
        ? cleanPhone.slice(2)
        : "";

    if (!corePhone || !/^[6-9]\d{9}$/.test(corePhone)) {
      errors.customerPhone =
        "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210)";
    }

    if (!formData.shippingAddressLine1.trim() || formData.shippingAddressLine1.trim().length < 3) {
      errors.shippingAddressLine1 = "Address Line 1 is required (min 3 characters)";
    }

    if (!formData.shippingCity.trim() || formData.shippingCity.trim().length < 2) {
      errors.shippingCity = "City is required";
    }

    if (!formData.shippingState.trim()) {
      errors.shippingState = "Please select a state";
    }

    if (!/^[1-9][0-9]{5}$/.test(formData.shippingPostalCode.trim())) {
      errors.shippingPostalCode = "PIN code must be a valid 6-digit Indian postal code";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (isSubmitting) return;

    if (!validateForm()) {
      setGeneralError("Please correct the highlighted fields before placing your order.");
      // Scroll to top of form
      window.scrollTo({ top: 180, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);

    // Build canonical request payload strictly matching server schema
    const payload = {
      customerName: formData.customerName.trim(),
      customerEmail: formData.customerEmail.trim(),
      customerPhone: formData.customerPhone.trim(),
      shippingAddressLine1: formData.shippingAddressLine1.trim(),
      shippingAddressLine2: formData.shippingAddressLine2.trim() || null,
      shippingCity: formData.shippingCity.trim(),
      shippingState: formData.shippingState.trim(),
      shippingPostalCode: formData.shippingPostalCode.trim(),
      shippingCountry: "India",
      paymentMethod: "COD" as const,
      couponCode: appliedCoupon?.code || undefined,
      items: cart.map((item) => ({
        productId: item.product.id,
        variantId:
          (item as { variantId?: string | null }).variantId ||
          (item.product as { variantId?: string | null }).variantId ||
          null,
        quantity: item.quantity,
      })),
    };

    const payloadString = JSON.stringify(payload);

    // Idempotency Key Management:
    // Reuse existing key if retrying the identical payload following an uncertain error.
    // Generate a fresh UUIDv4 key if this is a new checkout attempt or if payload was modified.
    let keyToUse = idempotencyKeyRef.current;
    if (!keyToUse || lastPayloadRef.current !== payloadString) {
      keyToUse = crypto.randomUUID();
      idempotencyKeyRef.current = keyToUse;
      lastPayloadRef.current = payloadString;
    }

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": keyToUse,
        },
        body: payloadString,
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        const errorMsg =
          json.error?.message ||
          "We were unable to place your order. Please review your details and try again.";
        setGeneralError(errorMsg);

        // Definitive client validation errors (HTTP 400 or 422) invalidate the attempt;
        // next attempt after user correction should generate a fresh key
        if (response.status === 400 || response.status === 422) {
          idempotencyKeyRef.current = null;
          lastPayloadRef.current = null;
        }

        // Map server-side Zod validation issues if returned
        if (json.error?.code === "VALIDATION_ERROR" && json.error?.issues) {
          const issues = json.error.issues;
          const mapped: Record<string, string> = {};
          if (issues.customerName?._errors?.[0]) mapped.customerName = issues.customerName._errors[0];
          if (issues.customerEmail?._errors?.[0]) mapped.customerEmail = issues.customerEmail._errors[0];
          if (issues.customerPhone?._errors?.[0]) mapped.customerPhone = issues.customerPhone._errors[0];
          if (issues.shippingAddressLine1?._errors?.[0]) mapped.shippingAddressLine1 = issues.shippingAddressLine1._errors[0];
          if (issues.shippingCity?._errors?.[0]) mapped.shippingCity = issues.shippingCity._errors[0];
          if (issues.shippingState?._errors?.[0]) mapped.shippingState = issues.shippingState._errors[0];
          if (issues.shippingPostalCode?._errors?.[0]) mapped.shippingPostalCode = issues.shippingPostalCode._errors[0];
          setFieldErrors((prev) => ({ ...prev, ...mapped }));
        }

        window.scrollTo({ top: 180, behavior: "smooth" });
        setIsSubmitting(false);
        return;
      }

      // Successful order creation (or completed replay):
      // Reset idempotency state, clear local cart, and navigate to confirmation route
      idempotencyKeyRef.current = null;
      lastPayloadRef.current = null;
      clearCart();

      const orderData = json.data;
      router.push(
        `/checkout/success?orderNumber=${encodeURIComponent(
          orderData.orderNumber
        )}&orderId=${encodeURIComponent(orderData.id)}`
      );
    } catch (err) {
      console.error("[Checkout submission error]:", err);
      // On uncertain network error, keep idempotencyKeyRef and lastPayloadRef intact so retry reuses key!
      setGeneralError(
        "A network communication error occurred. Please check your connection and try again."
      );
      window.scrollTo({ top: 180, behavior: "smooth" });
      setIsSubmitting(false);
    }
  };

  // 1. Loading State
  if (isAuthLoading) {
    return (
      <div className="py-20 bg-[#FAF8F5] min-h-[75vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-3 border-[#DFCBB8] border-t-[#B88746] rounded-full animate-spin mx-auto" />
          <p className="font-serif text-[#35271D] text-lg">Preparing your secure checkout...</p>
          <p className="text-xs text-[#7E6955] font-light">Authenticating session with Shivura Concierge</p>
        </div>
      </div>
    );
  }

  // 2. Redirecting Unauthenticated Guest
  if (!isAuthenticated) {
    return (
      <div className="py-20 bg-[#FAF8F5] min-h-[75vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="font-serif text-[#35271D] text-lg">Redirecting to secure login...</p>
          <p className="text-xs text-[#7E6955] font-light">Please sign in to complete your purchase.</p>
        </div>
      </div>
    );
  }

  // 3. Graceful Empty Cart State
  if (cart.length === 0) {
    return (
      <div className="py-16 sm:py-24 bg-[#FAF8F5] min-h-[75vh]">
        <Container size="narrow">
          <div className="bg-white/90 border border-[#DFCBB8]/70 p-10 sm:p-14 rounded-3xl text-center space-y-6 shadow-2xs max-w-lg mx-auto">
            <div className="w-20 h-20 bg-[#FAF7F2] rounded-full flex items-center justify-center mx-auto text-[#B88746]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <div className="space-y-2">
              <span className="text-[#B88746] text-xs uppercase tracking-widest font-sans font-medium">
                Shopping Bag Empty
              </span>
              <h2 className="font-serif text-2xl text-[#2C2117]">No Treasures Selected</h2>
              <p className="text-xs sm:text-sm text-[#7E6955] font-light leading-relaxed">
                Your cart is currently empty. Please select artisanal handcrafted pieces from our catalog before proceeding to checkout.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <Button href="/shop" variant="primary" size="md">
                Explore Handcrafted Shop
              </Button>
              <Button href="/cart" variant="outline" size="md">
                View Cart
              </Button>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // 4. Main Checkout Interface
  return (
    <div className="py-10 sm:py-16 bg-[#FAF8F5] min-h-[85vh]">
      <Container size="wide">
        {/* Header Breadcrumb & Title */}
        <div className="mb-8 sm:mb-12 space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center space-x-2 text-[#B88746] text-xs uppercase tracking-widest font-sans font-medium">
            <Link href="/cart" className="hover:underline">Cart</Link>
            <span>›</span>
            <span className="text-[#2C2117]">Checkout</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2C2117]">
            Delivery & Payment
          </h1>
          <p className="text-xs sm:text-sm text-[#7E6955] font-light">
            Review your artisanal selection and provide your shipping address for delivery across India.
          </p>
        </div>

        {/* Global Error Alert */}
        {generalError && (
          <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start space-x-3 shadow-2xs">
            <svg
              className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-medium">{generalError}</p>
              <p className="text-xs text-rose-700">Please review your input fields below.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitOrder} noValidate>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column (7 cols): Address Form & Payment Selection */}
            <div className="lg:col-span-7 space-y-8">
              {/* Section 1: Customer Contact Details */}
              <div className="bg-white/90 border border-[#DFCBB8]/70 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6">
                <div className="flex items-center space-x-3 pb-4 border-b border-[#EFE7DC]">
                  <span className="w-7 h-7 rounded-full bg-[#1C2820] text-[#FAF5EB] text-xs font-sans font-medium flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <h2 className="font-serif text-lg text-[#2C2117]">Contact Information</h2>
                    <p className="text-xs text-[#7E6955]">Order confirmation and shipping updates will be sent here.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {/* Full Name */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label
                      htmlFor="customerName"
                      className="block text-xs font-sans font-medium uppercase tracking-wider text-[#3A2A1E]"
                    >
                      Full Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="customerName"
                      name="customerName"
                      type="text"
                      autoComplete="name"
                      required
                      value={formData.customerName}
                      onChange={handleInputChange}
                      placeholder="e.g. Aarav Sharma"
                      className={`w-full px-4 py-3 rounded-xl border text-sm text-[#2C2117] bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B88746] transition-all ${
                        fieldErrors.customerName
                          ? "border-rose-400 focus:ring-rose-500"
                          : "border-[#DFCBB8]"
                      }`}
                    />
                    {fieldErrors.customerName && (
                      <p className="text-[11px] text-rose-600 font-medium">
                        {fieldErrors.customerName}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="customerEmail"
                      className="block text-xs font-sans font-medium uppercase tracking-wider text-[#3A2A1E]"
                    >
                      Email Address <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="customerEmail"
                      name="customerEmail"
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.customerEmail}
                      onChange={handleInputChange}
                      placeholder="e.g. aarav@example.com"
                      className={`w-full px-4 py-3 rounded-xl border text-sm text-[#2C2117] bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B88746] transition-all ${
                        fieldErrors.customerEmail
                          ? "border-rose-400 focus:ring-rose-500"
                          : "border-[#DFCBB8]"
                      }`}
                    />
                    {fieldErrors.customerEmail && (
                      <p className="text-[11px] text-rose-600 font-medium">
                        {fieldErrors.customerEmail}
                      </p>
                    )}
                  </div>

                  {/* Mobile Phone */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="customerPhone"
                      className="block text-xs font-sans font-medium uppercase tracking-wider text-[#3A2A1E]"
                    >
                      Mobile Phone (India) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#7E6955]">
                        +91
                      </span>
                      <input
                        id="customerPhone"
                        name="customerPhone"
                        type="tel"
                        autoComplete="tel"
                        required
                        maxLength={15}
                        value={formData.customerPhone}
                        onChange={handleInputChange}
                        placeholder="98765 43210"
                        className={`w-full pl-12 pr-4 py-3 rounded-xl border text-sm text-[#2C2117] bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B88746] transition-all ${
                          fieldErrors.customerPhone
                            ? "border-rose-400 focus:ring-rose-500"
                            : "border-[#DFCBB8]"
                        }`}
                      />
                    </div>
                    {fieldErrors.customerPhone ? (
                      <p className="text-[11px] text-rose-600 font-medium">
                        {fieldErrors.customerPhone}
                      </p>
                    ) : (
                      <p className="text-[10px] text-[#7E6955]">Required for delivery coordination and OTP.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Shipping Address */}
              <div className="bg-white/90 border border-[#DFCBB8]/70 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6">
                <div className="flex items-center space-x-3 pb-4 border-b border-[#EFE7DC]">
                  <span className="w-7 h-7 rounded-full bg-[#1C2820] text-[#FAF5EB] text-xs font-sans font-medium flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <h2 className="font-serif text-lg text-[#2C2117]">Shipping Destination</h2>
                    <p className="text-xs text-[#7E6955]">Where should we deliver your handcrafted treasures?</p>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-5">
                  {/* Address Line 1 */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="shippingAddressLine1"
                      className="block text-xs font-sans font-medium uppercase tracking-wider text-[#3A2A1E]"
                    >
                      Flat / House No. / Building / Street <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="shippingAddressLine1"
                      name="shippingAddressLine1"
                      type="text"
                      autoComplete="address-line1"
                      required
                      value={formData.shippingAddressLine1}
                      onChange={handleInputChange}
                      placeholder="e.g. 402 Golden Heritage, MG Road"
                      className={`w-full px-4 py-3 rounded-xl border text-sm text-[#2C2117] bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B88746] transition-all ${
                        fieldErrors.shippingAddressLine1
                          ? "border-rose-400 focus:ring-rose-500"
                          : "border-[#DFCBB8]"
                      }`}
                    />
                    {fieldErrors.shippingAddressLine1 && (
                      <p className="text-[11px] text-rose-600 font-medium">
                        {fieldErrors.shippingAddressLine1}
                      </p>
                    )}
                  </div>

                  {/* Address Line 2 */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="shippingAddressLine2"
                      className="block text-xs font-sans font-medium uppercase tracking-wider text-[#3A2A1E]"
                    >
                      Apartment / Landmark / Locality <span className="text-[#7E6955] text-[10px] lowercase">(optional)</span>
                    </label>
                    <input
                      id="shippingAddressLine2"
                      name="shippingAddressLine2"
                      type="text"
                      autoComplete="address-line2"
                      value={formData.shippingAddressLine2}
                      onChange={handleInputChange}
                      placeholder="e.g. Near City Palace Gate"
                      className="w-full px-4 py-3 rounded-xl border border-[#DFCBB8] text-sm text-[#2C2117] bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B88746] transition-all"
                    />
                  </div>

                  {/* City & State */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* City */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="shippingCity"
                        className="block text-xs font-sans font-medium uppercase tracking-wider text-[#3A2A1E]"
                      >
                        City <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="shippingCity"
                        name="shippingCity"
                        type="text"
                        autoComplete="address-level2"
                        required
                        value={formData.shippingCity}
                        onChange={handleInputChange}
                        placeholder="e.g. Jaipur"
                        className={`w-full px-4 py-3 rounded-xl border text-sm text-[#2C2117] bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B88746] transition-all ${
                          fieldErrors.shippingCity
                            ? "border-rose-400 focus:ring-rose-500"
                            : "border-[#DFCBB8]"
                        }`}
                      />
                      {fieldErrors.shippingCity && (
                        <p className="text-[11px] text-rose-600 font-medium">
                          {fieldErrors.shippingCity}
                        </p>
                      )}
                    </div>

                    {/* State */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="shippingState"
                        className="block text-xs font-sans font-medium uppercase tracking-wider text-[#3A2A1E]"
                      >
                        State <span className="text-rose-600">*</span>
                      </label>
                      <select
                        id="shippingState"
                        name="shippingState"
                        required
                        value={formData.shippingState}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 rounded-xl border text-sm text-[#2C2117] bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B88746] transition-all ${
                          fieldErrors.shippingState
                            ? "border-rose-400 focus:ring-rose-500"
                            : "border-[#DFCBB8]"
                        }`}
                      >
                        <option value="">Select Indian State</option>
                        {INDIAN_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.shippingState && (
                        <p className="text-[11px] text-rose-600 font-medium">
                          {fieldErrors.shippingState}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* PIN Code & Country */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* PIN code */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="shippingPostalCode"
                        className="block text-xs font-sans font-medium uppercase tracking-wider text-[#3A2A1E]"
                      >
                        Postal PIN Code (6 Digits) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="shippingPostalCode"
                        name="shippingPostalCode"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        autoComplete="postal-code"
                        required
                        value={formData.shippingPostalCode}
                        onChange={handleInputChange}
                        placeholder="e.g. 302001"
                        className={`w-full px-4 py-3 rounded-xl border text-sm text-[#2C2117] font-mono bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B88746] transition-all ${
                          fieldErrors.shippingPostalCode
                            ? "border-rose-400 focus:ring-rose-500"
                            : "border-[#DFCBB8]"
                        }`}
                      />
                      {fieldErrors.shippingPostalCode && (
                        <p className="text-[11px] text-rose-600 font-medium">
                          {fieldErrors.shippingPostalCode}
                        </p>
                      )}
                    </div>

                    {/* Country */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="shippingCountry"
                        className="block text-xs font-sans font-medium uppercase tracking-wider text-[#3A2A1E]"
                      >
                        Country
                      </label>
                      <input
                        id="shippingCountry"
                        name="shippingCountry"
                        type="text"
                        readOnly
                        value="India"
                        className="w-full px-4 py-3 rounded-xl border border-[#DFCBB8] text-sm text-[#7E6955] bg-[#EFE7DC]/40 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Payment Method Selection */}
              <div className="bg-white/90 border border-[#DFCBB8]/70 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6">
                <div className="flex items-center space-x-3 pb-4 border-b border-[#EFE7DC]">
                  <span className="w-7 h-7 rounded-full bg-[#1C2820] text-[#FAF5EB] text-xs font-sans font-medium flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <h2 className="font-serif text-lg text-[#2C2117]">Payment Method</h2>
                    <p className="text-xs text-[#7E6955]">Select how you wish to pay for your handcrafted order.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Option 1: Cash on Delivery (COD) - Active */}
                  <label className="relative flex items-start p-4 sm:p-5 rounded-2xl border-2 border-[#1C2820] bg-[#FAF8F5]/70 cursor-pointer shadow-xs transition-all">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="COD"
                      checked={true}
                      readOnly
                      className="mt-1 h-4 w-4 text-[#1C2820] focus:ring-[#B88746] accent-[#1C2820]"
                    />
                    <div className="ml-3.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-serif text-base text-[#2C2117] font-medium">
                          Cash on Delivery (COD)
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-sans font-medium uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Available
                        </span>
                      </div>
                      <p className="text-xs text-[#5D4636] mt-1 leading-relaxed">
                        Pay in cash or through UPI upon doorstep delivery. No advance digital payment required.
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-[#DFCBB8]/50 flex items-center text-[11px] text-[#7E6955] space-x-1.5">
                        <span>ℹ️</span>
                        <span>
                          Payment status remains <strong>PENDING</strong> until genuine cash collection is recorded upon courier delivery.
                        </span>
                      </div>
                    </div>
                  </label>

                  {/* Option 2: Online Payments - Disabled / Coming Soon */}
                  <div className="relative flex items-start p-4 sm:p-5 rounded-2xl border border-dashed border-[#DFCBB8] bg-[#FAF8F5]/30 opacity-70 cursor-not-allowed">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="ONLINE"
                      disabled
                      className="mt-1 h-4 w-4 text-stone-400 accent-stone-400 cursor-not-allowed"
                    />
                    <div className="ml-3.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-serif text-base text-[#7E6955] font-medium">
                          Online Payment (UPI, Cards, NetBanking)
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-sans font-medium uppercase tracking-wider bg-[#EFE7DC] text-[#7E6955] border border-[#DFCBB8]">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-xs text-[#9E8B7A] mt-1 leading-relaxed">
                        Direct online payment integration is currently undergoing compliance and security testing.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Order Summary & Checkout Trigger */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
              <div className="bg-white/90 border border-[#DFCBB8]/70 rounded-3xl p-6 sm:p-7 shadow-2xs space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#EFE7DC]">
                  <h3 className="font-serif text-xl text-[#2C2117]">Order Summary</h3>
                  <span className="text-xs text-[#7E6955] font-mono">
                    {cartCount} {cartCount === 1 ? "item" : "items"}
                  </span>
                </div>

                {/* Free Shipping Notification */}
                <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8]/60 text-xs">
                  {cartSubtotal >= FREE_SHIPPING_THRESHOLD ? (
                    <div className="flex items-center space-x-2 text-emerald-800 font-medium">
                      <span>✨</span>
                      <span>You unlocked <strong>Free Shipping</strong> across India!</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-[#7E6955]">
                      <span>📦</span>
                      <span>
                        Add <strong>₹{(FREE_SHIPPING_THRESHOLD - cartSubtotal).toFixed(2)}</strong> more for free shipping
                      </span>
                    </div>
                  )}
                </div>

                {/* Item Previews List */}
                <div className="divide-y divide-[#EFE7DC] max-h-72 overflow-y-auto pr-1">
                  {cart.map(({ product, quantity }) => (
                    <div key={product.id} className="py-3 flex items-center space-x-3.5">
                      <div className="relative w-14 h-14 bg-[#FAF7F2] rounded-xl overflow-hidden border border-[#DFCBB8]/60 shrink-0">
                        <Image
                          src={product.imageSrc || "/images/Product1.png"}
                          alt={product.name}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1C2820] text-[#FAF5EB] text-[10px] font-mono flex items-center justify-center shadow-xs">
                          {quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-serif text-[#2C2117] truncate" title={product.name}>
                          {product.name}
                        </h4>
                        <p className="text-[11px] text-[#7E6955] font-mono mt-0.5">
                          ₹{Number(product.price).toLocaleString("en-IN")} × {quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium font-mono text-[#2C2117]">
                          ₹{(Number(product.price) * quantity).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coupon Code Section */}
                <div className="pt-2 border-t border-[#EFE7DC] space-y-2">
                  {appliedCoupon ? (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-medium text-emerald-900 uppercase">
                          {appliedCoupon.code}
                        </span>
                        <p className="text-[11px] text-emerald-700">{appliedCoupon.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-xs text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          placeholder="Promo code (e.g. SHIVURA10)"
                          className="flex-1 px-3.5 py-2 rounded-xl border border-[#DFCBB8] text-xs uppercase bg-[#FAF8F5]/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          className="px-4 py-2 rounded-xl bg-[#2C2117] hover:bg-[#3D2F22] text-[#FAF5EB] text-xs font-medium transition-colors cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>
                      {couponSuccess && (
                        <p className="text-[11px] text-emerald-700">{couponSuccess}</p>
                      )}
                      {couponError && (
                        <p className="text-[11px] text-rose-600">{couponError}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Price Calculations */}
                <div className="pt-4 border-t border-[#EFE7DC] space-y-2.5 text-xs text-[#5D4636]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono text-[#2C2117]">
                      ₹{cartSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {appliedCoupon && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Promo Discount ({appliedCoupon.code})</span>
                      <span className="font-mono">
                        -₹{discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Shipping Fee</span>
                    <span className="font-mono text-[#2C2117]">
                      {shippingFee === 0 ? (
                        <span className="text-emerald-700 uppercase font-sans font-medium text-[11px]">Free</span>
                      ) : (
                        `₹${shippingFee.toFixed(2)}`
                      )}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-[#EFE7DC] flex justify-between items-baseline text-sm">
                    <span className="font-serif text-base text-[#2C2117] font-medium">Estimated Total</span>
                    <span className="font-serif text-xl text-[#2C2117] font-bold">
                      ₹{estimatedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#7E6955] text-right font-light">
                    Final total verified and computed canonically by server on placement.
                  </p>
                </div>

                {/* Submission CTA */}
                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-6 rounded-2xl bg-[#1C2820] hover:bg-[#2B3B30] disabled:bg-stone-500 text-[#FAF5EB] text-xs uppercase tracking-widest font-sans font-medium transition-all shadow-md hover:shadow-lg cursor-pointer disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#FAF5EB]/30 border-t-[#FAF5EB] rounded-full animate-spin" />
                        <span>Securing Your Order...</span>
                      </>
                    ) : (
                      <>
                        <span>Place Order with Cash on Delivery</span>
                        <span>→</span>
                      </>
                    )}
                  </button>

                  <div className="space-y-1.5 text-center">
                    <p className="text-[11px] text-[#7E6955] font-light flex items-center justify-center space-x-1.5">
                      <span>🔒</span>
                      <span>Encrypted transactional order creation across India</span>
                    </p>
                    <p className="text-[10px] text-[#A89887]">
                      By placing your order, you agree to Shivura&apos;s Terms of Service and Privacy Policy.
                    </p>
                  </div>
                </div>
              </div>

              {/* Concierge Assurance Card */}
              <div className="p-5 rounded-2xl bg-white/70 border border-[#DFCBB8]/50 space-y-3 text-xs text-[#7E6955]">
                <h4 className="font-serif text-sm text-[#2C2117] font-medium flex items-center space-x-2">
                  <span>✦</span>
                  <span>The Shivura Luxury Promise</span>
                </h4>
                <ul className="space-y-2 text-[11px] leading-relaxed">
                  <li className="flex items-start space-x-2">
                    <span className="text-emerald-700">✓</span>
                    <span>100% Handcrafted Authenticity verified by master artisans.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-emerald-700">✓</span>
                    <span>Inspected & transit-protected multi-layer luxury packaging.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-emerald-700">✓</span>
                    <span>Cash on Delivery: Inspect package before hand-off.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </Container>
    </div>
  );
}
