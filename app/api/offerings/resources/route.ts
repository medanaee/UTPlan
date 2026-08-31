import { NextRequest, NextResponse } from "next/server";
import {
  getOfferingResources,
  createOfferingResource,
  updateOfferingResource,
  deleteOfferingResource,
} from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";
import type { OfferingResourceType } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offeringId = searchParams.get("offeringId");

    if (!offeringId) {
      return NextResponse.json(
        { success: false, message: "شناسه ارائه الزامی است." },
        { status: 400 }
      );
    }

    const data = await getOfferingResources(offeringId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("GET offering resources error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در دریافت منابع درس" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body = await request.json();
    const { offeringId, title, term, type, url } = body;

    if (!offeringId || !title?.trim() || !type || !url?.trim()) {
      return NextResponse.json(
        { success: false, message: "شناسه ارائه، نام منبع، نوع منبع و آدرس لینک الزامی هستند." },
        { status: 400 }
      );
    }

    const validTypes: OfferingResourceType[] = ["video", "slide", "archive"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, message: "نوع منبع باید یکی از مقادیر ویدئو، اسلاید یا آرشیو باشد." },
        { status: 400 }
      );
    }

    const newResource = await createOfferingResource({
      offeringId,
      title: title.trim(),
      term: term?.trim() || undefined,
      type,
      url: url.trim(),
    });

    return NextResponse.json({
      success: true,
      message: "منبع آموزشی با موفقیت ثبت شد.",
      data: newResource,
    });
  } catch (error: any) {
    console.error("POST offering resource error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در ثبت منبع آموزشی" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body = await request.json();
    const { id, title, term, type, url } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "شناسه منبع الزامی است." },
        { status: 400 }
      );
    }

    if (type) {
      const validTypes: OfferingResourceType[] = ["video", "slide", "archive"];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { success: false, message: "نوع منبع نامعتبر است." },
          { status: 400 }
        );
      }
    }

    const updated = await updateOfferingResource(id, {
      title: title?.trim(),
      term: term !== undefined ? (term?.trim() || null) : undefined,
      type,
      url: url?.trim(),
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "منبع مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "منبع آموزشی با موفقیت ویرایش شد.",
      data: updated,
    });
  } catch (error: any) {
    console.error("PUT offering resource error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در ویرایش منبع آموزشی" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "شناسه منبع الزامی است." },
        { status: 400 }
      );
    }

    const deleted = await deleteOfferingResource(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "منبع مورد نظر یافت نشد یا حذف نگردید." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "منبع آموزشی با موفقیت حذف شد.",
    });
  } catch (error: any) {
    console.error("DELETE offering resource error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در حذف منبع آموزشی" },
      { status: 500 }
    );
  }
}
