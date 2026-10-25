"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { sanitizeClientRedirectPath } from "@/lib/pendingAction";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const returnUrlParam = searchParams.get("returnUrl") || searchParams.get("redirect");
  const safeReturnUrl = sanitizeClientRedirectPath(returnUrlParam, "/");
  const reasonParam = searchParams.get("reason");
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // If already authenticated and not loading, redirect to return URL
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace(safeReturnUrl);
    }
  }, [isAuthenticated, isAuthLoading, router, safeReturnUrl]);

  // Contextual reason messages
  const getReasonBanner = () => {
    switch (reasonParam) {
      case "cart":
        return {
          title: "Sign in to add items to your cart",
          description: "Your selected piece will be safely saved to your shopping bag upon sign in.",
        };
      case "wishlist":
        return {
          title: "Sign in to manage your wishlist",
          description: "Curate and preserve your personal collection of handcrafted favorites.",
        };
      case "contact":
        return {
          title: "Sign in to submit your enquiry",
          description: "Connect directly with our luxury concierge and artisan team.",
        };
      case "checkout":
        return {
          title: "Sign in to complete your order",
          description: "Secure 256-bit encrypted checkout with verified Indian payment gateways.",
        };
      default:
        return null;
    }
  };

  // Google OAuth error translations
  const getOAuthErrorMessage = () => {
    if (!errorParam) return null;
    switch (errorParam) {
      case "account_exists":
        return "An account with this email already exists via standard credentials. Please sign in below using your email and password.";
      case "oauth_denied":
        return "Google sign-in was cancelled. You may sign in with your email or try Google again.";
      case "oauth_unconfigured":
        return "Google authentication is being initialized. Please sign in using your email and password.";
      case "unverified_email":
        return "Your Google email address is not verified. Please verify your email with Google or sign up with email.";
      case "invalid_token":
      case "token_exchange_failed":
      case "invalid_state":
      case "missing_state":
        return "Authentication could not be completed. Please try signing in with your email and password.";
      default:
        return "Unable to sign in with Google. Please use your email and password below.";
    }
  };

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      errors.email = "Email address is required";
    } else if (!emailRegex.test(email.trim())) {
      errors.email = "Please enter a valid email address";
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
      const result = await login({
        email: email.trim(),
        password,
      });

      if (!result.success) {
        setErrorMessage(result.error || "Invalid email or password");
        setIsSubmitting(false);
      } else {
        // Redirection is handled seamlessly
        router.replace(safeReturnUrl);
      }
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  const reasonBanner = getReasonBanner();
  const oauthError = getOAuthErrorMessage();

  // Signup link with preserved return params
  const signupQuery = new URLSearchParams();
  if (returnUrlParam) signupQuery.set("returnUrl", safeReturnUrl);
  if (reasonParam) signupQuery.set("reason", reasonParam);
  const signupHref = `/signup${signupQuery.toString() ? `?${signupQuery.toString()}` : ""}`;

  // Google OAuth initiate URL with sanitized return path
  const googleAuthUrl = `/api/auth/google?return_to=${encodeURIComponent(safeReturnUrl)}`;

  return (
    <div className="w-full">
      {/* Brand Header */}
      {/* Brand Header */}
      <div className="text-center space-y-1 mb-3.5 sm:mb-4">
        <div className="inline-flex items-center space-x-1.5 text-[#B88746] text-[10.5px] uppercase tracking-[0.2em] font-sans font-medium">
          <span>✦</span>
          <span>Member Concierge</span>
          <span>✦</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-[28px] text-[#2C2117] font-normal tracking-tight leading-tight">
          Welcome to Shivura
        </h1>
        <p className="text-xs text-[#7E6955] font-light max-w-sm mx-auto">
          Sign in to access your curated treasures, orders, and concierge.
        </p>
        <div className="w-10 h-[1px] bg-[#DFCBB8] mx-auto mt-1" />
      </div>

      <div className="bg-white/95 backdrop-blur-sm p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-[#DFCBB8]/80 shadow-[0_4px_24px_rgba(44,33,23,0.06)] max-w-md mx-auto space-y-3 sm:space-y-3.5">
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

        {/* OAuth Error Alert */}
        {oauthError && (
          <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs font-sans space-y-0.5">
            <div className="flex items-center space-x-1.5 font-medium">
              <span>⚠️</span>
              <span>Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800 font-light">
              {oauthError}
            </p>
          </div>
        )}

        {/* Form Level Error Alert */}
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-800 text-xs font-sans flex items-start space-x-2">
            <span className="text-sm leading-none mt-0.5">⚠️</span>
            <div className="flex-1 text-[11.5px] font-light leading-relaxed">
              {errorMessage}
            </div>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          {/* Email Address */}
          <div>
            <label
              htmlFor="login-email"
              className="block text-[11px] font-medium text-[#4A392A] uppercase tracking-wider mb-1 font-sans"
            >
              Email Address
            </label>
            <input
              id="login-email"
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

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="login-password"
                className="block text-[11px] font-medium text-[#4A392A] uppercase tracking-wider font-sans"
              >
                Password
              </label>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                placeholder="••••••••"
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
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In</span>
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

        {/* Link to Signup */}
        <div className="text-center pt-2 sm:pt-2.5 border-t border-[#DFCBB8]/70">
          <p className="text-[11.5px] text-[#7E6955] font-light">
            Don&apos;t have a Shivura profile?{" "}
            <Link
              href={signupHref}
              className="text-[#B88746] font-medium hover:underline hover:text-[#916223] transition-colors"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
