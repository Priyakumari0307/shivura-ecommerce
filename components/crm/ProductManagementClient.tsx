"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";

interface PrimaryImage {
  id: string;
  url: string;
  publicId?: string | null;
  altText?: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Occasion {
  id: string;
  name: string;
  slug: string;
}

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  price: number;
  originalPrice: number | null;
  pricePrefix: string | null;
  stock: number;
  rating: number;
  reviewCount: number;
  isNew: boolean;
  badge: string | null;
  active: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  primaryImage: PrimaryImage | null;
  imagesCount: number;
  variantsCount: number;
  ordersCount: number;
  hasOrders: boolean;
  categories: Category[];
  occasions: Occasion[];
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

interface CatalogSummary {
  total: number;
  published: number;
  draft: number;
  lowStock: number;
  outOfStock: number;
}

interface TaxonomyCategory {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

interface TaxonomyOccasion {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

export default function ProductManagementClient() {
  // Data states
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });
  const [summary, setSummary] = useState<CatalogSummary>({
    total: 0,
    published: 0,
    draft: 0,
    lowStock: 0,
    outOfStock: 0,
  });
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [occasions, setOccasions] = useState<TaxonomyOccasion[]>([]);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [occasionFilter, setOccasionFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Action states
  const [mutatingProductId, setMutatingProductId] = useState<string | null>(null);
  const [deleteModalProduct, setDeleteModalProduct] = useState<ProductItem | null>(null);
  const [deleteOrderConflict, setDeleteOrderConflict] = useState<{
    message: string;
    orderCount: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [, startTransition] = useTransition();

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load taxonomy on mount
  useEffect(() => {
    async function fetchTaxonomy() {
      try {
        const res = await fetch("/api/crm/taxonomy");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setCategories(json.data.categories || []);
            setOccasions(json.data.occasions || []);
          }
        }
      } catch (err) {
        console.error("Failed to load taxonomy metadata:", err);
      }
    }
    fetchTaxonomy();
  }, []);

  // Fetch product list
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("limit", itemsPerPage.toString());

    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }
    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    if (categoryFilter !== "all") {
      params.set("category", categoryFilter);
    }
    if (occasionFilter !== "all") {
      params.set("occasion", occasionFilter);
    }
    if (sortOrder !== "newest") {
      params.set("sort", sortOrder);
    }

    try {
      const res = await fetch(`/api/crm/products?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please re-authenticate to Shivura CRM.");
        }
        if (res.status === 403) {
          throw new Error("Access denied. Customer accounts cannot view CRM products.");
        }
        throw new Error(`Failed to load products (HTTP ${res.status})`);
      }

      const json = await res.json();
      if (json.success) {
        setProducts(json.data || []);
        if (json.pagination) {
          setPagination(json.pagination);
        }
        if (json.summary) {
          setSummary(json.summary);
        }
      } else {
        throw new Error(json.error || "Failed to retrieve products");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    itemsPerPage,
    debouncedSearch,
    statusFilter,
    categoryFilter,
    occasionFilter,
    sortOrder,
  ]);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      await Promise.resolve();
      if (!ignore) {
        await fetchProducts();
      }
    })();
    return () => {
      ignore = true;
    };
  }, [fetchProducts]);

  // Show auto-dismissing toast feedback
  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Toggle publish or active state
  const handleToggleStatus = async (
    product: ProductItem,
    field: "published" | "active"
  ) => {
    const nextValue = !product[field];
    setMutatingProductId(product.id);

    try {
      const res = await fetch(`/api/crm/products/${product.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: nextValue }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        // Optimistic UI update
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id ? { ...p, [field]: nextValue } : p
          )
        );
        showToast(
          `Product "${product.name}" ${field === "published" ? (nextValue ? "published" : "drafted") : (nextValue ? "activated" : "archived")}.`,
          "success"
        );
        // Refresh summary metrics in background
        startTransition(() => {
          fetchProducts();
        });
      } else {
        showToast(json.error || `Failed to update status for ${product.name}`, "error");
      }
    } catch {
      showToast("Network error while updating product status.", "error");
    } finally {
      setMutatingProductId(null);
    }
  };

  // Archive a product directly (used when deletion is blocked by order history)
  const handleArchiveProduct = async (product: ProductItem) => {
    setMutatingProductId(product.id);
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/crm/products/${product.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false, published: false }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(
          `Product "${product.name}" safely archived. Removed from storefront while preserving order history.`,
          "success"
        );
        setDeleteModalProduct(null);
        setDeleteOrderConflict(null);
        fetchProducts();
      } else {
        showToast(json.error || "Failed to archive product", "error");
      }
    } catch {
      showToast("Network error while archiving product", "error");
    } finally {
      setIsDeleting(false);
      setMutatingProductId(null);
    }
  };

  // Confirm and execute product deletion
  const handleDeleteProduct = async () => {
    if (!deleteModalProduct) return;
    setIsDeleting(true);
    setDeleteOrderConflict(null);

    try {
      const res = await fetch(`/api/crm/products/${deleteModalProduct.id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (res.status === 409) {
        // Order history conflict! Guide admin to archive instead
        setDeleteOrderConflict({
          message: json.error || "This product has active customer order records and cannot be permanently deleted.",
          orderCount: json.orderCount || 1,
        });
        return;
      }

      if (res.ok && json.success) {
        showToast(`Product "${deleteModalProduct.name}" deleted successfully.`, "success");
        setDeleteModalProduct(null);
        fetchProducts();
      } else {
        showToast(json.error || "Failed to delete product.", "error");
      }
    } catch {
      showToast("Network error while attempting product deletion.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setOccasionFilter("all");
    setSortOrder("newest");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    debouncedSearch !== "" ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    occasionFilter !== "all" ||
    sortOrder !== "newest";

  return (
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-lg border text-xs sm:text-sm font-medium flex items-center space-x-3 transition-all animate-in fade-in slide-in-from-bottom-2 ${
            toastMessage.type === "success"
              ? "bg-[#1C2820] text-emerald-100 border-emerald-800"
              : toastMessage.type === "error"
              ? "bg-rose-950 text-rose-100 border-rose-800"
              : "bg-[#2C2117] text-amber-100 border-[#DFCBB8]"
          }`}
        >
          <span>{toastMessage.type === "success" ? "✓" : toastMessage.type === "error" ? "⚠" : "ℹ"}</span>
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-stone-400 hover:text-white ml-2 text-xs"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-[11px] font-sans uppercase tracking-[0.16em] text-[#8C7560]">
            <Link href="/CRM" className="hover:text-[#2C2117] transition-colors">
              CRM Headquarters
            </Link>
            <span>/</span>
            <span className="text-[#B88746] font-semibold">Catalog</span>
            <span>/</span>
            <span className="text-[#2C2117] font-semibold">Products</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#2C2117] font-normal tracking-tight">
            Product Management
          </h1>
          <p className="text-xs text-[#7E6955] font-light max-w-2xl">
            Oversee Shivura&apos;s handcrafted luxury catalog, manage inventory stock, configure variants, and control live storefront publication states.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <button
            onClick={() => fetchProducts()}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-[#DFCBB8] bg-white hover:bg-[#FAF7F2] text-[#4A392A] transition-colors disabled:opacity-50 text-xs flex items-center justify-center shadow-2xs"
            title="Refresh product list"
            aria-label="Refresh product list"
          >
            <span className={isLoading ? "animate-spin" : ""}>↻</span>
          </button>

          <Link
            href="/CRM/products/new"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] text-xs font-semibold uppercase tracking-wider transition-all shadow-sm hover:shadow"
            id="crm-add-product-button"
          >
            <span className="text-base leading-none font-normal">+</span>
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Catalog */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("all");
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "all"
              ? "bg-[#FAF5EB] border-[#B88746] shadow-xs ring-1 ring-[#B88746]/30"
              : "bg-white/90 border-[#DFCBB8]/70 hover:border-[#B88746]/50 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-[#8C7560] text-[10.5px] uppercase tracking-wider font-semibold">
            <span>Total Catalog</span>
            <span>📦</span>
          </div>
          <div className="text-2xl sm:text-3xl font-serif text-[#2C2117] mt-1 font-normal">
            {summary.total}
          </div>
          <div className="text-[11px] text-[#7E6955] mt-0.5">
            {summary.draft > 0 ? `${summary.draft} draft${summary.draft > 1 ? "s" : ""}` : "All published"}
          </div>
        </button>

        {/* Card 2: Published */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("published");
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "published"
              ? "bg-emerald-50/60 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30"
              : "bg-white/90 border-[#DFCBB8]/70 hover:border-emerald-500/40 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-800 text-[10.5px] uppercase tracking-wider font-semibold">
            <span>Live on Storefront</span>
            <span>✨</span>
          </div>
          <div className="text-2xl sm:text-3xl font-serif text-emerald-900 mt-1 font-normal">
            {summary.published}
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-0.5">
            Active and customer-visible
          </div>
        </button>

        {/* Card 3: Low Stock */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("low_stock");
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "low_stock"
              ? "bg-amber-50/60 border-amber-500 shadow-xs ring-1 ring-amber-500/30"
              : "bg-white/90 border-[#DFCBB8]/70 hover:border-amber-500/40 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-amber-800 text-[10.5px] uppercase tracking-wider font-semibold">
            <span>Low Stock (≤ 5)</span>
            <span>⚠️</span>
          </div>
          <div className="text-2xl sm:text-3xl font-serif text-amber-900 mt-1 font-normal">
            {summary.lowStock}
          </div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">
            Requires inventory replenishment
          </div>
        </button>

        {/* Card 4: Out of Stock */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("out_of_stock");
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "out_of_stock"
              ? "bg-rose-50/60 border-rose-500 shadow-xs ring-1 ring-rose-500/30"
              : "bg-white/90 border-[#DFCBB8]/70 hover:border-rose-500/40 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-rose-800 text-[10.5px] uppercase tracking-wider font-semibold">
            <span>Out of Stock (0)</span>
            <span>🛑</span>
          </div>
          <div className="text-2xl sm:text-3xl font-serif text-rose-900 mt-1 font-normal">
            {summary.outOfStock}
          </div>
          <div className="text-[11px] text-rose-700/80 mt-0.5">
            Depleted units
          </div>
        </button>
      </div>

      {/* Filter and Search Controls Bar */}
      <div className="bg-white/90 p-4 sm:p-5 rounded-2xl border border-[#DFCBB8]/80 shadow-2xs space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Field */}
          <div className="lg:col-span-2 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, slug, or SKU..."
              className="w-full pl-9 pr-8 py-2 bg-[#FAF8F5] border border-[#DFCBB8] rounded-xl text-xs text-[#2C2117] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors"
              aria-label="Search products"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs p-1"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DFCBB8] rounded-xl text-xs text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors cursor-pointer"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="low_stock">Low Stock (≤ 5)</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DFCBB8] rounded-xl text-xs text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors cursor-pointer"
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name} ({c.productCount})
                </option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DFCBB8] rounded-xl text-xs text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors cursor-pointer"
              aria-label="Sort products by"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="stock-asc">Stock: Low to High</option>
              <option value="stock-desc">Stock: High to Low</option>
              <option value="name-asc">Title: A to Z</option>
              <option value="name-desc">Title: Z to A</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter Row & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#DFCBB8]/40 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-[#8C7560] font-medium uppercase tracking-wider">
              Occasion:
            </span>
            <select
              value={occasionFilter}
              onChange={(e) => {
                setOccasionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 bg-[#FAF8F5] border border-[#DFCBB8] rounded-lg text-xs text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746] cursor-pointer"
              aria-label="Filter by occasion"
            >
              <option value="all">All Occasions</option>
              {occasions.map((o) => (
                <option key={o.id} value={o.slug}>
                  {o.name} ({o.productCount})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-[#B88746] hover:text-[#916731] font-medium underline underline-offset-2 transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            )}

            <div className="flex items-center space-x-1.5 text-xs text-[#7E6955]">
              <span>Rows:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-0.5 bg-[#FAF8F5] border border-[#DFCBB8] rounded-md text-xs cursor-pointer"
                aria-label="Items per page"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Error / Loading / Empty / Data Table */}
      {error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <div className="text-2xl text-rose-600">⚠️</div>
          <h2 className="text-sm font-semibold text-rose-900">Unable to load catalog products</h2>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={() => fetchProducts()}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs uppercase tracking-wider font-medium hover:bg-rose-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : isLoading ? (
        /* Loading Skeleton */
        <div className="bg-white/95 rounded-2xl border border-[#DFCBB8]/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-[#DFCBB8]/40 text-xs text-[#8C7560] animate-pulse">
            Loading catalog data...
          </div>
          <div className="divide-y divide-[#DFCBB8]/40">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 flex items-center space-x-4 animate-pulse">
                <div className="w-12 h-12 bg-stone-200 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-stone-200 rounded w-1/3" />
                  <div className="h-3 bg-stone-100 rounded w-1/4" />
                </div>
                <div className="w-20 h-4 bg-stone-200 rounded" />
                <div className="w-16 h-4 bg-stone-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : products.length === 0 ? (
        /* Empty State */
        <div className="bg-white/95 rounded-2xl border border-[#DFCBB8]/80 p-8 sm:p-12 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF7F2] border border-[#DFCBB8] flex items-center justify-center text-2xl text-[#8C7560]">
            🛍️
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-lg text-[#2C2117]">No products found</h2>
            <p className="text-xs text-[#7E6955] max-w-sm mx-auto">
              {hasActiveFilters
                ? "No catalog items matched your active search or filter criteria. Try adjusting your parameters."
                : "Your Shivura product catalog is currently empty."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 border border-[#DFCBB8] hover:bg-[#FAF7F2] text-[#2C2117] rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
            <Link
              href="/CRM/products/new"
              className="px-4 py-2 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs uppercase tracking-wider font-medium transition-colors"
            >
              + Create New Product
            </Link>
          </div>
        </div>
      ) : (
        /* Product Listing Table */
        <div className="bg-white/95 rounded-2xl border border-[#DFCBB8]/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#DFCBB8]/80 text-[10.5px] uppercase tracking-wider font-semibold text-[#8C7560]">
                  <th scope="col" className="py-3.5 px-4 w-14 text-center">
                    Media
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Product Title & Slug
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    SKU
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Price
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Inventory
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Variants
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Status
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFCBB8]/50">
                {products.map((p) => {
                  const isLowStock = p.stock > 0 && p.stock <= 5;
                  const isOutOfStock = p.stock <= 0;
                  const isMutating = mutatingProductId === p.id;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[#FAF8F5] transition-colors ${
                        !p.active ? "opacity-60 bg-stone-50/50" : ""
                      }`}
                    >
                      {/* Thumbnail Media */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="w-11 h-11 rounded-xl bg-[#FAF7F2] border border-[#DFCBB8]/80 overflow-hidden relative mx-auto shrink-0 flex items-center justify-center">
                          {p.primaryImage?.url ? (
                            <Image
                              src={p.primaryImage.url}
                              alt={p.primaryImage.altText || p.name}
                              fill
                              sizes="44px"
                              className="object-cover"
                              unoptimized={p.primaryImage.url.startsWith("/")}
                            />
                          ) : (
                            <span className="text-stone-400 text-xs" title="No image available">
                              🖼️
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Title & Slug */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 max-w-xs sm:max-w-md">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-[#2C2117] line-clamp-1">
                              {p.name}
                            </span>
                            {p.badge && (
                              <span className="text-[9.5px] uppercase tracking-wider font-semibold px-1.5 py-0.2 rounded bg-[#B88746]/10 text-[#9E6D2B] shrink-0">
                                {p.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#8C7560] font-mono line-clamp-1">
                            /shop/{p.slug}
                          </div>
                          {p.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {p.categories.map((c) => (
                                <span
                                  key={c.id}
                                  className="text-[9.5px] px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded"
                                >
                                  {c.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#4A392A]">
                        {p.sku || <span className="text-stone-400 italic">None</span>}
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#2C2117]">
                          ₹{p.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        {p.originalPrice && (
                          <div className="text-[10.5px] text-stone-400 line-through">
                            ₹{p.originalPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>

                      {/* Inventory Stock */}
                      <td className="py-3.5 px-4">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Out of stock
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            {p.stock} left (Low)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {p.stock} units
                          </span>
                        )}
                      </td>

                      {/* Variants Count */}
                      <td className="py-3.5 px-4 text-[11.5px] text-[#7E6955]">
                        {p.variantsCount > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium text-[11px]">
                            {p.variantsCount} variant{p.variantsCount > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-stone-400">Single</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <button
                            type="button"
                            disabled={isMutating}
                            onClick={() => handleToggleStatus(p, "published")}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase transition-colors cursor-pointer border ${
                              p.published
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200"
                            }`}
                            title={`Click to ${p.published ? "unpublish (set to draft)" : "publish to storefront"}`}
                          >
                            {p.published ? "● Published" : "○ Draft"}
                          </button>

                          {!p.active && (
                            <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              Archived
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1 sm:space-x-1.5">
                          {/* Edit Button */}
                          <Link
                            href={`/CRM/products/${p.id}/edit`}
                            className="p-1.5 rounded-lg border border-[#DFCBB8] bg-white hover:bg-[#FAF7F2] text-[#2C2117] transition-colors text-xs"
                            title="Edit product in editor"
                          >
                            ✏️
                          </Link>

                          {/* View on Boutique */}
                          <Link
                            href={`/shop/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-[#DFCBB8] bg-white hover:bg-[#FAF7F2] text-[#2C2117] transition-colors text-xs"
                            title="View product in storefront boutique (opens in new tab)"
                          >
                            ↗️
                          </Link>

                          {/* Toggle Active / Archive */}
                          <button
                            type="button"
                            disabled={isMutating}
                            onClick={() => handleToggleStatus(p, "active")}
                            className="p-1.5 rounded-lg border border-[#DFCBB8] bg-white hover:bg-[#FAF7F2] text-[#2C2117] transition-colors text-xs cursor-pointer"
                            title={p.active ? "Archive product" : "Restore active status"}
                          >
                            {p.active ? "📦" : "♻️"}
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            disabled={isMutating}
                            onClick={() => {
                              setDeleteOrderConflict(null);
                              setDeleteModalProduct(p);
                            }}
                            className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition-colors text-xs cursor-pointer"
                            title="Delete product"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 bg-[#FAF7F2] border-t border-[#DFCBB8]/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#7E6955]">
            <div>
              Showing{" "}
              <strong className="text-[#2C2117]">
                {(pagination.page - 1) * pagination.limit + 1}
              </strong>{" "}
              to{" "}
              <strong className="text-[#2C2117]">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </strong>{" "}
              of <strong className="text-[#2C2117]">{pagination.total}</strong> products
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                disabled={!pagination.hasPrevPage || isLoading}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded-xl border border-[#DFCBB8] bg-white hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed font-medium text-[#2C2117] transition-colors cursor-pointer"
              >
                ← Previous
              </button>

              <span className="px-3 py-1 bg-white border border-[#DFCBB8] rounded-xl font-mono text-[#2C2117]">
                {pagination.page} / {pagination.totalPages}
              </span>

              <button
                type="button"
                disabled={!pagination.hasNextPage || isLoading}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, pagination.totalPages))}
                className="px-3 py-1.5 rounded-xl border border-[#DFCBB8] bg-white hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed font-medium text-[#2C2117] transition-colors cursor-pointer"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation & Order History Guard Modal */}
      {deleteModalProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white rounded-3xl border border-[#DFCBB8] shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-xl">
              {deleteOrderConflict ? "⛔" : "🗑️"}
            </div>

            <div className="space-y-1">
              <h3 id="delete-dialog-title" className="font-serif text-lg text-[#2C2117]">
                {deleteOrderConflict ? "Cannot Permanently Delete" : "Confirm Product Deletion"}
              </h3>
              <p className="text-xs text-[#7E6955]">
                {deleteOrderConflict
                  ? deleteOrderConflict.message
                  : `Are you sure you want to delete "${deleteModalProduct.name}"? If this item has no customer orders, it will be permanently removed.`}
              </p>
            </div>

            {/* Order Conflict Prompt: Suggest Archiving */}
            {deleteOrderConflict ? (
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-left text-xs text-amber-900 space-y-1 font-sans">
                <p className="font-semibold">Recommended Action: Archive</p>
                <p className="text-amber-800/90 leading-relaxed font-light">
                  Archiving hides this product from the boutique while preserving order accounting and customer history intact.
                </p>
              </div>
            ) : null}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              {deleteOrderConflict ? (
                <>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleArchiveProduct(deleteModalProduct)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs uppercase tracking-wider font-semibold transition-colors cursor-pointer"
                  >
                    {isDeleting ? "Archiving..." : "Archive Product Instead"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteModalProduct(null);
                      setDeleteOrderConflict(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteProduct}
                    className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs uppercase tracking-wider font-semibold transition-colors cursor-pointer"
                  >
                    {isDeleting ? "Deleting..." : "Permanently Delete"}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeleteModalProduct(null)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
