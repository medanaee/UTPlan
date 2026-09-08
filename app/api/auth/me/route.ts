import { NextRequest, NextResponse } from "next/server";
import {
  getAuthTokenFromRequest,
  verifySessionToken,
  verifyPassword,
  hashPassword,
} from "@/lib/auth";
import { findUserById, updateUserProfile, changeUserPassword } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const user = await findUserById(session.id);
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        email: user.email,
        role: user.role,
        facultyId: user.facultyId,
        majorId: user.majorId,
        trackId: user.trackId,
        entrySemester: user.entrySemester,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ authenticated: false, user: null }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ success: false, message: "عدم احراز هویت" }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ success: false, message: "نشست نامعتبر است" }, { status: 401 });
    }

    const body: any = await request.json();
    const {
      firstName,
      lastName,
      name,
      facultyId,
      majorId,
      trackId,
      entrySemester,
      avatarUrl,
      currentPassword,
      newPassword,
    } = body;

    const user = await findUserById(session.id);
    if (!user) {
      return NextResponse.json({ success: false, message: "کاربر یافت نشد" }, { status: 404 });
    }

    // Optional password change
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, message: "برای تغییر رمز، وارد کردن رمز عبور فعلی الزامی است." },
          { status: 400 }
        );
      }
      const isCurrentCorrect = await verifyPassword(currentPassword, user.passwordHash);
      if (!isCurrentCorrect) {
        return NextResponse.json(
          { success: false, message: "رمز عبور فعلی نادرست است." },
          { status: 400 }
        );
      }
      if (newPassword.length < 6) {
        return NextResponse.json(
          { success: false, message: "رمز عبور جدید باید حداقل ۶ کاراکتر باشد." },
          { status: 400 }
        );
      }
      const newHash = await hashPassword(newPassword);
      await changeUserPassword(session.id, newHash);
    }

    const updatedUser = await updateUserProfile(session.id, {
      firstName: firstName !== undefined ? firstName.trim() : user.firstName,
      lastName: lastName !== undefined ? lastName.trim() : user.lastName,
      name: name !== undefined ? name.trim() : undefined,
      facultyId: facultyId !== undefined ? facultyId : user.facultyId,
      majorId: majorId !== undefined ? majorId : user.majorId,
      trackId: trackId !== undefined ? trackId : user.trackId,
      entrySemester: entrySemester !== undefined ? entrySemester : user.entrySemester,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : user.avatarUrl,
    });

    return NextResponse.json({
      success: true,
      message: "اطلاعات حساب کاربری با موفقیت به‌روزرسانی شد.",
      user: {
        id: updatedUser!.id,
        firstName: updatedUser!.firstName,
        lastName: updatedUser!.lastName,
        name: updatedUser!.name,
        email: updatedUser!.email,
        role: updatedUser!.role,
        facultyId: updatedUser!.facultyId,
        majorId: updatedUser!.majorId,
        trackId: updatedUser!.trackId,
        entrySemester: updatedUser!.entrySemester,
        avatarUrl: updatedUser!.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Auth profile update error:", error);
    return NextResponse.json({ success: false, message: "خطا در ویرایش پروفایل" }, { status: 500 });
  }
}
