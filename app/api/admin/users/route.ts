import { getAuthTokenFromRequest, verifySessionToken } from "@/lib/auth";
import { getAllUsers, updateUserRole, findUserById, logAdminAction } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return Response.json({ success: false, message: "احراز هویت نشده‌اید." }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return Response.json({ success: false, message: "دسترسی غیرمجاز." }, { status: 403 });
    }

    // Live DB validation of requester role
    const currentUser = await findUserById(session.id);
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "super_admin")) {
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
    if (!session) {
      return Response.json({ success: false, message: "دسترسی غیرمجاز." }, { status: 403 });
    }

    // 1. Live DB check of requester's current role
    const currentUser = await findUserById(session.id);
    if (!currentUser || currentUser.role !== "super_admin") {
      return Response.json(
        { success: false, message: "تنها مدیر ارشد سامانه مجاز به تغییر نقش کاربران است." },
        { status: 403 }
      );
    }

    const body: any = await request.json();
    const { userId, role } = body as { userId: string; role: "super_admin" | "admin" | "user" };

    if (!userId || !role) {
      return Response.json({ success: false, message: "شناسه کاربر و نقش الزامی است." }, { status: 400 });
    }

    if (!["super_admin", "admin", "user"].includes(role)) {
      return Response.json({ success: false, message: "نقش نامعتبر است." }, { status: 400 });
    }

    // 2. Self-Role Modification Prevention
    if (currentUser.id === userId) {
      return Response.json(
        { success: false, message: "شما نمی‌توانید نقش حساب کاربری خودتان را تغییر دهید." },
        { status: 400 }
      );
    }

    const targetUser = await findUserById(userId);
    if (!targetUser) {
      return Response.json({ success: false, message: "کاربر یافت نشد." }, { status: 404 });
    }

    // 3. Last Super Admin Protection
    if (targetUser.role === "super_admin" && role !== "super_admin") {
      const allUsers = await getAllUsers();
      const superAdminsCount = allUsers.filter((u) => u.role === "super_admin").length;
      if (superAdminsCount <= 1) {
        return Response.json(
          { success: false, message: "حداقل یک مدیر ارشد باید در سامانه فعال باقی بماند." },
          { status: 400 }
        );
      }
    }

    const ok = await updateUserRole(userId, role);
    if (!ok) {
      return Response.json({ success: false, message: "خطا در به‌روزرسانی نقش کاربر." }, { status: 400 });
    }

    await logAdminAction({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      action: "ROLE_CHANGE",
      entityType: "user",
      entityId: targetUser.id,
      entityName: targetUser.name,
      details: { previousRole: targetUser.role, newRole: role, targetEmail: targetUser.email },
    });

    return Response.json({
      success: true,
      message: `نقش کاربر «${targetUser.name}» با موفقیت به «${
        role === "super_admin" ? "مدیر ارشد" : role === "admin" ? "مدیر سامانه" : "دانشجو / کاربر عادی"
      }» تغییر یافت.`,
    });
  } catch (error) {
    console.error("PATCH /api/admin/users error:", error);
    return Response.json({ success: false, message: "خطای سرور" }, { status: 500 });
  }
}
