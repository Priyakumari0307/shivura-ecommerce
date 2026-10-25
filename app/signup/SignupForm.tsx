"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { sanitizeClientRedirectPath } from "@/lib/pendingAction";

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const returnUrlParam = searchParams.get("returnUrl") || searchParams.get("redirect");
  const safeReturnUrl = sanitizeClientRedirectPath(returnUrlParam, "/");
  const reasonParam = searchParams.get("reason");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEmailDuplicate, setIsEmailDuplicate] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // If already authenticated and not loading, redirect to return destination
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace(safeReturnUrl);
    }
  }, [isAuthenticated, isAuthLoading, router, safeReturnUrl]);

  // Contextual reason banner
  const getReasonBanner = () => {
    switch (reasonParam) {
      case "cart":
        return {
          title: "Create an account to save your cart",
          description: "Your selected piece will be placed in your personal bag as soon as your account is created.",
        };
      case "wishlist":
        return {
          title: "Create an account to curate your wishlist",
          description: "Save and organize your favorite artisanal pieces across all your devices.",
        };
      case "contact":
        return {
          title: "Create an account to submit your inquiry",
          description: "Enjoy dedicated communication with our concierge specialists.",
        };
      case "checkout":
        return {
          title: "Create an account to checkout",
          description: "Store your delivery addresses and track artisanal shipments with ease.",
        };
      default:
        return null;
    }
  };

  const validate = () => {
    const errors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name.trim()) {
      errors.name = "Full name is required";
    } else if (name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }

    if (!email.trim()) {
      errors.email = "Email address is required";
    } else if (!emailRegex.test(email.trim())) {
      errors.email = "Please enter a valid email address";
    }

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Confirm password is required";
    } else if (confirmPassword !== password) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsEmailDuplicate(false);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signup({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (!result.success) {
        const errorText = result.error || "Failed to create account";
        setErrorMessage(errorText);
        if (
          errorText.toLowerCase().includes("already exists") ||
          errorText.toLowerCase().includes("duplicate")
        ) {
          setIsEmailDuplicate(true);
        }
        setIsSubmitting(false);
      } else {
        // Redirection handled
        router.replace(safeReturnUrl);
      }
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  const reasonBanner = getReasonBanner();

  // Login link with preserved parameters
  const loginQuery = new URLSearchParams();
  if (returnUrlParam) loginQuery.set("returnUrl", safeReturnUrl);
  if (reasonParam) loginQuery.set("reason", reasonParam);
  const loginHref = `/login${loginQuery.toString() ? `?${loginQuery.toString()}` : ""}`;

  // Google OAuth URL
  const googleAuthUrl = `/api/auth/google?return_to=${encodeURIComponent(safeReturnUrl)}`;

  return (
    <div className="w-full">
      {/* Brand Header */}
      <div className="text-center space-y-1 mb-3.5 sm:mb-4">
        <div className="inline-flex items-center space-x-1.5 text-[#B88746] text-[10.5px] uppercase tracking-[0.2em] font-sans font-medium">
          <span>✦</span>
          <span>Join the Shivura Circle</span>
          <span>✦</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-[28px] text-[#2C2117] font-normal tracking-tight leading-tight">
          Create an Account
        </h1>
        <p className="text-xs text-[#7E6955] font-light max-w-sm mx-auto">
          Experience timeless Indian artisanal heritage, bespoke collections, and seamless ordering.
        </p>
        <div className="w-10 h-[1px] bg-[#DFCBB8] mx-auto mt-1" />
      </div>

      <div className="bg-white/95 backdrop-blur-sm p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#DFCBB8]/80 shadow-[0_4px_24px_rgba(44,33,23,0.06)] max-w-xl mx-auto space-y-3 sm:space-y-3.5">
        {/* Contextual Reason Banner */}
        {reasonBanner && (
          <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#DFCBB8] text-xs font-sans text-[#4A392A] space-y-0.5">
            <div className="flex items-center space-x-1.5 font-medium text-[#B88746]">
              <span>🪷</span>
              <span>{reasonBanner.title}</span>
            </div>
            <p className="text-[11px] text-[#7E6955] font-light leading-relaxed">
              {reasonBanner.description}
            </p>
          </div>
        )}

        {/* Form Error Banner */}
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-800 text-xs font-sans space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-sm leading-none">⚠️</span>
              <span className="font-medium">Registration Issue</span>
            </div>
            <p className="text-[11.5px] font-light leading-relaxed">
              {errorMessage}
            </p>
            {isEmailDuplicate && (
              <div className="pt-0.5">
                <Link
                  href={loginHref}
                  className="inline-flex items-center space-x-1 text-xs font-medium text-[#B88746] hover:underline"
                >
                  <span>Click here to sign in with this email</span>
                  <span>→</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          {/* Row 1: Full Name & Email Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Full Name */}
            <div>
              <label
                htmlFor="signup-name"
                className="block text-[11px] font-medium text-[#4A392A] uppercase tracking-wider mb-1 font-sans"
              >
                Full Name
              </label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="Priya Kumari"
                className={`w-full bg-[#FAF7F2] border ${
                  fieldErrors.name ? "border-rose-400" : "border-[#DFCBB8]"
                } rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#382B1F] placeholder-[#A49180] focus:outline-none focus:ring-1 focus:ring-[#B88746] focus:border-[#B88746] transition-all shadow-2xs`}
                required
              />
              {fieldErrors.name && (
                <p className="mt-1 text-[11px] text-rose-600 font-sans">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Email Address */}
            <div>
              <label
                htmlFor="signup-email"
                className="block text-[11px] font-medium text-[#4A392A] uppercase tracking-wider mb-1 font-sans"
              >
                Email Address
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                placeholder="name@example.com"
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
          </div>

          {/* Row 2: Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Password */}
            <div>
              <label
                htmlFor="signup-password"
                className="block text-[11px] font-medium text-[#4A392A] uppercase tracking-wider mb-1 font-sans"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder="Min. 8 characters"
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

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="signup-confirm-password"
                className="block text-[11px] font-medium text-[#4A392A] uppercase tracking-wider mb-1 font-sans"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        confirmPassword: undefined,
                      }));
                    }
                  }}
                  placeholder="Re-enter password"
                  className={`w-full bg-[#FAF7F2] border ${
                    fieldErrors.confirmPassword
                      ? "border-rose-400"
                      : "border-[#DFCBB8]"
                  } rounded-xl px-3.5 py-2.5 pr-11 text-xs sm:text-sm text-[#382B1F] placeholder-[#A49180] focus:outline-none focus:ring-1 focus:ring-[#B88746] focus:border-[#B88746] transition-all shadow-2xs`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-500 hover:text-stone-800 cursor-pointer focus:outline-none"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
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
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-[11px] text-rose-600 font-sans">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 sm:py-3 bg-[#1C2820] hover:bg-[#2F3E34] text-[#FAF5EB] rounded-xl text-xs uppercase tracking-widest font-sans font-medium transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        {/* Luxury Divider */}
        <div className="relative my-2.5 sm:my-3 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#DFCBB8]/70" />
          </div>
          <span className="relative bg-white px-2.5 text-[10.5px] font-sans text-[#7E6955] uppercase tracking-wider">
            or continue with
          </span>
        </div>

        {/* Continue with Google Button */}
        <a
          href={googleAuthUrl}
          className="w-full py-2.5 bg-white hover:bg-[#FAF7F2] border border-[#DFCBB8] hover:border-[#B88746]/60 text-[#2C2117] rounded-xl text-xs font-sans font-medium transition-all cursor-pointer shadow-2xs flex items-center justify-center space-x-2.5 group"
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span className="tracking-wide">Continue with Google</span>
        </a>

        {/* Link to Login */}
        <div className="text-center pt-2 sm:pt-2.5 border-t border-[#DFCBB8]/70">
          <p className="text-[11.5px] text-[#7E6955] font-light">
            Already part of the Shivura Circle?{" "}
            <Link
              href={loginHref}
              className="text-[#B88746] font-medium hover:underline hover:text-[#916223] transition-colors"
            >
              Sign in to your account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
