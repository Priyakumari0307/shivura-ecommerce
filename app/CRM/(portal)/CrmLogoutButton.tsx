"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface CrmLogoutButtonProps {
  className?: string;
  variant?: "header" | "forbidden" | "sidebar";
}

export default function CrmLogoutButton({
  className = "",
  variant = "header",
}: CrmLogoutButtonProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/crm/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[CRM Logout Error]:", err);
    } finally {
      router.replace("/CRM/login");
      router.refresh();
    }
  };

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className={`w-full px-3 py-2 text-xs text-rose-700 hover:text-rose-900 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200/70 rounded-xl transition-all font-sans font-medium cursor-pointer disabled:opacity-60 flex items-center justify-center space-x-2 ${className}`}
        title="Terminate administrative session"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>{isLoggingOut ? "Ending Session..." : "Log Out"}</span>
      </button>
    );
  }

  if (variant === "forbidden") {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className={`px-4 py-2.5 bg-[#1C2820] hover:bg-[#2F3E34] text-[#FAF5EB] rounded-xl text-xs uppercase tracking-wider font-sans font-medium transition-all shadow-xs cursor-pointer disabled:opacity-60 flex items-center justify-center space-x-2 ${className}`}
      >
        {isLoggingOut ? (
          <span>Signing Out...</span>
        ) : (
          <>
            <span>🔒</span>
            <span>Sign Out & Switch to Admin Login</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={`px-3 py-1.5 text-xs text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-all font-sans font-medium cursor-pointer disabled:opacity-60 flex items-center space-x-1.5 ${className}`}
      title="Terminate administrative session"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      <span>{isLoggingOut ? "Ending Session..." : "Admin Logout"}</span>
    </button>
  );
}
