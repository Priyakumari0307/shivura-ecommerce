"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { VerifiedAdminUser } from "@/lib/adminAuth";
import CrmLogoutButton from "@/app/CRM/(portal)/CrmLogoutButton";

interface CrmSidebarLayoutProps {
  admin: VerifiedAdminUser;
  children: React.ReactNode;
}

interface NavItemConfig {
  id: string;
  name: string;
  href?: string;
  isUpcoming?: boolean;
  section: "catalog" | "operations" | "system";
  exact?: boolean;
}

const SIDEBAR_ITEMS: NavItemConfig[] = [
  // Catalog Management
  {
    id: "overview",
    name: "Overview",
    href: "/CRM",
    exact: true,
    section: "catalog",
  },
  {
    id: "products",
    name: "Products",
    href: "/CRM/products",
    exact: true,
    section: "catalog",
  },
  {
    id: "add-product",
    name: "Add Product",
    href: "/CRM/products/new",
    exact: true,
    section: "catalog",
  },
  {
    id: "categories",
    name: "Categories",
    href: "/CRM/categories",
    exact: false,
    section: "catalog",
  },
  {
    id: "occasions",
    name: "Occasions",
    href: "/CRM/occasions",
    exact: false,
    section: "catalog",
  },
  {
    id: "homepage",
    name: "Homepage Management",
    href: "/CRM/homepage",
    exact: false,
    section: "catalog",
  },
  {
    id: "media",
    name: "Media Library",
    href: "/CRM/media",
    exact: false,
    section: "catalog",
  },

  // Operations
  {
    id: "orders",
    name: "Orders",
    href: "/CRM/orders",
    exact: false,
    section: "operations",
  },
  {
    id: "artisans",
    name: "Artisans & Enquiries",
    href: "/CRM/artisans",
    exact: false,
    section: "operations",
  },

  // System
  {
    id: "settings",
    name: "Settings",
    href: "/CRM/settings",
    exact: false,
    section: "system",
  },
];

export default function CrmSidebarLayout({
  admin,
  children,
}: CrmSidebarLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileMenuOpen(false);
  }

  // Handle escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Compute active status for navigation links
  const isItemActive = (item: NavItemConfig) => {
    if (!item.href || item.isUpcoming) return false;
    if (item.id === "products") {
      // Products list matches /CRM/products or query params, but not /CRM/products/new
      return (
        pathname === "/CRM/products" ||
        (pathname.startsWith("/CRM/products/") && pathname !== "/CRM/products/new")
      );
    }
    if (item.id === "categories" || item.id === "taxonomy") {
      return pathname === "/CRM/categories" || pathname.startsWith("/CRM/categories/");
    }
    if (item.id === "occasions") {
      return pathname === "/CRM/occasions" || pathname.startsWith("/CRM/occasions/");
    }
    if (item.id === "homepage") {
      return pathname === "/CRM/homepage" || pathname.startsWith("/CRM/homepage/");
    }
    if (item.id === "media") {
      return pathname === "/CRM/media" || pathname.startsWith("/CRM/media/");
    }
    if (item.id === "orders") {
      return pathname === "/CRM/orders" || pathname.startsWith("/CRM/orders/");
    }
    if (item.id === "artisans") {
      return pathname === "/CRM/artisans" || pathname.startsWith("/CRM/artisans/");
    }
    if (item.id === "settings") {
      return pathname === "/CRM/settings" || pathname.startsWith("/CRM/settings/");
    }
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  // Derive human-readable current section title for the topbar
  const getPageTitle = () => {
    if (pathname === "/CRM") return "Store Overview";
    if (pathname === "/CRM/products") return "Product Catalog";
    if (pathname === "/CRM/products/new") return "Add New Product";
    if (pathname.includes("/edit")) return "Edit Product Details";
    if (pathname === "/CRM/categories" || pathname.startsWith("/CRM/categories/")) return "Category Management";
    if (pathname === "/CRM/occasions" || pathname.startsWith("/CRM/occasions/")) return "Occasion Management";
    if (pathname === "/CRM/homepage" || pathname.startsWith("/CRM/homepage/")) return "Homepage Management";
    if (pathname === "/CRM/media" || pathname.startsWith("/CRM/media/")) return "Media Library";
    if (pathname === "/CRM/orders" || pathname.startsWith("/CRM/orders/")) return "Orders Management";
    if (pathname === "/CRM/artisans" || pathname.startsWith("/CRM/artisans/")) return "Artisans & Enquiries";
    if (pathname === "/CRM/settings" || pathname.startsWith("/CRM/settings/")) return "Settings";
    return "CRM Administration";
  };

  // Navigation SVG Icons
  const renderNavIcon = (id: string, active: boolean) => {
    const strokeClass = active ? "stroke-[#FAF5EB]" : "stroke-[#7E6955]";
    switch (id) {
      case "overview":
        return (
          <svg className={`w-4 h-4 ${strokeClass}`} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
          </svg>
        );
      case "products":
        return (
          <svg className={`w-4 h-4 ${strokeClass}`} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
          </svg>
        );
      case "add-product":
        return (
          <svg className={`w-4 h-4 ${strokeClass}`} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        );
      case "categories":
      case "taxonomy":
        return (
          <svg className={`w-4 h-4 ${strokeClass}`} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        );
      case "occasions":
        return (
          <svg className={`w-4 h-4 ${strokeClass}`} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <rect x="3" y="8" width="18" height="13" rx="2" />
            <path d="M12 8v13" />
            <path d="M19 12H5" />
            <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
          </svg>
        );
      case "homepage":
        return (
          <svg className={`w-4 h-4 ${strokeClass}`} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <path d="m4 12 4-4 4 4 4-4 4 4" />
          </svg>
        );
      case "media":
        return (
          <svg className={`w-4 h-4 ${strokeClass}`} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        );
      case "orders":
        return (
          <svg className={`w-4 h-4 ${strokeClass}`} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        );
      case "artisans":
        return (
          <svg className={`w-4 h-4 ${strokeClass}`} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case "settings":
        return (
          <svg className={`w-4 h-4 ${strokeClass}`} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Reusable Sidebar Nav Content
  const renderSidebarContent = () => {
    const catalogItems = SIDEBAR_ITEMS.filter((i) => i.section === "catalog");
    const operationsItems = SIDEBAR_ITEMS.filter((i) => i.section === "operations");
    const systemItems = SIDEBAR_ITEMS.filter((i) => i.section === "system");

    return (
      <div className="flex flex-col h-full bg-[#FAF7F2]">
        {/* Brand Header */}
        <div className="p-5 border-b border-[#DFCBB8]/70 flex items-center justify-between">
          <Link href="/CRM" className="flex items-center space-x-2.5 group">
            <span className="font-serif text-lg tracking-[0.2em] font-normal text-[#2C2117] uppercase">
              SHIVURA
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#1C2820] text-[#FAF5EB] text-[9.5px] font-sans font-semibold tracking-wider uppercase">
              CRM
            </span>
          </Link>

          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-sans text-[#7E6955] hover:text-[#2C2117] transition-colors flex items-center space-x-1"
            title="Preview storefront boutique"
          >
            <span>Boutique</span>
            <span className="text-[10px]">↗</span>
          </Link>
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3.5 py-5 space-y-6">
          {/* Section: Catalog */}
          <div>
            <div className="px-3 pb-2 text-[10px] font-sans uppercase tracking-[0.18em] font-semibold text-[#8C7560]">
              Catalog Management
            </div>
            <nav className="space-y-1" aria-label="Catalog Navigation">
              {catalogItems.map((item) => {
                const active = isItemActive(item);

                if (item.isUpcoming) {
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#9E8B79] opacity-60 cursor-not-allowed select-none"
                      title="Scheduled in upcoming CRM milestone"
                      aria-disabled="true"
                    >
                      <div className="flex items-center space-x-2.5">
                        {renderNavIcon(item.id, false)}
                        <span>{item.name}</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-stone-200/80 text-stone-600">
                        Upcoming
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    href={item.href!}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 group ${
                      active
                        ? "bg-[#2C2117] text-[#FAF5EB] font-medium shadow-xs"
                        : "text-[#5C4A3A] hover:text-[#2C2117] hover:bg-[#DFCBB8]/30 font-normal"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      {renderNavIcon(item.id, active)}
                      <span>{item.name}</span>
                    </div>
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#B88746]" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Section: Operations */}
          <div>
            <div className="px-3 pb-2 text-[10px] font-sans uppercase tracking-[0.18em] font-semibold text-[#8C7560]">
              Operations
            </div>
            <nav className="space-y-1" aria-label="Operations Navigation">
              {operationsItems.map((item) => {
                const active = isItemActive(item);

                if (item.isUpcoming) {
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#9E8B79] opacity-60 cursor-not-allowed select-none"
                      title="Scheduled in upcoming CRM milestone"
                      aria-disabled="true"
                    >
                      <div className="flex items-center space-x-2.5">
                        {renderNavIcon(item.id, false)}
                        <span>{item.name}</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-stone-200/80 text-stone-600">
                        Upcoming
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    href={item.href!}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 group ${
                      active
                        ? "bg-[#2C2117] text-[#FAF5EB] font-medium shadow-xs"
                        : "text-[#5C4A3A] hover:text-[#2C2117] hover:bg-[#DFCBB8]/30 font-normal"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      {renderNavIcon(item.id, active)}
                      <span>{item.name}</span>
                    </div>
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#B88746]" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Section: System */}
          <div>
            <div className="px-3 pb-2 text-[10px] font-sans uppercase tracking-[0.18em] font-semibold text-[#8C7560]">
              System
            </div>
            <nav className="space-y-1" aria-label="System Navigation">
              {systemItems.map((item) => {
                const active = isItemActive(item);

                if (item.isUpcoming) {
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#9E8B79] opacity-60 cursor-not-allowed select-none"
                      title="Scheduled in upcoming CRM milestone"
                      aria-disabled="true"
                    >
                      <div className="flex items-center space-x-2.5">
                        {renderNavIcon(item.id, false)}
                        <span>{item.name}</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-stone-200/80 text-stone-600">
                        Upcoming
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    href={item.href!}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 group ${
                      active
                        ? "bg-[#2C2117] text-[#FAF5EB] font-medium shadow-xs"
                        : "text-[#5C4A3A] hover:text-[#2C2117] hover:bg-[#DFCBB8]/30 font-normal"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      {renderNavIcon(item.id, active)}
                      <span>{item.name}</span>
                    </div>
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#B88746]" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Admin Identity & Footer Controls */}
        <div className="p-4 border-t border-[#DFCBB8]/70 bg-white/70 space-y-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1C2820] text-[#FAF5EB] flex items-center justify-center text-xs font-serif font-bold uppercase tracking-wider">
              {admin.name ? admin.name.charAt(0) : admin.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#2C2117] truncate">
                {admin.name || admin.email}
              </div>
              <div className="flex items-center space-x-1.5 text-[10.5px] text-[#7E6955]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Admin Active</span>
              </div>
            </div>
          </div>

          <CrmLogoutButton variant="sidebar" />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col md:flex-row">
      {/* Desktop Persistent Sidebar (fixed left on md+) */}
      <aside className="hidden md:flex flex-col w-64 xl:w-72 fixed inset-y-0 left-0 z-30 border-r border-[#DFCBB8]/80 shadow-[1px_0_12px_rgba(44,33,23,0.03)]">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer (backdrop + sliding panel) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true" aria-label="CRM Navigation">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 flex flex-col bg-[#FAF7F2]">
            <div className="absolute top-3 right-3 z-20">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-[#7E6955] hover:text-[#2C2117] hover:bg-[#DFCBB8]/40 transition-colors"
                aria-label="Close navigation"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Area (offset on desktop by sidebar width) */}
      <div className="flex-1 md:pl-64 xl:pl-72 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#DFCBB8]/80 shadow-[0_2px_12px_rgba(44,33,23,0.03)]">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            {/* Left: Mobile Toggle & Page Title */}
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
              {/* Mobile Menu Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-xl text-[#2C2117] hover:bg-[#FAF7F2] border border-[#DFCBB8]/70 transition-colors"
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              <div className="min-w-0">
                <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.18em] text-[#8C7560] block leading-none">
                  Shivura CRM
                </span>
                <h1 className="font-serif text-lg sm:text-xl text-[#2C2117] font-normal truncate mt-1">
                  {getPageTitle()}
                </h1>
              </div>
            </div>

            {/* Right: Quick Actions & Top Header Controls */}
            <div className="flex items-center space-x-3 sm:space-x-4">
              <Link
                href="/CRM/products/new"
                className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] text-xs font-semibold uppercase tracking-wider rounded-xl transition-all shadow-2xs"
              >
                <span className="text-sm leading-none">+</span>
                <span>Add Product</span>
              </Link>

              {/* Admin Identity Pill */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-[#FAF7F2] border border-[#DFCBB8]/80 rounded-xl text-xs font-sans">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[#4A392A] font-medium max-w-[150px] truncate">{admin.email}</span>
                <span className="text-[9.5px] uppercase tracking-wider text-[#B88746] font-semibold bg-[#B88746]/10 px-1.5 py-0.5 rounded">
                  Admin
                </span>
              </div>

              {/* Header Logout Action */}
              <CrmLogoutButton variant="header" />
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* Executive Footer */}
        <footer className="border-t border-[#DFCBB8]/60 bg-white/60 py-4 px-4 sm:px-6 lg:px-8 text-center text-[11px] font-sans text-[#8C7560]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Shivura Luxury Lifestyle • Catalog Administration</span>
            <span className="font-mono text-[10px] text-stone-500">
              Authenticated Session (256-bit JWE AES-GCM)
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
