"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Trash2,
  RotateCcw,
  Search,
  RefreshCw,
  BookOpen,
  Users,
  BookUser,
  CalendarDays,
  Layers,
  AlertCircle,
  Clock,
  Sparkles,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { TrashItem } from "@/app/api/admin/trash/route";
import { DependencyResolutionDialog } from "./dependency-resolution-dialog";

interface RecycleBinManagerProps {
  onDataChanged?: () => void;
  selectedFacultyId?: string;
}

export function RecycleBinManager({ onDataChanged, selectedFacultyId }: RecycleBinManagerProps) {
  const [activeTab, setActiveTab] = useState<"all" | "course" | "professor" | "offering" | "event">("all");
  const [items, setItems] = useState<TrashItem[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    course: 0,
    professor: 0,
    offering: 0,
    event: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Selected item for permanent delete wizard
  const [selectedItemForDelete, setSelectedItemForDelete] = useState<TrashItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchTrashItems = async () => {
    try {
      setLoading(true);
      const url = `/api/admin/trash?type=${activeTab}${selectedFacultyId ? `&facultyId=${selectedFacultyId}` : ""}`;
      const res = await fetch(url).then((r) => r.json());
      if (res.success && res.data) {
        setItems(res.data.items || []);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      }
    } catch (err) {
      console.error("Fetch trash error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrashItems();
  }, [activeTab, selectedFacultyId]);

  const handleRestore = async (item: TrashItem) => {
    try {
      setRestoringId(item.id);
      setActionSuccessMessage(null);

      const res = await fetch("/api/admin/trash/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: item.type,
          id: item.id,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setActionSuccessMessage(res.message || "آیتم با موفقیت بازیابی شد.");
        await fetchTrashItems();
        if (onDataChanged) onDataChanged();
      } else {
        alert(res.message || "خطا در بازیابی");
      }
    } catch (err: any) {
      alert("خطا در برقراری ارتباط با سرور: " + (err?.message || "نامشخص"));
    } finally {
      setRestoringId(null);
    }
  };

  const handleOpenPermanentDelete = (item: TrashItem) => {
    setSelectedItemForDelete(item);
    setIsDeleteModalOpen(true);
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.trim().toLowerCase();
    return items.filter((it) => {
      const matchTitle = it.title.toLowerCase().includes(q);
      const matchCode = it.code?.toLowerCase().includes(q);
      const matchDetails = it.details?.toLowerCase().includes(q);
      const matchFaculty = it.facultyName?.toLowerCase().includes(q);
      return matchTitle || matchCode || matchDetails || matchFaculty;
    });
  }, [items, searchQuery]);

  const getEntityIcon = (type: TrashItem["type"]) => {
    switch (type) {
      case "course":
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      case "professor":
        return <Users className="h-4 w-4 text-purple-500" />;
      case "offering":
        return <BookUser className="h-4 w-4 text-emerald-500" />;
      case "event":
        return <CalendarDays className="h-4 w-4 text-amber-500" />;
    }
  };

  const getEntityLabel = (type: TrashItem["type"]) => {
    switch (type) {
      case "course":
        return "درس";
      case "professor":
        return "استاد";
      case "offering":
        return "ارائه";
      case "event":
        return "رویداد";
    }
  };

  const formatPersianDate = (isoString?: string) => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Message */}
      {actionSuccessMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                <span>سطل بازیافت و حذف نهایی (Recycle Bin)</span>
              </CardTitle>
              <CardDescription className="text-xs pt-1">
                مشاهده اقلام حذف‌شده موقت، امکان بازگردانی سریع به حالت فعال یا حذف نهایی فیزیکی به همراه مدیریت زنجیره‌ای وابستگی‌ها
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchTrashItems}
              disabled={loading}
              className="h-8 text-xs gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>به‌روزرسانی لیست</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Filter Tabs and Search Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-muted/30 border">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === "all"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>همه موارد</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-mono">
                  {counts.all}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("course")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === "course"
                    ? "bg-background text-primary shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                <span>دروس</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-mono">
                  {counts.course}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("professor")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === "professor"
                    ? "bg-background text-primary shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5 text-purple-500" />
                <span>اساتید</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-mono">
                  {counts.professor}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("offering")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === "offering"
                    ? "bg-background text-primary shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BookUser className="h-3.5 w-3.5 text-emerald-500" />
                <span>ارائه‌ها</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-mono">
                  {counts.offering}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("event")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === "event"
                    ? "bg-background text-primary shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5 text-amber-500" />
                <span>رویدادها</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-mono">
                  {counts.event}
                </Badge>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative max-w-sm w-full">
              <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="جستجو بر اساس نام، کد یا جزئیات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-8 h-8 text-xs bg-background"
              />
            </div>
          </div>

          {/* Items Table / List */}
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
              <span>در حال بارگذاری لیست سطل بازیافت...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10 space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto text-muted-foreground">
                <Trash2 className="h-6 w-6" />
              </div>
              <h4 className="text-xs font-bold text-foreground">هیچ آیتم حذف‌شده‌ای یافت نشد</h4>
              <p className="text-[11px] text-muted-foreground">
                سطل بازیافت برای فیلتر انتخابی کاملاً پاک و خالی است.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold">
                      <th className="p-3 w-16 text-center">نوع</th>
                      <th className="p-3">عنوان و نام موجودیت</th>
                      <th className="p-3">کد شناسایی</th>
                      <th className="p-3">جزئیات و مشخصات</th>
                      <th className="p-3">دانشکده</th>
                      <th className="p-3">تاریخ و ساعت حذف</th>
                      <th className="p-3 text-center w-52">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 bg-card">
                    {filteredItems.map((item) => (
                      <tr key={`${item.type}_${item.id}`} className="hover:bg-muted/20 transition-colors">
                        {/* Type Icon */}
                        <td className="p-3 text-center">
                          <div
                            className="inline-flex p-1.5 rounded-lg bg-muted/60"
                            title={getEntityLabel(item.type)}
                          >
                            {getEntityIcon(item.type)}
                          </div>
                        </td>

                        {/* Title */}
                        <td className="p-3">
                          <span className="font-bold text-foreground block truncate max-w-xs">
                            {item.title}
                          </span>
                        </td>

                        {/* Code */}
                        <td className="p-3">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {item.code || "ندارد"}
                          </Badge>
                        </td>

                        {/* Details */}
                        <td className="p-3 text-muted-foreground text-[11px]">
                          {item.details || "-"}
                        </td>

                        {/* Faculty */}
                        <td className="p-3 text-muted-foreground text-[11px]">
                          {item.facultyName ? (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-muted-foreground/70" />
                              {item.facultyName}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>

                        {/* Deleted Date */}
                        <td className="p-3 text-muted-foreground text-[11px]" dir="ltr">
                          <div className="flex items-center gap-1 justify-end">
                            <span>{formatPersianDate(item.deletedAt)}</span>
                            <Clock className="h-3 w-3 text-muted-foreground/60" />
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Restore Button */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestore(item)}
                              disabled={restoringId === item.id}
                              className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shadow-2xs font-medium"
                              title="بازیابی و بازگردانی به لیست فعال"
                            >
                              <RotateCcw className={`h-3 w-3 ${restoringId === item.id ? "animate-spin" : ""}`} />
                              <span>بازیابی</span>
                            </Button>

                            {/* Permanent Delete Button */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenPermanentDelete(item)}
                              className="h-7 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 shadow-2xs font-medium"
                              title="حذف قطعی فیزیکی با بررسی وابستگی‌ها"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>حذف دائمی</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cascading Dependency Resolution Wizard Dialog */}
      <DependencyResolutionDialog
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        item={selectedItemForDelete}
        onSuccess={async () => {
          setActionSuccessMessage("موجودیت با موفقیت به همراه تمام وابستگی‌های تعیین‌شده حذف فیزیکی گردید.");
          await fetchTrashItems();
          if (onDataChanged) onDataChanged();
        }}
      />
    </div>
  );
}
