"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Search,
  MapPin,
  Building,
  Navigation,
  ExternalLink,
  Copy,
  Check,
  X,
  Layers,
  ArrowLeft,
  ChevronDown,
  Compass,
  Loader2,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PhysicalFaculty } from "@/lib/types";
import { persianSearch } from "@/lib/search/persian-search";

// Dynamically import Neshan MapLibre component with SSR disabled
const NeshanMapView = dynamic(
  () => import("./neshan-map-view").then((mod) => mod.NeshanMapView),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-muted/10 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-xs font-medium">در حال فراخوانی نقشه تهران و نشان...</span>
      </div>
    ),
  }
);

interface PhysicalFacultyDirectoryProps {
  initialFaculties: PhysicalFaculty[];
}

type CampusFilter = "all" | "amirabad" | "central" | "tehran_other" | "outside_tehran";

export function PhysicalFacultyDirectory({
  initialFaculties = [],
}: PhysicalFacultyDirectoryProps) {
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<PhysicalFaculty | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [activeFilter, setActiveFilter] = useState<CampusFilter>("all");
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showFullListDrawer, setShowFullListDrawer] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter faculties based on campus filter
  const filteredByCampus = useMemo(() => {
    if (activeFilter === "all") return initialFaculties;

    if (activeFilter === "amirabad") {
      return initialFaculties.filter(
        (f) =>
          f.name.includes("فنی") ||
          f.name.includes("مهندسی") ||
          f.name.includes("تربیت بدنی") ||
          f.name.includes("اقتصاد") ||
          f.name.includes("مدیریت") ||
          f.name.includes("ژئوفیزیک") ||
          f.name.includes("بیوشیمی") ||
          (f.address && f.address.includes("امیرآباد")) ||
          (f.address && f.address.includes("کارگر شمالی"))
      );
    }

    if (activeFilter === "central") {
      return initialFaculties.filter(
        (f) =>
          f.name.includes("مرکزی") ||
          f.name.includes("ادبیات") ||
          f.name.includes("علوم پایه") ||
          f.name.includes("حقوق") ||
          f.name.includes("هنرهای زیبا") ||
          (f.address && f.address.includes("انقلاب")) ||
          (f.address && f.address.includes("دانشگاه تهران، خیابان انقلاب"))
      );
    }

    if (activeFilter === "outside_tehran") {
      return initialFaculties.filter(
        (f) =>
          f.name.includes("فومن") ||
          f.name.includes("کاسپین") ||
          f.name.includes("کیش") ||
          f.name.includes("ارس") ||
          f.name.includes("ابوریحان") ||
          f.name.includes("کشاورزی") ||
          (f.address && (f.address.includes("گیلان") || f.address.includes("کرج") || f.address.includes("کیش") || f.address.includes("پاکدشت") || f.address.includes("جلفا")))
      );
    }

    if (activeFilter === "tehran_other") {
      return initialFaculties.filter((f) => {
        const isAmirabad =
          (f.address && (f.address.includes("امیرآباد") || f.address.includes("کارگر شمالی"))) ||
          f.name.includes("فنی");
        const isCentral =
          f.address && (f.address.includes("انقلاب") || f.address.includes("قدس") || f.address.includes("وصال"));
        const isOutside =
          f.name.includes("فومن") ||
          f.name.includes("کاسپین") ||
          f.name.includes("کیش") ||
          f.name.includes("ارس") ||
          f.name.includes("ابوریحان") ||
          f.name.includes("کشاورزی");
        return !isAmirabad && !isCentral && !isOutside;
      });
    }

    return initialFaculties;
  }, [initialFaculties, activeFilter]);

  // Search results for autocomplete dropdown
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return persianSearch(initialFaculties, search).slice(0, 7);
  }, [initialFaculties, search]);

  const handleSelectFaculty = (faculty: PhysicalFaculty) => {
    setSelectedFaculty(faculty);
    if (typeof faculty.longitude === "number" && typeof faculty.latitude === "number") {
      setFlyToCoords([faculty.longitude, faculty.latitude]);
    }
    setSearchFocused(false);
  };

  const handleCopyAddress = (text?: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2500);
  };

  const handlePresetCampus = (campus: CampusFilter) => {
    setActiveFilter(campus);
    if (campus === "amirabad") {
      setFlyToCoords([51.3885, 35.7245]);
    } else if (campus === "central") {
      setFlyToCoords([51.3934, 35.7032]);
    } else if (campus === "all") {
      setFlyToCoords([51.389, 35.715]);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none" dir="rtl">
      {/* 1. Full-screen Interactive Neshan Map */}
      <div className="absolute inset-0 z-0">
        <NeshanMapView
          faculties={filteredByCampus}
          selectedFaculty={selectedFaculty}
          onSelectFaculty={handleSelectFaculty}
          flyToCoords={flyToCoords}
        />
      </div>

      {/* 2. Floating Top Search Bar & Campus Chips Overlay */}
      <div
        ref={searchBoxRef}
        className="absolute top-3 sm:top-4 right-3 left-3 sm:left-auto sm:right-4 z-20 w-auto sm:w-[460px] pointer-events-auto"
      >
        <div className="bg-card/90 dark:bg-zinc-950/90 backdrop-blur-xl border border-border/80 shadow-xl rounded-2xl p-2.5 space-y-2.5 transition-all">
          {/* Search Input Box */}
          <div className="relative flex items-center">
            <Search className="absolute right-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="جستجوی دانشکده، پردیس، کد یا آدرس..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchFocused(true);
              }}
              onFocus={() => setSearchFocused(true)}
              className="h-10 pr-9 pl-9 rounded-xl text-xs sm:text-sm bg-background/80 border-border/60 shadow-2xs focus-visible:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSearchFocused(false);
                }}
                className="absolute left-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick Campus Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] font-medium scrollbar-none">
            <button
              type="button"
              onClick={() => handlePresetCampus("all")}
              className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                activeFilter === "all"
                  ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              همه ({initialFaculties.length})
            </button>

            <button
              type="button"
              onClick={() => handlePresetCampus("amirabad")}
              className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                activeFilter === "amirabad"
                  ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              پردیس ۲ فنی (امیرآباد)
            </button>

            <button
              type="button"
              onClick={() => handlePresetCampus("central")}
              className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                activeFilter === "central"
                  ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              پردیس مرکزی (انقلاب)
            </button>

            <button
              type="button"
              onClick={() => handlePresetCampus("outside_tehran")}
              className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                activeFilter === "outside_tehran"
                  ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              خارج تهران
            </button>
          </div>
        </div>

        {/* Autocomplete Search Dropdown */}
        {searchFocused && search.trim().length > 0 && (
          <div className="mt-2 bg-card/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-2xl overflow-hidden divide-y divide-border/40 max-h-80 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                هیچ دانشکده یا پردیسی با این مشخصات یافت نشد.
              </div>
            ) : (
              searchResults.map((faculty) => (
                <button
                  key={faculty.id}
                  type="button"
                  onClick={() => handleSelectFaculty(faculty)}
                  className="w-full text-right p-3 hover:bg-muted/50 transition-colors flex items-center gap-3 group"
                >
                  <div className="w-10 h-10 rounded-full border border-border/80 bg-background overflow-hidden shrink-0 flex items-center justify-center">
                    {faculty.imageUrl ? (
                      <img
                        src={faculty.imageUrl}
                        alt={faculty.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {faculty.name}
                      </span>
                      {faculty.code && (
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0 bg-muted/60 px-1.5 py-0.5 rounded">
                          {faculty.code}
                        </span>
                      )}
                    </div>
                    {faculty.address && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {faculty.address}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* 3. Floating Quick Action Controls (Top-Left on Desktop / Bottom on Mobile) */}
      <div className="absolute top-4 left-4 z-20 hidden sm:flex items-center gap-2 pointer-events-auto">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowFullListDrawer(!showFullListDrawer)}
          className="h-9 rounded-xl text-xs gap-1.5 shadow-lg bg-card/90 dark:bg-zinc-950/90 backdrop-blur-md border border-border/80 font-bold"
        >
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span>فهرست دانشکده‌ها ({initialFaculties.length})</span>
        </Button>
      </div>

      {/* 4. Desktop Slide-Over Faculty Details Card (Slide from Right) */}
      {selectedFaculty && (
        <div className="hidden md:flex flex-col absolute top-4 right-4 bottom-4 w-96 max-w-[calc(100vw-32px)] z-30 bg-card/95 dark:bg-zinc-950/95 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-3xl overflow-hidden animate-in slide-in-from-right duration-300 pointer-events-auto">
          {/* Header Cover Image */}
          <div className="relative h-44 w-full bg-muted/30 overflow-hidden shrink-0">
            {selectedFaculty.imageUrl ? (
              <img
                src={selectedFaculty.imageUrl}
                alt={selectedFaculty.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2 bg-gradient-to-br from-primary/10 to-primary/5">
                <Building className="h-12 w-12 text-primary/40" />
                <span className="text-xs font-medium text-foreground/70">دانشگاه تهران</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedFaculty(null)}
              className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-colors shadow-md"
              title="بستن پنجره"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Code Badge */}
            {selectedFaculty.code && (
              <div className="absolute top-3 right-3">
                <Badge
                  variant="secondary"
                  className="text-[10px] font-mono shadow-xs backdrop-blur-md bg-background/90"
                >
                  {selectedFaculty.code}
                </Badge>
              </div>
            )}

            {/* Title Overlay */}
            <div className="absolute bottom-3 right-3 left-3 text-white">
              <h2 className="text-base font-extrabold leading-snug drop-shadow-sm">
                {selectedFaculty.name}
              </h2>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-right">
            {/* Address */}
            {selectedFaculty.address && (
              <div className="p-3.5 rounded-2xl border border-border/80 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>نشانی و آدرس دسترسی</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyAddress(selectedFaculty.address)}
                    className="h-6 px-2 text-[10px] gap-1 font-medium text-primary hover:text-primary"
                  >
                    {copiedAddress ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedAddress ? "کپی شد" : "کپی"}</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedFaculty.address}
                </p>
              </div>
            )}

            {/* Description / Departments */}
            {selectedFaculty.description && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  <span>معرفی و دانشکده‌های تابعه</span>
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line bg-card p-3 rounded-2xl border border-border/60">
                  {selectedFaculty.description}
                </p>
              </div>
            )}

            {/* Navigation Apps Quick Routing */}
            {selectedFaculty.latitude && selectedFaculty.longitude && (
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-foreground block">
                  مسیریابی با اپلیکیشن‌ها:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://neshan.org/maps/@${selectedFaculty.latitude},${selectedFaculty.longitude},16z`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-border/80 bg-card hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all flex items-center justify-between text-xs font-bold shadow-2xs group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🗺️</span>
                      <span className="group-hover:text-emerald-600 transition-colors">نشان</span>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-emerald-600" />
                  </a>

                  <a
                    href={`https://balad.ir/location?latitude=${selectedFaculty.latitude}&longitude=${selectedFaculty.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-border/80 bg-card hover:border-sky-500/50 hover:bg-sky-500/5 transition-all flex items-center justify-between text-xs font-bold shadow-2xs group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">📍</span>
                      <span className="group-hover:text-sky-600 transition-colors">بلد</span>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-sky-600" />
                  </a>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedFaculty.latitude},${selectedFaculty.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-border/80 bg-card hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-between text-xs font-bold shadow-2xs group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🌐</span>
                      <span className="group-hover:text-blue-600 transition-colors">گوگل مپ</span>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-blue-600" />
                  </a>

                  <a
                    href={`https://waze.com/ul?ll=${selectedFaculty.latitude},${selectedFaculty.longitude}&navigate=yes`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-border/80 bg-card hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex items-center justify-between text-xs font-bold shadow-2xs group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🚗</span>
                      <span className="group-hover:text-purple-600 transition-colors">ویز</span>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-purple-600" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-3 border-t bg-muted/10 shrink-0">
            <Button asChild className="w-full h-9 rounded-xl text-xs font-bold gap-1.5">
              <Link href={`/physical-faculties/${selectedFaculty.id}`}>
                <span>مشاهده صفحه کامل و اشتراک‌گذاری</span>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* 5. Mobile Slide-Up Bottom Sheet (< md) */}
      {selectedFaculty && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end pointer-events-auto">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedFaculty(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
          />

          {/* Sheet Panel */}
          <div className="relative w-full max-h-[75vh] bg-card/95 dark:bg-zinc-950/95 backdrop-blur-2xl border-t border-border/80 rounded-t-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Grab handle */}
            <div className="w-12 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-1 shrink-0" />

            {/* Header */}
            <div className="p-4 pb-2 border-b border-border/50 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full border border-border/80 overflow-hidden shrink-0 bg-muted/30 flex items-center justify-center">
                  {selectedFaculty.imageUrl ? (
                    <img
                      src={selectedFaculty.imageUrl}
                      alt={selectedFaculty.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground leading-snug">
                    {selectedFaculty.name}
                  </h2>
                  {selectedFaculty.code && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {selectedFaculty.code}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFaculty(null)}
                className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground flex items-center justify-center shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-right text-xs">
              {/* Address */}
              {selectedFaculty.address && (
                <div className="p-3 rounded-2xl border border-border/80 bg-muted/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary" />
                      نشانی:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAddress(selectedFaculty.address)}
                      className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1"
                    >
                      {copiedAddress ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedAddress ? "کپی شد" : "کپی آدرس"}</span>
                    </button>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {selectedFaculty.address}
                  </p>
                </div>
              )}

              {/* Description */}
              {selectedFaculty.description && (
                <p className="text-muted-foreground leading-relaxed p-3 bg-muted/10 rounded-2xl border border-border/40 whitespace-pre-line text-[11px]">
                  {selectedFaculty.description}
                </p>
              )}

              {/* Navigation Apps */}
              {selectedFaculty.latitude && selectedFaculty.longitude && (
                <div className="space-y-1.5 pt-1">
                  <span className="font-bold text-foreground text-[11px] block">
                    مسیریابی مستقیم:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`https://neshan.org/maps/@${selectedFaculty.latitude},${selectedFaculty.longitude},16z`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl border bg-card text-center font-bold text-xs hover:bg-muted flex items-center justify-center gap-1.5"
                    >
                      <span>🗺️ نشان</span>
                    </a>
                    <a
                      href={`https://balad.ir/location?latitude=${selectedFaculty.latitude}&longitude=${selectedFaculty.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl border bg-card text-center font-bold text-xs hover:bg-muted flex items-center justify-center gap-1.5"
                    >
                      <span>📍 بلد</span>
                    </a>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedFaculty.latitude},${selectedFaculty.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl border bg-card text-center font-bold text-xs hover:bg-muted flex items-center justify-center gap-1.5"
                    >
                      <span>🌐 گوگل مپ</span>
                    </a>
                    <a
                      href={`https://waze.com/ul?ll=${selectedFaculty.latitude},${selectedFaculty.longitude}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl border bg-card text-center font-bold text-xs hover:bg-muted flex items-center justify-center gap-1.5"
                    >
                      <span>🚗 ویز</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Button */}
            <div className="p-3 border-t bg-muted/10 shrink-0">
              <Button asChild className="w-full h-9 rounded-xl text-xs font-bold gap-1.5">
                <Link href={`/physical-faculties/${selectedFaculty.id}`}>
                  <span>مشاهده صفحه کامل دانشکده</span>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Full List Modal/Drawer for Desktop and Mobile (When User Clicks "فهرست دانشکده‌ها") */}
      {showFullListDrawer && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 pointer-events-auto">
          <div
            onClick={() => setShowFullListDrawer(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          />
          <div className="relative w-full max-w-2xl max-h-[85vh] bg-card/95 dark:bg-zinc-950/95 backdrop-blur-2xl border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <h3 className="font-extrabold text-sm sm:text-base text-foreground">
                  فهرست کلی پردیس‌ها و دانشکده‌ها ({initialFaculties.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFullListDrawer(false)}
                className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 divide-y divide-border/40">
              {initialFaculties.map((faculty) => (
                <div
                  key={faculty.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-muted/30 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full border border-border/80 overflow-hidden shrink-0 bg-background flex items-center justify-center">
                      {faculty.imageUrl ? (
                        <img
                          src={faculty.imageUrl}
                          alt={faculty.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-foreground block truncate">
                        {faculty.name}
                      </span>
                      {faculty.address && (
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {faculty.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowFullListDrawer(false);
                        handleSelectFaculty(faculty);
                      }}
                      className="h-7 text-[10px] rounded-lg gap-1 font-semibold"
                    >
                      <Compass className="h-3 w-3 text-primary" />
                      <span>روی نقشه</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-7 text-[10px] rounded-lg"
                    >
                      <Link href={`/physical-faculties/${faculty.id}`}>
                        <ArrowLeft className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
