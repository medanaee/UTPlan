import { apiResponseJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { getProfessors } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;
    const directOnly = searchParams.get("directOnly") !== "false";

    // When exporting professors for a specific faculty, only export professors directly belonging to that faculty
    const professors = await getProfessors(facultyId, directOnly);
    const exportProfessors = facultyId && directOnly ? professors.filter((p) => p.facultyId === facultyId) : professors;

    // Format clean JSON schema without internal database artifacts
    const exportData = exportProfessors.map((p) => {
      const fName = p.firstName || "";
      const lName = p.lastName || "";
      return {
        code: p.code || undefined,
        firstName: fName || p.name || "",
        lastName: lName || "",
        title: p.title || "استاد تمام",
        email: p.email || "",
        links: p.links || {},
      };
    });

    return apiResponseJson({
      success: true,
      count: exportData.length,
      data: exportData,
    });
  } catch (error: any) {
    console.error("Professors Export error:", error);
    return apiResponseJson(
      { success: false, message: "خطا در خروجی گرفتن از اطلاعات اساتید" },
      { status: 500 }
    );
  }
}
