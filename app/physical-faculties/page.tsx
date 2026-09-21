import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { PhysicalFacultyDirectory } from "@/components/physical-faculties/physical-faculty-directory";
import { getPhysicalFaculties } from "@/lib/db";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "دانشکده‌ها و پردیس‌های فیزیکی دانشگاه | سامانه برنامه‌ریزی",
  description: "راهنمای نشانی، موقعیت مکانی، نقشه و مشخصات پردیس‌ها و دانشکده‌های فیزیکی دانشگاه تهران",
};

export default async function PhysicalFacultiesPage() {
  const faculties = await getPhysicalFaculties(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs">در حال دریافت لیست پردیس‌ها و دانشکده‌ها...</span>
            </div>
          }
        >
          <PhysicalFacultyDirectory initialFaculties={faculties} />
        </Suspense>
      </main>
    </div>
  );
}
