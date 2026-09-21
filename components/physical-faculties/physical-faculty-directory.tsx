"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Building,
  Navigation,
  ExternalLink,
  Compass,
  ArrowLeft,
  Share2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PhysicalFaculty } from "@/lib/types";
import { persianSearch } from "@/lib/search/persian-search";

interface PhysicalFacultyDirectoryProps {
  initialFaculties: PhysicalFaculty[];
}

export function PhysicalFacultyDirectory({
  initialFaculties = [],
}: PhysicalFacultyDirectoryProps) {
  const [search, setSearch] = useState("");
  const [onlyWithMap, setOnlyWithMap] = useState(false);

  const filteredFaculties = useMemo(() => {
    let list = initialFaculties;
    if (onlyWithMap) {
      list = list.filter(
        (f) =>
          f.latitude !== null &&
          f.latitude !== undefined &&
          f.longitude !== null &&
          f.longitude !== undefined
      );
    }

    if (!search.trim()) return list;
    return persianSearch(list, search);
  }, [initialFaculties, search, onlyWithMap]);

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header section */}
      <div className="space-y-4 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary shadow-2xs">
          <MapPin className="h-3.5 w-3.5" />
          <span>پردیس‌ها و دانشکده‌های فیزیکی دانشگاه</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          راهنمای موقعیت مکانی و نقشه دانشکده‌ها
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          مشاهده اطلاعات پردیس‌ها، آدرس متنی، موقعیت دقیق ماهواره‌ای روی نقشه و مسیریابی مستقیم با نشان، بلد، گوگل‌مپ و ویز
        </p>

        {/* Search Bar */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5 max-w-xl mx-auto">
          <div className="relative w-full">
            <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="جستجوی نام دانشکده، پردیس، کد یا آدرس..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pr-10 pl-4 rounded-xl text-xs sm:text-sm bg-card border-border/80 shadow-2xs"
            />
          </div>

          <Button
            type="button"
            variant={onlyWithMap ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyWithMap(!onlyWithMap)}
            className="h-10 text-xs shrink-0 rounded-xl gap-1.5 shadow-2xs font-semibold"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>فقط دارای نقشه</span>
          </Button>
        </div>

        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground pt-1">
          <span>{initialFaculties.length} پردیس و دانشکده ثبت‌شده</span>
          <span>•</span>
          <span>{filteredFaculties.length} مورد منطبق با جستجو</span>
        </div>
      </div>

      {/* Grid of faculties */}
      {filteredFaculties.length === 0 ? (
        <div className="py-20 text-center rounded-3xl border border-dashed border-border/80 bg-muted/10 space-y-3 max-w-lg mx-auto">
          <Building className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-foreground">هیچ پردیس یا دانشکده‌ای یافت نشد</h3>
            <p className="text-xs text-muted-foreground">
              عبارت جستجو را تغییر دهید یا فیلتر «فقط دارای نقشه» را غیرفعال کنید.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFaculties.map((faculty) => {
            const hasCoords =
              faculty.latitude !== null &&
              faculty.latitude !== undefined &&
              faculty.longitude !== null &&
              faculty.longitude !== undefined;

            return (
              <div
                key={faculty.id}
                className="group rounded-2xl border border-border/70 bg-card overflow-hidden shadow-2xs hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Photo / Banner */}
                  <Link href={`/physical-faculties/${faculty.id}`} className="block relative h-48 w-full bg-muted/40 overflow-hidden">
                    {faculty.imageUrl ? (
                      <img
                        src={faculty.imageUrl}
                        alt={faculty.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                        <Building className="h-10 w-10" />
                        <span className="text-xs font-medium">تصویر ثبت نشده است</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                    {/* Code badge */}
                    {faculty.code && (
                      <div className="absolute top-3 left-3">
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-mono shadow-xs backdrop-blur bg-background/90"
                        >
                          {faculty.code}
                        </Badge>
                      </div>
                    )}

                    {/* Coordinates pill */}
                    {hasCoords && (
                      <div className="absolute bottom-3 right-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-background/90 backdrop-blur text-foreground font-mono gap-1 shadow-xs"
                        >
                          <Navigation className="h-3 w-3 text-primary" />
                          <span>دارای موقعیت نقشه</span>
                        </Badge>
                      </div>
                    )}
                  </Link>

                  {/* Content Info */}
                  <div className="p-5 space-y-3">
                    <Link href={`/physical-faculties/${faculty.id}`}>
                      <h2 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {faculty.name}
                      </h2>
                    </Link>

                    {faculty.address ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex items-start gap-1.5">
                        <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                        <span>{faculty.address}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic">
                        آدرس متنی برای این پردیس وارد نشده است.
                      </p>
                    )}

                    {faculty.description && (
                      <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed">
                        {faculty.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t bg-muted/10 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="text-xs text-primary hover:text-primary gap-1 font-bold group-hover:translate-x-[-2px] transition-transform"
                  >
                    <Link href={`/physical-faculties/${faculty.id}`}>
                      <span>مشاهده نقشه و جزئیات</span>
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                  </Button>

                  {hasCoords && (
                    <div className="flex items-center gap-1">
                      <a
                        href={`https://neshan.org/maps/@${faculty.latitude},${faculty.longitude},16z`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] px-2 py-1 rounded-md border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium"
                        title="مسیریابی در نشان"
                      >
                        نشان
                      </a>
                      <a
                        href={`https://balad.ir/location?latitude=${faculty.latitude}&longitude=${faculty.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] px-2 py-1 rounded-md border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium"
                        title="مسیریابی در بلد"
                      >
                        بلد
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
