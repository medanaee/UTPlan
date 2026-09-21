"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Building,
  Navigation,
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  Share2,
  Compass,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { PhysicalFaculty } from "@/lib/types";

interface PhysicalFacultyDetailViewProps {
  faculty: PhysicalFaculty;
}

export function PhysicalFacultyDetailView({ faculty }: PhysicalFacultyDetailViewProps) {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const hasCoordinates =
    faculty.latitude !== null &&
    faculty.latitude !== undefined &&
    faculty.longitude !== null &&
    faculty.longitude !== undefined;

  const lat = faculty.latitude || 0;
  const lon = faculty.longitude || 0;

  const handleCopyAddress = () => {
    if (!faculty.address) return;
    navigator.clipboard.writeText(faculty.address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2500);
  };

  const handleCopyShareLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Breadcrumb & Navigation Back */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            سامانه
          </Link>
          <span>/</span>
          <Link href="/physical-faculties" className="hover:text-foreground transition-colors">
            دانشکده‌های فیزیکی
          </Link>
          <span>/</span>
          <span className="text-foreground font-semibold truncate max-w-[200px] sm:max-w-none">
            {faculty.name}
          </span>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyShareLink}
            className="h-8 text-xs gap-1.5 shadow-2xs font-semibold"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
            <span>{copiedLink ? "لینک کپی شد" : "اشتراک‌گذاری"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 text-xs gap-1"
          >
            <Link href="/physical-faculties">
              <ArrowRight className="h-3.5 w-3.5" />
              <span>بازگشت به فهرست</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
        {/* Cover Photo */}
        <div className="relative h-64 sm:h-80 w-full bg-muted/40 overflow-hidden">
          {faculty.imageUrl ? (
            <img
              src={faculty.imageUrl}
              alt={faculty.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-3">
              <Building className="h-16 w-16" />
              <span className="text-sm font-medium">تصویر نمای ساختمان ثبت نشده است</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

          {/* Code Badge */}
          {faculty.code && (
            <div className="absolute top-4 left-4">
              <Badge
                variant="secondary"
                className="text-xs font-mono px-3 py-1 shadow-sm backdrop-blur bg-background/90"
              >
                کد: {faculty.code}
              </Badge>
            </div>
          )}

          {/* Bottom Title Overlay */}
          <div className="absolute bottom-6 right-6 left-6 space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/90 text-primary-foreground px-3 py-0.5 text-xs font-medium shadow-xs">
              <Building className="h-3.5 w-3.5" />
              <span>پردیس / ساختمان فیزیکی</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              {faculty.name}
            </h1>
          </div>
        </div>

        {(faculty.address || faculty.description) && (<div className="p-3 sm:p-3 space-y-6">
          {/* Address Block */}
          {faculty.address && (
            <div className="p-4 rounded-2xl border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-muted-foreground">نشانی و آدرس دسترسی:</span>
                  <p className="text-sm font-bold text-foreground leading-relaxed">
                    {faculty.address}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyAddress}
                className="h-8 text-xs gap-1.5 shrink-0 shadow-2xs font-semibold"
              >
                {copiedAddress ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedAddress ? "کپی شد" : "کپی نشانی"}</span>
              </Button>
            </div>
          )}

          {/* Description Block */}
          {faculty.description && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span>مشخصات، آزمایشگاه‌ها و امکانات پردیس</span>
              </h2>
              <div className="p-5 rounded-2xl border bg-card text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {faculty.description}
              </div>
            </div>
          )}
        </div>)}
        {/* Info Grid */}

      </div>

      {/* Map & Navigation Apps Section */}
      {hasCoordinates && (
        <Card className="rounded-3xl border-border/80 shadow-xs overflow-hidden">
          <CardHeader className="border-b bg-muted/10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Compass className="h-5 w-5 text-primary" />
                  <span>موقعیت مکانی روی نقشه و مسیریابی مستقیم</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  مختصات ثبت‌شده: {lat.toFixed(6)}, {lon.toFixed(6)}
                </p>
              </div>

              <Badge variant="outline" className="font-mono text-xs px-2.5 py-1">
                GPS: {lat.toFixed(4)}, {lon.toFixed(4)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Embedded OpenStreetMap */}
            <div className="h-80 sm:h-96 w-full rounded-2xl overflow-hidden border shadow-inner bg-background relative">
              <iframe
                title={`نقشه ${faculty.name}`}
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.007}%2C${lat - 0.004}%2C${lon + 0.007}%2C${lat + 0.004}&layer=mapnik&marker=${lat}%2C${lon}`}
                className="w-full h-full"
              />
            </div>

            {/* Direct Navigation Buttons */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-foreground block">
                مسیریابی سریع با اپلیکیشن‌های نقشه:
              </span>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Neshan */}
                <a
                  href={`https://neshan.org/maps/@${lat},${lon},16z`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl border border-border/80 bg-card hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all flex items-center justify-between shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">🗺️</span>
                    <div>
                      <span className="text-xs font-bold text-foreground block group-hover:text-emerald-600 transition-colors">
                        نشان (Neshan)
                      </span>
                      <span className="text-[10px] text-muted-foreground">مسیریابی در نقشه نشان</span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 transition-colors" />
                </a>

                {/* Balad */}
                <a
                  href={`https://balad.ir/location?latitude=${lat}&longitude=${lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl border border-border/80 bg-card hover:border-sky-500/50 hover:bg-sky-500/5 transition-all flex items-center justify-between shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">📍</span>
                    <div>
                      <span className="text-xs font-bold text-foreground block group-hover:text-sky-600 transition-colors">
                        بلد (Balad)
                      </span>
                      <span className="text-[10px] text-muted-foreground">مسیریابی در نقشه بلد</span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-sky-600 transition-colors" />
                </a>

                {/* Google Maps */}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl border border-border/80 bg-card hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-between shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">🌐</span>
                    <div>
                      <span className="text-xs font-bold text-foreground block group-hover:text-blue-600 transition-colors">
                        گوگل مپس (Google Maps)
                      </span>
                      <span className="text-[10px] text-muted-foreground">مسیریابی در گوگل مپ</span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                </a>

                {/* Waze */}
                <a
                  href={`https://waze.com/ul?ll=${lat},${lon}&navigate=yes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl border border-border/80 bg-card hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex items-center justify-between shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">🚗</span>
                    <div>
                      <span className="text-xs font-bold text-foreground block group-hover:text-purple-600 transition-colors">
                        ویز (Waze)
                      </span>
                      <span className="text-[10px] text-muted-foreground">مسیریابی خودرویی با ویز</span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 transition-colors" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
