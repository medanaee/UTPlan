import { requireAdminSession } from "@/lib/auth";
import {
  getCategories,
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
  logAdminAction,
} from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get("trackId");

    if (!trackId) {
      return Response.json({ success: false, message: "شناسه گرایش الزامی است." }, { status: 400 });
    }

    const categories = await getCategories(trackId);

    return Response.json({
      success: true,
      data: {
        categories,
        items: categories,
        // Backward compatibility
        visual: categories,
        visualCategories: categories,
        rule: categories,
        ruleCategories: categories,
      },
    });
  } catch (error) {
    console.error("Get categories error:", error);
    return Response.json({ success: false, message: "خطا در دریافت لیست دسته‌ها" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();

    const { trackId, name, color, sortOrder, parentId, code } = body as {
      trackId: string;
      name: string;
      color?: string;
      sortOrder?: number;
      parentId?: string | null;
      code?: string;
    };

    if (!trackId || !name) {
      return Response.json({ success: false, message: "اطلاعات دسته ناقص است (نام و گرایش الزامی هستند)." }, { status: 400 });
    }

    const newCat = await createCategory({
      trackId,
      name,
      color: color || "#3b82f6",
      sortOrder: sortOrder || 0,
      parentId: parentId || null,
      code,
    });

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "CREATE",
      entityType: "category",
      entityId: newCat.id,
      entityName: newCat.name,
      details: { trackId, name, code, parentId },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return Response.json({ success: true, data: newCat }, { status: 201 });
  } catch (error) {
    console.error("Create category error:", error);
    return Response.json({ success: false, message: "خطا در ایجاد دسته" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ success: false, message: "شناسه دسته الزامی است." }, { status: 400 });
    }

    const success = await deleteCategory(id);

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "DELETE",
      entityType: "category",
      entityId: id,
      entityName: `حذف دسته‌بندی ${id}`,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return Response.json({ success });
  } catch (error) {
    console.error("Delete category error:", error);
    return Response.json({ success: false, message: "خطا در حذف دسته" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response!;
    const body: any = await request.json();
    const { action, items, id, name, color, sortOrder, parentId, code } = body as {
      action?: "reorder" | "update";
      items?: { id: string; sortOrder: number; parentId?: string | null }[];
      id?: string;
      name?: string;
      color?: string;
      sortOrder?: number;
      parentId?: string | null;
      code?: string | null;
    };

    // Sub-action: Reorder
    if (action === "reorder" && Array.isArray(items)) {
      await reorderCategories(items);

      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "UPDATE",
        entityType: "category",
        entityName: `تغییر چیدمان دسته‌بندی‌ها (${items.length} دسته)`,
        details: { count: items.length },
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });

      return Response.json({ success: true, message: "ترتیب دسته‌ها با موفقیت ذخیره شد." });
    }

    // Sub-action: Update category
    if (id) {
      const updated = await updateCategory(id, { name, color, parentId, sortOrder, code });
      if (!updated) {
        return Response.json({ success: false, message: "دسته یافت نشد." }, { status: 404 });
      }

      await logAdminAction({
        userId: auth.user!.id,
        userName: auth.user!.name,
        userEmail: auth.user!.email,
        action: "UPDATE",
        entityType: "category",
        entityId: id,
        entityName: updated.name,
        details: { name, color, parentId, sortOrder, code },
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });

      return Response.json({ success: true, data: updated, message: "دسته با موفقیت ویرایش شد." });
    }

    return Response.json({ success: false, message: "عملیات یا اطلاعات نامعتبر است." }, { status: 400 });
  } catch (error: any) {
    console.error("PUT categories error:", error);
    return Response.json(
      { success: false, message: "خطا در به‌روزرسانی دسته: " + (error?.message || "نامشخص") },
      { status: 500 }
    );
  }
}
