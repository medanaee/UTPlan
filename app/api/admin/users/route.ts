import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";
import { getAllUsers, updateUserRole, findUserById } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return Response.json({ success: false, message: "احراز هویت نشده‌اید." }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
      return Response.json({ success: false, message: "دسترسی غیرمجاز." }, { status: 403 });
    }

    const rawUsers = await getAllUsers();
    // Sanitize password hashes
    const users = rawUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      facultyId: u.facultyId,
      majorId: u.majorId,
      trackId: u.trackId,
      entrySemester: u.entrySemester,
      createdAt: u.createdAt,
    }));

    return Response.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return Response.json({ success: false, message: "خطای سرور" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return Response.json({ success: false, message: "احراز هویت نشده‌اید." }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
      return Response.json({ success: false, message: "دسترسی غیرمجاز." }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role } = body as { userId: string; role: "super_admin" | "admin" | "user" };

    if (!userId || !role) {
      return Response.json({ success: false, message: "شناسه کاربر و نقش الزامی است." }, { status: 400 });
    }

    if (!["super_admin", "admin", "user"].includes(role)) {
      return Response.json({ success: false, message: "نقش نامعتبر است." }, { status: 400 });
    }

    // Only super_admin can create another super_admin or demote a super_admin
    const targetUser = await findUserById(userId);
    if (!targetUser) {
      return Response.json({ success: false, message: "کاربر یافت نشد." }, { status: 404 });
    }

    if (session.role !== "super_admin" && (role === "super_admin" || targetUser.role === "super_admin")) {
      return Response.json(
        { success: false, message: "تنها مدیر ارشد (Super Admin) می‌تواند نقش مدیر ارشد را تغییر دهد." },
        { status: 403 }
      );
    }

    const ok = await updateUserRole(userId, role);
    if (!ok) {
      return Response.json({ success: false, message: "خطا در به‌روزرسانی نقش کاربر." }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: `نقش کاربر «${targetUser.name}» با موفقیت به «${
        role === "super_admin" ? "مدیر ارشد" : role === "admin" ? "مدیر" : "دانشجو / کاربر عادی"
      }» تغییر یافت.`,
    });
  } catch (error) {
    console.error("PATCH /api/admin/users error:", error);
    return Response.json({ success: false, message: "خطای سرور" }, { status: 500 });
  }
}
