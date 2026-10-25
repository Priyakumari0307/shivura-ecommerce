"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function CrmLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnUrlParam = searchParams.get("returnUrl") || searchParams.get("redirect");
  const targetUrl = returnUrlParam && returnUrlParam.startsWith("/") ? returnUrlParam : "/CRM";
  const reasonParam = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [detectedCustomerEmail, setDetectedCustomerEmail] = useState<string | null>(null);

  // Check if an existing session is currently present
  useEffect(() => {
    async function checkCurrentSession() {
      try {
        const res = await fetch("/api/crm/auth/session", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.status === "authorized") {
            // Already authorized admin -> redirect directly to CRM portal
            router.replace(targetUrl);
          }
        } else if (res.status === 403) {
          // A customer session is active
          try {
            const customerRes = await fetch("/api/auth/me", { cache: "no-store" });
            if (customerRes.ok) {
              const custData = await customerRes.json();
              if (custData.user?.email) {
                setDetectedCustomerEmail(custData.user.email);
              }
            }
          } catch {
            // Silently ignore
          }
        }
      } catch {
        // Silently continue
      }
    }

    checkCurrentSession();
  }, [router, targetUrl]);

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      errors.email = "Administrator email address is required";
    } else if (!emailRegex.test(email.trim())) {
      errors.email = "Please enter a valid email format";
    }

    if (!password) {
      errors.password = "Password is required";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/crm/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(
          data.error || "Invalid administrator email or password"
        );
        setIsSubmitting(false);
        return;
      }

      // Success: navigate to CRM portal
      router.replace(targetUrl);
      router.refresh();
    } catch {
      setErrorMessage("Network error occurred. Please check your connection.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Brand & Security Header */}
      <div className="text-center space-y-2 mb-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#1C2820]/5 border border-[#1C2820]/10 text-[#B88746] text-[11px] uppercase tracking-[0.22em] font-sans font-medium">
          <span className="text-[9px]">✦</span>
          <span>Shivura Executive CRM</span>
          <span className="text-[9px]">✦</span>
        </div>

        <h1 className="font-serif text-2xl sm:text-3xl text-[#2C2117] font-normal tracking-tight">
          Administrative Portal
        </h1>

        <p className="text-xs text-[#7E6955] font-light max-w-sm mx-auto leading-relaxed">
          Authorized operations personnel only. All access attempts and administrative sessions are cryptographically verified and audited.
        </p>

        <div className="w-12 h-[1px] bg-[#DFCBB8] mx-auto mt-2" />
      </div>

      {/* Main Login Card */}
      <div className="bg-white/95 backdrop-blur-md p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-[#DFCBB8]/80 shadow-[0_8px_32px_rgba(44,33,23,0.08)] space-y-5">
        {/* Customer Session Warning Alert */}
        {detectedCustomerEmail && (
          <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-900 text-xs font-sans space-y-1">
            <div className="flex items-center space-x-1.5 font-medium text-amber-800">
              <span>⚠️</span>
              <span>Customer Session Detected</span>
            </div>
            <p className="text-[11.5px] text-amber-700 font-light leading-relaxed">
              You are currently signed in as customer (<strong>{detectedCustomerEmail}</strong>). To proceed to the CRM, please sign in with your authorized administrator credentials below.
            </p>
          </div>
        )}

        {/* Reason notice if redirected */}
        {reasonParam === "unauthorized" && (
          <div className="p-3 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 text-xs font-sans">
            Please sign in with administrator credentials to access the requested CRM module.
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50/90 border border-rose-200 text-rose-800 text-xs font-sans flex items-start space-x-2">
            <span className="text-sm leading-none mt-0.5">⚠️</span>
            <div className="flex-1 text-[11.5px] font-light leading-relaxed">
              {errorMessage}
            </div>
          </div>
        )}

        {/* Administrative Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email Field */}
          <div>
            <label
              htmlFor="crm-admin-email"
              className="block text-[11px] font-medium text-[#4A392A] uppercase tracking-wider mb-1.5 font-sans"
            >
              Administrator Email
            </label>
            <input
              id="crm-admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              placeholder="admin@shivura.com"
              className={`w-full bg-[#FAF7F2] border ${
                fieldErrors.email ? "border-rose-400" : "border-[#DFCBB8]"
              } rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#382B1F] placeholder-[#A49180] focus:outline-none focus:ring-1 focus:ring-[#B88746] focus:border-[#B88746] transition-all shadow-2xs`}
              required
            />
            {fieldErrors.email && (
              <p className="mt-1 text-[11px] text-rose-600 font-sans">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="crm-admin-password"
              className="block text-[11px] font-medium text-[#4A392A] uppercase tracking-wider mb-1.5 font-sans"
            >
              Security Password
            </label>
            <div className="relative">
              <input
                id="crm-admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                placeholder="••••••••••••"
                className={`w-full bg-[#FAF7F2] border ${
                  fieldErrors.password ? "border-rose-400" : "border-[#DFCBB8]"
                } rounded-xl px-3.5 py-2.5 pr-11 text-xs sm:text-sm text-[#382B1F] placeholder-[#A49180] focus:outline-none focus:ring-1 focus:ring-[#B88746] focus:border-[#B88746] transition-all shadow-2xs`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-500 hover:text-stone-800 cursor-pointer focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1 text-[11px] text-rose-600 font-sans">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#1C2820] hover:bg-[#2A3B30] text-[#FAF5EB] rounded-xl text-xs uppercase tracking-[0.16em] font-sans font-medium transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 pt-3"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-[#FAF5EB]"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Authenticating Admin...</span>
              </>
            ) : (
              <span>Sign In to CRM Portal</span>
            )}
          </button>
        </form>

        {/* Security Disclaimers & Return to Boutique */}
        <div className="pt-3 border-t border-[#DFCBB8]/70 text-center space-y-2">
          <p className="text-[11px] text-[#8C7560] font-light flex items-center justify-center space-x-1.5">
            <span>🔒</span>
            <span>256-bit AES-GCM Encrypted Administrative Session</span>
          </p>
          <div>
            <Link
              href="/"
              className="text-[11.5px] text-[#B88746] hover:text-[#916223] font-medium transition-colors inline-flex items-center space-x-1"
            >
              <span>← Return to Shivura Boutique</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
