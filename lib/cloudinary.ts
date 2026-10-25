import "server-only";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

/**
 * Public configuration status structure.
 * NEVER exposes or returns API secrets or raw keys.
 */
export interface CloudinaryConfigStatus {
  configured: boolean;
  cloudName: string | null;
  hasApiKey: boolean;
  hasApiSecret: boolean;
}

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

/**
 * Inspects server-side environment variables for Cloudinary configuration.
 * Safely normalizes values and ensures credentials are never logged or leaked.
 */
export function getCloudinaryConfigStatus(): CloudinaryConfigStatus {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() || null;
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || null;
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || null;
  const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim() || null;

  const isConfiguredDirect = Boolean(cloudName && apiKey && apiSecret);
  const isConfiguredUrl = Boolean(cloudinaryUrl);

  const isConfigured = isConfiguredDirect || isConfiguredUrl;

  return {
    configured: isConfigured,
    cloudName: cloudName || (isConfiguredUrl ? "configured-via-url" : null),
    hasApiKey: Boolean(apiKey || isConfiguredUrl),
    hasApiSecret: Boolean(apiSecret || isConfiguredUrl),
  };
}

/**
 * Checks whether Cloudinary credentials are fully configured on the server.
 */
export function isCloudinaryConfigured(): boolean {
  return getCloudinaryConfigStatus().configured;
}

/**
 * Initializes and configures the Cloudinary instance if credentials are valid.
 * Throws a safe, informative error if configuration is incomplete.
 */
function ensureCloudinaryConfigured(): void {
  const status = getCloudinaryConfigStatus();

  if (!status.configured) {
    throw new Error(
      "Cloudinary is not configured on this server. Please define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file."
    );
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }
}

/**
 * Uploads an image buffer or base64 data URI to Cloudinary.
 *
 * Safety guarantees:
 * - Refuses execution if credentials are not configured.
 * - Confines uploads to the "shivura/products" folder by default.
 * - Never logs credentials or binary buffer data.
 */
export async function uploadImageToCloudinary(
  fileBuffer: Buffer | string,
  options: {
    folder?: string;
    publicId?: string;
    tags?: string[];
  } = {}
): Promise<CloudinaryUploadResult> {
  ensureCloudinaryConfigured();

  const folder = options.folder || "shivura/products";

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    if (typeof fileBuffer === "string" && fileBuffer.startsWith("data:")) {
      // Base64 Data URI upload
      cloudinary.uploader.upload(
        fileBuffer,
        {
          folder,
          public_id: options.publicId,
          tags: options.tags || ["shivura", "product"],
          resource_type: "image",
          transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
        },
        (error, result) => {
          if (error || !result) {
            return reject(
              new Error(
                `Cloudinary upload failed: ${error?.message || "Unknown error"}`
              )
            );
          }
          resolve(formatUploadResult(result));
        }
      );
    } else {
      // Buffer / Stream upload
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: options.publicId,
          tags: options.tags || ["shivura", "product"],
          resource_type: "image",
          transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
        },
        (error, result) => {
          if (error || !result) {
            return reject(
              new Error(
                `Cloudinary upload stream failed: ${error?.message || "Unknown error"}`
              )
            );
          }
          resolve(formatUploadResult(result));
        }
      );

      const bufferToStream =
        typeof fileBuffer === "string"
          ? Buffer.from(fileBuffer, "base64")
          : fileBuffer;

      uploadStream.end(bufferToStream);
    }
  });
}

/**
 * Deletes an image from Cloudinary by its publicId.
 *
 * Safety guarantees:
 * - Refuses execution if credentials are not configured.
 * - Safely returns success/failure status without exposing internals.
 */
export async function deleteImageFromCloudinary(
  publicId: string
): Promise<{ success: boolean; result?: string; error?: string }> {
  ensureCloudinaryConfigured();

  if (!publicId || typeof publicId !== "string") {
    throw new Error("Invalid publicId provided for Cloudinary deletion.");
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    return {
      success: result.result === "ok",
      result: result.result,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown deletion error";
    return {
      success: false,
      error: message,
    };
  }
}

function formatUploadResult(result: UploadApiResponse): CloudinaryUploadResult {
  return {
    url: result.url,
    secureUrl: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}

export interface CloudinaryListOptions {
  prefix?: string;
  maxResults?: number;
  nextCursor?: string;
  direction?: "asc" | "desc";
}

export interface CloudinaryResourceItem {
  publicId: string;
  format: string;
  version: number;
  bytes: number;
  width: number;
  height: number;
  url: string;
  secureUrl: string;
  createdAt: string;
  folder?: string;
  displayName?: string;
}

export interface CloudinaryListResult {
  resources: CloudinaryResourceItem[];
  nextCursor?: string;
  totalCount?: number;
}

/**
 * Lists image assets stored in Cloudinary under the authorized prefix.
 *
 * Safety guarantees:
 * - Refuses execution if credentials are not configured.
 * - Confines queries to the authorized Shivura prefix ("shivura") by default.
 * - Gracefully handles pagination via next_cursor and max_results limit.
 */
export async function listCloudinaryImages(
  options: CloudinaryListOptions = {}
): Promise<CloudinaryListResult> {
  ensureCloudinaryConfigured();

  const prefix = options.prefix ?? "shivura";
  const maxResults = Math.min(100, Math.max(1, options.maxResults || 50));

  const apiOptions: Record<string, unknown> = {
    type: "upload",
    prefix,
    max_results: maxResults,
    direction: options.direction || "desc",
  };

  if (options.nextCursor) {
    apiOptions.next_cursor = options.nextCursor;
  }

  const result = await cloudinary.api.resources(apiOptions);

  interface RawResource {
    public_id: string;
    format: string;
    version: number;
    bytes: number;
    width: number;
    height: number;
    url: string;
    secure_url: string;
    created_at: string;
    asset_folder?: string;
    display_name?: string;
  }

  const rawList: RawResource[] = result.resources || [];
  const resources: CloudinaryResourceItem[] = rawList.map((item) => ({
    publicId: item.public_id,
    format: item.format,
    version: item.version,
    bytes: item.bytes,
    width: item.width,
    height: item.height,
    url: item.url,
    secureUrl: item.secure_url,
    createdAt: item.created_at,
    folder: item.asset_folder,
    displayName: item.display_name || item.public_id.split("/").pop(),
  }));

  return {
    resources,
    nextCursor: result.next_cursor,
    totalCount: result.total_count,
  };
}

export { cloudinary };

