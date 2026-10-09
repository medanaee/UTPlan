"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Building2,
  Star,
  ArrowLeft,
  Loader2,
  Mail,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Professor } from "@/lib/types";
import { fetchJson } from "@/lib/api-client";

interface ProfessorDirectoryProps {
  initialProfessors?: Professor[];
}

export function ProfessorDirectory({
  initialProfessors = [],
}: ProfessorDirectoryProps) {
  const [professors, setProfessors] = useState<Professor[]>(initialProfessors);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [search, setSearch] = useState("");

  useEffect(() => {
    const query = search.trim();
    if (query.length < 3) {
      setProfessors([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        const response = await fetchJson<{ success?: boolean; data?: Professor[] }>(
          `/api/professors?q=${encodeURIComponent(query)}&limit=20`,
          { signal: controller.signal }
        );
        setProfessors(response.success ? response.data || [] : []);
        setHasSearched(true);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Error searching professors:", err);
          setProfessors([]);
          setHasSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  const filteredProfessors = professors;

  return (
    <div className="space-y-6">
      {/* Header Banner with Centered Hero Search */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-b from-primary/10 via-primary/5 to-background/50 p-6 sm:p-10 shadow-xs text-center">
        {/* Subtle decorative glow circle in the background */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-2.5">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
            جستجو و بررسی مشخصات اساتید
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            مشخصات اساتید دانشکده فنی، دروس ارائه‌شده، سوابق علمی و نظرات و امتیازات دانشجویان را مشاهده و بررسی نمایید.
          </p>
        </div>

        {/* Centered Translucent Search Box with Soft Glow */}
        <div className="relative z-10 max-w-2xl mx-auto mt-6">
          <div className="group relative flex items-center w-full rounded-2xl border border-border/80 bg-background/60 backdrop-blur-md shadow-xs transition-all duration-300 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/15 focus-within:shadow-[0_0_30px_rgba(59,130,246,0.18)] dark:focus-within:shadow-[0_0_35px_rgba(59,130,246,0.25)]">
            <Search className="h-5 w-5 text-muted-foreground mr-3.5 ml-1.5 shrink-0 transition-colors group-focus-within:text-primary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام یا مرتبه علمی استاد..."
              className="w-full bg-transparent py-3 pr-1 pl-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />

            {/* Clear Search Button */}
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 ml-1.5 cursor-pointer"
                title="پاک کردن متن جستجو"
              >
                <X className="h-4 w-4" />
              </button>
            )}
              </div>
        </div>
      </div>

      {/* Result stats & Reset */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-2 pt-0.5">
        <span>
          {hasSearched && (<>نمایش <strong className="text-foreground">{filteredProfessors.length}</strong> پیشنهاد استاد</>)}
        </span>
        {search && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
            }}
            className="h-6 text-[11px] text-primary hover:bg-primary/10 rounded-md cursor-pointer"
          >
            بازنشانی همه فیلترها و جستجو
          </Button>
        )}
      </div>

      {/* Professors Grid */}
      {!search.trim() || search.trim().length < 3 ? (
        <div className="text-center py-16 border rounded-2xl border-dashed border-border/80 p-8 space-y-3">
          <Search className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <h3 className="text-sm font-bold text-foreground">برای شروع نام استاد را جست‌وجو کنید</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            حداقل سه حرف از نام، نام خانوادگی یا کد استاد را وارد کنید.
          </p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs">در حال بارگذاری اساتید...</span>
        </div>
      ) : filteredProfessors.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl border-dashed border-border/80 p-8 space-y-3">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <h3 className="text-sm font-bold text-foreground">استادی با این مشخصات یافت نشد</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            عبارت جستجو یا فیلتر دانشکده را تغییر دهید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfessors.map((prof) => {
            return (
              <Link
                key={prof.id}
                href={`/professors/${prof.id}`}
                className="group relative rounded-2xl border border-border/70 bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Top Bar: Avatar + Details */}
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20 overflow-hidden">
                      {prof.avatarUrl ? (
                        <img
                          src={prof.avatarUrl}
                          alt={prof.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{prof.name[0] || "ا"}</span>
                      )}
                    </div>
                    <div className="truncate flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                          {prof.name}
                        </h3>
                        {prof.code && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono h-4 font-normal text-muted-foreground shrink-0">
                            {prof.code}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground block truncate">
                        {prof.title || "استاد تمام"}
                      </span>
                    </div>
                  </div>

                  {/* Faculty & Email */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5 truncate">
                      <Building2 className="h-3.5 w-3.5 text-primary shrink-0 opacity-60" />
                      <span className="truncate">{prof.facultyName || "دانشکده مهندسی برق و کامپیوتر"}</span>
                    </p>
                    {prof.email && (
                      <p className="flex items-center gap-1.5  text-[11px] truncate">
                        <Mail className="h-3 w-3 text-muted-foreground shrink-0 opacity-60" />
                        <span className="truncate">{prof.email}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer: Action */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-primary font-semibold">
                  <span className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    مشاهده پروفایل، دروس و نظرات
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
