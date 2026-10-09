import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { OfferingDirectory } from "@/components/offerings/offering-directory";

export const metadata = {
  title: "جستجوی ارائه‌های درسی و نظرات | سامانه انتخاب واحد",
  description: "جستجوی ارائه‌های دروس، ساعات کلاسی، امتحانات و تبادل تجربیات دانشجویان",
};

export default async function OfferingsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <Suspense>
          <OfferingDirectory />
        </Suspense>
      </main>
    </div>
  );
}
