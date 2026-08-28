import type { Metadata } from "next";
import "./globals.css";
import { Inter, Vazirmatn } from "next/font/google";
import { cn } from "@/lib/utils";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "سامانه جامع انتخاب واحد و مدیریت چارت درسی | دانشکده فنی",
  description: "سامانه هوشمند مدیریت چارت تحصیلی، پایش تداخلات کلاسی و امتحانی و نظرات اساتید",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={cn("font-sans", vazirmatn.variable, inter.variable)}
    >
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
