import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { OfferingDirectory } from "@/components/offerings/offering-directory";
import { getOfferings, getFaculties } from "@/lib/db";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "جستجوی ارائه‌های درسی و نظرات | سامانه انتخاب واحد",
  description: "جستجوی ارائه‌های دروس، ساعات کلاسی، امتحانات و تبادل تجربیات دانشجویان",
};

export default async function OfferingsPage() {
  const [offerings, faculties] = await Promise.all([
    getOfferings(),
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
              <span className="text-xs">در حال بارگذاری ارائه‌ها...</span>
            </div>
          }
        >
          <OfferingDirectory
            initialOfferings={offerings}
            initialFaculties={faculties}
          />
        </Suspense>
      </main>
    </div>
  );
}
