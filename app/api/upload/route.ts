import { apiResponseJson, withApiTiming } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/auth";
import crypto from "node:crypto";

/**
 * Upload API Endpoint
 * Handles direct image upload to Cloudinary (Cloud name: mmlnviaw)
 * with seamless local data URI fallback if offline.
 */
async function POSTHandler(request: NextRequest) {
  try {
    const auth = await requireUserSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiResponseJson(
        { success: false, message: "هیچ فایلی ارسال نشده است." },
        { status: 400 }
      );
    }

    // Check file size (e.g. max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return apiResponseJson(
        { success: false, message: "حجم فایل نباید بیش از ۱۰ مگابایت باشد." },
        { status: 400 }
      );
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "mmlnviaw";
    const apiKey = process.env.CLOUDINARY_API_KEY || "493152994931629";
    const apiSecret = process.env.CLOUDINARY_API_SECRET || "MUdfC3ueRbmjRXNpkwGO2_-x-h4";

    // 1. Upload to Cloudinary using signed upload API
    if (cloudName && apiKey && apiSecret) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const folder = "ut-ece";

        // Signature format: sorted parameters + api_secret
        const stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash("sha1").update(stringToSign).digest("hex");

        const cldFormData = new FormData();
        cldFormData.append("file", file);
        cldFormData.append("api_key", apiKey);
        cldFormData.append("timestamp", timestamp.toString());
        cldFormData.append("folder", folder);
        cldFormData.append("signature", signature);

        const cldRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: "POST",
            body: cldFormData,
          }
        );

        const cldData: any = await cldRes.json();
        if (cldData.secure_url) {
          return apiResponseJson({
            success: true,
            url: cldData.secure_url,
            provider: "cloudinary",
            message: "تصویر با موفقیت در Cloudinary بارگذاری شد.",
          });
        } else {
          console.warn("Cloudinary returned non-success response:", cldData);
        }
      } catch (cldErr) {
        console.error("Cloudinary upload failed, falling back:", cldErr);
      }
    }

    // 2. Fallback for offline development / edge fallback (Data URI)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return apiResponseJson({
      success: true,
      url: dataUrl,
      provider: "data_uri_fallback",
      message: "تصویر با موفقیت آپلود و ذخیره شد.",
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در پردازش و آپلود تصویر" },
      { status: 500 }
    );
  }
}

export const POST = withApiTiming(POSTHandler);
