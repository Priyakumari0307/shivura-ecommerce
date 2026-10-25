"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface HeroBannerData {
  imageUrl: string;
  publicId?: string | null;
  altText: string;
  badgeText: string;
  isCustom: boolean;
  updatedAt?: string | null;
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit matching CRM upload policy
const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

const DEFAULT_HERO: HeroBannerData = {
  imageUrl: "/images/background.png",
  publicId: null,
  altText: "Shivura Home Decoration",
  badgeText: "New Collection 2026",
  isCustom: false,
  updatedAt: null,
};

export default function HomepageManagementClient() {
  // Current saved data from database
  const [currentHero, setCurrentHero] = useState<HeroBannerData>(DEFAULT_HERO);

  // Draft editable state
  const [draftHero, setDraftHero] = useState<HeroBannerData>(DEFAULT_HERO);

  // Status & loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageInputMode, setImageInputMode] = useState<"upload" | "url">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState<boolean | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        try {
          URL.revokeObjectURL(filePreviewUrl);
        } catch {
          // ignore
        }
      }
    };
  }, [filePreviewUrl]);

  // Check Cloudinary status
  useEffect(() => {
    async function checkUploadConfig() {
      try {
        const res = await fetch("/api/crm/upload");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setCloudinaryConfigured(Boolean(json.data.configured));
          }
        }
      } catch {
        // Fallback
      }
    }
    checkUploadConfig();
  }, []);

  // Fetch current hero configuration from API
  const fetchHeroConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/crm/homepage");
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please re-authenticate to Shivura CRM.");
        }
        if (res.status === 403) {
          throw new Error("Access denied. Customer accounts cannot manage homepage settings.");
        }
        throw new Error(`Failed to load homepage configuration (HTTP ${res.status})`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setCurrentHero(json.data);
        setDraftHero(json.data);
      } else {
        throw new Error(json.error || "Failed to load hero configuration");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error loading homepage configuration";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      await Promise.resolve();
      if (!ignore) {
        await fetchHeroConfig();
      }
    })();
    return () => {
      ignore = true;
    };
  }, [fetchHeroConfig]);

  // Upload image file to /api/crm/upload
  const uploadImageFile = useCallback(async (file: File) => {
    setIsUploadingImage(true);
    setImageUploadProgress(20);
    setImageUploadError(null);

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(90, Math.round((event.loaded / event.total) * 90));
          setImageUploadProgress(percent);
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
              error: `Server returned invalid response (HTTP ${xhr.status})`,
            });
          }
        };
        xhr.onerror = () => reject(new Error("Network connection error during upload."));
      });

      xhr.open("POST", "/api/crm/upload");
      xhr.send(uploadFormData);

      const result = await responsePromise;

      if (result.success && result.data && result.data.length > 0) {
        const uploadedImg = result.data[0];
        setImageUploadProgress(100);
        setDraftHero((prev) => ({
          ...prev,
          imageUrl: uploadedImg.url,
          publicId: uploadedImg.publicId,
        }));
        setImageUploadError(null);
        setToast({
          text: "Image uploaded to media storage successfully. Click 'Save Changes' to update the storefront.",
          type: "info",
        });
      } else {
        setImageUploadError(result.error || "Failed to upload image to media storage.");
      }
    } catch (err) {
      setImageUploadError(
        err instanceof Error ? err.message : "Network error during image upload."
      );
    } finally {
      setIsUploadingImage(false);
    }
  }, []);

  // Handle file selection from picker or drop
  const handleFileSelect = (file: File) => {
    setImageUploadError(null);

    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.includes(ext);
    const hasValidMime = !file.type || ALLOWED_IMAGE_MIME_TYPES.includes(file.type);

    if (!hasValidExt || !hasValidMime) {
      setImageUploadError(
        "Unsupported image format. Please select a JPEG, PNG, or WebP image."
      );
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setImageUploadError(
        `File size (${sizeMb} MB) exceeds maximum allowed limit of 5 MB.`
      );
      return;
    }

    if (filePreviewUrl) {
      try {
        URL.revokeObjectURL(filePreviewUrl);
      } catch {
        // ignore
      }
    }

    const preview = URL.createObjectURL(file);
    setSelectedFile(file);
    setFilePreviewUrl(preview);
    setImageUploadProgress(0);

    // Auto-trigger direct upload
    uploadImageFile(file);
  };

  // Drag and drop handlers
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
      const file = e.dataTransfer.files[0];
      handleFileSelect(file);
    }
  };

  // Discard draft changes
  const handleDiscardChanges = () => {
    if (filePreviewUrl) {
      try {
        URL.revokeObjectURL(filePreviewUrl);
      } catch {
        // ignore
      }
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setImageUploadProgress(0);
    setImageUploadError(null);
    setDraftHero(currentHero);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setToast({ text: "Draft changes discarded", type: "info" });
  };

  // Save changes to database and revalidate homepage
  const handleSaveChanges = async () => {
    if (isUploadingImage) {
      setToast({
        text: "Please wait for the image upload to complete before saving.",
        type: "error",
      });
      return;
    }

    if (!draftHero.imageUrl.trim()) {
      setImageUploadError("Hero image URL cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/crm/homepage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: draftHero.imageUrl.trim(),
          publicId: draftHero.publicId,
          altText: draftHero.altText.trim() || "Shivura Home Decoration",
          badgeText: draftHero.badgeText.trim() || "New Collection 2026",
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed to save changes (HTTP ${res.status})`);
      }

      setCurrentHero(json.data);
      setDraftHero(json.data);
      setSelectedFile(null);
      setFilePreviewUrl(null);
      setToast({
        text: "Homepage hero banner image updated and published to storefront!",
        type: "success",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error saving hero banner";
      setToast({ text: msg, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default theme hero
  const handleResetToDefault = async () => {
    if (!window.confirm("Are you sure you want to revert the storefront hero to the default brand banner?")) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch("/api/crm/homepage", {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to reset hero banner");
      }

      setCurrentHero(DEFAULT_HERO);
      setDraftHero(DEFAULT_HERO);
      setSelectedFile(null);
      setFilePreviewUrl(null);
      setToast({
        text: "Homepage hero reset to default luxury banner (/images/background.png).",
        type: "success",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reset hero";
      setToast({ text: msg, type: "error" });
    } finally {
      setIsResetting(false);
    }
  };

  // Check if draft has unsaved changes
  const hasUnsavedChanges =
    draftHero.imageUrl !== currentHero.imageUrl ||
    draftHero.altText !== currentHero.altText ||
    draftHero.badgeText !== currentHero.badgeText;

  // Active preview image URL: local file object URL takes precedence, then draft URL, then current, then default
  const activePreviewUrl =
    filePreviewUrl || draftHero.imageUrl || currentHero.imageUrl || "/images/background.png";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
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

      {/* Header & Section Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DFCBB8]/70">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10.5px] font-sans font-semibold uppercase tracking-[0.2em] text-[#8C7560]">
              Storefront Merchandising
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#B88746]" />
            <span className="text-[10.5px] font-sans text-[#7E6955]">
              Executive CRM Management
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#2C2117] font-normal tracking-tight">
            Homepage Management
          </h1>
          <p className="text-xs text-[#7E6955] font-light max-w-2xl leading-relaxed">
            Manage the primary hero banner photography, brand headlines, and promotional tags displayed at the pinnacle of the Shivura boutique storefront.
          </p>
        </div>

        {/* Quick Boutique Storefront Preview Link */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-sans text-[#5C4A3A] hover:text-[#2C2117] bg-white border border-[#DFCBB8] hover:bg-[#FAF7F2] transition-all shadow-2xs group"
          >
            <span>Live Boutique</span>
            <span className="text-[10px] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center space-x-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchHeroConfig}
            className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg font-medium transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Cloudinary & Security Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white/80 rounded-2xl border border-[#DFCBB8]/80 text-xs text-[#7E6955]">
        <div className="flex items-center space-x-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C7560]">
            Storage Engine:
          </span>
          {cloudinaryConfigured === true ? (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cloudinary CDN Active</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-300 text-[11px]">
              <span>Direct / Local Storage Mode</span>
            </span>
          )}
          <span className="hidden sm:inline text-stone-300">•</span>
          <span className="hidden sm:inline text-[11px]">Max: 5 MB (JPEG, PNG, WebP)</span>
        </div>

        <div className="flex items-center space-x-2 text-[11px]">
          {isLoading && (
            <span className="w-2.5 h-2.5 border-2 border-[#B88746]/40 border-t-[#B88746] rounded-full animate-spin" />
          )}
          <span>Current Banner:</span>
          <span className="font-medium text-[#2C2117]">
            {currentHero.isCustom ? "Custom Uploaded Hero" : "Default Theme Asset"}
          </span>
          {currentHero.updatedAt && (
            <span className="text-stone-400 font-mono text-[10px]">
              ({new Date(currentHero.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})
            </span>
          )}
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Upload & Banner Configuration (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card: Upload / Change Image */}
          <div className="bg-white/95 rounded-2xl border border-[#DFCBB8]/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-sans uppercase tracking-[0.2em] font-semibold text-[#8C7560]">
                  Hero Banner Photography
                </span>
                <h2 className="font-serif text-lg text-[#2C2117] font-normal mt-0.5">
                  Upload or Change Banner
                </h2>
              </div>

              {/* Mode Toggle Tabs: Computer Upload vs Custom URL */}
              <div className="flex items-center space-x-1 p-1 bg-[#FAF7F2] rounded-xl border border-[#DFCBB8]/70 text-xs">
                <button
                  type="button"
                  onClick={() => setImageInputMode("upload")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    imageInputMode === "upload"
                      ? "bg-[#2C2117] text-[#FAF5EB] shadow-2xs"
                      : "text-[#7E6955] hover:text-[#2C2117]"
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setImageInputMode("url")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    imageInputMode === "url"
                      ? "bg-[#2C2117] text-[#FAF5EB] shadow-2xs"
                      : "text-[#7E6955] hover:text-[#2C2117]"
                  }`}
                >
                  Image URL
                </button>
              </div>
            </div>

            {/* Error Message */}
            {imageUploadError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <div className="font-semibold flex items-center space-x-1.5">
                  <span>⚠️</span>
                  <span>Upload Warning</span>
                </div>
                <p>{imageUploadError}</p>
              </div>
            )}

            {imageInputMode === "upload" ? (
              /* Drag & Drop Upload Zone */
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  isDraggingOver
                    ? "border-[#B88746] bg-[#B88746]/5 scale-[0.99]"
                    : "border-[#DFCBB8] bg-[#FAF8F5]/60 hover:bg-[#FAF8F5]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-[#DFCBB8] flex items-center justify-center text-xl shadow-2xs">
                    📷
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#2C2117]">
                      Drag and drop high-resolution hero photography here
                    </p>
                    <p className="text-[11px] text-[#7E6955]">
                      Supports JPEG, PNG, and WebP (up to 5 MB). Landscape ratio recommended (e.g. 1920×900).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] text-xs font-semibold uppercase tracking-wider rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-60"
                  >
                    <span>{isUploadingImage ? "Uploading..." : "Browse Computer Files"}</span>
                  </button>

                  {/* Upload Progress Bar */}
                  {isUploadingImage && (
                    <div className="w-full max-w-xs space-y-1 pt-2">
                      <div className="flex items-center justify-between text-[10px] text-[#7E6955]">
                        <span>Uploading to Cloudinary CDN...</span>
                        <span>{imageUploadProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#B88746] transition-all duration-200"
                          style={{ width: `${imageUploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedFile && !isUploadingImage && (
                    <div className="flex items-center space-x-2 px-3 py-1 bg-white border border-[#DFCBB8]/80 rounded-xl text-xs text-[#2C2117] shadow-2xs">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span className="font-medium truncate max-w-[200px]">
                        {selectedFile.name}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* URL Mode Input */
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C7560]">
                    Direct Image URL *
                  </label>
                  <input
                    type="text"
                    value={draftHero.imageUrl}
                    onChange={(e) =>
                      setDraftHero((prev) => ({
                        ...prev,
                        imageUrl: e.target.value.trim(),
                      }))
                    }
                    placeholder="https://res.cloudinary.com/... or /images/background.png"
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#DFCBB8] rounded-xl text-[#2C2117] text-xs font-mono placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                  />
                  <p className="text-[10.5px] text-[#7E6955]">
                    Enter a secure web URL (https://) or an internal public path (/images/...).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Card: Hero Merchandising Metadata (Badge & Alt Text) */}
          <div className="bg-white/95 rounded-2xl border border-[#DFCBB8]/80 p-5 shadow-2xs space-y-4">
            <div>
              <span className="text-[10px] font-sans uppercase tracking-[0.2em] font-semibold text-[#8C7560]">
                Typography & Merchandising
              </span>
              <h2 className="font-serif text-lg text-[#2C2117] font-normal mt-0.5">
                Hero Content & Accessibility
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C7560]">
                  Promotional Tag Badge
                </label>
                <input
                  type="text"
                  value={draftHero.badgeText}
                  onChange={(e) =>
                    setDraftHero((prev) => ({ ...prev, badgeText: e.target.value }))
                  }
                  placeholder="e.g. New Collection 2026"
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#DFCBB8] rounded-xl text-[#2C2117] text-xs placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                />
                <p className="text-[10px] text-[#7E6955]">
                  Small animated pill badge displayed above hero action buttons.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C7560]">
                  Image Alt Description (SEO & Accessibility)
                </label>
                <input
                  type="text"
                  value={draftHero.altText}
                  onChange={(e) =>
                    setDraftHero((prev) => ({ ...prev, altText: e.target.value }))
                  }
                  placeholder="e.g. Shivura Handcrafted Luxury Living"
                  maxLength={200}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#DFCBB8] rounded-xl text-[#2C2117] text-xs placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                />
                <p className="text-[10px] text-[#7E6955]">
                  Accessible alt description for screen readers and SEO indexing.
                </p>
              </div>
            </div>
          </div>

          {/* Action Bar: Save / Discard / Revert to Default */}
          <div className="bg-white/95 rounded-2xl border border-[#DFCBB8]/80 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isResetting || isSaving || !currentHero.isCustom}
                className="px-3.5 py-2 text-xs font-sans text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200/80 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Revert storefront hero back to default /images/background.png"
              >
                {isResetting ? "Reverting..." : "Revert to Default Banner"}
              </button>
            </div>

            <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={!hasUnsavedChanges || isSaving}
                className="px-4 py-2 border border-[#DFCBB8] hover:bg-[#FAF7F2] text-[#2C2117] rounded-xl text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel / Reset
              </button>

              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={!hasUnsavedChanges || isSaving || isUploadingImage}
                className="px-5 py-2 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs uppercase tracking-wider font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isSaving ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <span>Publish to Storefront</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Storefront Simulated Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white/95 rounded-2xl border border-[#DFCBB8]/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-sans uppercase tracking-[0.2em] font-semibold text-[#8C7560]">
                  Real-time Simulation
                </span>
                <h2 className="font-serif text-lg text-[#2C2117] font-normal mt-0.5">
                  Storefront Live Preview
                </h2>
              </div>

              {hasUnsavedChanges && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold uppercase tracking-wider">
                  Unsaved Draft
                </span>
              )}
            </div>

            {/* Simulated Hero Frame replicating HeroPlaceholder.tsx */}
            <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden border border-stone-200/90 shadow-md flex items-center p-6 bg-stone-900">
              {/* Background Photography */}
              <div className="absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activePreviewUrl}
                  alt={draftHero.altText || "Hero Preview"}
                  className="w-full h-full object-cover object-center transition-all duration-300"
                />
                {/* Overlay Tint matching HeroPlaceholder */}
                <div className="absolute inset-0 bg-stone-900/[0.04]" />
              </div>

              {/* Foreground UI Components */}
              <div className="relative z-10 max-w-xs space-y-4">
                {/* Badge */}
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white/95 backdrop-blur-md rounded-full text-[9px] uppercase tracking-[0.2em] text-neutral-800 font-sans font-medium border border-stone-300 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 animate-pulse" />
                  <span className="truncate max-w-[150px]">
                    {draftHero.badgeText || "New Collection 2026"}
                  </span>
                </div>

                {/* Simulated Storefront Action Buttons */}
                <div className="flex items-center space-x-2 pt-2">
                  <div className="px-3.5 py-1.5 bg-[#1C2820] text-[#FAF5EB] text-[10px] font-sans uppercase tracking-wider font-semibold rounded-full shadow-xs">
                    Explore
                  </div>
                  <div className="px-3.5 py-1.5 bg-white/90 backdrop-blur-md text-[#2C2117] border border-stone-300 text-[10px] font-sans uppercase tracking-wider font-medium rounded-full shadow-2xs">
                    Our Story
                  </div>
                </div>
              </div>

              <div className="absolute bottom-2.5 right-2.5 z-10 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[9.5px] font-mono text-white/90">
                Hero Ratio 16:9
              </div>
            </div>

            {/* Image Details Card */}
            <div className="p-3.5 bg-[#FAF8F5] rounded-xl border border-[#DFCBB8]/70 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#8C7560] font-semibold uppercase tracking-wider">
                  Active Image Source:
                </span>
                <span className="font-mono text-[10.5px] text-[#2C2117] truncate max-w-[200px]" title={activePreviewUrl}>
                  {activePreviewUrl.startsWith("http") ? "Cloudinary CDN" : "Local Theme Image"}
                </span>
              </div>

              <div className="text-[10.5px] font-mono text-stone-500 break-all bg-white/80 p-2 rounded-lg border border-[#DFCBB8]/50">
                {activePreviewUrl}
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#7E6955] pt-1">
                <span>Alt: &quot;{draftHero.altText}&quot;</span>
                <span>Badge: &quot;{draftHero.badgeText}&quot;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
