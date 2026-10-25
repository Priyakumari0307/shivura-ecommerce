"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  name: string;
  href: string;
  badge?: string;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Overview",
    href: "/CRM",
    exact: true,
  },
  {
    name: "Products",
    href: "/CRM/products",
    exact: true,
  },
  {
    name: "Add Product",
    href: "/CRM/products/new",
    exact: true,
  },
  {
    name: "Categories",
    href: "/CRM/categories",
    exact: false,
  },
  {
    name: "Occasions",
    href: "/CRM/occasions",
    exact: false,
  },
  {
    name: "Homepage",
    href: "/CRM/homepage",
    exact: false,
  },
  {
    name: "Media Library",
    href: "/CRM/media",
    exact: false,
  },
  {
    name: "Orders",
    href: "/CRM/orders",
    exact: false,
  },
  {
    name: "Artisans & Enquiries",
    href: "/CRM/artisans",
    exact: false,
  },
  {
    name: "Settings",
    href: "/CRM/settings",
    exact: false,
  },
];

export default function CrmNavTabs() {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <nav
      aria-label="CRM Navigation"
      className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto py-1 no-scrollbar font-sans text-xs"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item);
        const isUpcoming = Boolean(item.badge);

        if (isUpcoming) {
          return (
            <div
              key={item.href}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[#9E8B79] bg-transparent cursor-not-allowed opacity-60 select-none"
              title="Coming in subsequent roadmap phase"
            >
              <span>{item.name}</span>
              {item.badge && (
                <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.2 rounded bg-stone-200/70 text-stone-600">
                  {item.badge}
                </span>
              )}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl transition-all duration-150 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#B88746]/50 ${
              active
                ? "bg-[#2C2117] text-[#FAF5EB] font-medium shadow-xs"
                : "text-[#7E6955] hover:text-[#2C2117] hover:bg-[#DFCBB8]/30 font-normal"
            }`}
          >
            <span>{item.name}</span>
            {item.name === "Products" && active && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#B88746]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
