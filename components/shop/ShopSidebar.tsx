"use client";

import React from "react";
import { SHOP_SIDEBAR_CATEGORIES } from "@/lib/constants";

interface ShopSidebarProps {
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export function ShopSidebar({
  selectedCategory,
  onSelectCategory,
}: ShopSidebarProps) {
  return (
    <aside className="w-full lg:w-64 shrink-0">
      <div className="bg-[#FAF7F2] border border-[#DFCBB8]/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
        {/* Sidebar Header with Flourish */}
        <div className="flex items-center space-x-2 pb-5 border-b border-[#E8DCCF]">
          <span className="text-[#B88746] text-lg font-serif">✨</span>
          <h2 className="font-serif italic text-2xl text-[#2E2217] font-normal tracking-wide">
            Browse by
          </h2>
        </div>

        {/* Category List */}
        <nav className="mt-4 space-y-1.5" aria-label="Product Categories">
          {SHOP_SIDEBAR_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-[#1E2721] text-[#FAF6F0] font-medium shadow-xs"
                    : "text-[#3D2E22] hover:bg-[#F2E8DC] hover:text-[#1E2721] font-normal"
                }`}
              >
                <span className="text-sm tracking-wide font-sans">
                  {cat.label}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isActive
                      ? "text-[#E6CA65] translate-x-0.5"
                      : "text-[#9E8B7A]"
                  }`}
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            );
          })}
        </nav>

        {/* Bottom Decorative Lotus Emblem */}
        <div className="pt-6 mt-6 border-t border-[#E8DCCF] flex justify-center text-[#B88746]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 20"
            fill="currentColor"
            className="w-5 h-4 opacity-80"
            aria-hidden="true"
          >
            <path d="M16 1 C14.5 5, 14.5 10, 16 14 C17.5 10, 17.5 5, 16 1 Z" opacity="0.95" />
            <path d="M15 4 C11 7, 10.5 12, 15.5 14 C13.5 11, 13.5 7, 15 4 Z" opacity="0.9" />
            <path d="M17 4 C21 7, 21.5 12, 16.5 14 C18.5 11, 18.5 7, 17 4 Z" opacity="0.9" />
            <path d="M13.5 7 C8.5 10, 8 14.5, 14.5 15 C11 13.5, 10.5 10.5, 13.5 7 Z" opacity="0.8" />
            <path d="M18.5 7 C23.5 10, 24 14.5, 17.5 15 C21 13.5, 21.5 10.5, 18.5 7 Z" opacity="0.8" />
            <path d="M11 15.5 C14 17, 18 17, 21 15.5 C19 16.5, 13 16.5, 11 15.5 Z" opacity="0.95" />
          </svg>
        </div>
      </div>
    </aside>
  );
}
