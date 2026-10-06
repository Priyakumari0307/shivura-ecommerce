"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/Container";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened & lock scroll
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/shop?q=${encodeURIComponent(query.trim())}`);
      onClose();
      setQuery("");
    }
  };

  const handleQuickSearch = (term: string) => {
    router.push(`/shop?q=${encodeURIComponent(term)}`);
    onClose();
    setQuery("");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Refined Search Panel - Low Vertical Height */}
      <div className="relative z-10 bg-[#FAF8F5] text-neutral-900 border-b border-stone-300/90 shadow-lg transition-all duration-200">
        <Container size="wide" className="py-4 sm:py-5">
          {/* Top Label & Close Button */}
          <div className="flex items-center justify-between pb-2">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-neutral-500 font-sans font-medium">
              SEARCH SHIVURA CATALOG
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-neutral-500 hover:text-neutral-900 focus:outline-none transition-colors cursor-pointer"
              aria-label="Close search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Middle: Clean Moderately Sized Search Input with Thin Bottom Border */}
          <form onSubmit={handleSubmit} className="mt-1">
            <div className="relative flex items-center border-b border-stone-300 focus-within:border-stone-800 transition-colors pb-1">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-transparent font-serif text-lg sm:text-xl text-neutral-900 placeholder:text-neutral-400 placeholder:font-serif focus:outline-none py-1.5 pr-10 font-normal"
              />
              <button
                type="submit"
                className="absolute right-0 text-neutral-600 hover:text-neutral-900 p-1 focus:outline-none cursor-pointer transition-colors"
                aria-label="Submit search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
            </div>
          </form>

          {/* Below: POPULAR SEARCHES */}
          <div className="mt-3.5 pt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="text-neutral-400 uppercase tracking-[0.2em] text-[9px] font-sans font-medium">
              POPULAR SEARCHES:
            </span>
            {["Festival Living", "Brass Lighting", "Home Decor", "Gifting"].map(
              (term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleQuickSearch(term)}
                  className="text-neutral-700 hover:text-neutral-950 text-xs font-sans transition-colors cursor-pointer underline underline-offset-4 decoration-stone-300 hover:decoration-neutral-800"
                >
                  {term}
                </button>
              )
            )}
          </div>
        </Container>
      </div>
    </div>
  );
}
