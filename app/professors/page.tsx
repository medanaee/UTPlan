import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { ProfessorDirectory } from "@/components/professors/professor-directory";

export const metadata = {
  title: "جستجوی اساتید و اعضای هیئت علمی | سامانه انتخاب واحد",
  description: "جستجو و بررسی اساتید دانشکده فنی، دروس ارائه‌شده، سوابق و نظرات دانشجویان",
};

export default async function ProfessorsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <Suspense>
          <ProfessorDirectory />
        </Suspense>
      </main>
    </div>
  );
}
