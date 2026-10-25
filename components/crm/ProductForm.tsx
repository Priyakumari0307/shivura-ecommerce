"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { slugify, generateSku } from "@/lib/validation/product";

interface ProductImage {
  id?: string;
  url: string;
  publicId?: string | null;
  altText?: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

interface UploadItem {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  previewUrl: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  uploadedUrl?: string;
  publicId?: string;
}

interface ProductVariant {
  id?: string;
  name: string;
  size?: string | null;
  color?: string | null;
  design?: string | null;
  sku?: string | null;
  price?: number | null;
  stock: number;
  active: boolean;
}

interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

interface ProductDetailResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  price: number;
  originalPrice: number | null;
  pricePrefix: string | null;
  sku: string | null;
  stock: number;
  isNew: boolean;
  badge: string | null;
  active: boolean;
  published: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
  categoryIds: string[];
  occasionIds: string[];
  ordersCount: number;
  hasOrders: boolean;
}

interface ProductFormProps {
  mode: "create" | "edit";
  productId?: string;
}

export default function ProductForm({ mode, productId }: ProductFormProps) {
  const router = useRouter();

  // Loading & submission states
  const [isPageLoading, setIsPageLoading] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Dirty tracking for edit mode (to prevent unintentional array overwrites)
  const [isImagesDirty, setIsImagesDirty] = useState(false);
  const [isVariantsDirty, setIsVariantsDirty] = useState(false);
  const [isCategoriesDirty, setIsCategoriesDirty] = useState(false);
  const [isOccasionsDirty, setIsOccasionsDirty] = useState(false);

  // Taxonomy states
  const [taxonomyCategories, setTaxonomyCategories] = useState<TaxonomyItem[]>([]);
  const [taxonomyOccasions, setTaxonomyOccasions] = useState<TaxonomyItem[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);

  // Form Fields: Basic Information
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState<string>("");
  const [originalPrice, setOriginalPrice] = useState<string>("");
  const [pricePrefix, setPricePrefix] = useState("");
  const [stock, setStock] = useState<string>("0");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [badge, setBadge] = useState("");
  const [isNew, setIsNew] = useState(false);

  // Form Fields: Publishing & Status
  const [published, setPublished] = useState(true); // Default to live/published on creation, aligned with createProductSchema
  const [active, setActive] = useState(true);

  // Form Fields: Media & Images
  const [images, setImages] = useState<ProductImage[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageAlt, setNewImageAlt] = useState("");
  const [newImageIsPrimary, setNewImageIsPrimary] = useState(false);
  const [imageErrorIndices, setImageErrorIndices] = useState<Record<number, boolean>>({});

  // Direct Image Upload & Cloudinary States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState<boolean | null>(null);
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState<string | null>(null);
  const [uploadBannerError, setUploadBannerError] = useState<string | null>(null);

  // Form Fields: Variants
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantSize, setNewVariantSize] = useState("");
  const [newVariantColor, setNewVariantColor] = useState("");
  const [newVariantDesign, setNewVariantDesign] = useState("");
  const [newVariantSku, setNewVariantSku] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState("");
  const [newVariantStock, setNewVariantStock] = useState("0");

  // Form Fields: Taxonomy Selections
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedOccasionIds, setSelectedOccasionIds] = useState<string[]>([]);

  // Step 3 Unified Inventory: Rollup calculations for active variants
  const hasVariants = variants.length > 0;
  const activeVariants = variants.filter((v) => v.active !== false);
  const computedVariantStock = activeVariants.reduce(
    (sum, v) => sum + (Number(v.stock) || 0),
    0
  );

  // Show auto-dismissing toast feedback
  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Clean up any remaining object URLs on component unmount
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

  // Fetch taxonomy metadata and Cloudinary media configuration
  const fetchTaxonomy = useCallback(async () => {
    setTaxonomyLoading(true);
    setTaxonomyError(null);
    try {
      const res = await fetch("/api/crm/taxonomy");
      if (!res.ok) throw new Error("Failed to load taxonomy metadata");
      const json = await res.json();
      if (json.success && json.data) {
        setTaxonomyCategories(json.data.categories || []);
        setTaxonomyOccasions(json.data.occasions || []);
        if (json.data.mediaConfig) {
          setCloudinaryConfigured(Boolean(json.data.mediaConfig.cloudinaryConfigured));
          setCloudinaryCloudName(json.data.mediaConfig.cloudName || null);
        }
      }
    } catch (err) {
      setTaxonomyError(err instanceof Error ? err.message : "Error loading categories and occasions");
    } finally {
      setTaxonomyLoading(false);
    }
  }, []);

  // Fetch product in edit mode
  const fetchProductDetail = useCallback(async (id: string) => {
    setIsPageLoading(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/crm/products/${id}`);
      if (res.status === 404) {
        setFormError("Product not found. The item may have been deleted.");
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to load product details (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        const p: ProductDetailResponse = json.data;
        setName(p.name);
        setSlug(p.slug);
        setIsSlugManuallyEdited(true); // Preserve loaded slug
        setSku(p.sku || "");
        setPrice(p.price.toString());
        setOriginalPrice(p.originalPrice !== null ? p.originalPrice.toString() : "");
        setPricePrefix(p.pricePrefix || "");
        setStock(p.stock.toString());
        setShortDescription(p.shortDescription || "");
        setDescription(p.description || "");
        setBadge(p.badge || "");
        setIsNew(p.isNew);
        setPublished(p.published);
        setActive(p.active);

        setImages(
          p.images.map((img, idx) => ({
            id: img.id,
            url: img.url,
            publicId: img.publicId,
            altText: img.altText,
            sortOrder: img.sortOrder ?? idx,
            isPrimary: img.isPrimary,
          }))
        );

        setVariants(
          p.variants.map((v) => ({
            id: v.id,
            name: v.name,
            size: v.size,
            color: v.color,
            design: v.design,
            sku: v.sku,
            price: v.price,
            stock: v.stock,
            active: v.active,
          }))
        );

        setSelectedCategoryIds(p.categoryIds || []);
        setSelectedOccasionIds(p.occasionIds || []);
      } else {
        throw new Error(json.error || "Failed to load product details");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to load product details");
    } finally {
      setIsPageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTaxonomy();
    if (mode === "edit" && productId) {
      fetchProductDetail(productId);
    }
  }, [mode, productId, fetchTaxonomy, fetchProductDetail]);

  // Handle product name changes & automatic slug suggestions
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugManuallyEdited) {
      const generated = slugify(val);
      setSlug(generated);
      if (!sku || sku.startsWith("SHIVURA-")) {
        setSku(generateSku(generated));
      }
    }
  };

  // Image actions
  const handleAddImage = () => {
    const trimmedUrl = newImageUrl.trim();
    if (!trimmedUrl) {
      setFieldErrors((prev) => ({ ...prev, image: "Image URL cannot be empty" }));
      return;
    }

    const isValidFormat =
      trimmedUrl.startsWith("/") ||
      trimmedUrl.startsWith("http://") ||
      trimmedUrl.startsWith("https://");

    if (!isValidFormat) {
      setFieldErrors((prev) => ({
        ...prev,
        image: "URL must be a root path (/images/...) or absolute web URL (http/https)",
      }));
      return;
    }

    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy.image;
      return copy;
    });

    const shouldBePrimary = newImageIsPrimary || images.length === 0;

    const updatedImages = images.map((img) =>
      shouldBePrimary ? { ...img, isPrimary: false } : img
    );

    const newImg: ProductImage = {
      url: trimmedUrl,
      altText: newImageAlt.trim() || name || "Product image",
      sortOrder: updatedImages.length,
      isPrimary: shouldBePrimary,
    };

    setImages([...updatedImages, newImg]);
    setIsImagesDirty(true);
    setNewImageUrl("");
    setNewImageAlt("");
    setNewImageIsPrimary(false);
  };

  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    // If we removed the primary image and other images exist, assign first as primary
    if (images[index].isPrimary && updated.length > 0) {
      updated[0].isPrimary = true;
    }
    // Re-index sortOrder
    const reordered = updated.map((img, i) => ({ ...img, sortOrder: i }));
    setImages(reordered);
    setIsImagesDirty(true);
  };

  const handleSetPrimaryImage = (index: number) => {
    const updated = images.map((img, i) => ({
      ...img,
      isPrimary: i === index,
    }));
    setImages(updated);
    setIsImagesDirty(true);
  };

  const handleMoveImage = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const copy = [...images];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const reordered = copy.map((img, i) => ({ ...img, sortOrder: i }));
    setImages(reordered);
    setIsImagesDirty(true);
  };

  const handleUpdateImageAlt = (index: number, newAlt: string) => {
    setImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, altText: newAlt } : img))
    );
    setIsImagesDirty(true);
  };

  const uploadItemFile = async (item: UploadItem) => {
    setIsUploading(true);
    setUploadQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: "uploading", progress: 10 } : q))
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
        errors?: Array<{ fileName: string; error: string }>;
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
                errors: json.errors,
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
      xhr.send(formData);

      const result = await responsePromise;

      if (result.success && result.data && result.data.length > 0) {
        const uploadedData = result.data[0];

        // Mark upload item as complete
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  progress: 100,
                  status: "success",
                  uploadedUrl: uploadedData.url,
                  publicId: uploadedData.publicId,
                }
              : q
          )
        );

        // Add to images gallery
        setImages((prevImages) => {
          const shouldBePrimary = prevImages.length === 0;
          const cleanTitle = item.fileName
            .replace(/\.[^/.]+$/, "")
            .replace(/[-_]/g, " ")
            .trim();
          const newImg: ProductImage = {
            url: uploadedData.url,
            publicId: uploadedData.publicId,
            altText: cleanTitle || name || "Product image",
            sortOrder: prevImages.length,
            isPrimary: shouldBePrimary,
          };
          return [...prevImages, newImg];
        });

        setIsImagesDirty(true);

        // Auto remove successful item from queue after 2 seconds
        setTimeout(() => {
          URL.revokeObjectURL(item.previewUrl);
          setUploadQueue((prev) => prev.filter((q) => q.id !== item.id));
        }, 2000);
      } else {
        const fileErr = result.errors?.[0]?.error || result.error || "Upload failed.";
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "error",
                  error: fileErr,
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
                error: err instanceof Error ? err.message : "Network error during upload.",
              }
            : q
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleFilesSelected = (selectedFiles: FileList | File[]) => {
    setUploadBannerError(null);
    const files = Array.from(selectedFiles);
    if (files.length === 0) return;

    if (cloudinaryConfigured === false) {
      setUploadBannerError(
        "Cloudinary direct upload is unconfigured on the server. Please define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file, or use manual image URLs."
      );
      return;
    }

    if (files.length > 10) {
      setUploadBannerError("A maximum of 10 images can be uploaded per batch. Processing first 10 files.");
    }
    const filesToProcess = files.slice(0, 10);

    const allowedMime = ["image/jpeg", "image/png", "image/webp"];
    const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
    const maxBytes = 5 * 1024 * 1024; // 5 MB

    const newItems: UploadItem[] = filesToProcess.map((file) => {
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      const hasValidExt = allowedExts.includes(ext);
      const hasValidMime = !file.type || allowedMime.includes(file.type);
      const isOversized = file.size > maxBytes;

      let initialStatus: "pending" | "error" = "pending";
      let errorMsg: string | undefined = undefined;

      if (!hasValidExt || !hasValidMime) {
        initialStatus = "error";
        errorMsg = "Unsupported format. Only JPEG, PNG, and WebP images are allowed.";
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

    // Automatically trigger upload for pending items
    const validPending = newItems.filter((i) => i.status === "pending");
    if (validPending.length > 0) {
      validPending.forEach((item) => {
        uploadItemFile(item);
      });
    }
  };

  const handleRetryUpload = (id: string) => {
    const item = uploadQueue.find((q) => q.id === id);
    if (item) {
      uploadItemFile(item);
    }
  };

  const handleDismissUpload = (id: string) => {
    const item = uploadQueue.find((q) => q.id === id);
    if (item) {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        // ignore
      }
    }
    setUploadQueue((prev) => prev.filter((q) => q.id !== id));
  };

  // Drag and Drop Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cloudinaryConfigured) setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cloudinaryConfigured) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (cloudinaryConfigured && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // Variant actions
  const handleAddVariant = () => {
    const trimmedName = newVariantName.trim();
    if (!trimmedName) {
      setFieldErrors((prev) => ({ ...prev, variantName: "Variant name is required" }));
      return;
    }

    const parsedStock = parseInt(newVariantStock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      setFieldErrors((prev) => ({ ...prev, variantStock: "Variant stock must be 0 or greater" }));
      return;
    }

    let parsedPrice: number | null = null;
    if (newVariantPrice.trim()) {
      const p = parseFloat(newVariantPrice);
      if (isNaN(p) || p < 0) {
        setFieldErrors((prev) => ({ ...prev, variantPrice: "Variant price cannot be negative" }));
        return;
      }
      parsedPrice = p;
    }

    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy.variantName;
      delete copy.variantStock;
      delete copy.variantPrice;
      return copy;
    });

    const newVar: ProductVariant = {
      name: trimmedName,
      size: newVariantSize.trim() || null,
      color: newVariantColor.trim() || null,
      design: newVariantDesign.trim() || null,
      sku: newVariantSku.trim() || null,
      price: parsedPrice,
      stock: parsedStock,
      active: true,
    };

    setVariants([...variants, newVar]);
    setIsVariantsDirty(true);
    setNewVariantName("");
    setNewVariantSize("");
    setNewVariantColor("");
    setNewVariantDesign("");
    setNewVariantSku("");
    setNewVariantPrice("");
    setNewVariantStock("0");
  };

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
    setIsVariantsDirty(true);
  };

  // Taxonomy actions
  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
    setIsCategoriesDirty(true);
  };

  const handleToggleOccasion = (occId: string) => {
    setSelectedOccasionIds((prev) =>
      prev.includes(occId) ? prev.filter((id) => id !== occId) : [...prev, occId]
    );
    setIsOccasionsDirty(true);
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Client-side quick validations
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Product title is required.";

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      errors.price = "Price must be greater than 0.";
    }

    let parsedOriginalPrice: number | null = null;
    if (originalPrice.trim()) {
      const op = parseFloat(originalPrice);
      if (isNaN(op) || op < 0) {
        errors.originalPrice = "Original price cannot be negative.";
      } else {
        parsedOriginalPrice = op;
      }
    }

    const parsedStock = hasVariants ? computedVariantStock : parseInt(stock, 10);
    if (!hasVariants && (isNaN(parsedStock) || parsedStock < 0)) {
      errors.stock = "Base inventory stock cannot be negative.";
    }

    if (slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())) {
      errors.slug = "Slug must contain only lowercase letters, numbers, and hyphens (e.g. 'brass-diya').";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Please fix the validation errors below.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "create") {
        // Construct create payload
        const payload = {
          name: name.trim(),
          slug: slug.trim() || slugify(name),
          sku: sku.trim() || undefined,
          price: parsedPrice,
          originalPrice: parsedOriginalPrice,
          pricePrefix: pricePrefix.trim() || undefined,
          stock: parsedStock,
          shortDescription: shortDescription.trim() || undefined,
          description: description.trim() || undefined,
          badge: badge.trim() || undefined,
          isNew,
          published,
          active,
          images: images.map((img, i) => ({
            url: img.url,
            publicId: img.publicId || undefined,
            altText: img.altText || name,
            sortOrder: i,
            isPrimary: img.isPrimary,
          })),
          variants: variants.map((v) => ({
            name: v.name,
            size: v.size || undefined,
            color: v.color || undefined,
            design: v.design || undefined,
            sku: v.sku || undefined,
            price: v.price ?? undefined,
            stock: v.stock,
            active: v.active,
          })),
          categoryIds: selectedCategoryIds,
          occasionIds: selectedOccasionIds,
        };

        const res = await fetch("/api/crm/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();

        if (res.status === 409) {
          setFormError(json.error || "Conflict: Duplicate slug or SKU detected.");
          if (json.conflict === "slug") setFieldErrors((p) => ({ ...p, slug: json.error }));
          if (json.conflict === "sku") setFieldErrors((p) => ({ ...p, sku: json.error }));
          return;
        }

        if (!res.ok || !json.success) {
          setFormError(json.error || "Failed to create product.");
          return;
        }

        showToast(`Product "${name}" created successfully!`, "success");
        setTimeout(() => {
          router.push("/CRM/products");
        }, 1000);
      } else {
        // Mode === "edit"
        // Respect documented array behavior: only send arrays if user modified them!
        const payload: Record<string, unknown> = {
          id: productId,
          name: name.trim(),
          slug: slug.trim() || slugify(name),
          sku: sku.trim() || null,
          price: parsedPrice,
          originalPrice: parsedOriginalPrice,
          pricePrefix: pricePrefix.trim() || null,
          stock: parsedStock,
          shortDescription: shortDescription.trim() || null,
          description: description.trim() || null,
          badge: badge.trim() || null,
          isNew,
          published,
          active,
        };

        if (isImagesDirty) {
          payload.images = images.map((img, i) => ({
            url: img.url,
            publicId: img.publicId || null,
            altText: img.altText || name,
            sortOrder: i,
            isPrimary: img.isPrimary,
          }));
        }

        if (isVariantsDirty) {
          payload.variants = variants.map((v) => ({
            name: v.name,
            size: v.size || null,
            color: v.color || null,
            design: v.design || null,
            sku: v.sku || null,
            price: v.price ?? null,
            stock: v.stock,
            active: v.active,
          }));
        }

        if (isCategoriesDirty) {
          payload.categoryIds = selectedCategoryIds;
        }

        if (isOccasionsDirty) {
          payload.occasionIds = selectedOccasionIds;
        }

        const res = await fetch(`/api/crm/products/${productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();

        if (res.status === 409) {
          setFormError(json.error || "Conflict: Duplicate slug or SKU detected.");
          if (json.conflict === "slug") setFieldErrors((p) => ({ ...p, slug: json.error }));
          if (json.conflict === "sku") setFieldErrors((p) => ({ ...p, sku: json.error }));
          return;
        }

        if (!res.ok || !json.success) {
          setFormError(json.error || "Failed to update product.");
          return;
        }

        showToast(`Product "${name}" updated successfully!`, "success");
        setTimeout(() => {
          router.push("/CRM/products");
        }, 1000);
      }
    } catch {
      setFormError("A network error occurred while communicating with the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="bg-white/95 rounded-3xl border border-[#DFCBB8]/80 p-8 sm:p-12 text-center space-y-4 shadow-2xs">
        <div className="w-10 h-10 border-2 border-[#B88746] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[#7E6955] uppercase tracking-wider font-semibold">
          Loading product specifications...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 font-sans max-w-5xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-lg border text-xs sm:text-sm font-medium flex items-center space-x-3 transition-all animate-in fade-in slide-in-from-bottom-2 ${
            toastMessage.type === "success"
              ? "bg-[#1C2820] text-emerald-100 border-emerald-800"
              : "bg-rose-950 text-rose-100 border-rose-800"
          }`}
        >
          <span>{toastMessage.type === "success" ? "✓" : "⚠"}</span>
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-stone-400 hover:text-white ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-[11px] font-sans uppercase tracking-[0.16em] text-[#8C7560]">
            <Link href="/CRM" className="hover:text-[#2C2117] transition-colors">
              CRM
            </Link>
            <span>/</span>
            <Link href="/CRM/products" className="hover:text-[#2C2117] transition-colors">
              Products
            </Link>
            <span>/</span>
            <span className="text-[#B88746] font-semibold">
              {mode === "create" ? "New Product" : "Edit Product"}
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#2C2117] font-normal tracking-tight">
            {mode === "create" ? "Add New Luxury Product" : `Edit "${name || "Product"}"`}
          </h1>
          <p className="text-xs text-[#7E6955] font-light">
            {mode === "create"
              ? "Configure catalog metadata, images, pricing, and variants for your artisan collection."
              : "Modify product specifications, synchronize image galleries, and manage stock."}
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <Link
            href="/CRM/products"
            className="px-3.5 py-2 rounded-xl border border-[#DFCBB8] bg-white hover:bg-[#FAF7F2] text-xs font-medium text-[#4A392A] transition-colors"
          >
            ← Back to Products
          </Link>
          {mode === "edit" && slug && published && (
            <Link
              href={`/shop/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl border border-[#DFCBB8] bg-white hover:bg-[#FAF7F2] text-xs font-medium text-[#2C2117] transition-colors flex items-center space-x-1"
            >
              <span>View in Boutique</span>
              <span>↗</span>
            </Link>
          )}
        </div>
      </div>

      {/* Top Error Alert */}
      {formError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start space-x-2.5">
          <span className="text-base leading-none">⚠️</span>
          <div>
            <p className="font-semibold">Unable to save product</p>
            <p className="text-rose-800/90 font-light mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
        {/* ======================================================== */}
        {/* SECTION A: BASIC INFORMATION & PRICING */}
        {/* ======================================================== */}
        <div className="bg-white/95 p-6 sm:p-8 rounded-3xl border border-[#DFCBB8]/80 shadow-2xs space-y-6">
          <div className="border-b border-[#DFCBB8]/50 pb-4">
            <h2 className="font-serif text-lg text-[#2C2117] font-normal">
              1. Basic Information & Pricing
            </h2>
            <p className="text-xs text-[#7E6955] font-light">
              Essential product identity, pricing values, and merchandising attributes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Product Title */}
            <div className="md:col-span-2 space-y-1.5">
              <label htmlFor="product-name" className="text-xs font-semibold text-[#2C2117]">
                Product Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="product-name"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Shivura Royal Brass Pooja Thali Set"
                className={`w-full px-3.5 py-2.5 rounded-xl border bg-[#FAF8F5] text-xs text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors ${
                  fieldErrors.name ? "border-rose-400" : "border-[#DFCBB8]"
                }`}
                required
              />
              {fieldErrors.name && (
                <p className="text-[11px] text-rose-600 font-medium">{fieldErrors.name}</p>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="product-slug" className="text-xs font-semibold text-[#2C2117]">
                  URL Slug <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSlug(slugify(name));
                    setIsSlugManuallyEdited(false);
                  }}
                  className="text-[10.5px] text-[#B88746] hover:underline"
                >
                  Regenerate from title
                </button>
              </div>
              <input
                id="product-slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().trim());
                  setIsSlugManuallyEdited(true);
                }}
                placeholder="e.g. royal-brass-pooja-thali"
                className={`w-full px-3.5 py-2.5 rounded-xl border bg-[#FAF8F5] text-xs font-mono text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors ${
                  fieldErrors.slug ? "border-rose-400" : "border-[#DFCBB8]"
                }`}
                required
              />
              <p className="text-[11px] text-[#8C7560]">
                Storefront route: <span className="font-mono text-[#2C2117]">/shop/{slug || "slug"}</span>
              </p>
              {fieldErrors.slug && (
                <p className="text-[11px] text-rose-600 font-medium">{fieldErrors.slug}</p>
              )}
            </div>

            {/* SKU */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="product-sku" className="text-xs font-semibold text-[#2C2117]">
                  Product SKU (Stock Keeping Unit)
                </label>
                <button
                  type="button"
                  onClick={() => setSku(generateSku(slug || name))}
                  className="text-[10.5px] text-[#B88746] hover:underline"
                >
                  Generate SKU
                </button>
              </div>
              <input
                id="product-sku"
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase().trim())}
                placeholder="e.g. SHIVURA-BRASS-THALI"
                className={`w-full px-3.5 py-2.5 rounded-xl border bg-[#FAF8F5] text-xs font-mono text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors ${
                  fieldErrors.sku ? "border-rose-400" : "border-[#DFCBB8]"
                }`}
              />
              {fieldErrors.sku && (
                <p className="text-[11px] text-rose-600 font-medium">{fieldErrors.sku}</p>
              )}
            </div>

            {/* Price (INR) */}
            <div className="space-y-1.5">
              <label htmlFor="product-price" className="text-xs font-semibold text-[#2C2117]">
                Price in ₹ (INR) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-xs font-medium">
                  ₹
                </span>
                <input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="1499.00"
                  className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl border bg-[#FAF8F5] text-xs text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors ${
                    fieldErrors.price ? "border-rose-400" : "border-[#DFCBB8]"
                  }`}
                  required
                />
              </div>
              {fieldErrors.price && (
                <p className="text-[11px] text-rose-600 font-medium">{fieldErrors.price}</p>
              )}
            </div>

            {/* Original Price (Optional / Discount Display) */}
            <div className="space-y-1.5">
              <label htmlFor="product-original-price" className="text-xs font-semibold text-[#2C2117]">
                Original Price in ₹ (Strikethrough / Discount)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-xs font-medium">
                  ₹
                </span>
                <input
                  id="product-original-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="2199.00 (optional)"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-[#DFCBB8] bg-[#FAF8F5] text-xs text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors"
                />
              </div>
              {fieldErrors.originalPrice && (
                <p className="text-[11px] text-rose-600 font-medium">{fieldErrors.originalPrice}</p>
              )}
            </div>

            {/* Price Prefix */}
            <div className="space-y-1.5">
              <label htmlFor="product-price-prefix" className="text-xs font-semibold text-[#2C2117]">
                Price Prefix (Optional)
              </label>
              <input
                id="product-price-prefix"
                type="text"
                value={pricePrefix}
                onChange={(e) => setPricePrefix(e.target.value)}
                placeholder="e.g. Starting at, Set of 2 from"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFCBB8] bg-[#FAF8F5] text-xs text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors"
              />
            </div>

            {/* Base Stock */}
            <div className="space-y-1.5">
              <label htmlFor="product-stock" className="text-xs font-semibold text-[#2C2117]">
                Base Inventory Stock <span className="text-rose-500">*</span>
              </label>
              {hasVariants ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      id="product-stock"
                      type="number"
                      value={computedVariantStock}
                      readOnly
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFCBB8] bg-[#F5EFE6] text-xs font-semibold text-[#5A4533] cursor-not-allowed select-none"
                    />
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-[#EAE0D2] text-[#634E3C] rounded-lg whitespace-nowrap">
                      Rollup
                    </span>
                  </div>
                  <p className="text-[11px] text-[#7A624E] font-medium">
                    Auto-calculated: {computedVariantStock} total units across {activeVariants.length} active variant{activeVariants.length === 1 ? "" : "s"}.
                    {variants.length > activeVariants.length && (
                      <span className="text-amber-700 ml-1">
                        ({variants.length - activeVariants.length} inactive variant{variants.length - activeVariants.length === 1 ? "" : "s"} excluded)
                      </span>
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <input
                    id="product-stock"
                    type="number"
                    step="1"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="0"
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-[#FAF8F5] text-xs text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors ${
                      fieldErrors.stock ? "border-rose-400" : "border-[#DFCBB8]"
                    }`}
                    required
                  />
                  <p className="text-[11px] text-[#8C7560]">
                    Authoritative inventory stock count for standalone product.
                  </p>
                  {fieldErrors.stock && (
                    <p className="text-[11px] text-rose-600 font-medium">{fieldErrors.stock}</p>
                  )}
                </>
              )}
            </div>

            {/* Badge & New Collection */}
            <div className="space-y-1.5">
              <label htmlFor="product-badge" className="text-xs font-semibold text-[#2C2117]">
                Merchandising Badge
              </label>
              <div className="flex gap-2">
                <input
                  id="product-badge"
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="e.g. Bestseller, Limited Edition"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFCBB8] bg-[#FAF8F5] text-xs text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors"
                />
              </div>
            </div>

            {/* New Product Checkbox */}
            <div className="flex items-center space-x-3 pt-6">
              <input
                id="product-is-new"
                type="checkbox"
                checked={isNew}
                onChange={(e) => setIsNew(e.target.checked)}
                className="w-4 h-4 text-[#B88746] rounded border-[#DFCBB8] focus:ring-[#B88746]"
              />
              <label htmlFor="product-is-new" className="text-xs font-medium text-[#2C2117] cursor-pointer">
                Highlight as &ldquo;New Arrival&rdquo; in boutique
              </label>
            </div>

            {/* Short Description */}
            <div className="md:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="product-short-desc" className="text-xs font-semibold text-[#2C2117]">
                  Short Summary Description (Preview Card)
                </label>
                <span className="text-[10.5px] text-stone-400">
                  {shortDescription.length}/500 chars
                </span>
              </div>
              <textarea
                id="product-short-desc"
                rows={2}
                maxLength={500}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Concise 1-2 sentence luxury summary for collection cards..."
                className="w-full px-3.5 py-2 rounded-xl border border-[#DFCBB8] bg-[#FAF8F5] text-xs text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors"
              />
            </div>

            {/* Full Description */}
            <div className="md:col-span-2 space-y-1.5">
              <label htmlFor="product-full-desc" className="text-xs font-semibold text-[#2C2117]">
                Full Product Story & Artisan Heritage
              </label>
              <textarea
                id="product-full-desc"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed handcrafted dimensions, materials, care instructions, and artisan background..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFCBB8] bg-[#FAF8F5] text-xs text-[#2C2117] focus:outline-none focus:ring-2 focus:ring-[#B88746]/40 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION B: PRODUCT IMAGES & MEDIA */}
        {/* ======================================================== */}
        <div className="bg-white/95 p-6 sm:p-8 rounded-3xl border border-[#DFCBB8]/80 shadow-2xs space-y-6">
          <div className="border-b border-[#DFCBB8]/50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="font-serif text-lg text-[#2C2117] font-normal">
                2. Product Imagery & Media Gallery
              </h2>
              <p className="text-xs text-[#7E6955] font-light">
                Upload photography directly from your computer or supply image URLs. Manage primary cover and organize gallery order.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8C7560] font-medium bg-[#FAF7F2] px-2.5 py-1 rounded-lg border border-[#DFCBB8]">
                {images.length} image{images.length === 1 ? "" : "s"} in gallery
              </span>
            </div>
          </div>

          {/* Cloudinary Status Banner */}
          {cloudinaryConfigured === true ? (
            <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-300/80 text-xs text-emerald-900 flex items-start space-x-2.5">
              <span className="text-sm">☁️</span>
              <div>
                <p className="font-semibold text-emerald-950">Cloudinary Media Storage Connected</p>
                <p className="font-light leading-relaxed mt-0.5 text-emerald-800">
                  Connected to cloud <span className="font-mono font-medium">{cloudinaryCloudName || "active"}</span>. Direct computer image uploads and drag-and-drop are active.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl border border-amber-300/80 bg-amber-50/50 text-xs text-[#7E6955] flex items-start space-x-2.5">
              <span className="text-sm">ℹ️</span>
              <div>
                <p className="font-semibold text-[#2C2117]">Manual Image URLs Active</p>
                <p className="font-light leading-relaxed mt-0.5 text-[#5A4838]">
                  Cloudinary direct upload is unconfigured on the server. To enable direct uploads from your computer, define <span className="font-mono font-semibold text-[#2C2117]">CLOUDINARY_CLOUD_NAME</span>, <span className="font-mono font-semibold text-[#2C2117]">CLOUDINARY_API_KEY</span>, and <span className="font-mono font-semibold text-[#2C2117]">CLOUDINARY_API_SECRET</span> in your server <span className="font-mono text-[#2C2117]">.env</span> file.
                  Local boutique paths (e.g. <span className="font-mono text-[#2C2117]">/images/Art1.png</span>) or valid web URLs (http/https) are fully supported below.
                </p>
              </div>
            </div>
          )}

          {/* Banner Error Notification */}
          {uploadBannerError && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-300 text-xs text-rose-700 flex items-center justify-between">
              <span>{uploadBannerError}</span>
              <button
                type="button"
                onClick={() => setUploadBannerError(null)}
                className="text-rose-500 hover:text-rose-800 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Direct Computer Upload Drag-and-Drop Area */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed transition-all p-6 sm:p-8 text-center flex flex-col items-center justify-center space-y-3 ${
              cloudinaryConfigured === false
                ? "bg-[#FAF8F5]/40 border-[#DFCBB8]/60 opacity-80"
                : isDragging
                ? "border-[#B88746] bg-[#FAF5EB] scale-[1.005] shadow-xs"
                : "border-[#DFCBB8] hover:border-[#B88746]/70 bg-[#FAF8F5]/80 hover:bg-[#FAF8F5]"
            }`}
          >
            <input
              ref={fileInputRef}
              id="crm-product-image-file-input"
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
              disabled={cloudinaryConfigured === false}
            />

            <div className="w-12 h-12 rounded-full bg-[#FAF5EB] border border-[#DFCBB8] flex items-center justify-center text-[#B88746] text-xl shadow-2xs">
              📸
            </div>

            <div className="space-y-1 max-w-md">
              <p className="text-xs sm:text-sm font-semibold text-[#2C2117]">
                {cloudinaryConfigured === false
                  ? "Direct image upload requires Cloudinary configuration"
                  : "Drag & drop product images here, or choose from computer"}
              </p>
              <p className="text-[11px] text-[#8C7560]">
                {cloudinaryConfigured === false
                  ? "Configure Cloudinary credentials in .env to activate direct file uploads. Use manual URLs below in the meantime."
                  : "Supports JPEG, PNG, and WebP (up to 5 MB per file, max 10 files per batch)."}
              </p>
            </div>

            <div className="pt-1">
              <button
                type="button"
                id="btn-upload-images"
                disabled={cloudinaryConfigured === false || isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-[#2C2117] hover:bg-[#1C2820] disabled:bg-stone-300 disabled:cursor-not-allowed text-[#FAF5EB] rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors shadow-2xs cursor-pointer flex items-center space-x-2"
              >
                <span>Upload Images</span>
              </button>
            </div>
          </div>

          {/* Upload Queue Progress & Previews */}
          {uploadQueue.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#2C2117]">
                  Uploading Media ({uploadQueue.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {uploadQueue.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border transition-all space-y-2 bg-white ${
                      item.status === "error"
                        ? "border-rose-300 bg-rose-50/30"
                        : item.status === "success"
                        ? "border-emerald-300 bg-emerald-50/30"
                        : "border-[#DFCBB8]"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.previewUrl}
                          alt={item.fileName}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[#2C2117] truncate" title={item.fileName}>
                          {item.fileName}
                        </p>
                        <p className="text-[10px] text-stone-500">
                          {(item.fileSize / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDismissUpload(item.id)}
                        className="text-stone-400 hover:text-stone-700 text-xs p-1 cursor-pointer"
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Progress Bar */}
                    {item.status === "uploading" && (
                      <div className="space-y-1">
                        <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#B88746] h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-stone-500 font-medium text-right">
                          Uploading... {item.progress}%
                        </p>
                      </div>
                    )}

                    {item.status === "success" && (
                      <p className="text-[10.5px] text-emerald-700 font-medium flex items-center gap-1">
                        ✓ Uploaded to Cloudinary
                      </p>
                    )}

                    {item.status === "error" && (
                      <div className="space-y-1.5 pt-0.5">
                        <p className="text-[10.5px] text-rose-600 font-medium leading-tight">
                          ⚠️ {item.error || "Upload failed"}
                        </p>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleRetryUpload(item.id)}
                            className="text-[10px] text-[#2C2117] underline hover:text-[#B88746] font-semibold cursor-pointer"
                          >
                            Retry
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDismissUpload(item.id)}
                            className="text-[10px] text-stone-500 hover:text-stone-800 cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Image Gallery Cards */}
          {images.length > 0 ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#2C2117]">
                  Gallery Cards ({images.length})
                </h3>
                <p className="text-[11px] text-[#8C7560]">
                  The primary cover is highlighted in green. Order cards with arrows.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                      img.isPrimary
                        ? "bg-emerald-50/40 border-emerald-400 shadow-xs"
                        : "bg-[#FAF8F5] border-[#DFCBB8]/70"
                    }`}
                  >
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-stone-100 border border-stone-200 flex items-center justify-center">
                      {!imageErrorIndices[idx] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img.url}
                          alt={img.altText || "Product preview"}
                          className="object-cover w-full h-full"
                          onError={() =>
                            setImageErrorIndices((prev) => ({ ...prev, [idx]: true }))
                          }
                        />
                      ) : (
                        <div className="p-3 text-center space-y-1">
                          <span className="text-lg">🖼️</span>
                          <p className="text-[10px] text-stone-500 font-mono line-clamp-1">
                            {img.url}
                          </p>
                          <p className="text-[9.5px] text-stone-400">
                            (Preview unavailable locally)
                          </p>
                        </div>
                      )}

                      {img.isPrimary && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-700 text-white text-[9.5px] font-semibold tracking-wider uppercase shadow-xs">
                          ★ Primary Cover
                        </span>
                      )}

                      {img.publicId && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[9px] font-mono shadow-xs">
                          ☁️ Cloudinary
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="font-mono text-[11px] text-[#2C2117] truncate" title={img.url}>
                        {img.url}
                      </p>
                    </div>

                    {/* Inline Editable Alt Text */}
                    <div className="space-y-1">
                      <label
                        htmlFor={`img-alt-${idx}`}
                        className="text-[10px] font-semibold text-[#7E6955] uppercase tracking-wider block"
                      >
                        Alt Text (SEO & Accessibility)
                      </label>
                      <input
                        id={`img-alt-${idx}`}
                        type="text"
                        value={img.altText || ""}
                        onChange={(e) => handleUpdateImageAlt(idx, e.target.value)}
                        placeholder="e.g. Handcrafted Brass Diya angle view"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#DFCBB8] bg-white text-xs text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                      />
                    </div>

                    {/* Actions: Reorder, Set Primary, Delete */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#DFCBB8]/40 text-xs">
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveImage(idx, "up")}
                          className="p-1 px-1.5 rounded-lg border border-[#DFCBB8] bg-white hover:bg-stone-50 disabled:opacity-30 text-[11px] cursor-pointer"
                          title="Move image left"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          disabled={idx === images.length - 1}
                          onClick={() => handleMoveImage(idx, "down")}
                          className="p-1 px-1.5 rounded-lg border border-[#DFCBB8] bg-white hover:bg-stone-50 disabled:opacity-30 text-[11px] cursor-pointer"
                          title="Move image right"
                        >
                          →
                        </button>
                      </div>

                      <div className="flex items-center space-x-2">
                        {!img.isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryImage(idx)}
                            className="text-[10.5px] text-emerald-700 hover:underline font-medium cursor-pointer"
                          >
                            ★ Make Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="text-[10.5px] text-rose-600 hover:underline font-medium cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center rounded-2xl border border-dashed border-[#DFCBB8] bg-[#FAF8F5]/60 text-xs text-[#8C7560]">
              No images added yet. Upload images from your computer above or provide an image URL below.
            </div>
          )}

          {/* Manual Image URL Input (Fallback / Local Boutique Assets) */}
          <div className="pt-1">
            <details className="group rounded-2xl border border-[#DFCBB8]/70 bg-[#FAF8F5] p-4 transition-colors open:bg-white">
              <summary className="text-xs font-semibold text-[#2C2117] cursor-pointer flex items-center justify-between select-none">
                <span className="flex items-center space-x-2">
                  <span>🔗</span>
                  <span>Manual Image URL (Fallback / Local Boutique Assets)</span>
                </span>
                <span className="text-[10px] text-[#8C7560] group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>

              <div className="space-y-3 pt-3.5 mt-2 border-t border-[#DFCBB8]/40">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label htmlFor="new-image-url" className="text-[11px] font-semibold text-[#2C2117]">
                      Image Path / URL
                    </label>
                    <input
                      id="new-image-url"
                      type="text"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="/images/Product1.png or https://..."
                      className="w-full px-3 py-2 rounded-xl border border-[#DFCBB8] bg-white text-xs text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="new-image-alt" className="text-[11px] font-semibold text-[#2C2117]">
                      Alt Text (Accessibility)
                    </label>
                    <input
                      id="new-image-alt"
                      type="text"
                      value={newImageAlt}
                      onChange={(e) => setNewImageAlt(e.target.value)}
                      placeholder="e.g. Handcrafted Brass Diya angle"
                      className="w-full px-3 py-2 rounded-xl border border-[#DFCBB8] bg-white text-xs text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2">
                    <input
                      id="new-img-primary"
                      type="checkbox"
                      checked={newImageIsPrimary}
                      onChange={(e) => setNewImageIsPrimary(e.target.checked)}
                      className="w-4 h-4 text-[#B88746] rounded border-[#DFCBB8] focus:ring-[#B88746]"
                    />
                    <label htmlFor="new-img-primary" className="text-xs text-[#4A392A] cursor-pointer">
                      Set as primary display photo
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddImage}
                    className="px-4 py-2 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    + Add Image URL
                  </button>
                </div>

                {fieldErrors.image && (
                  <p className="text-[11px] text-rose-600 font-medium">{fieldErrors.image}</p>
                )}
              </div>
            </details>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION C: PRODUCT VARIANTS */}
        {/* ======================================================== */}
        <div className="bg-white/95 p-6 sm:p-8 rounded-3xl border border-[#DFCBB8]/80 shadow-2xs space-y-6">
          <div className="border-b border-[#DFCBB8]/50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="font-serif text-lg text-[#2C2117] font-normal">
                3. Size, Color & Material Variants
              </h2>
              <p className="text-xs text-[#7E6955] font-light">
                Optional SKU variants for dimensions, finishes, custom packs, and individual inventory counts.
              </p>
            </div>
            <span className="text-xs text-[#8C7560] font-medium bg-[#FAF7F2] px-2.5 py-1 rounded-lg border border-[#DFCBB8]">
              {variants.length} variant{variants.length === 1 ? "" : "s"} added
            </span>
          </div>

          {/* Add Variant Form Box */}
          <div className="p-4 rounded-2xl border border-[#DFCBB8]/70 bg-[#FAF8F5] space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="variant-name" className="text-[11px] font-semibold text-[#2C2117]">
                  Variant Title <span className="text-rose-500">*</span>
                </label>
                <input
                  id="variant-name"
                  type="text"
                  value={newVariantName}
                  onChange={(e) => setNewVariantName(e.target.value)}
                  placeholder="e.g. Standard (Set of 6)"
                  className="w-full px-3 py-2 rounded-xl border border-[#DFCBB8] bg-white text-xs text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="variant-size" className="text-[11px] font-semibold text-[#2C2117]">
                  Size / Dimension
                </label>
                <input
                  id="variant-size"
                  type="text"
                  value={newVariantSize}
                  onChange={(e) => setNewVariantSize(e.target.value)}
                  placeholder="e.g. 10-inch, 250ml"
                  className="w-full px-3 py-2 rounded-xl border border-[#DFCBB8] bg-white text-xs text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="variant-color" className="text-[11px] font-semibold text-[#2C2117]">
                  Color / Finish
                </label>
                <input
                  id="variant-color"
                  type="text"
                  value={newVariantColor}
                  onChange={(e) => setNewVariantColor(e.target.value)}
                  placeholder="e.g. Antique Brass, Terracotta"
                  className="w-full px-3 py-2 rounded-xl border border-[#DFCBB8] bg-white text-xs text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="variant-design" className="text-[11px] font-semibold text-[#2C2117]">
                  Design / Motif
                </label>
                <input
                  id="variant-design"
                  type="text"
                  value={newVariantDesign}
                  onChange={(e) => setNewVariantDesign(e.target.value)}
                  placeholder="e.g. Traditional Peacock"
                  className="w-full px-3 py-2 rounded-xl border border-[#DFCBB8] bg-white text-xs text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="variant-sku" className="text-[11px] font-semibold text-[#2C2117]">
                  Variant SKU
                </label>
                <input
                  id="variant-sku"
                  type="text"
                  value={newVariantSku}
                  onChange={(e) => setNewVariantSku(e.target.value.toUpperCase().trim())}
                  placeholder="e.g. SHIVURA-DIYA-6PK"
                  className="w-full px-3 py-2 rounded-xl border border-[#DFCBB8] bg-white text-xs font-mono text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="variant-price" className="text-[11px] font-semibold text-[#2C2117]">
                  Price Override in ₹ (Optional)
                </label>
                <input
                  id="variant-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newVariantPrice}
                  onChange={(e) => setNewVariantPrice(e.target.value)}
                  placeholder="Leaves blank to use base price"
                  className="w-full px-3 py-2 rounded-xl border border-[#DFCBB8] bg-white text-xs text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="variant-stock" className="text-[11px] font-semibold text-[#2C2117]">
                  Variant Stock Quantity <span className="text-rose-500">*</span>
                </label>
                <input
                  id="variant-stock"
                  type="number"
                  step="1"
                  min="0"
                  value={newVariantStock}
                  onChange={(e) => setNewVariantStock(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-[#DFCBB8] bg-white text-xs text-[#2C2117] focus:outline-none focus:ring-1 focus:ring-[#B88746]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleAddVariant}
                className="px-4 py-2 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                + Add Variant Option
              </button>
            </div>

            {fieldErrors.variantName && (
              <p className="text-[11px] text-rose-600 font-medium">{fieldErrors.variantName}</p>
            )}
            {fieldErrors.variantStock && (
              <p className="text-[11px] text-rose-600 font-medium">{fieldErrors.variantStock}</p>
            )}
          </div>

          {/* Variants Table */}
          {variants.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-[#DFCBB8]/70">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF7F2] border-b border-[#DFCBB8]/70 text-[10.5px] uppercase font-semibold text-[#8C7560]">
                    <th className="py-2.5 px-3">Variant</th>
                    <th className="py-2.5 px-3">Attributes</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Price</th>
                    <th className="py-2.5 px-3">Stock</th>
                    <th className="py-2.5 px-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFCBB8]/40 bg-white">
                  {variants.map((v, i) => (
                    <tr key={i} className="hover:bg-[#FAF8F5]">
                      <td className="py-2.5 px-3 font-semibold text-[#2C2117]">{v.name}</td>
                      <td className="py-2.5 px-3 text-[#7E6955]">
                        {[v.size, v.color, v.design].filter(Boolean).join(" • ") || "—"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">{v.sku || "—"}</td>
                      <td className="py-2.5 px-3">
                        {v.price !== null && v.price !== undefined
                          ? `₹${Number(v.price).toFixed(2)}`
                          : "Base Price"}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#2C2117]">{v.stock} units</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(i)}
                          className="text-rose-600 hover:text-rose-800 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center rounded-2xl border border-dashed border-[#DFCBB8] bg-[#FAF8F5]/60 text-xs text-[#8C7560]">
              No custom variants configured. This product will sell as a single unified item.
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* SECTION D: TAXONOMY (CATEGORIES & OCCASIONS) */}
        {/* ======================================================== */}
        <div className="bg-white/95 p-6 sm:p-8 rounded-3xl border border-[#DFCBB8]/80 shadow-2xs space-y-6">
          <div className="border-b border-[#DFCBB8]/50 pb-4">
            <h2 className="font-serif text-lg text-[#2C2117] font-normal">
              4. Categories & Festive Occasions
            </h2>
            <p className="text-xs text-[#7E6955] font-light">
              Connect this product to relevant catalog categories and seasonal gifting occasions.
            </p>
          </div>

          {taxonomyError && (
            <div className="p-3.5 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center justify-between">
              <span>{taxonomyError}</span>
              <button
                type="button"
                onClick={fetchTaxonomy}
                className="text-xs font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}

          {taxonomyLoading ? (
            <div className="p-4 text-center text-xs text-stone-400 animate-pulse">
              Loading available taxonomy collections...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Categories */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#2C2117] uppercase tracking-wider">
                    Categories ({selectedCategoryIds.length} selected)
                  </span>
                  {selectedCategoryIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryIds([]);
                        setIsCategoriesDirty(true);
                      }}
                      className="text-[10.5px] text-[#8C7560] hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {taxonomyCategories.map((cat) => {
                    const isSelected = selectedCategoryIds.includes(cat.id);
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => handleToggleCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-[#2C2117] text-[#FAF5EB] border-[#2C2117] shadow-xs"
                            : "bg-[#FAF8F5] text-[#4A392A] border-[#DFCBB8]/80 hover:border-[#B88746]"
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        {isSelected && <span className="text-xs ml-1">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Occasions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#2C2117] uppercase tracking-wider">
                    Occasions & Festivals ({selectedOccasionIds.length} selected)
                  </span>
                  {selectedOccasionIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOccasionIds([]);
                        setIsOccasionsDirty(true);
                      }}
                      className="text-[10.5px] text-[#8C7560] hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {taxonomyOccasions.map((occ) => {
                    const isSelected = selectedOccasionIds.includes(occ.id);
                    return (
                      <button
                        type="button"
                        key={occ.id}
                        onClick={() => handleToggleOccasion(occ.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-[#B88746] text-white border-[#B88746] shadow-xs"
                            : "bg-[#FAF8F5] text-[#4A392A] border-[#DFCBB8]/80 hover:border-[#B88746]"
                        }`}
                      >
                        <span className="truncate">{occ.name}</span>
                        {isSelected && <span className="text-xs ml-1">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* SECTION E: PUBLISHING CONTROLS & SUBMIT BAR */}
        {/* ======================================================== */}
        <div className="bg-white/95 p-6 sm:p-8 rounded-3xl border border-[#DFCBB8]/80 shadow-2xs space-y-6">
          <div className="border-b border-[#DFCBB8]/50 pb-4">
            <h2 className="font-serif text-lg text-[#2C2117] font-normal">
              5. Publication & Catalog Visibility
            </h2>
            <p className="text-xs text-[#7E6955] font-light">
              Control whether this product is immediately visible on the boutique storefront.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Published Toggle */}
            <div className="p-4 rounded-2xl border border-[#DFCBB8]/80 bg-[#FAF8F5] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[#2C2117] block">
                  Storefront Publication
                </span>
                <span className="text-[11px] text-[#7E6955]">
                  {published
                    ? "Live: Customers can view and purchase"
                    : "Draft: Hidden from customer storefront"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPublished(!published)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  published ? "bg-emerald-600" : "bg-stone-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    published ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Active Toggle */}
            <div className="p-4 rounded-2xl border border-[#DFCBB8]/80 bg-[#FAF8F5] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[#2C2117] block">
                  Operational Catalog State
                </span>
                <span className="text-[11px] text-[#7E6955]">
                  {active
                    ? "Active: Available for catalog inventory management"
                    : "Archived: Disabled in catalog operations"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActive(!active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  active ? "bg-emerald-600" : "bg-stone-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    active ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#DFCBB8]/60">
            <Link
              href="/CRM/products"
              className="w-full sm:w-auto px-5 py-2.5 border border-[#DFCBB8] hover:bg-[#FAF7F2] text-xs uppercase tracking-wider font-semibold text-[#4A392A] rounded-xl text-center transition-colors"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-7 py-3 bg-[#2C2117] hover:bg-[#1C2820] text-[#FAF5EB] rounded-xl text-xs uppercase tracking-widest font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
              id="crm-product-save-button"
            >
              {isSubmitting && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{mode === "create" ? "Create Product" : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
