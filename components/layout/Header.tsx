"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { MobileNav } from "./MobileNav";
import { ShopDropdown } from "./ShopDropdown";
import { useShop } from "@/context/ShopContext";
import { useAuth } from "@/context/AuthContext";

export function Header() {
  const pathname = usePathname();
  const { wishlistCount, cartCount, showToast } = useShop();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCloseMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMouseEnterShop = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
    }
    setShopDropdownOpen(true);
  };

  const handleMouseLeaveShop = () => {
    leaveTimeoutRef.current = setTimeout(() => {
      setShopDropdownOpen(false);
    }, 150);
  };

  // Do not render consumer header in CRM
  if (pathname?.startsWith("/CRM") || pathname?.startsWith("/crm")) {
    return null;
  }

  return (
    <>
      <header
        className={`sticky top-0 z-40 bg-[#FAF8F5]/90 backdrop-blur-md transition-all duration-300 ease-in-out border-b ${
          scrolled
            ? "border-stone-300/80 shadow-2xs py-1 sm:py-1.5"
            : "border-stone-200/80 py-1.5 sm:py-2"
        }`}
      >
        <Container size="wide">
          <div className="flex items-center justify-between">
            {/* Left: Brand Logo & Mobile Hamburger */}
            <div className="flex items-center space-x-3 sm:space-x-4">
              {/* Mobile Hamburger Button */}
              <button
                type="button"
                id="mobile-nav-toggle"
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden flex items-center justify-center w-10 h-10 -ml-1 text-neutral-800 hover:text-neutral-900 active:bg-stone-200/60 focus:outline-none focus:ring-1 focus:ring-neutral-400 rounded-md cursor-pointer transition-colors"
                aria-label="Open navigation menu"
                aria-expanded={mobileNavOpen}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>

              {/* Shivura Brand Logo Image */}
              <Link href="/" className="group flex items-center">
                <Image
                  src="/images/logo.jpeg"
                  alt="Shivura Logo"
                  width={240}
                  height={200}
                  className={`w-auto object-contain transition-all duration-300 ease-in-out group-hover:opacity-95 ${
                    scrolled
                      ? "h-11 sm:h-12 lg:h-13"
                      : "h-14 sm:h-16 lg:h-18"
                  }`}
                  priority
                />
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-8">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.subItems &&
                    item.subItems.some((sub) => pathname === sub.href));

                if (item.subItems && item.subItems.length > 0) {
                  return (
                    <div
                      key={item.href}
                      className="relative py-1"
                      onMouseEnter={handleMouseEnterShop}
                      onMouseLeave={handleMouseLeaveShop}
                    >
                      <button
                        type="button"
                        aria-expanded={shopDropdownOpen}
                        aria-haspopup="true"
                        onClick={() => setShopDropdownOpen(!shopDropdownOpen)}
                        className={`text-xs uppercase tracking-[0.18em] font-medium transition-colors inline-flex items-center space-x-1 cursor-pointer py-1 ${
                          isActive
                            ? "text-neutral-900 font-semibold"
                            : "text-neutral-700 hover:text-neutral-900"
                        }`}
                      >
                        <span>{item.label}</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`transition-transform duration-200 ${
                            shopDropdownOpen ? "rotate-180 text-neutral-900" : "text-neutral-500"
                          }`}
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>

                      {isActive && (
                        <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-neutral-900 rounded-full" />
                      )}

                      <ShopDropdown
                        isOpen={shopDropdownOpen}
                        onClose={() => setShopDropdownOpen(false)}
                        items={item.subItems}
                        activeHref={pathname}
                      />
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-xs uppercase tracking-[0.18em] font-medium transition-colors relative py-1 ${
                      isActive
                        ? "text-neutral-900 font-semibold"
                        : "text-neutral-700 hover:text-neutral-900"
                    }`}
                  >
                    {item.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-neutral-900 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right: User Login, Wishlist & Cart Action Icons */}
            <div className="flex items-center space-x-3.5 sm:space-x-4.5">
              {/* Account / Login or Profile Dropdown */}
              {isAuthenticated && user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-1.5 p-1 rounded-full text-neutral-800 hover:text-neutral-900 focus:outline-none cursor-pointer"
                    aria-label="User Account Menu"
                    aria-expanded={userMenuOpen}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#1C2820] text-[#FAF5EB] flex items-center justify-center text-xs font-serif font-medium shadow-xs">
                      {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`text-neutral-500 transition-transform duration-200 hidden sm:block ${
                        userMenuOpen ? "rotate-180" : ""
                      }`}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>

                  {/* Luxury Dropdown Menu */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#FAF8F5] border border-[#DFCBB8] shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-2.5 border-b border-[#DFCBB8]/60">
                        <p className="text-[10.5px] font-sans text-[#B88746] uppercase tracking-wider font-semibold">
                          ✦ Shivura Circle ✦
                        </p>
                        <p className="font-serif text-sm text-[#2C2117] font-medium truncate pt-0.5">
                          {user.name || "Member"}
                        </p>
                        <p className="text-[11px] text-[#7E6955] truncate font-light">
                          {user.email}
                        </p>
                      </div>

                      <div className="py-1">
                        <Link
                          href="/wishlist"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center justify-between px-4 py-2 text-xs text-[#3A2A1E] hover:bg-[#FAF7F2] hover:text-[#B88746] transition-colors"
                        >
                          <span>My Wishlist</span>
                          <span className="text-[11px] font-semibold text-rose-600">
                            ({wishlistCount})
                          </span>
                        </Link>
                        <Link
                          href="/cart"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center justify-between px-4 py-2 text-xs text-[#3A2A1E] hover:bg-[#FAF7F2] hover:text-[#B88746] transition-colors"
                        >
                          <span>My Shopping Cart</span>
                          <span className="text-[11px] font-semibold text-[#1C2820]">
                            ({cartCount})
                          </span>
                        </Link>
                        <Link
                          href="/account/orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center justify-between px-4 py-2 text-xs text-[#3A2A1E] hover:bg-[#FAF7F2] hover:text-[#B88746] transition-colors"
                        >
                          <span>My Orders</span>
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#B88746]">
                            View History
                          </span>
                        </Link>
                        <Link
                          href="/contact"
                          onClick={() => setUserMenuOpen(false)}
                          className="block px-4 py-2 text-xs text-[#3A2A1E] hover:bg-[#FAF7F2] hover:text-[#B88746] transition-colors"
                        >
                          Concierge &amp; Support
                        </Link>
                      </div>

                      <div className="pt-1 border-t border-[#DFCBB8]/60">
                        <button
                          type="button"
                          onClick={async () => {
                            setUserMenuOpen(false);
                            await logout();
                            showToast("You have been signed out safely. You may continue browsing.", "info");
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-rose-700 hover:bg-rose-50/70 font-medium transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <span>Sign Out</span>
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
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="text-neutral-700 hover:text-neutral-900 p-1.5 transition-colors relative flex items-center cursor-pointer"
                  aria-label="Account Login and Sign Up"
                  title="Account / Sign In"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="19"
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
                </Link>
              )}

              {/* Wishlist Heart Icon */}
              <Link
                href="/wishlist"
                className="text-neutral-700 hover:text-rose-600 p-1.5 transition-colors relative flex items-center group cursor-pointer"
                aria-label="Wishlist"
                title="Wishlist"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill={wishlistCount > 0 ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`group-hover:scale-105 transition-transform ${
                    wishlistCount > 0 ? "text-rose-600" : ""
                  }`}
                >
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                </svg>
                <span className={`ml-1 text-xs font-sans font-medium ${wishlistCount > 0 ? "text-rose-600 font-semibold" : "text-neutral-800"}`}>
                  ({wishlistCount})
                </span>
              </Link>

              {/* Shopping Cart Icon */}
              <Link
                href="/cart"
                className="text-neutral-700 hover:text-neutral-900 p-1.5 transition-colors relative flex items-center group cursor-pointer"
                aria-label="Shopping Cart"
                title="Shopping Cart"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="group-hover:scale-105 transition-transform"
                >
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                <span className={`ml-1 text-xs font-sans font-medium ${cartCount > 0 ? "text-[#1C2820] font-bold" : "text-neutral-800"}`}>
                  ({cartCount})
                </span>
              </Link>
            </div>
          </div>
        </Container>
      </header>

      {/* Mobile Nav Drawer */}
      <MobileNav
        isOpen={mobileNavOpen}
        onClose={handleCloseMobileNav}
      />
    </>
  );
}
