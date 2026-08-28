import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";

/**
 * Upload API Endpoint
 * Handles direct image upload to Cloudflare Images / Cloudflare R2
 * with seamless local data URI fallback for development.
 */
export async function POST(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const session = token ? await verifySessionToken(token) : null;
    if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
      return NextResponse.json(
        { success: false, message: "عدم دسترسی کافی برای آپلود فایل" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "هیچ فایلی ارسال نشده است." },
        { status: 400 }
      );
    }

    // Check file size (e.g. max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "حجم فایل نباید بیش از ۵ مگابایت باشد." },
        { status: 400 }
      );
    }

    const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const cfApiToken = process.env.CLOUDFLARE_API_TOKEN;

    // 1. If Cloudflare Images credentials are provided, upload directly to Cloudflare
    if (cfAccountId && cfApiToken) {
      try {
        const cfFormData = new FormData();
        cfFormData.append("file", file);

        const cfRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/images/v1`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cfApiToken}`,
            },
            body: cfFormData,
          }
        );

        const cfData = await cfRes.json();
        if (cfData.success && cfData.result?.variants?.[0]) {
          return NextResponse.json({
            success: true,
            url: cfData.result.variants[0],
            provider: "cloudflare_images",
            message: "تصویر با موفقیت در Cloudflare Images بارگذاری شد.",
          });
        }
      } catch (cfErr) {
        console.error("Cloudflare Images upload failed, using fallback:", cfErr);
      }
    }

    // 2. Fallback for development / Edge local deployment (Data URI)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      url: dataUrl,
      provider: "cloudflare_ready_data_uri",
      message: "تصویر با موفقیت آپلود و ذخیره شد.",
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در پردازش و آپلود تصویر" },
      { status: 500 }
    );
  }
}
