"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CrmCatalogAnalyticsData } from "@/lib/crm/analytics";

interface CrmDashboardOverviewProps {
  initialData: CrmCatalogAnalyticsData;
  adminName: string;
}

export default function CrmDashboardOverview({
  initialData,
  adminName,
}: CrmDashboardOverviewProps) {
  const [data, setData] = useState<CrmCatalogAnalyticsData>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const { metrics, categories, occasions, recentProducts } = data;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/crm/analytics");
      if (!res.ok) {
        throw new Error(`Failed to refresh analytics (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "Error refreshing analytics");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Safe percentage helper
  const calcPercent = (val: number, total: number) => {
    if (!total || total <= 0) return 0;
    return Math.round((val / total) * 100);
  };

  const publishedPercent = calcPercent(metrics.published, metrics.total);
  const draftPercent = calcPercent(metrics.draft, metrics.total);
  const inStockPercent = calcPercent(metrics.inStock, metrics.total);
  const lowStockPercent = calcPercent(metrics.lowStock, metrics.total);
  const outOfStockPercent = calcPercent(metrics.outOfStock, metrics.total);

  // Maximum category count for relative bar scaling
  const maxCategoryCount = Math.max(...categories.map((c) => c.productCount), 1);

  return (
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* Header & Greeting Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 text-[#B88746] text-[11px] uppercase tracking-[0.2em] font-medium">
            <span>✦</span>
            <span>Catalog Intelligence</span>
            <span>✦</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#2C2117] font-normal tracking-tight">
            Store Overview
          </h1>
          <p className="text-xs sm:text-sm text-[#7E6955] font-light max-w-2xl leading-relaxed">
            Welcome back, <strong className="font-medium text-[#2C2117]">{adminName}</strong>. Live catalog status, inventory alerts, and taxonomy distribution from the central database.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 self-start md:self-auto">
          {/* Refresh Action */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl border border-[#DFCBB8] bg-white hover:bg-[#FAF7F2] text-[#4A392A] transition-all disabled:opacity-50 text-xs flex items-center justify-center shadow-2xs cursor-pointer"
            title="Refresh analytics data"
            aria-label="Refresh analytics data"
          >
            <svg
              className={`w-4 h-4 text-[#5C4A3A] ${isRefreshing ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
          </button>

          {/* View Catalog */}
          <Link
            href="/CRM/products"
            className="px-3.5 py-2.5 rounded-xl border border-[#DFCBB8] bg-white hover:bg-[#FAF7F2] text-[#2C2117] text-xs font-semibold uppercase tracking-wider transition-all shadow-2xs whitespace-nowrap"
          >
            View Products
          </Link>

          {/* Add Product Button */}
          <Link
            href="/CRM/products/new"
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] text-xs font-semibold uppercase tracking-wider transition-all shadow-sm hover:shadow whitespace-nowrap"
            id="overview-add-product-button"
          >
            <span className="text-base leading-none font-normal">+</span>
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {refreshError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
          <span>Failed to refresh metrics: {refreshError}</span>
          <button onClick={() => setRefreshError(null)} className="text-rose-500 hover:text-rose-700 ml-2">✕</button>
        </div>
      )}

      {/* 4 Primary Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Products */}
        <Link
          href="/CRM/products"
          className="group p-5 rounded-2xl bg-white border border-[#DFCBB8]/80 hover:border-[#B88746]/60 transition-all shadow-[0_2px_12px_rgba(44,33,23,0.03)] hover:shadow-md flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8C7560]">
              Total Products
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#FAF7F2] border border-[#DFCBB8]/70 flex items-center justify-center text-[#B88746] group-hover:scale-105 transition-transform">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                <path d="m3.3 7 8.7 5 8.7-5" />
                <path d="M12 22V12" />
              </svg>
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-serif text-[#2C2117] font-normal">
              {metrics.total}
            </div>
            <div className="text-[11px] text-[#7E6955] mt-1 flex items-center space-x-2">
              <span>{metrics.active} active catalog items</span>
              {metrics.archived > 0 && (
                <>
                  <span>•</span>
                  <span className="text-stone-500">{metrics.archived} archived</span>
                </>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-[#DFCBB8]/40 flex items-center justify-between text-[11px] text-[#B88746] font-medium">
            <span>Manage Catalog</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </div>
        </Link>

        {/* Card 2: Published Products */}
        <Link
          href="/CRM/products?status=published"
          className="group p-5 rounded-2xl bg-white border border-[#DFCBB8]/80 hover:border-emerald-600/50 transition-all shadow-[0_2px_12px_rgba(44,33,23,0.03)] hover:shadow-md flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8C7560]">
              Published
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition-transform">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-serif text-[#1C2820] font-normal flex items-baseline space-x-2">
              <span>{metrics.published}</span>
              <span className="text-xs font-sans font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                {publishedPercent}%
              </span>
            </div>
            <div className="text-[11px] text-[#7E6955] mt-1">
              Live on customer boutique storefront
            </div>
          </div>

          <div className="pt-2 border-t border-[#DFCBB8]/40 flex items-center justify-between text-[11px] text-emerald-800 font-medium">
            <span>Filter Published</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </div>
        </Link>

        {/* Card 3: Draft Products */}
        <Link
          href="/CRM/products?status=draft"
          className="group p-5 rounded-2xl bg-white border border-[#DFCBB8]/80 hover:border-amber-500/50 transition-all shadow-[0_2px_12px_rgba(44,33,23,0.03)] hover:shadow-md flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8C7560]">
              Drafts
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 group-hover:scale-105 transition-transform">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-serif text-[#2C2117] font-normal flex items-baseline space-x-2">
              <span>{metrics.draft}</span>
              <span className="text-xs font-sans font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                {draftPercent}%
              </span>
            </div>
            <div className="text-[11px] text-[#7E6955] mt-1">
              Hidden from storefront, editing in progress
            </div>
          </div>

          <div className="pt-2 border-t border-[#DFCBB8]/40 flex items-center justify-between text-[11px] text-amber-800 font-medium">
            <span>Filter Drafts</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </div>
        </Link>

        {/* Card 4: Stock Alerts */}
        <div className="p-5 rounded-2xl bg-white border border-rose-200/80 shadow-[0_2px_12px_rgba(225,29,72,0.03)] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-rose-800">
              Stock Alerts
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-serif text-[#2C2117] font-normal">
              {metrics.stockAlertsTotal}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 font-sans">
              <Link
                href="/CRM/products?status=low_stock"
                className="p-1.5 rounded-lg bg-amber-50/80 hover:bg-amber-100 border border-amber-200/60 transition-colors block text-center"
                title="View products with stock between 1 and 5"
              >
                <div className="text-[10px] text-amber-800 uppercase font-semibold">Low Stock</div>
                <div className="text-sm font-semibold text-amber-900 mt-0.5">{metrics.lowStock}</div>
                <div className="text-[9px] text-amber-700/80">1–5 units</div>
              </Link>
              <Link
                href="/CRM/products?status=out_of_stock"
                className="p-1.5 rounded-lg bg-rose-50/80 hover:bg-rose-100 border border-rose-200/60 transition-colors block text-center"
                title="View products with 0 stock"
              >
                <div className="text-[10px] text-rose-800 uppercase font-semibold">Out of Stock</div>
                <div className="text-sm font-semibold text-rose-900 mt-0.5">{metrics.outOfStock}</div>
                <div className="text-[9px] text-rose-700/80">0 units</div>
              </Link>
            </div>
          </div>

          <div className="pt-2 border-t border-[#DFCBB8]/40 flex items-center justify-between text-[11px] text-rose-700 font-medium">
            <span>Threshold: ≤ 5 units</span>
            <Link href="/CRM/products?status=out_of_stock" className="hover:underline">
              Review Alerts →
            </Link>
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid: Status Distribution & Inventory Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Section 1: Catalog Status Breakdown */}
        <div className="p-6 rounded-2xl bg-white border border-[#DFCBB8]/80 shadow-[0_2px_12px_rgba(44,33,23,0.03)] space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg text-[#2C2117] font-normal">
                Publication Distribution
              </h2>
              <p className="text-xs text-[#7E6955] font-light">
                Ratio of public storefront items versus unpublished drafts
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FAF7F2] border border-[#DFCBB8] text-[#4A392A]">
              {metrics.total} Items
            </span>
          </div>

          {/* Proportional Stacked Bar */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-stone-100 rounded-full overflow-hidden flex shadow-inner">
              {publishedPercent > 0 && (
                <div
                  style={{ width: `${publishedPercent}%` }}
                  className="bg-[#1C2820] transition-all duration-300"
                  title={`Published: ${metrics.published} (${publishedPercent}%)`}
                />
              )}
              {draftPercent > 0 && (
                <div
                  style={{ width: `${draftPercent}%` }}
                  className="bg-[#B88746] transition-all duration-300"
                  title={`Drafts: ${metrics.draft} (${draftPercent}%)`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-[#1C2820]" />
                <span className="text-[#2C2117] font-medium">Published: {metrics.published}</span>
                <span className="text-stone-500 text-[11px]">({publishedPercent}%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-[#B88746]" />
                <span className="text-[#2C2117] font-medium">Drafts: {metrics.draft}</span>
                <span className="text-stone-500 text-[11px]">({draftPercent}%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-stone-300" />
                <span className="text-[#2C2117] font-medium">Archived: {metrics.archived}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#DFCBB8]/40 text-[11.5px] text-[#7E6955] flex items-center justify-between">
            <span>Storefront Visibility Policy: Only active, published items appear in boutique</span>
            <Link href="/CRM/products" className="text-[#B88746] hover:underline font-medium">
              View All
            </Link>
          </div>
        </div>

        {/* Section 2: Inventory Health Breakdown */}
        <div className="p-6 rounded-2xl bg-white border border-[#DFCBB8]/80 shadow-[0_2px_12px_rgba(44,33,23,0.03)] space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg text-[#2C2117] font-normal">
                Inventory Stock Health
              </h2>
              <p className="text-xs text-[#7E6955] font-light">
                Stock fulfillment availability across all product entries
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FAF7F2] border border-[#DFCBB8] text-[#4A392A]">
              Alerts: {metrics.stockAlertsTotal}
            </span>
          </div>

          {/* Proportional Stacked Bar */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-stone-100 rounded-full overflow-hidden flex shadow-inner">
              {inStockPercent > 0 && (
                <div
                  style={{ width: `${inStockPercent}%` }}
                  className="bg-emerald-600 transition-all duration-300"
                  title={`In Stock (>5): ${metrics.inStock} (${inStockPercent}%)`}
                />
              )}
              {lowStockPercent > 0 && (
                <div
                  style={{ width: `${lowStockPercent}%` }}
                  className="bg-amber-500 transition-all duration-300"
                  title={`Low Stock (1-5): ${metrics.lowStock} (${lowStockPercent}%)`}
                />
              )}
              {outOfStockPercent > 0 && (
                <div
                  style={{ width: `${outOfStockPercent}%` }}
                  className="bg-rose-500 transition-all duration-300"
                  title={`Out of Stock (0): ${metrics.outOfStock} (${outOfStockPercent}%)`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span className="text-[#2C2117] font-medium">In Stock ({metrics.inStock})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-[#2C2117] font-medium">Low Stock ({metrics.lowStock})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-[#2C2117] font-medium">Out of Stock ({metrics.outOfStock})</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#DFCBB8]/40 text-[11.5px] text-[#7E6955] flex items-center justify-between">
            <span>Base product stock & variant stock are tracked independently</span>
            <Link href="/CRM/products?status=low_stock" className="text-[#B88746] hover:underline font-medium">
              Manage Inventory
            </Link>
          </div>
        </div>
      </div>

      {/* Taxonomy Distribution Breakdown (Categories & Occasions) */}
      <div className="p-6 rounded-2xl bg-white border border-[#DFCBB8]/80 shadow-[0_2px_12px_rgba(44,33,23,0.03)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-serif text-lg sm:text-xl text-[#2C2117] font-normal">
              Taxonomy Breakdown
            </h2>
            <p className="text-xs text-[#7E6955] font-light">
              Live product counts mapped to luxury categories and festive occasions
            </p>
          </div>
          <span className="text-xs text-[#8C7560] self-start sm:self-auto">
            {categories.length} Categories • {occasions.length} Occasions
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Categories Chart */}
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[#8C7560] border-b border-[#DFCBB8]/40 pb-1.5">
              Top Categories
            </div>
            <div className="space-y-2.5">
              {categories.map((cat) => {
                const barWidth = Math.round((cat.productCount / maxCategoryCount) * 100);
                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <Link
                        href={`/CRM/products?category=${cat.slug}`}
                        className="text-[#2C2117] hover:text-[#B88746] font-medium transition-colors"
                      >
                        {cat.name}
                      </Link>
                      <span className="text-[#7E6955] font-mono text-[11px]">
                        {cat.productCount} {cat.productCount === 1 ? "product" : "products"}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[#FAF7F2] rounded-full overflow-hidden border border-[#DFCBB8]/40">
                      <div
                        style={{ width: `${barWidth}%` }}
                        className="h-full bg-[#2C2117] rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Occasions Badges & Counts */}
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[#8C7560] border-b border-[#DFCBB8]/40 pb-1.5">
              Occasions & Seasonal Themes
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {occasions.map((occ) => (
                <Link
                  key={occ.id}
                  href={`/CRM/products?occasion=${occ.slug}`}
                  className="p-3 rounded-xl bg-[#FAF7F2] hover:bg-[#FAF5EB] border border-[#DFCBB8]/70 hover:border-[#B88746]/60 transition-all group flex items-center justify-between"
                >
                  <span className="text-xs font-medium text-[#2C2117] group-hover:text-[#B88746] transition-colors truncate">
                    {occ.name}
                  </span>
                  <span className="ml-2 px-2 py-0.5 rounded-md bg-white border border-[#DFCBB8]/80 text-[#1C2820] font-mono text-[11px] font-semibold">
                    {occ.productCount}
                  </span>
                </Link>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF7F2]/80 border border-[#DFCBB8]/60 text-xs text-[#7E6955] leading-relaxed mt-4">
              <span className="font-semibold text-[#2C2117]">Taxonomy Rule: </span>
              Products can be cross-listed across multiple categories and seasonal occasions to ensure discoverability across boutique navigation filters.
            </div>
          </div>
        </div>
      </div>

      {/* Recently Added Products Table */}
      <div className="p-6 rounded-2xl bg-white border border-[#DFCBB8]/80 shadow-[0_2px_12px_rgba(44,33,23,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-serif text-lg sm:text-xl text-[#2C2117] font-normal">
              Recently Cataloged Products
            </h2>
            <p className="text-xs text-[#7E6955] font-light">
              Latest items added or synchronized in the Shivura collection
            </p>
          </div>
          <Link
            href="/CRM/products"
            className="text-xs text-[#B88746] hover:text-[#2C2117] font-semibold transition-colors self-start sm:self-auto flex items-center space-x-1"
          >
            <span>View All ({metrics.total})</span>
            <span>→</span>
          </Link>
        </div>

        {recentProducts.length === 0 ? (
          <div className="p-8 text-center bg-[#FAF7F2] rounded-xl border border-dashed border-[#DFCBB8] space-y-3">
            <p className="text-sm text-[#7E6955]">No products cataloged in the database yet.</p>
            <Link
              href="/CRM/products/new"
              className="inline-block px-4 py-2 bg-[#2C2117] text-[#FAF5EB] rounded-xl text-xs font-semibold uppercase tracking-wider"
            >
              Add First Product
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6 no-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DFCBB8]/60 text-[10.5px] uppercase tracking-wider text-[#8C7560] font-semibold">
                  <th className="py-3 pr-4">Product</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3">Price</th>
                  <th className="py-3 px-3">Stock</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 pl-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFCBB8]/40">
                {recentProducts.map((prod) => (
                  <tr key={prod.id} className="hover:bg-[#FAF7F2]/60 transition-colors group">
                    {/* Product Name & Thumbnail */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-[#FAF7F2] border border-[#DFCBB8]/70 overflow-hidden relative shrink-0 flex items-center justify-center">
                          {prod.imageUrl ? (
                            <Image
                              src={prod.imageUrl}
                              alt={prod.imageAlt || prod.name}
                              fill
                              sizes="40px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="text-[10px] text-stone-400 font-mono">No img</span>
                          )}
                        </div>
                        <div className="min-w-0 max-w-[220px] sm:max-w-xs">
                          <Link
                            href={`/CRM/products/${prod.id}/edit`}
                            className="font-medium text-[#2C2117] group-hover:text-[#B88746] transition-colors truncate block"
                            title={prod.name}
                          >
                            {prod.name}
                          </Link>
                          {prod.categoryName && (
                            <span className="text-[10px] text-[#8C7560]">
                              {prod.categoryName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* SKU */}
                    <td className="py-3 px-3 font-mono text-[11px] text-stone-600">
                      {prod.sku || "—"}
                    </td>

                    {/* Price */}
                    <td className="py-3 px-3 font-semibold text-[#2C2117]">
                      ₹{prod.price.toLocaleString("en-IN")}
                    </td>

                    {/* Stock */}
                    <td className="py-3 px-3">
                      {prod.stock <= 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-800 border border-rose-200">
                          Out of Stock ({prod.stock})
                        </span>
                      ) : prod.stock <= 5 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          Low Stock ({prod.stock})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {prod.stock} in stock
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      {prod.published ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Published</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Draft</span>
                        </span>
                      )}
                    </td>

                    {/* Edit Link */}
                    <td className="py-3 pl-4 text-right">
                      <Link
                        href={`/CRM/products/${prod.id}/edit`}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#FAF7F2] hover:bg-[#2C2117] text-[#4A392A] hover:text-[#FAF5EB] border border-[#DFCBB8]/70 hover:border-[#2C2117] transition-all font-medium text-[11px]"
                      >
                        <span>Edit</span>
                        <span>→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
