"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Product } from "@/types";
import { ALL_PRODUCTS, SHOP_SIDEBAR_CATEGORIES } from "@/lib/constants";
import { ShopProductCard } from "./ShopProductCard";

interface ShopCatalogProps {
  initialCategory?: string;
  initialQuery?: string;
}

export function ShopCatalog({
  initialCategory = "all",
  initialQuery = "",
}: ShopCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [sortBy, setSortBy] = useState<string>("default");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Update selection if initial props change
  useEffect(() => {
    if (initialCategory) setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (initialQuery) setSearchQuery(initialQuery);
  }, [initialQuery]);

  // Get active category display title
  const currentCategoryObj = useMemo(() => {
    return (
      SHOP_SIDEBAR_CATEGORIES.find((cat) => cat.id === selectedCategory) || {
        id: "all",
        label: "All Products",
        slug: "all",
      }
    );
  }, [selectedCategory]);

  // Count products per category for badge indicators in dropdown
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: ALL_PRODUCTS.length };
    SHOP_SIDEBAR_CATEGORIES.forEach((cat) => {
      if (cat.id === "all") return;
      counts[cat.id] = ALL_PRODUCTS.filter((p) => {
        return (
          p.categories?.includes(cat.id) ||
          p.category === cat.id ||
          (cat.id === "bestseller" && p.badge === "Bestseller") ||
          (cat.id === "new" && (p.isNew || p.badge === "New"))
        );
      }).length;
    });
    return counts;
  }, []);

  // Filter products by category and search query
  const filteredProducts = useMemo(() => {
    return ALL_PRODUCTS.filter((product) => {
      // Category filter
      if (selectedCategory && selectedCategory !== "all") {
        const matchesCategory =
          product.categories?.includes(selectedCategory) ||
          product.category === selectedCategory ||
          (selectedCategory === "bestseller" && product.badge === "Bestseller") ||
          (selectedCategory === "new" && (product.isNew || product.badge === "New"));

        if (!matchesCategory) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesCategory = product.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesCategory) return false;
      }

      return true;
    });
  }, [selectedCategory, searchQuery]);

  // Sort filtered products
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (sortBy === "price-low") {
      return list.sort((a, b) => a.price - b.price);
    }
    if (sortBy === "price-high") {
      return list.sort((a, b) => b.price - a.price);
    }
    if (sortBy === "rating") {
      return list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (sortBy === "newest") {
      return list.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    }
    return list;
  }, [filteredProducts, sortBy]);

  const handleResetFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    setSortBy("default");
    setIsFilterOpen(false);
  };

  const isFiltered = selectedCategory !== "all" || searchQuery.trim() !== "" || sortBy !== "default";

  return (
    <div className="relative pt-6 pb-12 sm:pt-8 sm:pb-16 bg-[#FAF8F5] min-h-[700px] overflow-hidden">
      {/* Decorative Corner Watermarks */}
      <div className="pointer-events-none absolute -bottom-12 -left-12 w-64 h-64 opacity-15 text-[#B88746]">
        <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="60" cy="140" r="40" strokeDasharray="3 3" />
          <path d="M60 40 C80 80, 120 100, 160 140" />
          <path d="M40 80 C80 100, 100 140, 120 180" />
          <circle cx="100" cy="100" r="60" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Controls Toolbar: Filter Dropdown + Search Bar + Sort Dropdown */}
        <div className="bg-[#FAF7F2] border border-[#DFCBB8]/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs mb-6 transition-all">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            
            {/* Left: Category Filter Dropdown */}
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsFilterOpen((prev) => !prev)}
                className={`w-full md:w-auto inline-flex items-center justify-between space-x-2.5 px-4 py-2 rounded-full border text-xs sm:text-sm font-sans transition-all duration-200 cursor-pointer shadow-2xs ${
                  selectedCategory !== "all"
                    ? "bg-[#1E2721] text-[#FAF6F0] border-[#1E2721] hover:bg-[#2A372E]"
                    : "bg-[#FAF7F2] hover:bg-white text-[#382B1F] border-[#DFCBB8]"
                }`}
                aria-haspopup="true"
                aria-expanded={isFilterOpen}
              >
                <div className="flex items-center space-x-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={selectedCategory !== "all" ? "text-[#E6CA65]" : "text-[#B88746]"}
                  >
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                  </svg>
                  <span className="text-[#7E6955] font-light">Filter:</span>
                  <span className="font-medium">{currentCategoryObj.label}</span>
                </div>

                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${isFilterOpen ? "rotate-180" : ""} ${
                    selectedCategory !== "all" ? "text-[#E6CA65]" : "text-[#7E6955]"
                  }`}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {/* Dropdown Menu Popup */}
              {isFilterOpen && (
                <div className="absolute left-0 top-full mt-2 w-full md:w-64 bg-[#FAF7F2] border border-[#DFCBB8] rounded-xl shadow-xl z-50 py-2 max-h-80 overflow-y-auto backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 border-b border-[#E8DCCF]/80 flex items-center justify-between text-[11px] uppercase tracking-wider text-[#9E8B7A] font-sans font-medium">
                    <span>Select Category</span>
                    <span>{SHOP_SIDEBAR_CATEGORIES.length} options</span>
                  </div>

                  <div className="mt-1 space-y-0.5 px-1.5">
                    {SHOP_SIDEBAR_CATEGORIES.map((cat) => {
                      const isActive = selectedCategory === cat.id;
                      const count = categoryCounts[cat.id];

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setIsFilterOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs sm:text-[13px] font-sans transition-all duration-150 cursor-pointer ${
                            isActive
                              ? "bg-[#1E2721] text-[#FAF6F0] font-medium shadow-2xs"
                              : "text-[#3D2E22] hover:bg-[#F2E8DC] hover:text-[#1E2721]"
                          }`}
                        >
                          <span className="font-normal">{cat.label}</span>

                          {count !== undefined && (
                            <span
                              className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                                isActive
                                  ? "bg-white/20 text-[#FAF6F0]"
                                  : "bg-[#E8DCCF]/60 text-[#7E6955]"
                              }`}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Middle: Search Bar Input */}
            <div className="relative flex-1 max-w-full md:max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9E8B7A]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, craft, or style..."
                className="w-full bg-white hover:bg-[#FAF7F2] focus:bg-white border border-[#DFCBB8] rounded-full pl-9 pr-8 py-2 text-xs sm:text-sm text-[#382B1F] placeholder-[#9E8B7A] focus:outline-none focus:ring-1 focus:ring-[#B88746] focus:border-[#B88746] shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#9E8B7A] hover:text-[#382B1F] cursor-pointer"
                  title="Clear search"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>

            {/* Right: Sort By Dropdown */}
            <div className="flex items-center justify-between sm:justify-end space-x-2 shrink-0">
              <label htmlFor="shop-sort" className="text-xs text-[#7E6955] font-sans font-light">
                Sort by:
              </label>
              <div className="relative">
                <select
                  id="shop-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none bg-white hover:bg-[#FAF7F2] border border-[#DFCBB8] rounded-full pl-3.5 pr-8 py-2 text-xs sm:text-sm text-[#4A392A] focus:outline-none focus:ring-1 focus:ring-[#B88746] focus:border-[#B88746] shadow-2xs cursor-pointer transition-colors"
                >
                  <option value="default">Default</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Customer Rating</option>
                  <option value="newest">Newest First</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-[#7E6955]">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Active Filters Bar & Product Count */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-7 text-xs text-[#7A6451] px-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-sans font-medium text-[#4A392A]">
              Showing <span className="font-semibold text-[#1C2820]">{sortedProducts.length}</span> {sortedProducts.length === 1 ? "product" : "products"}
            </span>

            {/* Active Category Chip */}
            {selectedCategory !== "all" && (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#EFE7DC] border border-[#DFCBB8] text-[#2C2117] text-xs font-medium shadow-2xs">
                <span>Category: {currentCategoryObj.label}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className="hover:text-red-700 cursor-pointer font-bold ml-1 text-sm leading-none"
                  title="Remove category filter"
                >
                  ×
                </button>
              </span>
            )}

            {/* Active Search Query Chip */}
            {searchQuery.trim() && (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#EFE7DC] border border-[#DFCBB8] text-[#2C2117] text-xs font-medium shadow-2xs">
                <span>Search: &ldquo;{searchQuery}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="hover:text-red-700 cursor-pointer font-bold ml-1 text-sm leading-none"
                  title="Clear search"
                >
                  ×
                </button>
              </span>
            )}

            {/* Reset All Filters Button */}
            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-[#B88746] hover:text-[#8E531A] font-medium underline cursor-pointer ml-1.5 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Product Grid - Full Width Responsive */}
        {sortedProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5 lg:gap-6">
            {sortedProducts.map((product) => (
              <ShopProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4 bg-[#FAF7F2] border border-[#DFCBB8]/70 rounded-2xl">
            <div className="text-[#B88746] text-3xl mb-3">🪷</div>
            <h3 className="font-serif text-lg text-[#35271D]">No products found</h3>
            <p className="text-xs text-[#7E6955] mt-1 max-w-sm mx-auto">
              We couldn&apos;t find any pieces matching your current filter or search criteria.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 px-5 py-2 rounded-full bg-[#1E2721] text-stone-100 text-xs font-sans tracking-wide hover:bg-[#2F3E34] transition-colors cursor-pointer"
            >
              View All Products
            </button>
          </div>
        )}

        {/* Bottom Ornate Divider & Action Button */}
        {sortedProducts.length > 0 && (
          <div className="mt-14 pt-8 border-t border-[#E8DCCF]/80 flex flex-col items-center space-y-4">
            <div className="flex items-center justify-center space-x-3 text-[#B88746] w-full">
              <div className="h-[1px] flex-1 max-w-[120px] sm:max-w-[200px] bg-[#DFCBB8]" />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 20"
                fill="currentColor"
                className="w-4 h-3.5 opacity-90"
                aria-hidden="true"
              >
                <path d="M16 1 C14.5 5, 14.5 10, 16 14 C17.5 10, 17.5 5, 16 1 Z" />
                <path d="M15 4 C11 7, 10.5 12, 15.5 14 C13.5 11, 13.5 7, 15 4 Z" opacity="0.85" />
                <path d="M17 4 C21 7, 21.5 12, 16.5 14 C18.5 11, 18.5 7, 17 4 Z" opacity="0.85" />
              </svg>

              {/* Center Pill Button */}
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-6 py-2.5 rounded-full bg-[#1C2820] hover:bg-[#2B3B30] text-[#FAF5EB] text-xs sm:text-[13px] font-sans font-medium tracking-wide flex items-center space-x-2 border border-[#C8A060]/50 shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer"
              >
                <span>View All Products</span>
                <span className="text-[#E6CA65]">→</span>
              </button>

              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 20"
                fill="currentColor"
                className="w-4 h-3.5 opacity-90"
                aria-hidden="true"
              >
                <path d="M16 1 C14.5 5, 14.5 10, 16 14 C17.5 10, 17.5 5, 16 1 Z" />
                <path d="M15 4 C11 7, 10.5 12, 15.5 14 C13.5 11, 13.5 7, 15 4 Z" opacity="0.85" />
                <path d="M17 4 C21 7, 21.5 12, 16.5 14 C18.5 11, 18.5 7, 17 4 Z" opacity="0.85" />
              </svg>
              <div className="h-[1px] flex-1 max-w-[120px] sm:max-w-[200px] bg-[#DFCBB8]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
