import { NextRequest, NextResponse } from "next/server";
import { getOfferings, getCourses, getProfessors } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;
    const directOnly = searchParams.get("directOnly") !== "false";

    // When exporting offerings for a specific faculty, only export offerings of courses directly belonging to that faculty
    const [offerings, courses, professors] = await Promise.all([
      getOfferings(facultyId ? { facultyId, directOnly } : undefined, directOnly),
      getCourses(facultyId),
      getProfessors(facultyId),
    ]);

    const exportOfferings = facultyId && directOnly
      ? offerings.filter((o) => o.facultyId === facultyId)
      : offerings;

    const courseMap = new Map<string, typeof courses[0]>();
    courses.forEach((c) => courseMap.set(c.id, c));

    const profMap = new Map<string, typeof professors[0]>();
    professors.forEach((p) => profMap.set(p.id, p));

    const exportData = exportOfferings.map((o) => {
      const crs = courseMap.get(o.courseId);

      // Extract all professor codes in order
      const profCodes = (o.professors || [])
        .map((p) => profMap.get(p.id)?.code || p.code)
        .filter(Boolean) as string[];

      const primaryProf = (o.professors || []).find((p) => p.isPrimary) || (o.professors || [])[0];
      const mainProfCode = primaryProf ? (profMap.get(primaryProf.id)?.code || primaryProf.code || "") : "";

      const finalProfCodes = profCodes.length > 0 ? profCodes : (mainProfCode ? [mainProfCode] : []);

      return {
        code: o.code || "",
        courseCode: crs?.code || o.courseCode || "",
        mainProfessor: mainProfCode || (finalProfCodes[0] || ""),
        professors: finalProfCodes,
        description: o.description || undefined,
        finalizedSemesters: o.finalizedSemesters && o.finalizedSemesters.length > 0 ? o.finalizedSemesters : undefined,
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
