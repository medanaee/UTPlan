import { requireAdminSession } from "@/lib/auth";
import {
  getVisualCategories,
  createVisualCategory,
  deleteVisualCategory,
  reorderVisualCategories,
  getRuleCategories,
  createRuleCategory,
  deleteRuleCategory,
  reorderRuleCategories,
} from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get("trackId");
    const type = searchParams.get("type") || "all"; // 'visual' | 'rule' | 'all'

    if (!trackId) {
      return Response.json({ success: false, message: "شناسه گرایش الزامی است." }, { status: 400 });
    }

    let visualCats = [];
    let ruleCats = [];

    if (type === "all" || type === "visual") {
      visualCats = await getVisualCategories(trackId);
    }
    if (type === "all" || type === "rule") {
      ruleCats = await getRuleCategories(trackId);
    }

    return Response.json({
      success: true,
      data: {
        visual: visualCats,
        visualCategories: visualCats,
        rule: ruleCats,
        ruleCategories: ruleCats,
      },
    });
  } catch (error) {
    console.error("Get categories error:", error);
    return Response.json({ success: false, message: "خطا در دریافت لیست دسته‌بندی‌ها" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body = await request.json();
    const { type, trackId, name, color, sortOrder, parentId } = body as {
      type: "visual" | "rule";
      trackId: string;
      name: string;
      color?: string;
      sortOrder?: number;
      parentId?: string | null;
    };

    if (!trackId || !name || !type) {
      return Response.json({ success: false, message: "اطلاعات دسته‌بندی ناقص است." }, { status: 400 });
    }

    if (type === "visual") {
      const newCat = await createVisualCategory(trackId, name, color || "#3b82f6", sortOrder || 0);
      return Response.json({ success: true, data: newCat }, { status: 201 });
    } else {
      const newCat = await createRuleCategory(trackId, name, parentId);
      return Response.json({ success: true, data: newCat }, { status: 201 });
    }
  } catch (error) {
    console.error("Create category error:", error);
    return Response.json({ success: false, message: "خطا در ایجاد دسته‌بندی" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type"); // 'visual' | 'rule'

    if (!id || !type) {
      return Response.json({ success: false, message: "شناسه و نوع دسته‌بندی الزامی است." }, { status: 400 });
    }

    const success =
      type === "visual" ? await deleteVisualCategory(id) : await deleteRuleCategory(id);
    return Response.json({ success });
  } catch (error) {
    console.error("Delete category error:", error);
    return Response.json({ success: false, message: "خطا در حذف دسته‌بندی" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body = await request.json();
    const { action, type, items } = body as {
      action: "reorder";
      type: "visual" | "rule";
      items: { id: string; sortOrder: number; parentId?: string | null }[];
    };

    if (action === "reorder" && Array.isArray(items)) {
      if (type === "visual") {
        await reorderVisualCategories(items);
      } else {
        await reorderRuleCategories(items);
      }
      return Response.json({ success: true, message: "ترتیب دسته‌ها با موفقیت ذخیره شد." });
    }

    return Response.json({ success: false, message: "عملیات نامعتبر است." }, { status: 400 });
  } catch (error: any) {
    console.error("PUT categories error:", error);
    return Response.json(
      { success: false, message: "خطا در به‌روزرسانی ترتیب دسته‌ها: " + (error?.message || "نامشخص") },
      { status: 500 }
    );
  }
}
