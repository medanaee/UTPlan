"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Layers,
  Search,
  Building2,
  Users,
  BookOpen,
  Star,
  MessageSquare,
  ArrowLeft,
  Calendar,
  Sparkles,
  Loader2,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CourseOffering, Faculty } from "@/lib/types";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";

interface OfferingDirectoryProps {
  initialOfferings?: CourseOffering[];
  initialFaculties?: Faculty[];
}

export function OfferingDirectory({
  initialOfferings = [],
  initialFaculties = [],
}: OfferingDirectoryProps) {
  const [offerings, setOfferings] = useState<CourseOffering[]>(initialOfferings);
  const [faculties, setFaculties] = useState<Faculty[]>(initialFaculties);
  const [loading, setLoading] = useState(initialOfferings.length === 0);

  const [search, setSearch] = useState("");
  const [selectedFaculty, setSelectedFaculty] = usePersistedState<string>("ut_ece_public_faculty", "all");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [offRes, facRes] = await Promise.all([
          fetch("/api/offerings").then((r) => r.json()),
          fetch("/api/faculties").then((r) => r.json()),
        ]);

        if (offRes.success) setOfferings(offRes.data);
        if (facRes.success) setFaculties(facRes.data);
      } catch (err) {
        console.error("Error loading offerings directory:", err);
      } finally {
        setLoading(false);
      }
    }

    if (initialOfferings.length === 0) {
      loadData();
    }
  }, [initialOfferings.length]);

  const filteredOfferings = useMemo(() => {
    return offerings.filter((o) => {
      const searchLower = search.toLowerCase().trim();
      const profNames =
        o.professors && o.professors.length > 0
          ? o.professors.map((p) => p.name).join(" ")
          : o.professorName || "";

      const matchesSearch =
        searchLower === "" ||
        (o.courseName || "").toLowerCase().includes(searchLower) ||
        (o.courseCode || "").toLowerCase().includes(searchLower) ||
        (o.code || "").toLowerCase().includes(searchLower) ||
        profNames.toLowerCase().includes(searchLower);

      const matchesFaculty =
        selectedFaculty === "all" || o.facultyId === selectedFaculty;

      return matchesSearch && matchesFaculty;
    });
  }, [offerings, search, selectedFaculty]);

  return (
    <div className="space-y-6">
      {/* Header Banner - Flat & Minimal */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-b from-primary/10 via-background to-background p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Layers className="h-3.5 w-3.5" />
            <span>جستجو و بررسی ارائه‌های درسی</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            دایرکتوری ارائه‌ها و تبادل نظر دانشجویان
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            در این بخش می‌توانید ارائه‌های مختلف دروس توسط اساتید دانشکده را جستجو کرده، زمان‌بندی‌های کلاسی را مشاهده کنید و نظرات و تجربیات دانشجویان را درباره هر ارائه بخوانید.
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <Card className="border border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی نام درس، کد درس یا نام استاد..."
                className="pr-9 text-xs h-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute left-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  پاک کردن
                </button>
              )}
            </div>

            {/* Faculty Filter */}
            <div className="w-full md:w-64">
              <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
                <SelectTrigger className="w-full text-xs h-9">
                  <SelectValue placeholder="فیلتر دانشکده" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all" className="text-xs">
                      همه دانشکده‌ها ({offerings.length})
                    </SelectItem>
                    {faculties.map((f) => {
                      const count = offerings.filter((o) => o.facultyId === f.id).length;
                      return (
                        <SelectItem key={f.id} value={f.id} className="text-xs">
                          {f.name} ({count})
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats & Reset */}
          <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs text-muted-foreground">
            <span>
              نمایش <strong className="text-foreground">{filteredOfferings.length}</strong> ارائه از مجموع {offerings.length} ارائه تعریف‌شده
            </span>
            {(search || selectedFaculty !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedFaculty("all");
                }}
                className="h-6 text-[11px] text-primary"
              >
                بازنشانی فیلترها
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Offerings Grid - Flat & Clean Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs">در حال بارگذاری ارائه‌ها...</span>
        </div>
      ) : filteredOfferings.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl border-dashed border-border/80 p-8 space-y-3">
          <Layers className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <h3 className="text-sm font-bold text-foreground">هیچ ارائه‌ای با این مشخصات یافت نشد</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            عبارت جستجو یا فیلتر دانشکده را تغییر دهید تا ارائه‌های مرتبط نمایش داده شوند.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOfferings.map((off) => {
            const profsList =
              off.professors && off.professors.length > 0
                ? off.professors
                : off.professorName
                ? off.professorName.split(" و ").map((name, idx) => ({
                    id: idx === 0 ? off.professorId : `p_${idx}`,
                    name: name.trim(),
                    title: idx === 0 ? off.professorTitle : undefined,
                    avatarUrl: idx === 0 ? off.professorAvatarUrl : undefined,
                    isPrimary: idx === 0,
                  }))
                : [];

            return (
              <Link
                key={off.id}
                href={`/offerings/${off.id}`}
                className="group relative rounded-2xl border border-border/70 bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Header: Course Code & Units */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 bg-muted/60">
                      {off.courseCode || "---"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {off.courseUnits || 3} واحد
                    </Badge>
                  </div>

                  {/* Course Name */}
                  <div>
                    <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-1">
                      {off.courseName}
                    </h3>
                  </div>

                  {/* Professors Grid - 2 Columns */}
                  {profsList.length === 0 ? (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/30 border border-border/50 text-muted-foreground text-xs">
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      <span>استاد تعیین نشده</span>
                    </div>
                  ) : (
                    <div className={profsList.length > 1 ? "grid grid-cols-2 gap-2" : "space-y-1.5"}>
                      {profsList.map((p, pIdx) => {
                        const isLastOdd =
                          profsList.length % 2 !== 0 &&
                          pIdx === profsList.length - 1 &&
                          profsList.length > 1;

                        return (
                          <div
                            key={p.id || pIdx}
                            className={`flex items-center gap-2 p-2 rounded-xl bg-muted/30 border border-border/50 group-hover:border-primary/20 transition-colors ${
                              isLastOdd ? "col-span-2" : ""
                            }`}
                          >
                            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                              {p.avatarUrl ? (
                                <img
                                  src={p.avatarUrl}
                                  alt={p.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>{p.name?.[0] || "ا"}</span>
                              )}
                            </div>
                            <div className="truncate flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-xs truncate text-foreground">
                                  {p.name}
                                </span>
                                {p.isPrimary && profsList.length > 1 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 font-normal text-primary border-primary/30 bg-primary/5 shrink-0"
                                  >
                                    اصلی
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground block truncate">
                                {p.title || "استاد مدرس"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Card Footer: Action & Review indicator */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-primary font-semibold">
                  <span className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    مشاهده صفحه ارائه و نظرات
                  </span>
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
