import { NextRequest, NextResponse } from "next/server";
import { getOfferings, getCourses, getProfessors } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;

    const [offerings, courses, professors] = await Promise.all([
      getOfferings(facultyId),
      getCourses(facultyId),
      getProfessors(facultyId),
    ]);

    const courseMap = new Map<string, typeof courses[0]>();
    courses.forEach((c) => courseMap.set(c.id, c));

    const profMap = new Map<string, typeof professors[0]>();
    professors.forEach((p) => profMap.set(p.id, p));

    const exportData = offerings.map((o) => {
      const crs = courseMap.get(o.courseId);
      const offeringProfs = (o.professors || []).map((p) => {
        const fullProf = profMap.get(p.id);
        return {
          professorCode: fullProf?.code || p.code || undefined,
          professorName: fullProf?.name || p.name || "",
          professorEmail: fullProf?.email || p.email || undefined,
        };
      });

      const primaryProf = offeringProfs[0];

      return {
        code: o.code || undefined,
        courseCode: crs?.code || o.courseCode || "",
        courseName: crs?.name || o.courseName || "",
        description: o.description || undefined,
        // Array of professors (supporting co-teaching)
        professors: offeringProfs,
        // Legacy single-professor fields for convenience
        professorCode: primaryProf?.professorCode || undefined,
        professorName: o.professorName || primaryProf?.professorName || "",
        professorEmail: primaryProf?.professorEmail || undefined,
      };
    });

    return NextResponse.json({
      success: true,
      count: exportData.length,
      data: exportData,
    });
  } catch (error: any) {
    console.error("Offerings Export error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در دریافت خروجی ارائه‌های درسی" },
      { status: 500 }
    );
  }
}
