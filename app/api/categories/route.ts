import {
  getVisualCategories,
  createVisualCategory,
  deleteVisualCategory,
  getRuleCategories,
  createRuleCategory,
  deleteRuleCategory,
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
        rule: ruleCats,
      },
    });
  } catch (error) {
    console.error("Get categories error:", error);
    return Response.json({ success: false, message: "خطا در دریافت لیست دسته‌بندی‌ها" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, trackId, name, color, sortOrder, minCredits, parentId } = body as {
      type: "visual" | "rule";
      trackId: string;
      name: string;
      color?: string;
      sortOrder?: number;
      minCredits?: number;
      parentId?: string | null;
    };

    if (!trackId || !name || !type) {
      return Response.json({ success: false, message: "اطلاعات دسته‌بندی ناقص است." }, { status: 400 });
    }

    if (type === "visual") {
      const newCat = await createVisualCategory(trackId, name, color || "#3b82f6", sortOrder || 0);
      return Response.json({ success: true, data: newCat }, { status: 201 });
    } else {
      const newCat = await createRuleCategory(trackId, name, minCredits || 0, parentId);
      return Response.json({ success: true, data: newCat }, { status: 201 });
    }
  } catch (error) {
    console.error("Create category error:", error);
    return Response.json({ success: false, message: "خطا در ایجاد دسته‌بندی" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
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
