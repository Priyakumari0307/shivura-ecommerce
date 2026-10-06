"use client";

import { useState } from "react";
import Link from "next/link";
import { ANNOUNCEMENT_TEXT } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface AnnouncementBarProps {
  message?: string;
  href?: string;
  closable?: boolean;
  className?: string;
}

export function AnnouncementBar({
  message = ANNOUNCEMENT_TEXT,
  href,
  closable = false,
  className,
}: AnnouncementBarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  if (!isVisible) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
    }, 300);
  };

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out overflow-hidden select-none",
        isClosing ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      )}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            "relative z-50 bg-[#111111] text-stone-200 text-[10px] sm:text-[11px] font-sans font-medium uppercase tracking-[0.2em] sm:tracking-[0.24em] py-1 sm:py-1.5 px-4 text-center border-b border-neutral-800/80 transition-colors",
            className
          )}
        >
          <div className="mx-auto max-w-7xl flex items-center justify-center">
            {href ? (
              <Link
                href={href}
                className="hover:text-white transition-colors underline underline-offset-4 decoration-neutral-600 hover:decoration-white truncate"
              >
                {message}
              </Link>
            ) : (
              <span className="truncate">{message}</span>
            )}
          </div>

          {closable && (
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 transition-colors rounded-xs focus:outline-none focus:ring-1 focus:ring-stone-400 cursor-pointer"
              aria-label="Dismiss announcement"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
