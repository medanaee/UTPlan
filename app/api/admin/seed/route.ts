import { seedDevData } from "@/lib/db";

export async function POST() {
  try {
    await seedDevData();
    return Response.json({
      success: true,
      message: "داده‌های نمونه جامع دانشگاهی (دانشکده‌ها، رشته‌ها، گرایش‌ها، دروس، اساتید، ارائه‌ها و رویدادها) در محیط دولوپ بارگذاری شدند.",
    });
  } catch (error) {
    console.error("Seed error:", error);
    return Response.json(
      { success: false, message: "خطا در بارگذاری داده‌های نمونه" },
      { status: 500 }
    );
  }
}
