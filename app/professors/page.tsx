import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { ProfessorDirectory } from "@/components/professors/professor-directory";
import { getProfessors, getFaculties } from "@/lib/db";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "جستجوی اساتید و اعضای هیئت علمی | سامانه انتخاب واحد",
  description: "جستجو و بررسی اساتید دانشکده فنی، دروس ارائه‌شده، سوابق و نظرات دانشجویان",
};

export default async function ProfessorsPage() {
  const [professors, faculties] = await Promise.all([
    getProfessors(),
    getFaculties(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs">در حال بارگذاری اساتید...</span>
            </div>
          }
        >
          <ProfessorDirectory
            initialProfessors={professors}
            initialFaculties={faculties}
          />
        </Suspense>
      </main>
    </div>
  );
}
