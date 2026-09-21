import type { Metadata } from "next";
import "./fonts/vazir.css";
import "./fonts/kalameh.css";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { DirectionProvider } from "@/components/ui/direction"


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
      suppressHydrationWarning
      className={cn("font-sans", inter.variable)}
    >
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <ThemeProvider defaultTheme="system">
          <DirectionProvider dir="rtl">{children}</DirectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
