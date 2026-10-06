"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { SubNavItem } from "@/types/navigation";

interface ShopDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  items: SubNavItem[];
  activeHref: string;
}

export function ShopDropdown({
  isOpen,
  onClose,
  items,
  activeHref,
}: ShopDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      ref={dropdownRef}
      role="menu"
      aria-orientation="vertical"
      className={`absolute top-full left-0 mt-1.5 w-52 bg-[#FAF8F5] border border-stone-200 shadow-lg rounded-xs py-2 z-50 transition-all duration-200 origin-top-left ${
        isOpen
          ? "opacity-100 scale-100 pointer-events-auto translate-y-0"
          : "opacity-0 scale-95 pointer-events-none -translate-y-1"
      }`}
    >
      <div className="py-1">
        {items.map((subItem) => {
          const isSubActive = activeHref === subItem.href;
          return (
            <Link
              key={subItem.href}
              href={subItem.href}
              role="menuitem"
              onClick={onClose}
              className={`block px-4 py-2.5 text-xs font-sans uppercase tracking-[0.14em] transition-colors ${
                isSubActive
                  ? "text-neutral-900 font-semibold bg-stone-200/50"
                  : "text-neutral-700 hover:text-neutral-900 hover:bg-stone-200/40"
              }`}
            >
              {subItem.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
