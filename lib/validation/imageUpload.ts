/**
 * Image Upload Validation and Security Utilities for Shivura CRM
 *
 * Enforces strict raster image validation (JPEG, PNG, WebP) using
 * server-side binary magic byte detection to prevent MIME spoofing,
 * executable uploads, SVG script injections, and oversized files.
 */

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_UPLOAD_FILES_PER_REQUEST = 10;

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const ALLOWED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

export interface ImageValidationResult {
  valid: boolean;
  mimeType?: AllowedImageMimeType;
  extension?: string;
  error?: string;
}

/**
 * Validates actual binary content of an image buffer via magic bytes.
 * Never trusts client-reported MIME type or filename extension alone.
 */
export function validateImageBuffer(
  buffer: Buffer,
  fileName?: string
): ImageValidationResult {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      error: "Uploaded file is empty.",
    };
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds the maximum allowed limit of 5 MB.`,
    };
  }

  if (buffer.length < 12) {
    return {
      valid: false,
      error: "File is too small to be a valid image.",
    };
  }

  let detectedMime: AllowedImageMimeType | null = null;
  let detectedExt: string | null = null;

  // 1. Check JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedMime = "image/jpeg";
    detectedExt = "jpg";
  }
  // 2. Check PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  else if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedMime = "image/png";
    detectedExt = "png";
  }
  // 3. Check WebP: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
  else if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    detectedMime = "image/webp";
    detectedExt = "webp";
  }

  if (!detectedMime || !detectedExt) {
    return {
      valid: false,
      error:
        "Unsupported or invalid image format. Only JPEG, PNG, and WebP raster images are accepted.",
    };
  }

  // Cross-validate file extension if a filename is provided
  if (fileName) {
    const cleanName = fileName.toLowerCase().trim();
    const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) =>
      cleanName.endsWith(ext)
    );

    if (!hasValidExt) {
      return {
        valid: false,
        error: `File extension for "${fileName}" does not match allowed types (.jpg, .jpeg, .png, .webp).`,
      };
    }
  }

  return {
    valid: true,
    mimeType: detectedMime,
    extension: detectedExt,
  };
}

/**
 * Sanitizes an uploaded file name to prevent directory traversal or malicious characters.
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[/\\]/g, "") // Remove slashes
    .replace(/\0/g, "") // Remove null bytes
    .replace(/[^\w.-]/g, "_") // Replace special chars with underscores
    .slice(0, 100);
}
