"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface MediaReferenceReport {
  inUse: boolean;
  totalReferences: number;
  products: Array<{
    id: string;
    name: string;
    slug: string;
    sku?: string | null;
  }>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  occasions: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  summaryText: string;
}

interface MediaAsset {
  publicId: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  folder?: string;
  fileName: string;
  inUse: boolean;
  references: MediaReferenceReport;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

interface SummaryStats {
  totalAssets: number;
  inUseAssets: number;
  unusedAssets: number;
  totalBytes: number;
}

interface UploadQueueItem {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  previewUrl: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  uploadedUrl?: string;
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit
const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export default function MediaLibraryClient() {
  // Data states
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 24,
    total: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });
  const [summary, setSummary] = useState<SummaryStats>({
    totalAssets: 0,
    inUseAssets: 0,
    unusedAssets: 0,
    totalBytes: 0,
  });
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "in_use" | "unused">("all");
  const [sortOrder, setSortOrder] = useState<string>("newest");
  const [currentPage, setCurrentPage] = useState(1);

  // Loading & Feedback states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Detail View Modal state
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Deletion Modal state
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Upload Modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadBannerError, setUploadBannerError] = useState<string | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Clean up object URLs on component unmount
  useEffect(() => {
    return () => {
      uploadQueue.forEach((item) => {
        try {
          URL.revokeObjectURL(item.previewUrl);
        } catch {
          // ignore
        }
      });
    };
  }, [uploadQueue]);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch Media Library Assets
  const fetchMediaAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("limit", "24");

    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }
    if (filterMode !== "all") {
      params.set("filter", filterMode);
    }
    if (sortOrder !== "newest") {
      params.set("sort", sortOrder);
    }

    try {
      const res = await fetch(`/api/crm/media?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please sign in to Shivura CRM.");
        }
        if (res.status === 403) {
          throw new Error("Access denied. Customer accounts cannot access the Media Library.");
        }
        throw new Error(`Failed to load media assets (HTTP ${res.status})`);
      }

      const json = await res.json();
      if (json.success) {
        setIsConfigured(json.configured !== false);
        setAssets(json.data || []);
        if (json.pagination) {
          setPagination(json.pagination);
        }
        if (json.summary) {
          setSummary(json.summary);
        }
      } else {
        throw new Error(json.error || "Failed to load media assets");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading media assets");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch, filterMode, sortOrder]);

  useEffect(() => {
    fetchMediaAssets();
  }, [fetchMediaAssets]);

  // Copy Image URL to Clipboard
  const handleCopyUrl = async (url: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setToast({ text: "Image URL copied to clipboard", type: "success" });
      setTimeout(() => setCopiedUrl(null), 3000);
    } catch {
      setToast({ text: "Failed to copy URL to clipboard", type: "error" });
    }
  };

  // Upload a single queue item to POST /api/crm/upload
  const uploadSingleFile = async (item: UploadQueueItem) => {
    setIsUploading(true);
    setUploadQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: "uploading", progress: 15 } : q))
    );

    const formData = new FormData();
    formData.append("file", item.file);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(90, Math.round((event.loaded / event.total) * 90));
          setUploadQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, progress: percent } : q))
          );
        }
      };

      const responsePromise = new Promise<{
        success: boolean;
        data?: Array<{ url: string; publicId: string; originalName: string }>;
        error?: string;
      }>((resolve, reject) => {
        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && json.success) {
              resolve(json);
            } else {
              resolve({
                success: false,
                error: json.error || `Upload failed (HTTP ${xhr.status})`,
              });
            }
          } catch {
            resolve({
              success: false,
              error: `Invalid server response (HTTP ${xhr.status})`,
            });
          }
        };
        xhr.onerror = () => reject(new Error("Network connection error."));
      });

      xhr.open("POST", "/api/crm/upload");
      xhr.send(formData);

      const result = await responsePromise;

      if (result.success && result.data && result.data.length > 0) {
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "success",
                  progress: 100,
                  uploadedUrl: result.data![0].url,
                }
              : q
          )
        );
      } else {
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "error",
                  error: result.error || "Upload failed",
                }
              : q
          )
        );
      }
    } catch (err) {
      setUploadQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: "error",
                error: err instanceof Error ? err.message : "Upload error",
              }
            : q
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Process files selected from file picker or drag-and-drop
  const handleFilesSelected = (filesList: FileList | File[]) => {
    setUploadBannerError(null);
    const files = Array.from(filesList);
    if (files.length === 0) return;

    if (files.length > 10) {
      setUploadBannerError("A maximum of 10 files can be uploaded per batch. Processing first 10 files.");
    }
    const filesToProcess = files.slice(0, 10);

    const newItems: UploadQueueItem[] = filesToProcess.map((file) => {
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.includes(ext);
      const hasValidMime = !file.type || ALLOWED_IMAGE_MIME_TYPES.includes(file.type);
      const isOversized = file.size > MAX_IMAGE_SIZE_BYTES;

      let initialStatus: "pending" | "error" = "pending";
      let errorMsg: string | undefined = undefined;

      if (!hasValidExt || !hasValidMime) {
        initialStatus = "error";
        errorMsg = "Unsupported format. Only JPEG, PNG, and WebP are allowed.";
      } else if (isOversized) {
        initialStatus = "error";
        errorMsg = `File exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
      }

      return {
        id: "upload_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        file,
        fileName: file.name,
        fileSize: file.size,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: initialStatus,
        error: errorMsg,
      };
    });

    setUploadQueue((prev) => [...prev, ...newItems]);

    // Trigger uploads for pending items
    const pendingItems = newItems.filter((i) => i.status === "pending");
    pendingItems.forEach((item) => {
      uploadSingleFile(item);
    });
  };

  // Drag-and-drop handlers for upload modal
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // Close upload modal and refresh library if any uploads succeeded
  const handleCloseUploadModal = () => {
    const hasSuccessfulUploads = uploadQueue.some((i) => i.status === "success");
    // Clean up temporary object URLs
    uploadQueue.forEach((item) => {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        // ignore
      }
    });
    setUploadQueue([]);
    setIsUploadModalOpen(false);
    if (hasSuccessfulUploads) {
      fetchMediaAssets();
    }
  };

  // Handle asset deletion
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    // Safety relationship guard
    if (deleteTarget.inUse) {
      setToast({
        text: `Cannot delete: asset is linked to ${deleteTarget.references.totalReferences} item(s)`,
        type: "error",
      });
      return;
    }

    setIsDeleting(true);

    try {
      const res = await fetch("/api/crm/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: deleteTarget.publicId }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(
            json.error || "Deletion blocked: asset is currently referenced by catalog items."
          );
        }
        throw new Error(json.error || "Failed to delete media asset");
      }

      setToast({
        text: `Asset "${deleteTarget.fileName}" deleted successfully from Cloudinary`,
        type: "success",
      });

      setDeleteTarget(null);
      if (selectedAsset?.publicId === deleteTarget.publicId) {
        setSelectedAsset(null);
      }
      fetchMediaAssets();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : "Error deleting asset",
        type: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() || filterMode !== "all" || sortOrder !== "newest"
  );

  const handleResetFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setFilterMode("all");
    setSortOrder("newest");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-3 text-xs font-sans border backdrop-blur-md ${
              toast.type === "success"
                ? "bg-[#1C2820]/95 text-[#FAF5EB] border-emerald-500/40"
                : toast.type === "error"
                ? "bg-rose-950/95 text-rose-100 border-rose-500/40"
                : "bg-[#2C2117]/95 text-[#FAF5EB] border-[#DFCBB8]/40"
            }`}
          >
            <span className="text-sm">
              {toast.type === "success" ? "✓" : toast.type === "error" ? "⚠️" : "ℹ️"}
            </span>
            <span className="font-medium">{toast.text}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-stone-400 hover:text-white transition-colors cursor-pointer text-sm"
              aria-label="Dismiss toast"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header & Page Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10.5px] font-sans font-semibold uppercase tracking-[0.2em] text-[#8C7560]">
              Digital Asset Management
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#B88746]" />
            <span className="text-[10.5px] font-sans text-[#7E6955]">
              Cloudinary Storage & Relational Safety
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#2C2117] font-normal tracking-tight">
            Media Library
          </h1>
          <p className="text-xs text-[#7E6955] font-light max-w-2xl leading-relaxed">
            Centralized Cloudinary media management. Inspect product photography, verify
            catalog usage dependencies, copy CDN URLs, and upload new brand assets.
          </p>
        </div>

        {/* Primary Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fetchMediaAssets()}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-[#DFCBB8] hover:bg-[#FAF7F2] text-[#2C2117] transition-colors cursor-pointer"
            title="Refresh Media Assets"
            aria-label="Refresh Media Library"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
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

          <button
            type="button"
            onClick={() => {
              setUploadBannerError(null);
              setIsUploadModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs uppercase tracking-wider font-semibold transition-all shadow-xs cursor-pointer"
          >
            <span className="text-base leading-none font-light">+</span>
            <span>Upload Media</span>
          </button>
        </div>
      </div>

      {/* Cloudinary Diagnostic Banner if Unconfigured */}
      {isConfigured === false && (
        <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-2xl text-xs text-amber-900 flex items-start space-x-3">
          <span className="text-base">☁️</span>
          <div>
            <p className="font-semibold text-amber-950">Cloudinary Credentials Unconfigured</p>
            <p className="mt-0.5 text-amber-800 leading-relaxed font-light">
              To activate Cloudinary asset listing, define <span className="font-mono font-medium">CLOUDINARY_CLOUD_NAME</span>, <span className="font-mono font-medium">CLOUDINARY_API_KEY</span>, and <span className="font-mono font-medium">CLOUDINARY_API_SECRET</span> in your server <span className="font-mono">.env</span> file.
            </p>
          </div>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white/95 rounded-2xl p-4 border border-[#DFCBB8]/80 shadow-2xs">
          <div className="text-[10px] font-sans uppercase tracking-[0.16em] font-semibold text-[#8C7560]">
            Cloudinary Assets
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-serif text-2xl text-[#2C2117] font-normal">
              {summary.totalAssets}
            </span>
            <span className="text-[10.5px] font-sans text-[#7E6955]">Images</span>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 border border-[#DFCBB8]/80 shadow-2xs">
          <div className="text-[10px] font-sans uppercase tracking-[0.16em] font-semibold text-[#B88746]">
            Catalog In-Use
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-serif text-2xl text-[#8A5F23] font-normal">
              {summary.inUseAssets}
            </span>
            <span className="text-[10.5px] font-sans text-[#8A5F23]/80">Linked items</span>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 border border-[#DFCBB8]/80 shadow-2xs">
          <div className="text-[10px] font-sans uppercase tracking-[0.16em] font-semibold text-emerald-800">
            Unused Assets
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-serif text-2xl text-emerald-700 font-normal">
              {summary.unusedAssets}
            </span>
            <span className="text-[10.5px] font-sans text-emerald-700/80">Standalone</span>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 border border-[#DFCBB8]/80 shadow-2xs">
          <div className="text-[10px] font-sans uppercase tracking-[0.16em] font-semibold text-stone-600">
            Storage Footprint
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-serif text-2xl text-[#2C2117] font-normal">
              {formatFileSize(summary.totalBytes)}
            </span>
            <span className="text-[10.5px] font-sans text-[#7E6955]">CDN Data</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white/95 rounded-2xl p-4 border border-[#DFCBB8]/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search assets by file name, publicId, or format..."
              className="w-full pl-8 pr-8 py-2 bg-[#FAF7F2] border border-[#DFCBB8]/80 rounded-xl text-xs text-[#2C2117] placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#B88746] transition-all font-sans"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-700 transition-colors cursor-pointer text-xs"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter pills & Sorting */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-sans">
            {/* Filter: All / In-Use / Unused */}
            <div className="flex items-center space-x-1 bg-[#FAF7F2] p-1 rounded-xl border border-[#DFCBB8]/70">
              <button
                type="button"
                onClick={() => {
                  setFilterMode("all");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                  filterMode === "all"
                    ? "bg-[#2C2117] text-[#FAF5EB] font-medium"
                    : "text-[#7E6955] hover:text-[#2C2117]"
                }`}
              >
                All ({summary.totalAssets})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode("in_use");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                  filterMode === "in_use"
                    ? "bg-[#2C2117] text-[#FAF5EB] font-medium"
                    : "text-[#7E6955] hover:text-[#2C2117]"
                }`}
              >
                In Use ({summary.inUseAssets})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode("unused");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                  filterMode === "unused"
                    ? "bg-[#2C2117] text-[#FAF5EB] font-medium"
                    : "text-[#7E6955] hover:text-[#2C2117]"
                }`}
              >
                Unused ({summary.unusedAssets})
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] text-[#8C7560]">Sort:</span>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#FAF7F2] border border-[#DFCBB8]/80 rounded-xl px-2.5 py-1.5 text-xs text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746] cursor-pointer"
              >
                <option value="newest">Newest Uploads</option>
                <option value="oldest">Oldest Uploads</option>
                <option value="name_asc">Name (A → Z)</option>
                <option value="name_desc">Name (Z → A)</option>
                <option value="size_desc">File Size (Largest)</option>
              </select>
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 text-[11px] text-stone-600 hover:text-stone-900 border border-stone-200 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
          <div className="font-semibold flex items-center space-x-2">
            <span>⚠️</span>
            <span>Error Loading Media Library</span>
          </div>
          <p>{error}</p>
        </div>
      )}

      {/* Media Grid Presentation */}
      {isLoading ? (
        /* Loading Skeletons */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-[#DFCBB8]/60 p-2.5 space-y-2.5 animate-pulse"
            >
              <div className="aspect-square bg-stone-200 rounded-xl w-full" />
              <div className="h-3 bg-stone-200 rounded w-2/3" />
              <div className="h-2.5 bg-stone-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : assets.length === 0 ? (
        /* Empty State */
        <div className="bg-white/95 rounded-2xl border border-[#DFCBB8]/80 p-8 sm:p-12 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF7F2] border border-[#DFCBB8] flex items-center justify-center text-2xl text-[#8C7560]">
            🖼️
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-lg text-[#2C2117]">No media assets found</h2>
            <p className="text-xs text-[#7E6955] max-w-sm mx-auto">
              {hasActiveFilters
                ? "No image files match your active search or filter criteria. Try adjusting your parameters."
                : "Your Cloudinary media storage does not have any assets in the 'shivura/' folder yet."}
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
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="px-4 py-2 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs uppercase tracking-wider font-semibold transition-colors cursor-pointer"
            >
              + Upload First Image
            </button>
          </div>
        </div>
      ) : (
        /* Media Grid */
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {assets.map((asset) => {
              const isCopied = copiedUrl === asset.url;

              return (
                <div
                  key={asset.publicId}
                  onClick={() => setSelectedAsset(asset)}
                  className="group bg-white rounded-2xl border border-[#DFCBB8]/80 hover:border-[#B88746] transition-all shadow-2xs hover:shadow-md overflow-hidden cursor-pointer flex flex-col"
                >
                  {/* Thumbnail Container */}
                  <div className="relative aspect-square bg-[#FAF7F2] overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.fileName}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Status Pill Badge (Top-Right) */}
                    <div className="absolute top-2 right-2 z-10">
                      {asset.inUse ? (
                        <span
                          className="px-2 py-0.5 rounded-full text-[9px] font-sans font-semibold tracking-wide bg-amber-900/90 text-amber-100 shadow-2xs backdrop-blur-xs flex items-center space-x-1"
                          title={asset.references.summaryText}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span>In Use ({asset.references.totalReferences})</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-sans font-medium tracking-wide bg-stone-900/80 text-stone-200 shadow-2xs backdrop-blur-xs">
                          Unused
                        </span>
                      )}
                    </div>

                    {/* Format Pill (Bottom-Left) */}
                    <div className="absolute bottom-2 left-2 z-10">
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono uppercase bg-black/60 text-white backdrop-blur-xs">
                        {asset.format} • {asset.width}×{asset.height}
                      </span>
                    </div>

                    {/* Hover Overlay with Quick Actions */}
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
                      <button
                        type="button"
                        onClick={(e) => handleCopyUrl(asset.url, e)}
                        className="p-2 rounded-xl bg-white/90 hover:bg-white text-[#2C2117] transition-all shadow-xs cursor-pointer text-xs"
                        title="Copy CDN URL"
                      >
                        {isCopied ? "✓" : "📋"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAsset(asset);
                        }}
                        className="p-2 rounded-xl bg-white/90 hover:bg-white text-[#2C2117] transition-all shadow-xs cursor-pointer text-xs"
                        title="View Asset Details"
                      >
                        👁️
                      </button>
                      {!asset.inUse && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(asset);
                          }}
                          className="p-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white transition-all shadow-xs cursor-pointer text-xs"
                          title="Delete Unused Asset"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Title & Size */}
                  <div className="p-2.5 space-y-0.5 flex-1 flex flex-col justify-between bg-white">
                    <p
                      className="text-[11px] font-medium text-[#2C2117] truncate font-sans"
                      title={asset.fileName}
                    >
                      {asset.fileName}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-[#7E6955]">
                      <span>{formatFileSize(asset.bytes)}</span>
                      <span>
                        {new Date(asset.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border border-[#DFCBB8]/70 bg-white/95 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-[#7E6955]">
                Showing page <strong className="text-[#2C2117]">{pagination.page}</strong> of{" "}
                <strong className="text-[#2C2117]">{pagination.totalPages}</strong> (
                {pagination.total} total matching assets)
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrevPage}
                  className={`px-3 py-1.5 rounded-xl border border-[#DFCBB8] text-xs font-medium transition-colors ${
                    pagination.hasPrevPage
                      ? "hover:bg-[#FAF7F2] text-[#2C2117] cursor-pointer"
                      : "opacity-40 text-stone-400 cursor-not-allowed"
                  }`}
                >
                  Previous
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
                    (pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          pageNum === pagination.page
                            ? "bg-[#2C2117] text-[#FAF5EB]"
                            : "hover:bg-[#FAF7F2] text-[#5C4A3A]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasNextPage}
                  className={`px-3 py-1.5 rounded-xl border border-[#DFCBB8] text-xs font-medium transition-colors ${
                    pagination.hasNextPage
                      ? "hover:bg-[#FAF7F2] text-[#2C2117] cursor-pointer"
                      : "opacity-40 text-stone-400 cursor-not-allowed"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Asset Details & Relational References Dialog                     */}
      {/* ========================================================================= */}
      {selectedAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl border border-[#DFCBB8]/80 shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150 my-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#DFCBB8]/50 pb-4">
              <div>
                <span className="text-[10px] font-sans uppercase tracking-[0.2em] font-semibold text-[#8C7560]">
                  Asset Intelligence & Dependency Inspector
                </span>
                <h2 className="font-serif text-xl sm:text-2xl text-[#2C2117] font-normal mt-0.5 truncate max-w-md sm:max-w-xl">
                  {selectedAsset.fileName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                className="text-stone-400 hover:text-stone-700 transition-colors text-lg p-1 cursor-pointer"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Image Preview & Metadata Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left Column: High-Res Preview */}
              <div className="space-y-3">
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#FAF7F2] border border-[#DFCBB8] flex items-center justify-center shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedAsset.url}
                    alt={selectedAsset.fileName}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(selectedAsset.url)}
                    className="flex-1 py-2.5 px-4 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors shadow-2xs cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <span>{copiedUrl === selectedAsset.url ? "✓ Copied" : "📋 Copy CDN URL"}</span>
                  </button>

                  <Link
                    href={selectedAsset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 border border-[#DFCBB8] hover:bg-[#FAF7F2] text-[#2C2117] rounded-xl text-xs transition-colors"
                    title="Open original in new tab"
                  >
                    ↗
                  </Link>
                </div>
              </div>

              {/* Right Column: Technical Metadata & Dependency Relationships */}
              <div className="space-y-5 text-xs font-sans">
                {/* Technical Metadata Table */}
                <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#DFCBB8]/70 space-y-2.5">
                  <h3 className="font-semibold text-[#2C2117] uppercase tracking-wider text-[10.5px]">
                    Technical Metadata
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                    <div>
                      <span className="text-[#8C7560] block text-[10px]">Format:</span>
                      <span className="font-mono uppercase font-medium text-[#2C2117]">
                        {selectedAsset.format}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8C7560] block text-[10px]">Dimensions:</span>
                      <span className="font-mono font-medium text-[#2C2117]">
                        {selectedAsset.width} × {selectedAsset.height} px
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8C7560] block text-[10px]">File Size:</span>
                      <span className="font-mono font-medium text-[#2C2117]">
                        {formatFileSize(selectedAsset.bytes)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8C7560] block text-[10px]">Uploaded:</span>
                      <span className="font-medium text-[#2C2117]">
                        {new Date(selectedAsset.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#DFCBB8]/50">
                    <span className="text-[#8C7560] block text-[10px]">Public ID:</span>
                    <span className="font-mono text-[10.5px] text-[#2C2117] break-all select-all">
                      {selectedAsset.publicId}
                    </span>
                  </div>
                </div>

                {/* Relational Dependency Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[#2C2117] uppercase tracking-wider text-[10.5px]">
                      Catalog References ({selectedAsset.references.totalReferences})
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        selectedAsset.inUse
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      }`}
                    >
                      {selectedAsset.inUse ? "Active Dependency" : "Safe to Delete"}
                    </span>
                  </div>

                  {selectedAsset.inUse ? (
                    <div className="space-y-2">
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                        <div className="font-semibold flex items-center space-x-1.5 text-amber-950">
                          <span>🛡️</span>
                          <span>Relational Safety Guard Active</span>
                        </div>
                        <p className="font-light">
                          This asset is currently in use. To protect catalog integrity, deletion is
                          blocked until references are replaced or removed.
                        </p>
                      </div>

                      {/* Referencing Products */}
                      {selectedAsset.references.products.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8C7560]">
                            Referencing Products ({selectedAsset.references.products.length}):
                          </span>
                          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                            {selectedAsset.references.products.map((p) => (
                              <Link
                                key={p.id}
                                href={`/CRM/products/${p.id}/edit`}
                                className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 border border-[#DFCBB8]/70 flex items-center justify-between transition-colors group"
                              >
                                <span className="font-medium text-[#2C2117] truncate group-hover:text-[#B88746]">
                                  {p.name}
                                </span>
                                {p.sku && (
                                  <span className="font-mono text-[9.5px] text-stone-500">
                                    {p.sku}
                                  </span>
                                )}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Referencing Categories */}
                      {selectedAsset.references.categories.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8C7560]">
                            Referencing Categories ({selectedAsset.references.categories.length}):
                          </span>
                          <div className="space-y-1">
                            {selectedAsset.references.categories.map((c) => (
                              <Link
                                key={c.id}
                                href="/CRM/categories"
                                className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 border border-[#DFCBB8]/70 flex items-center justify-between transition-colors group"
                              >
                                <span className="font-medium text-[#2C2117] truncate group-hover:text-[#B88746]">
                                  {c.name}
                                </span>
                                <span className="font-mono text-[9.5px] text-stone-500">
                                  /{c.slug}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Referencing Occasions */}
                      {selectedAsset.references.occasions.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8C7560]">
                            Referencing Occasions ({selectedAsset.references.occasions.length}):
                          </span>
                          <div className="space-y-1">
                            {selectedAsset.references.occasions.map((o) => (
                              <Link
                                key={o.id}
                                href="/CRM/occasions"
                                className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 border border-[#DFCBB8]/70 flex items-center justify-between transition-colors group"
                              >
                                <span className="font-medium text-[#2C2117] truncate group-hover:text-[#B88746]">
                                  {o.name}
                                </span>
                                <span className="font-mono text-[9.5px] text-stone-500">
                                  /{o.slug}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-[11.5px] text-emerald-900 space-y-2">
                      <div className="font-medium flex items-center space-x-1.5">
                        <span>✓</span>
                        <span>Zero Catalog Dependencies</span>
                      </div>
                      <p className="font-light leading-relaxed">
                        This image is not linked to any product covers, gallery photos, category
                        banners, or festive occasions. It is safe to delete from Cloudinary storage.
                      </p>
                    </div>
                  )}
                </div>

                {/* Asset Actions (Delete) */}
                <div className="pt-2 border-t border-[#DFCBB8]/50 flex items-center justify-end">
                  {selectedAsset.inUse ? (
                    <button
                      type="button"
                      disabled
                      className="px-4 py-2 bg-stone-100 text-stone-400 rounded-xl text-xs uppercase tracking-wider font-semibold cursor-not-allowed border border-stone-200"
                      title="Cannot delete asset: in active use by catalog records"
                    >
                      Deletion Blocked (In Use)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(selectedAsset)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs uppercase tracking-wider font-semibold transition-colors shadow-2xs cursor-pointer flex items-center space-x-1.5"
                    >
                      <span>🗑️</span>
                      <span>Delete from Cloudinary</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Batch Upload Media Dialog                                        */}
      {/* ========================================================================= */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl border border-[#DFCBB8]/80 shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="flex items-start justify-between border-b border-[#DFCBB8]/50 pb-3">
              <div>
                <span className="text-[10px] font-sans uppercase tracking-[0.2em] font-semibold text-[#8C7560]">
                  Media Ingestion
                </span>
                <h2 className="font-serif text-xl sm:text-2xl text-[#2C2117] font-normal mt-0.5">
                  Upload Media to Cloudinary
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseUploadModal}
                disabled={isUploading}
                className="text-stone-400 hover:text-stone-700 transition-colors text-lg p-1 cursor-pointer"
                aria-label="Close upload dialog"
              >
                ✕
              </button>
            </div>

            {uploadBannerError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
                <span>{uploadBannerError}</span>
                <button
                  type="button"
                  onClick={() => setUploadBannerError(null)}
                  className="text-rose-600 hover:text-rose-900 font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Native Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesSelected(e.target.files);
                  e.target.value = "";
                }
              }}
              className="hidden"
            />

            {/* Drag & Drop Area */}
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition-all flex flex-col items-center justify-center space-y-2.5 ${
                isDraggingOver
                  ? "border-[#B88746] bg-[#FAF5EB] scale-[1.01]"
                  : "border-[#DFCBB8] hover:border-[#B88746]/70 bg-[#FAF8F5]/80 hover:bg-[#FAF8F5]"
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-white border border-[#DFCBB8] flex items-center justify-center text-xl text-[#B88746] shadow-2xs">
                📸
              </div>

              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-semibold text-[#2C2117]">
                  Drag & drop images here, or choose from computer
                </p>
                <p className="text-[11px] text-[#8C7560]">
                  Supports JPEG, PNG, and WebP (up to 5 MB per file, max 10 files per batch)
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="mt-1 px-4 py-2 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors shadow-2xs cursor-pointer"
              >
                Choose Image Files
              </button>
            </div>

            {/* Upload Queue Progress */}
            {uploadQueue.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-[#2C2117]">
                  <span>Uploading Batch ({uploadQueue.length})</span>
                  <span>
                    {uploadQueue.filter((q) => q.status === "success").length} of {uploadQueue.length} done
                  </span>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {uploadQueue.map((item) => (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center space-x-3 bg-white ${
                        item.status === "error"
                          ? "border-rose-300 bg-rose-50/40"
                          : item.status === "success"
                          ? "border-emerald-300 bg-emerald-50/40"
                          : "border-[#DFCBB8]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.previewUrl}
                          alt={item.fileName}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-[#2C2117] truncate" title={item.fileName}>
                            {item.fileName}
                          </p>
                          <span className="text-[10px] font-mono text-stone-500">
                            {(item.fileSize / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>

                        {item.status === "uploading" && (
                          <div className="w-full h-1 bg-stone-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#B88746] transition-all duration-200 rounded-full"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        )}

                        {item.status === "error" && (
                          <p className="text-[10.5px] text-rose-600 font-medium">
                            {item.error || "Upload failed"}
                          </p>
                        )}

                        {item.status === "success" && (
                          <p className="text-[10.5px] text-emerald-700 font-medium">
                            ✓ Uploaded successfully
                          </p>
                        )}
                      </div>

                      {item.status === "error" && (
                        <button
                          type="button"
                          onClick={() => uploadSingleFile(item)}
                          disabled={isUploading}
                          className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-[#2C2117] rounded-lg text-[10px] font-semibold cursor-pointer"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-[#DFCBB8]/60 flex items-center justify-end">
              <button
                type="button"
                onClick={handleCloseUploadModal}
                disabled={isUploading}
                className="px-5 py-2.5 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs uppercase tracking-wider font-semibold transition-colors shadow-2xs cursor-pointer"
              >
                {isUploading ? "Uploading..." : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Safe Asset Deletion Confirmation Dialog                          */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl border border-[#DFCBB8]/80 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {deleteTarget.inUse ? (
              /* Blocked State */
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl text-amber-700">
                  🛡️
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-amber-700">
                    Deletion Blocked • Relational Guard
                  </span>
                  <h2 className="font-serif text-xl sm:text-2xl text-[#2C2117] font-normal">
                    Cannot Delete Asset
                  </h2>
                  <p className="text-xs text-[#7E6955] leading-relaxed">
                    This media asset is currently in active use across{" "}
                    <strong className="text-[#2C2117]">
                      {deleteTarget.references.totalReferences} catalog items
                    </strong>
                    . Deleting it from Cloudinary would cause broken images in your storefront boutique.
                  </p>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-[#DFCBB8]/60">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="px-4 py-2.5 border border-[#DFCBB8] hover:bg-[#FAF7F2] text-[#2C2117] rounded-xl text-xs uppercase tracking-wider font-medium transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              /* Confirm Deletion of Unused Asset */
              <>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-xl text-rose-600">
                  🗑️
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-rose-600">
                    Permanent Deletion Confirmation
                  </span>
                  <h2 className="font-serif text-xl sm:text-2xl text-[#2C2117] font-normal">
                    Delete Asset from Cloudinary?
                  </h2>
                  <p className="text-xs text-[#7E6955] leading-relaxed">
                    This asset is confirmed <strong className="text-emerald-700">unused</strong> by
                    any catalog products or categories. It will be permanently removed from Cloudinary
                    storage (`{deleteTarget.publicId}`). This action cannot be undone.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-[#DFCBB8]/60">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={isDeleting}
                    className="px-4 py-2.5 border border-[#DFCBB8] hover:bg-[#FAF7F2] text-[#2C2117] rounded-xl text-xs uppercase tracking-wider font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs uppercase tracking-wider font-semibold transition-colors shadow-2xs cursor-pointer flex items-center space-x-1.5"
                  >
                    {isDeleting && <span className="animate-spin text-xs">⏳</span>}
                    <span>Confirm Delete</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
