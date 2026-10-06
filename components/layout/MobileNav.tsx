"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useShop } from "@/context/ShopContext";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const { wishlistCount, cartCount } = useShop();
  const [expandedSubMenu, setExpandedSubMenu] = useState<string | null>("Shop");

  // Close mobile drawer on route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSubMenu = (label: string) => {
    setExpandedSubMenu((prev) => (prev === label ? null : label));
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-[#FAF8F5] text-neutral-900 shadow-2xl flex flex-col justify-between p-6 overflow-y-auto border-r border-stone-300/80 transition-transform duration-300 ease-in-out">
        <div>
          {/* Header in Drawer with Enlarged Logo Image */}
          <div className="flex items-center justify-between pb-6 border-b border-stone-200">
            <Link href="/" onClick={onClose} className="flex items-center">
              <Image
                src="/images/logo.jpeg"
                alt="Shivura Logo"
                width={240}
                height={200}
                className="h-20 sm:h-24 w-auto object-contain"
              />
            </Link>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-600 hover:text-neutral-900 focus:outline-none rounded-xs"
              aria-label="Close menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
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

          {/* Nav Links */}
          <nav className="py-6 flex flex-col space-y-2">
            {NAV_ITEMS.map((item) => {
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isSubExpanded = expandedSubMenu === item.label;
              const isActive =
                pathname === item.href ||
                (item.subItems &&
                  item.subItems.some((sub) => pathname === sub.href));

              if (hasSubItems) {
                return (
                  <div key={item.href} className="py-1">
                    <div className="flex items-center justify-between">
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`text-base font-medium tracking-[0.12em] uppercase transition-colors py-2 ${
                          isActive
                            ? "text-neutral-900 font-semibold"
                            : "text-neutral-700 hover:text-neutral-900"
                        }`}
                      >
                        {item.label}
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleSubMenu(item.label)}
                        className="p-2 text-neutral-600 hover:text-neutral-900 focus:outline-none"
                        aria-label={`Toggle ${item.label} sub-items`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`transition-transform duration-200 ${
                            isSubExpanded ? "rotate-180 text-neutral-900" : "text-neutral-500"
                          }`}
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                    </div>

                    {isSubExpanded && (
                      <div className="pl-4 py-1 space-y-2 border-l border-stone-300 ml-2 mt-1">
                        {item.subItems?.map((sub) => {
                          const isSubActive = pathname === sub.href;
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={onClose}
                              className={`block text-xs uppercase tracking-[0.14em] py-1.5 transition-colors ${
                                isSubActive
                                  ? "text-neutral-900 font-semibold"
                                  : "text-neutral-600 hover:text-neutral-900"
                              }`}
                            >
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`text-base font-medium tracking-[0.12em] uppercase transition-colors py-2 flex items-center justify-between ${
                    isActive
                      ? "text-neutral-900 font-semibold border-l-2 border-neutral-900 pl-3"
                      : "text-neutral-700 hover:text-neutral-900"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.href === "/cart" && (
                    <span className="text-xs bg-stone-900 text-stone-100 rounded-full px-2.5 py-0.5 font-sans font-normal">
                      {cartCount}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Quick Mobile Wishlist & Account Links */}
            <div className="pt-4 border-t border-stone-200 mt-2 space-y-2">
              <Link
                href="/wishlist"
                onClick={onClose}
                className="flex items-center space-x-2.5 py-2 text-sm text-neutral-700 hover:text-rose-600 font-medium tracking-wide uppercase"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill={wishlistCount > 0 ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={wishlistCount > 0 ? "text-rose-600" : ""}
                >
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                </svg>
                <span>Wishlist ({wishlistCount})</span>
              </Link>
              <Link
                href="/login"
                onClick={onClose}
                className="flex items-center space-x-2.5 py-2 text-sm text-neutral-700 hover:text-neutral-900 font-medium tracking-wide uppercase"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Account Login / Sign Up</span>
              </Link>
            </div>
          </nav>
        </div>

        {/* Footer info in Mobile Drawer */}
        <div className="pt-6 border-t border-stone-200">
          <p className="text-xs text-neutral-500 font-sans">
            Need help? Email us at{" "}
            <a href="mailto:support@shivura.com" className="underline text-neutral-800">
              support@shivura.com
            </a>
          </p>
          <div className="mt-4 flex space-x-4 text-neutral-600">
            <span className="text-xs tracking-widest text-neutral-400 uppercase">
              Follow Us:
            </span>
            <span className="text-xs text-neutral-700 uppercase">Instagram</span>
            <span className="text-xs text-neutral-700 uppercase">Pinterest</span>
          </div>
        </div>
      </div>
    </div>
  );
}
