"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useRef,
} from "react";
import Link from "next/link";
import { slugify, SLUG_REGEX } from "@/lib/validation/taxonomy";

type ActiveTab = "categories" | "occasions";

interface TaxonomyRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  productCount: number;
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
  total: number;
  active: number;
  inactive: number;
  totalProductsLinked: number;
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit matching CRM upload policy
const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

interface CategoriesManagementClientProps {
  type?: ActiveTab;
}

export default function CategoriesManagementClient({
  type = "categories",
}: CategoriesManagementClientProps = {}) {
  // Navigation tab state initialized to the provided type
  const [activeTab, setActiveTab] = useState<ActiveTab>(type);

  // Sync activeTab when type prop changes
  useEffect(() => {
    setActiveTab(type);
    setCurrentPage(1);
    setSearchTerm("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setSortOrder("sortorder-asc");
  }, [type]);

  // Data states
  const [records, setRecords] = useState<TaxonomyRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });
  const [summary, setSummary] = useState<SummaryStats>({
    total: 0,
    active: 0,
    inactive: 0,
    totalProductsLinked: 0,
  });

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortOrder, setSortOrder] = useState("sortorder-asc");
  const [currentPage, setCurrentPage] = useState(1);

  // UI status states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Action / Mutation states
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Create & Edit Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TaxonomyRecord | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    image: "",
    sortOrder: 0,
    active: true,
  });
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Direct Image Upload & URL Toggle States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageInputMode, setImageInputMode] = useState<"upload" | "url">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState<boolean | null>(null);

  // Delete flow states
  const [deleteTarget, setDeleteTarget] = useState<TaxonomyRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Clean up object URLs on component unmount
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

  // Fetch Cloudinary upload configuration status on mount
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
        // Fallback gracefully
      }
    }
    checkUploadConfig();
  }, []);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset pagination on tab change
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchTerm("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setSortOrder("sortorder-asc");
  };

  // Fetch records
  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const endpoint =
      activeTab === "categories" ? "/api/crm/categories" : "/api/crm/occasions";
    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("limit", "10");

    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }
    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    if (sortOrder !== "sortorder-asc") {
      params.set("sort", sortOrder);
    }

    try {
      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please re-authenticate to Shivura CRM.");
        }
        if (res.status === 403) {
          throw new Error("Access denied. Customer accounts cannot manage catalog taxonomy.");
        }
        throw new Error(`Failed to load ${activeTab} (HTTP ${res.status})`);
      }

      const json = await res.json();
      if (json.success) {
        setRecords(json.data || []);
        if (json.pagination) {
          setPagination(json.pagination);
        }
        if (json.summary) {
          setSummary(json.summary);
        }
      } else {
        throw new Error(json.error || `Failed to load ${activeTab}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error loading taxonomy data";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, currentPage, debouncedSearch, statusFilter, sortOrder]);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      await Promise.resolve();
      if (!ignore) {
        await fetchRecords();
      }
    })();
    return () => {
      ignore = true;
    };
  }, [fetchRecords]);

  // Direct Computer Image Upload Executor
  const uploadImageFile = useCallback(async (file: File) => {
    setIsUploadingImage(true);
    setImageUploadProgress(15);
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
        code?: string;
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
                code: json.code,
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
        setFormData((prev) => ({ ...prev, image: uploadedImg.url }));
        setImageUploadError(null);
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

  // Validate and handle file chosen from native picker or drag-and-drop
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
        `File size (${sizeMb} MB) exceeds the maximum allowed limit of 5 MB.`
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

  // Drag-and-drop handlers
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

  // Remove selected/uploaded image
  const handleRemoveImage = () => {
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
    setFormData((prev) => ({ ...prev, image: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Retry upload for current file
  const handleRetryUpload = () => {
    if (selectedFile) {
      uploadImageFile(selectedFile);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    handleRemoveImage();
    setEditingRecord(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      image: "",
      sortOrder: summary.total + 1,
      active: true,
    });
    setImageInputMode("upload");
    setIsSlugManuallyEdited(false);
    setFormValidationError(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: TaxonomyRecord) => {
    handleRemoveImage();
    setEditingRecord(item);
    setFormData({
      name: item.name,
      slug: item.slug,
      description: item.description || "",
      image: item.image || "",
      sortOrder: item.sortOrder,
      active: item.active,
    });
    // Set appropriate image mode based on existing data
    if (item.image) {
      if (item.image.includes("cloudinary.com")) {
        setImageInputMode("upload");
      } else {
        setImageInputMode("url");
      }
    } else {
      setImageInputMode("upload");
    }
    setIsSlugManuallyEdited(true);
    setFormValidationError(null);
    setIsFormModalOpen(true);
  };

  // Auto slug generator on name change
  const handleNameChange = (newName: string) => {
    setFormData((prev) => ({
      ...prev,
      name: newName,
      slug: isSlugManuallyEdited ? prev.slug : slugify(newName),
    }));
  };

  // Slug change
  const handleSlugChange = (newSlug: string) => {
    setIsSlugManuallyEdited(true);
    setFormData((prev) => ({
      ...prev,
      slug: newSlug.toLowerCase().trim(),
    }));
  };

  // Form submit handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError(null);

    // Prevent saving if an image upload is actively in progress
    if (isUploadingImage) {
      setFormValidationError(
        "Please wait for the image upload to finish before saving."
      );
      return;
    }

    // Client-side validations
    if (!formData.name.trim()) {
      setFormValidationError("Name cannot be empty");
      return;
    }

    const finalSlug = slugify(formData.slug.trim() || formData.name);
    if (!finalSlug || !SLUG_REGEX.test(finalSlug)) {
      setFormValidationError(
        "Slug must consist of lowercase letters, numbers, and single hyphens (e.g., 'artisan-crafts')"
      );
      return;
    }

    if (
      formData.image.trim() &&
      !formData.image.startsWith("/") &&
      !formData.image.startsWith("http://") &&
      !formData.image.startsWith("https://")
    ) {
      setFormValidationError(
        "Image URL must be a root path (/images/...) or a web URL (http:// or https://)"
      );
      return;
    }

    setIsSubmitting(true);
    const endpoint =
      activeTab === "categories" ? "/api/crm/categories" : "/api/crm/occasions";
    const isEdit = Boolean(editingRecord);
    const targetUrl = isEdit ? `${endpoint}/${editingRecord!.id}` : endpoint;
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(targetUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          slug: finalSlug,
          description: formData.description.trim() || null,
          image: formData.image.trim() || null,
          sortOrder: Number(formData.sortOrder) || 0,
          active: formData.active,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setFormValidationError(
            json.error || `A ${activeTab.slice(0, -1)} with this slug already exists. Please choose a different slug.`
          );
          return;
        }
        throw new Error(json.error || `Failed to save ${activeTab.slice(0, -1)}`);
      }

      setToast({
        text: `${activeTab === "categories" ? "Category" : "Occasion"} "${formData.name}" ${
          isEdit ? "updated" : "created"
        } successfully`,
        type: "success",
      });

      setIsFormModalOpen(false);
      handleRemoveImage();
      fetchRecords();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setFormValidationError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active/inactive status
  const handleToggleStatus = async (item: TaxonomyRecord) => {
    setMutatingId(item.id);
    const endpoint =
      activeTab === "categories" ? "/api/crm/categories" : "/api/crm/occasions";

    try {
      const res = await fetch(`${endpoint}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to toggle status");
      }

      startTransition(() => {
        setRecords((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, active: !r.active } : r))
        );
        setSummary((prev) => ({
          ...prev,
          active: item.active ? prev.active - 1 : prev.active + 1,
          inactive: item.active ? prev.inactive + 1 : prev.inactive - 1,
        }));
      });

      setToast({
        text: `"${item.name}" marked as ${!item.active ? "Active" : "Inactive"}`,
        type: "success",
      });
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : "Failed to update status",
        type: "error",
      });
    } finally {
      setMutatingId(null);
    }
  };

  // Execute deletion (only when productCount === 0)
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.productCount > 0) {
      setToast({
        text: `Cannot delete "${deleteTarget.name}": has ${deleteTarget.productCount} associated products`,
        type: "error",
      });
      return;
    }

    setIsDeleting(true);
    const endpoint =
      activeTab === "categories" ? "/api/crm/categories" : "/api/crm/occasions";

    try {
      const res = await fetch(`${endpoint}/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(
            json.error || "Deletion blocked: active product relationships exist."
          );
        }
        throw new Error(json.error || "Failed to delete record");
      }

      setToast({
        text: `${activeTab === "categories" ? "Category" : "Occasion"} "${deleteTarget.name}" deleted successfully`,
        type: "success",
      });

      setDeleteTarget(null);
      fetchRecords();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : "Error executing deletion",
        type: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Safe Alternative: Deactivate item when deletion is blocked
  const handleSafeDeactivateFromModal = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    const endpoint =
      activeTab === "categories" ? "/api/crm/categories" : "/api/crm/occasions";

    try {
      const res = await fetch(`${endpoint}/${deleteTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to deactivate record");
      }

      setToast({
        text: `"${deleteTarget.name}" safely deactivated (hidden from storefront while preserving product links)`,
        type: "success",
      });

      setDeleteTarget(null);
      fetchRecords();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : "Error deactivating record",
        type: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() || statusFilter !== "all" || sortOrder !== "sortorder-asc"
  );

  const handleResetFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setSortOrder("sortorder-asc");
    setCurrentPage(1);
  };

  const activeTabSingular = activeTab === "categories" ? "Category" : "Occasion";

  // Compute active preview URL
  const currentPreview = filePreviewUrl || (formData.image.trim() ? formData.image.trim() : null);

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

      {/* Header & Section Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10.5px] font-sans font-semibold uppercase tracking-[0.2em] text-[#8C7560]">
              {activeTab === "categories"
                ? "Catalog Taxonomy & Hierarchy"
                : "Festive Collections & Gifting"}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#B88746]" />
            <span className="text-[10.5px] font-sans text-[#7E6955]">
              Executive CRM Management
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#2C2117] font-normal tracking-tight">
            {activeTab === "categories" ? "Categories" : "Occasions"}
          </h1>
          <p className="text-xs text-[#7E6955] font-light max-w-2xl leading-relaxed">
            {activeTab === "categories"
              ? "Organize Shivura catalog taxonomy, maintain navigational collections, and protect product relationship integrity during lifecycle updates."
              : "Manage seasonal and celebratory occasions, curate gift-ready moments, and organize festive catalogs across the boutique."}
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs uppercase tracking-wider font-semibold transition-all duration-150 shadow-xs cursor-pointer"
          >
            <span className="text-base leading-none font-light">+</span>
            <span>Add {activeTabSingular}</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher & Metric Summary Cards */}
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-[#DFCBB8]/70">
          <div className="flex space-x-2">
            <Link
              href="/CRM/categories"
              className={`pb-3 px-3 text-xs font-sans tracking-wide transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
                activeTab === "categories"
                  ? "border-[#2C2117] text-[#2C2117] font-semibold"
                  : "border-transparent text-[#7E6955] hover:text-[#2C2117] font-normal"
              }`}
            >
              <span className="font-serif text-sm">Product Categories</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  activeTab === "categories"
                    ? "bg-[#2C2117] text-[#FAF5EB]"
                    : "bg-stone-200 text-stone-600"
                }`}
              >
                {activeTab === "categories" ? summary.total : "•"}
              </span>
            </Link>

            <Link
              href="/CRM/occasions"
              className={`pb-3 px-3 text-xs font-sans tracking-wide transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
                activeTab === "occasions"
                  ? "border-[#2C2117] text-[#2C2117] font-semibold"
                  : "border-transparent text-[#7E6955] hover:text-[#2C2117] font-normal"
              }`}
            >
              <span className="font-serif text-sm">Festive Occasions</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  activeTab === "occasions"
                    ? "bg-[#2C2117] text-[#FAF5EB]"
                    : "bg-stone-200 text-stone-600"
                }`}
              >
                {activeTab === "occasions" ? summary.total : "•"}
              </span>
            </Link>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-[11px] text-[#8C7560]">
            {cloudinaryConfigured === true && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span>☁️</span>
                <span>Cloudinary Connected</span>
              </span>
            )}
            <span>Relational Safety Guard:</span>
            <span className="text-emerald-700 font-medium">Active (Protected)</span>
          </div>
        </div>

        {/* 4 Analytics Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white/95 rounded-2xl p-4 border border-[#DFCBB8]/80 shadow-2xs">
            <div className="text-[10px] font-sans uppercase tracking-[0.16em] font-semibold text-[#8C7560]">
              Total {activeTab === "categories" ? "Categories" : "Occasions"}
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-serif text-2xl text-[#2C2117] font-normal">
                {summary.total}
              </span>
              <span className="text-[10.5px] font-sans text-[#7E6955]">Collections</span>
            </div>
          </div>

          <div className="bg-white/95 rounded-2xl p-4 border border-[#DFCBB8]/80 shadow-2xs">
            <div className="text-[10px] font-sans uppercase tracking-[0.16em] font-semibold text-emerald-800">
              Storefront Active
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-serif text-2xl text-emerald-700 font-normal">
                {summary.active}
              </span>
              <span className="text-[10.5px] font-sans text-emerald-700/80">Visible</span>
            </div>
          </div>

          <div className="bg-white/95 rounded-2xl p-4 border border-[#DFCBB8]/80 shadow-2xs">
            <div className="text-[10px] font-sans uppercase tracking-[0.16em] font-semibold text-amber-800">
              Catalog Inactive
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-serif text-2xl text-amber-700 font-normal">
                {summary.inactive}
              </span>
              <span className="text-[10.5px] font-sans text-amber-700/80">Hidden</span>
            </div>
          </div>

          <div className="bg-white/95 rounded-2xl p-4 border border-[#DFCBB8]/80 shadow-2xs">
            <div className="text-[10px] font-sans uppercase tracking-[0.16em] font-semibold text-[#B88746]">
              Products Associated
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-serif text-2xl text-[#8A5F23] font-normal">
                {summary.totalProductsLinked}
              </span>
              <span className="text-[10.5px] font-sans text-[#8A5F23]/80">Linked items</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter, Search & Sort Control Bar */}
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
              placeholder={`Search ${activeTab} by name, slug, or keywords...`}
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

          {/* Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-sans">
            {/* Status Filter */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] text-[#8C7560]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "all" | "active" | "inactive");
                  setCurrentPage(1);
                }}
                className="bg-[#FAF7F2] border border-[#DFCBB8]/80 rounded-xl px-2.5 py-1.5 text-xs text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746] cursor-pointer"
              >
                <option value="all">All ({summary.total})</option>
                <option value="active">Active Only ({summary.active})</option>
                <option value="inactive">Inactive Only ({summary.inactive})</option>
              </select>
            </div>

            {/* Sort Order */}
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
                <option value="sortorder-asc">Sort Order (Lowest First)</option>
                <option value="sortorder-desc">Sort Order (Highest First)</option>
                <option value="name-asc">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
                <option value="products-desc">Most Products Linked</option>
                <option value="newest">Recently Created</option>
                <option value="oldest">Oldest Created</option>
              </select>
            </div>

            {/* Reset Filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 text-[11px] text-stone-600 hover:text-stone-900 border border-stone-200 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
          <div className="font-semibold flex items-center space-x-2">
            <span>⚠️</span>
            <span>Catalog Loading Error</span>
          </div>
          <p>{error}</p>
        </div>
      )}

      {/* Table Records Presentation */}
      {isLoading ? (
        /* Loading Skeleton */
        <div className="bg-white/95 rounded-2xl border border-[#DFCBB8]/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-[#DFCBB8]/40 text-xs text-[#8C7560] animate-pulse">
            Loading {activeTab}...
          </div>
          <div className="divide-y divide-[#DFCBB8]/40">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 flex items-center space-x-4 animate-pulse">
                <div className="w-10 h-10 bg-stone-200 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-stone-200 rounded w-1/4" />
                  <div className="h-3 bg-stone-100 rounded w-1/3" />
                </div>
                <div className="w-20 h-4 bg-stone-200 rounded" />
                <div className="w-16 h-4 bg-stone-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : records.length === 0 ? (
        /* Empty State */
        <div className="bg-white/95 rounded-2xl border border-[#DFCBB8]/80 p-8 sm:p-12 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF7F2] border border-[#DFCBB8] flex items-center justify-center text-2xl text-[#8C7560]">
            🏷️
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-lg text-[#2C2117]">
              No {activeTab} found
            </h2>
            <p className="text-xs text-[#7E6955] max-w-sm mx-auto">
              {hasActiveFilters
                ? `No ${activeTab} matched your active search or filter criteria. Try adjusting your search query.`
                : `Your Shivura catalog does not have any ${activeTab} configured yet.`}
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
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs uppercase tracking-wider font-semibold transition-colors cursor-pointer"
            >
              + Create New {activeTabSingular}
            </button>
          </div>
        </div>
      ) : (
        /* Records Table */
        <div className="bg-white/95 rounded-2xl border border-[#DFCBB8]/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#DFCBB8]/80 text-[10.5px] uppercase tracking-wider font-semibold text-[#8C7560]">
                  <th scope="col" className="py-3.5 px-4 w-12 text-center">
                    Media
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    {activeTabSingular} Title & Slug
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Description
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-center">
                    Order
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-center">
                    Products
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-center">
                    Status
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Created
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFCBB8]/50">
                {records.map((item) => {
                  const isMutating = mutatingId === item.id;
                  const formattedDate = new Date(item.createdAt).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }
                  );

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#FAF8F5] transition-colors ${
                        !item.active ? "opacity-65 bg-stone-50/50" : ""
                      }`}
                    >
                      {/* Media Thumbnail */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#DFCBB8]/80 overflow-hidden relative mx-auto shrink-0 flex items-center justify-center">
                          {item.image ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={item.image}
                              alt={item.name}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <span className="text-base text-stone-400">
                              {activeTab === "categories" ? "📂" : "✨"}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Title & Slug */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-serif text-sm font-medium text-[#2C2117]">
                            {item.name}
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono text-[10.5px] text-[#7E6955] bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                              /{item.slug}
                            </span>
                            <Link
                              href={`/shop/${item.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-stone-400 hover:text-[#B88746] transition-colors"
                              title="Preview storefront collection"
                            >
                              ↗
                            </Link>
                          </div>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="text-[11.5px] text-[#5C4A3A] truncate font-light">
                          {item.description || (
                            <span className="text-stone-400 italic">No description</span>
                          )}
                        </div>
                      </td>

                      {/* Sort Order */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-[11px] font-medium text-stone-600 bg-stone-100/90 px-2 py-0.5 rounded-lg border border-stone-200/80">
                          #{item.sortOrder}
                        </span>
                      </td>

                      {/* Product Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-sans font-medium ${
                            item.productCount > 0
                              ? "bg-amber-50 text-amber-900 border border-amber-200/80"
                              : "bg-stone-100 text-stone-500 border border-stone-200"
                          }`}
                          title={`${item.productCount} associated product(s)`}
                        >
                          <span>{item.productCount}</span>
                          <span className="text-[9.5px]">products</span>
                        </span>
                      </td>

                      {/* Status & Quick Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item)}
                          disabled={isMutating}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] uppercase font-semibold tracking-wider transition-colors cursor-pointer ${
                            item.active
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-stone-200/80 text-stone-600 border border-stone-300 hover:bg-stone-300/80"
                          }`}
                          title={`Click to mark as ${item.active ? "Inactive" : "Active"}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.active ? "bg-emerald-500" : "bg-stone-400"
                            }`}
                          />
                          <span>{item.active ? "Active" : "Inactive"}</span>
                        </button>
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-[11px] text-[#7E6955] whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1.5">
                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-lg text-[#5C4A3A] hover:text-[#2C2117] hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
                            title={`Edit ${item.name}`}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                          </button>

                          {/* Delete button (triggers relationship check flow) */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                            title={`Delete ${item.name}`}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
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
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-[#DFCBB8]/70 bg-[#FAF7F2]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-[#7E6955]">
                Showing page <strong className="text-[#2C2117]">{pagination.page}</strong> of{" "}
                <strong className="text-[#2C2117]">{pagination.totalPages}</strong> (
                {pagination.total} total {activeTab})
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrevPage}
                  className={`px-3 py-1.5 rounded-xl border border-[#DFCBB8] text-xs font-medium transition-colors ${
                    pagination.hasPrevPage
                      ? "hover:bg-white text-[#2C2117] cursor-pointer"
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
                            : "hover:bg-white text-[#5C4A3A]"
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
                      ? "hover:bg-white text-[#2C2117] cursor-pointer"
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
      {/* MODAL 1: Create or Edit Category / Occasion Modal                          */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl border border-[#DFCBB8]/80 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-sans uppercase tracking-[0.2em] font-semibold text-[#8C7560]">
                  {editingRecord ? "Edit Record" : "Add New Record"}
                </span>
                <h2 className="font-serif text-xl sm:text-2xl text-[#2C2117] font-normal mt-0.5">
                  {editingRecord
                    ? `Edit ${activeTabSingular}: ${editingRecord.name}`
                    : `Create New ${activeTabSingular}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleRemoveImage();
                  setIsFormModalOpen(false);
                }}
                className="text-stone-400 hover:text-stone-700 transition-colors text-lg p-1 cursor-pointer"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {formValidationError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <div className="font-semibold flex items-center space-x-1.5">
                  <span>⚠️</span>
                  <span>Validation Warning</span>
                </div>
                <p>{formValidationError}</p>
              </div>
            )}

            {/* Form Fields */}
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-sans">
              {/* Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C7560]">
                  {activeTabSingular} Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Royal Brass Diyas"
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#DFCBB8] rounded-xl text-[#2C2117] placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                />
              </div>

              {/* Slug */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C7560]">
                    URL Slug *
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">
                    /shop/{formData.slug || "..."}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="e.g. royal-brass-diyas"
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#DFCBB8] rounded-xl text-[#2C2117] font-mono text-[11px] placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                />
                <p className="text-[10.5px] text-[#7E6955]">
                  Lowercase letters, digits, and hyphens only. Unique across all{" "}
                  {activeTab}.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C7560]">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe this collection for merchandising and catalog categorization..."
                  className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#DFCBB8] rounded-xl text-[#2C2117] placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                />
              </div>

              {/* ============================================================= */}
              {/* COVER IMAGE: Direct Computer Upload OR Image URL Option       */}
              {/* ============================================================= */}
              <div className="space-y-2 pt-1 border-t border-[#DFCBB8]/50">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C7560]">
                    Cover Photography
                  </label>
                  <span className="text-[10.5px] text-stone-400">
                    Optional banner media
                  </span>
                </div>

                {/* Mode Selector Tabs: Upload vs URL */}
                <div className="flex items-center space-x-1.5 p-1 bg-[#FAF7F2] rounded-xl border border-[#DFCBB8]/70">
                  <button
                    type="button"
                    onClick={() => {
                      setImageInputMode("upload");
                      setImageUploadError(null);
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                      imageInputMode === "upload"
                        ? "bg-[#2C2117] text-[#FAF5EB] shadow-2xs font-semibold"
                        : "text-[#7E6955] hover:text-[#2C2117] hover:bg-white/60"
                    }`}
                  >
                    <span>💻</span>
                    <span>Upload from Computer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageInputMode("url");
                      setImageUploadError(null);
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                      imageInputMode === "url"
                        ? "bg-[#2C2117] text-[#FAF5EB] shadow-2xs font-semibold"
                        : "text-[#7E6955] hover:text-[#2C2117] hover:bg-white/60"
                    }`}
                  >
                    <span>🔗</span>
                    <span>Use Image URL</span>
                  </button>
                </div>

                {/* Hidden File Input for Native File Picker */}
                <input
                  ref={fileInputRef}
                  id="category-image-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelect(e.target.files[0]);
                      e.target.value = "";
                    }
                  }}
                  className="hidden"
                />

                {/* Upload Error Banner */}
                {imageUploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11.5px] text-rose-800 flex items-start justify-between space-x-2">
                    <div className="space-y-0.5">
                      <div className="font-semibold flex items-center space-x-1">
                        <span>⚠️</span>
                        <span>Upload Issue:</span>
                      </div>
                      <p>{imageUploadError}</p>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0 pt-0.5">
                      {selectedFile && (
                        <button
                          type="button"
                          onClick={handleRetryUpload}
                          className="px-2 py-0.5 rounded bg-rose-700 text-white hover:bg-rose-800 text-[10px] font-medium transition-colors cursor-pointer"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setImageUploadError(null)}
                        className="text-stone-400 hover:text-stone-700 p-0.5 text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Image Preview Card (if file chosen or URL entered) */}
                {currentPreview ? (
                  <div className="p-3 bg-[#FAF8F5] border border-[#DFCBB8] rounded-2xl space-y-2.5">
                    <div className="flex items-start space-x-3">
                      {/* Image Thumbnail */}
                      <div className="w-16 h-16 rounded-xl bg-stone-100 border border-stone-200 overflow-hidden relative shrink-0 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentPreview}
                          alt="Cover preview"
                          className="w-full h-full object-cover"
                        />
                        {isUploadingImage && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white text-xs animate-spin">⏳</span>
                          </div>
                        )}
                      </div>

                      {/* File Details & Status */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-[#2C2117] truncate">
                            {selectedFile ? selectedFile.name : formData.image || "Cover Photo"}
                          </p>
                          {selectedFile && (
                            <span className="text-[10px] font-mono text-stone-500">
                              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          )}
                        </div>

                        {/* Status badges */}
                        {isUploadingImage ? (
                          <div className="space-y-1 pt-0.5">
                            <div className="flex items-center justify-between text-[10px] text-[#8C7560]">
                              <span>Uploading to secure media storage...</span>
                              <span className="font-mono">{imageUploadProgress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#B88746] transition-all duration-200 rounded-full"
                                style={{ width: `${imageUploadProgress}%` }}
                              />
                            </div>
                          </div>
                        ) : formData.image.includes("cloudinary.com") ? (
                          <div className="flex items-center space-x-1.5 text-[10.5px] text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Uploaded to Cloudinary CDN</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 text-[10.5px] text-[#7E6955]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#B88746]" />
                            <span className="truncate">Image Source Set</span>
                          </div>
                        )}

                        {/* Replace / Remove Controls */}
                        <div className="flex items-center space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (imageInputMode === "upload") {
                                fileInputRef.current?.click();
                              } else {
                                handleRemoveImage();
                              }
                            }}
                            disabled={isUploadingImage}
                            className="text-[10.5px] font-semibold text-[#8C7560] hover:text-[#2C2117] transition-colors cursor-pointer"
                          >
                            {imageInputMode === "upload" ? "Replace File" : "Change URL"}
                          </button>
                          <span className="text-stone-300">•</span>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            disabled={isUploadingImage}
                            className="text-[10.5px] font-semibold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : imageInputMode === "upload" ? (
                  /* Drag & Drop Area for Computer Upload */
                  <div
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`rounded-2xl border-2 border-dashed p-5 text-center transition-all flex flex-col items-center justify-center space-y-2 ${
                      isDraggingOver
                        ? "border-[#B88746] bg-[#FAF5EB] scale-[1.01]"
                        : "border-[#DFCBB8] hover:border-[#B88746]/70 bg-[#FAF8F5]/80 hover:bg-[#FAF8F5]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-white border border-[#DFCBB8] flex items-center justify-center text-lg text-[#B88746] shadow-2xs">
                      📸
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-[#2C2117]">
                        Drag & drop image here, or choose from computer
                      </p>
                      <p className="text-[10.5px] text-[#8C7560]">
                        JPEG, PNG, or WebP (up to 5 MB per file)
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="mt-1 px-4 py-2 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors shadow-2xs cursor-pointer flex items-center space-x-1.5"
                    >
                      <span>Choose File</span>
                    </button>
                  </div>
                ) : (
                  /* Manual URL Input */
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={formData.image}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, image: e.target.value }))
                      }
                      placeholder="e.g. /images/lighting.png or https://..."
                      className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#DFCBB8] rounded-xl text-[#2C2117] placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                    />
                    <p className="text-[10.5px] text-[#7E6955]">
                      Supply a root-relative path (/images/...) or absolute HTTPS web URL.
                    </p>
                  </div>
                )}
              </div>

              {/* Sort Order and Active Status */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C7560]">
                    Sort Order Priority
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        sortOrder: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFCBB8] rounded-xl text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C7560]">
                    Publication Status
                  </label>
                  <label className="flex items-center space-x-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, active: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-[#2C2117] focus:ring-[#B88746] accent-[#2C2117]"
                    />
                    <span className="text-xs text-[#2C2117]">
                      {formData.active ? "Active (Storefront Visible)" : "Inactive (Hidden)"}
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 flex items-center justify-end space-x-2.5 border-t border-[#DFCBB8]/70">
                <button
                  type="button"
                  onClick={() => {
                    handleRemoveImage();
                    setIsFormModalOpen(false);
                  }}
                  disabled={isSubmitting || isUploadingImage}
                  className="px-4 py-2.5 border border-[#DFCBB8] hover:bg-[#FAF7F2] text-[#2C2117] rounded-xl text-xs uppercase tracking-wider font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploadingImage}
                  className="px-5 py-2.5 bg-[#2C2117] hover:bg-[#1C2820] disabled:bg-stone-300 disabled:cursor-not-allowed text-[#FAF5EB] rounded-xl text-xs uppercase tracking-wider font-semibold transition-all shadow-xs cursor-pointer flex items-center space-x-2"
                >
                  {(isSubmitting || isUploadingImage) && (
                    <span className="animate-spin text-sm">⏳</span>
                  )}
                  <span>
                    {isSubmitting
                      ? "Saving..."
                      : isUploadingImage
                      ? "Uploading image..."
                      : editingRecord
                      ? "Update Record"
                      : `Create ${activeTabSingular}`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Safe Deletion Flow Dialog                                        */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl border border-[#DFCBB8]/80 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Branch A: DELETION BLOCKED (product relationships exist) */}
            {deleteTarget.productCount > 0 ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl text-amber-700">
                  🛡️
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-amber-700">
                    Deletion Blocked • Relational Integrity Guard
                  </span>
                  <h2 className="font-serif text-xl sm:text-2xl text-[#2C2117] font-normal">
                    Cannot Delete &ldquo;{deleteTarget.name}&rdquo;
                  </h2>
                  <p className="text-xs text-[#7E6955] leading-relaxed">
                    This {activeTabSingular.toLowerCase()} is currently associated with{" "}
                    <strong className="text-[#2C2117] font-semibold">
                      {deleteTarget.productCount} product(s)
                    </strong>{" "}
                    in your catalog. Permanently deleting it would remove product
                    classification and cause orphaned catalog links.
                  </p>
                </div>

                <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[11.5px] text-amber-900 leading-relaxed space-y-1">
                  <div className="font-semibold text-amber-950">
                    Recommended Safe Alternative:
                  </div>
                  <p>
                    Instead of deleting, deactivating this {activeTabSingular.toLowerCase()}{" "}
                    safely hides it from customer navigation and storefront filters without
                    altering any existing product data or SKU associations.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-[#DFCBB8]/70">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={isDeleting}
                    className="w-full sm:w-auto px-4 py-2.5 border border-[#DFCBB8] hover:bg-[#FAF7F2] text-[#2C2117] rounded-xl text-xs uppercase tracking-wider font-medium transition-colors cursor-pointer"
                  >
                    Keep as Is
                  </button>
                  <button
                    type="button"
                    onClick={handleSafeDeactivateFromModal}
                    disabled={isDeleting}
                    className="w-full sm:w-auto px-4 py-2.5 bg-amber-800 hover:bg-amber-900 text-amber-50 rounded-xl text-xs uppercase tracking-wider font-semibold transition-colors shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    {isDeleting && <span className="animate-spin text-xs">⏳</span>}
                    <span>Deactivate {activeTabSingular} Instead</span>
                  </button>
                </div>
              </>
            ) : (
              /* Branch B: SAFE TO DELETE (productCount === 0) */
              <>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-xl text-rose-600">
                  🗑️
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-rose-600">
                    Permanent Deletion Confirmation
                  </span>
                  <h2 className="font-serif text-xl sm:text-2xl text-[#2C2117] font-normal">
                    Delete &ldquo;{deleteTarget.name}&rdquo;?
                  </h2>
                  <p className="text-xs text-[#7E6955] leading-relaxed">
                    This {activeTabSingular.toLowerCase()} has{" "}
                    <strong className="text-emerald-700">0 associated products</strong>.
                    Deleting it will permanently remove the record (`/{deleteTarget.slug}`)
                    from the database. This action cannot be undone.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-[#DFCBB8]/70">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={isDeleting}
                    className="w-full sm:w-auto px-4 py-2.5 border border-[#DFCBB8] hover:bg-[#FAF7F2] text-[#2C2117] rounded-xl text-xs uppercase tracking-wider font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs uppercase tracking-wider font-semibold transition-colors shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    {isDeleting && <span className="animate-spin text-xs">⏳</span>}
                    <span>Permanently Delete</span>
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
