import { NextRequest } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { checkCrmUploadRateLimit } from "@/lib/rateLimit";
import {
  isCloudinaryConfigured,
  getCloudinaryConfigStatus,
  uploadImageToCloudinary,
} from "@/lib/cloudinary";
import {
  validateImageBuffer,
  sanitizeFileName,
  MAX_UPLOAD_FILES_PER_REQUEST,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_IMAGE_EXTENSIONS,
} from "@/lib/validation/imageUpload";

/**
 * GET /api/crm/upload
 *
 * Checks administrator authorization and returns safe public upload configuration status.
 * Never leaks API keys, secrets, or privileged values.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to check upload configuration",
        },
        { status: 401 }
      );
    }

    if (auth.status === "forbidden") {
      return Response.json(
        {
          success: false,
          error: "Forbidden: Customer accounts do not have CRM permissions",
        },
        { status: 403 }
      );
    }

    const configStatus = getCloudinaryConfigStatus();

    return Response.json({
      success: true,
      data: {
        configured: configStatus.configured,
        cloudName: configStatus.cloudName,
        maxFileSizeBytes: MAX_IMAGE_SIZE_BYTES,
        maxFilesPerRequest: MAX_UPLOAD_FILES_PER_REQUEST,
        allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
        allowedExtensions: ALLOWED_IMAGE_EXTENSIONS,
        requiredVariables: [
          "CLOUDINARY_CLOUD_NAME",
          "CLOUDINARY_API_KEY",
          "CLOUDINARY_API_SECRET",
        ],
      },
    });
  } catch (error) {
    console.error("[CRM Upload GET Error]:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crm/upload
 *
 * Secure server-side image upload handler for Shivura CRM product catalog.
 *
 * Guarantees:
 * 1. Admin authentication required (unauthenticated -> 401, customer -> 403).
 * 2. Strict server-side binary magic-byte validation (JPEG, PNG, WebP only).
 * 3. Enforces 5 MB per-file size limit and max 10 files per batch.
 * 4. Refuses upload if Cloudinary is unconfigured on the server (returns 503 with variable names).
 * 5. Returns only safe public image URL and publicId. Never creates broken DB records.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate administrative session
    const auth = await verifyAdminSession(request);

    if (auth.status === "unauthenticated") {
      return Response.json(
        {
          success: false,
          error: "Unauthenticated: Administrative login required to upload images",
        },
        { status: 401 }
      );
    }

    if (auth.status === "forbidden") {
      return Response.json(
        {
          success: false,
          error: "Forbidden: Customer accounts do not have permission to upload files",
        },
        { status: 403 }
      );
    }

    // 1.5. Rate-limit upload requests (10 req/min per verified admin)
    const rateLimit = await checkCrmUploadRateLimit(auth.admin!.id);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    // 2. Verify Cloudinary credentials are configured on server
    if (!isCloudinaryConfigured()) {
      return Response.json(
        {
          success: false,
          error:
            "Cloudinary media storage is not configured on this server. Please define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.",
          code: "CLOUDINARY_NOT_CONFIGURED",
          requiredVariables: [
            "CLOUDINARY_CLOUD_NAME",
            "CLOUDINARY_API_KEY",
            "CLOUDINARY_API_SECRET",
          ],
        },
        { status: 503 }
      );
    }

    // 3. Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json(
        {
          success: false,
          error: "Invalid multipart form data in request body.",
        },
        { status: 400 }
      );
    }

    // Extract file entries from either 'files' or 'file' keys
    const rawFiles = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ].filter(
      (item): item is File =>
        typeof item === "object" && item !== null && "arrayBuffer" in item
    );

    if (rawFiles.length === 0) {
      return Response.json(
        {
          success: false,
          error:
            "No files provided in upload request. Please attach at least one image file under 'files' or 'file'.",
        },
        { status: 400 }
      );
    }

    if (rawFiles.length > MAX_UPLOAD_FILES_PER_REQUEST) {
      return Response.json(
        {
          success: false,
          error: `Maximum of ${MAX_UPLOAD_FILES_PER_REQUEST} files may be uploaded per request. Received ${rawFiles.length}.`,
        },
        { status: 400 }
      );
    }

    // 4. Validate and upload files in batch
    const uploadedImages: Array<{
      originalName: string;
      url: string;
      publicId: string;
      width?: number;
      height?: number;
      format?: string;
      bytes?: number;
    }> = [];

    const fileErrors: Array<{
      fileName: string;
      error: string;
    }> = [];

    for (const file of rawFiles) {
      const sanitizedName = sanitizeFileName(file.name || "uploaded-image");

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Content validation via magic bytes & size check
        const validation = validateImageBuffer(buffer, file.name);

        if (!validation.valid) {
          fileErrors.push({
            fileName: file.name,
            error: validation.error || "File validation failed",
          });
          continue;
        }

        // Stream buffer to Cloudinary
        const uploadResult = await uploadImageToCloudinary(buffer, {
          folder: "shivura/products",
          tags: ["shivura", "product-media"],
        });

        uploadedImages.push({
          originalName: sanitizedName,
          url: uploadResult.secureUrl || uploadResult.url,
          publicId: uploadResult.publicId,
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
        });
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : "Unknown upload error";
        fileErrors.push({
          fileName: file.name,
          error: message,
        });
      }
    }

    // If all files failed, return appropriate error response
    if (uploadedImages.length === 0) {
      return Response.json(
        {
          success: false,
          error:
            fileErrors[0]?.error ||
            "All uploaded files failed validation or upload.",
          errors: fileErrors,
        },
        { status: 400 }
      );
    }

    // Partial success or full success
    return Response.json(
      {
        success: true,
        message:
          fileErrors.length > 0
            ? `Uploaded ${uploadedImages.length} of ${rawFiles.length} images (${fileErrors.length} failed).`
            : `Successfully uploaded ${uploadedImages.length} image(s).`,
        data: uploadedImages,
        errors: fileErrors.length > 0 ? fileErrors : undefined,
        partial: fileErrors.length > 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[CRM Upload API Error]:", error);
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected server error occurred during upload.",
      },
      { status: 500 }
    );
  }
}
