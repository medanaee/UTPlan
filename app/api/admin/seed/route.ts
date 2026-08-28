import { seedUTECEDemoData } from "@/lib/db";

export async function POST() {
  try {
    const result = await seedUTECEDemoData();
    return Response.json(result);
  } catch (error) {
    console.error("Seed data error:", error);
    return Response.json({ success: false, message: "خطا در بارگذاری داده‌های تستی" }, { status: 500 });
  }
}
