"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  Edit,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Copy,
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Faculty, Major, Track, Course, StudentChart } from "@/lib/types";

interface ApprovedChartsManagerProps {
  faculties: Faculty[];
  majors: Major[];
  tracks: Track[];
  courses: Course[];
  selectedTrackId: string;
}

export function ApprovedChartsManager({
  faculties,
  majors,
  tracks,
  courses,
  selectedTrackId,
}: ApprovedChartsManagerProps) {
  const [allApprovedCharts, setAllApprovedCharts] = useState<StudentChart[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [sourceChartIdToClone, setSourceChartIdToClone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const currentTrack = tracks.find((t) => t.id === selectedTrackId);
  const trackApprovedCharts = allApprovedCharts.filter(
    (c) => c.trackId === selectedTrackId && c.isApprovedDefault
  );
  const currentApprovedChart = trackApprovedCharts[0];

  const cloneOptions = useMemo(
    () =>
      allApprovedCharts.map((c) => {
        const trk = tracks.find((t) => t.id === c.trackId);
        return {
          value: c.id,
          label: `${c.title} (${trk?.name || "گرایش"})`,
        };
      }),
    [allApprovedCharts, tracks]
  );

  // Load all approved charts
  const loadApprovedCharts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/charts");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const approved = json.data.filter((c: StudentChart) => c.isApprovedDefault);
        setAllApprovedCharts(approved);
      }
    } catch (e) {
      console.error("Error loading approved charts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovedCharts();
  }, []);

  // Create new approved chart for the selected track
  const handleCreateApprovedChart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackId) return;

    setIsSubmitting(true);
    try {
      const defaultTitle = newTitle.trim() || `چارت مصوب ${currentTrack?.name || "گرایش"}`;
      const res = await fetch("/api/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: selectedTrackId,
          title: defaultTitle,
          isApprovedDefault: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage("چارت مصوب رسمی با موفقیت ایجاد شد.");
        setCreateModalOpen(false);
        setNewTitle("");
        await loadApprovedCharts();
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        alert(data.message || "خطا در ایجاد چارت");
      }
    } catch (e) {
      alert("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clone from another approved chart
  const handleCloneApprovedChart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackId || !sourceChartIdToClone) return;

    setIsSubmitting(true);
    try {
      const defaultTitle = newTitle.trim() || `چارت مصوب ${currentTrack?.name || "گرایش"}`;
      const res = await fetch("/api/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: selectedTrackId,
          title: defaultTitle,
          cloneFromId: sourceChartIdToClone,
          isApprovedDefault: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage("چارت مصوب با موفقیت کپی و ایجاد شد.");
        setCloneModalOpen(false);
        setNewTitle("");
        setSourceChartIdToClone("");
        await loadApprovedCharts();
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        alert(data.message || "خطا در کپی چارت");
      }
    } catch (e) {
      alert("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete an approved chart
  const handleDeleteChart = async (chartId: string) => {
    if (!confirm("آیا از حذف این چارت مصوب اطمینان دارید؟")) return;

    try {
      const res = await fetch(`/api/charts?id=${chartId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setActionMessage("چارت مصوب با موفقیت حذف شد.");
        await loadApprovedCharts();
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        alert(data.message || "خطا در حذف چارت");
      }
    } catch (e) {
      alert("خطا در برقراری ارتباط با سرور");
    }
  };

  // Set a chart as the single primary approved chart for this track
  const handleSetPrimary = async (chartId: string) => {
    try {
      const res = await fetch("/api/charts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chartId, action: "set_primary" }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message || "چارت مصوب اصلی گرایش تعیین شد.");
        await loadApprovedCharts();
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        alert(data.message || "خطا در تنظیم چارت مصوب");
      }
    } catch {
      alert("خطا در برقراری ارتباط با سرور");
    }
  };

  // Helper to calculate total credits and courses in a chart
  const getChartStats = (chart: StudentChart) => {
    let totalCredits = 0;
    let totalCourses = 0;
    chart.semesters.forEach((sem) => {
      totalCourses += sem.courseIds.length;
      sem.courseIds.forEach((cId) => {
        const c = courses.find((course) => course.id === cId);
        if (c) totalCredits += c.units;
      });
    });
    return { totalCredits, totalCourses, semestersCount: chart.semesters.length };
  };

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {actionMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Standard Active Track Header Banner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">گرایش انتخابی:</span>
                {currentTrack ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="default" className="text-xs px-2.5 py-0.5 font-bold shadow-xs">
                      {currentTrack.name}
                    </Badge>  
                  </div>
                ) : (
                  <Badge variant="outline" className="text-xs px-2.5 py-0.5 text-destructive border-destructive/40">
                    گرایشی در بخش ساختار دانشگاه انتخاب نشده است
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                چارت‌های رسمی و سرفصل‌های مصوب برای دانشجویان این گرایش مدیریت و بارگذاری می‌شوند.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadApprovedCharts}
              disabled={loading}
              className="h-8 gap-1.5 text-xs bg-background shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              به‌روزرسانی
            </Button>
          </div>
        </div>
      </div>

      {/* Current Selected Track Approved Charts Section */}
      {selectedTrackId && (
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span>چارت‌های مصوب و پیشنهادی گرایش: {currentTrack?.name}</span>
                    <Badge variant="outline" className="text-[10px] h-5">
                      {currentTrack?.code}
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    تنها ۱ چارت می‌تواند به عنوان چارت مصوب رسمی اصلی انتخاب شود. سایر چارت‌ها به عنوان الگوهای پیشنهادی در دسترس خواهند بود.
                  </p>
                </div>
              </div>

              {/* Actions to add new approved charts for this track */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setNewTitle(`چارت مصوب ${currentTrack?.name || ""} - ورودی ۱۴۰۲`);
                    setCreateModalOpen(true);
                  }}
                  className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  افزودن چارت مصوب / پیشنهادی جدید
                </Button>

                {allApprovedCharts.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewTitle(`چارت پیشنهادی ${currentTrack?.name || ""}`);
                      setCloneModalOpen(true);
                    }}
                    className="h-8 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    کپی از چارت دیگر
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {trackApprovedCharts.length > 0 ? (
              <div className="space-y-4">
                {trackApprovedCharts.map((chart) => {
                  const stats = getChartStats(chart);

                  return (
                    <div
                      key={chart.id}
                      className={`p-4 rounded-xl border space-y-3 transition-all ${
                        chart.isPrimaryApproved
                          ? "border-emerald-500/50 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30"
                          : "border-border/80 bg-muted/20 hover:border-primary/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {chart.isPrimaryApproved ? (
                              <Badge className="bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black border-transparent text-[11px] h-5.5 font-bold gap-1 shadow-2xs">
                                <Sparkles className="h-3 w-3 shrink-0" />
                                <span>چارت مصوب رسمی اصلی</span>
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-muted-foreground border-border/80 text-[10px] h-5">
                                  الگوی پیشنهادی
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSetPrimary(chart.id)}
                                  className="h-6 text-[10px] gap-1 text-primary border-primary/30 hover:bg-primary/5"
                                  title="تنها ۱ چارت در هر گرایش مصوب اصلی است"
                                >
                                  تعیین به عنوان مصوب اصلی گرایش
                                </Button>
                              </div>
                            )}

                            <span className="text-xs font-bold text-foreground">
                              {chart.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            شناسه: <span>{chart.id}</span> | آخرین ویرایش:{" "}
                            {new Date(chart.updatedAt).toLocaleDateString("fa-IR")}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <Link href={`/charts/${chart.id}`} target="_blank">
                            <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold shadow-xs">
                              <Edit className="h-3.5 w-3.5" />
                              ویرایش بصری در ادیتور
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteChart(chart.id)}
                            className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                            title="حذف چارت مصوب"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Stats & terms breakdown */}
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-center pt-2 border-t border-border/60">
                        {/* Stats Summary */}
                        <div className="flex items-center gap-2 text-center">
                          <div className="flex-1 px-2.5 py-1 rounded-lg bg-background border border-border/60">
                            <p className="text-[9px] text-muted-foreground">ترم‌ها</p>
                            <p className="text-xs font-bold">{stats.semestersCount} ترم</p>
                          </div>
                          <div className="flex-1 px-2.5 py-1 rounded-lg bg-background border border-border/60">
                            <p className="text-[9px] text-muted-foreground">دروس</p>
                            <p className="text-xs font-bold">{stats.totalCourses} درس</p>
                          </div>
                          <div className="flex-1 px-2.5 py-1 rounded-lg bg-background border border-border/60">
                            <p className="text-[9px] text-muted-foreground">مجموع واحد</p>
                            <p className="text-xs font-bold text-primary">{stats.totalCredits} واحد</p>
                          </div>
                        </div>

                        {/* Semester Pills */}
                        <div className="lg:col-span-3 grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                          {chart.semesters.map((sem) => {
                            let semCredits = 0;
                            sem.courseIds.forEach((cId) => {
                              const c = courses.find((course) => course.id === cId);
                              if (c) semCredits += c.units;
                            });

                            return (
                              <div
                                key={sem.semesterNumber}
                                className="p-1.5 rounded-lg bg-background/80 border border-border/60 text-center"
                              >
                                <span className="text-[10px] font-bold text-foreground block">
                                  ترم {sem.semesterNumber}
                                </span>
                                <span className="text-[9px] text-muted-foreground block">
                                  {sem.courseIds.length} درس ({semCredits}و)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl border-2 border-dashed border-border/70 text-center space-y-3">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto opacity-75" />
                <h4 className="text-xs font-bold">برای این گرایش هنوز چارت مصوبی تعریف نشده است</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  با ایجاد چارت‌های مصوب یا پیشنهادی، دانشجویان می‌توانند در هنگام ساخت چارت تحصیلی، الگوی مناسب ورودی خود را انتخاب و بارگذاری کنند.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setNewTitle(`چارت مصوب ${currentTrack?.name || ""}`);
                    setCreateModalOpen(true);
                  }}
                  className="h-8 gap-1.5 text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  ایجاد اولین چارت مصوب برای این گرایش
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Approved Charts List Table */}
      {/* <Card className="border-border/70 shadow-xs">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              لیست تمام چارت‌های مصوب تعریف‌شده در سیستم ({allApprovedCharts.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allApprovedCharts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/40 border-b border-border/70 text-muted-foreground">
                  <tr>
                    <th className="p-3 font-semibold">عنوان چارت مصوب</th>
                    <th className="p-3 font-semibold">گرایش تحصیلی</th>
                    <th className="p-3 font-semibold">رشته / دانشکده</th>
                    <th className="p-3 font-semibold">تعداد ترم</th>
                    <th className="p-3 font-semibold">تعداد دروس</th>
                    <th className="p-3 font-semibold">مجموع واحد</th>
                    <th className="p-3 font-semibold text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {allApprovedCharts.map((chart) => {
                    const track = tracks.find((t) => t.id === chart.trackId);
                    const major = majors.find((m) => m.id === track?.majorId);
                    const faculty = faculties.find((f) => f.id === major?.facultyId);
                    const stats = getChartStats(chart);

                    return (
                      <tr key={chart.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-bold text-foreground">
                          <div className="flex items-center gap-2">
                            {chart.isPrimaryApproved ? (
                              <Badge className="bg-emerald-600 text-white text-[10px] h-4.5 px-1.5 font-bold">
                                مصوب اصلی
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 text-muted-foreground">
                                پیشنهادی
                              </Badge>
                            )}
                            <span>{chart.title}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-foreground">{track?.name || "نامشخص"}</span>
                          <span className="text-[10px] text-muted-foreground block">
                            {track?.code || "---"}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          <span>{major?.name || "نامشخص"}</span>
                          <span className="text-[10px] opacity-75 block">{faculty?.name}</span>
                        </td>
                        <td className="p-3 font-medium">{stats.semestersCount} ترم</td>
                        <td className="p-3 font-medium">{stats.totalCourses} درس</td>
                        <td className="p-3 font-bold text-primary">{stats.totalCredits} واحد</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link href={`/charts/${chart.id}`} target="_blank">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-[11px] border-primary/30 text-primary hover:bg-primary/5"
                              >
                                <Edit className="h-3 w-3" />
                                ویرایش در ادیتور
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteChart(chart.id)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="حذف"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
              <Layers className="h-6 w-6 mx-auto opacity-40" />
              <p>هنوز هیچ چارت مصوبی در سامانه ثبت نشده است.</p>
            </div>
          )}
        </CardContent>
      </Card> */}

      {/* CREATE APPROVED CHART MODAL */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              ایجاد چارت مصوب رسمی برای {currentTrack?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              چارت مصوب به عنوان الگوی استاندارد در اختیار تمامی دانشجویان این گرایش قرار می‌گیرد.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateApprovedChart} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">عنوان چارت مصوب</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="مثلاً: چارت مصوب مهندسی نرم‌افزار - بازنگری ۱۴۰۲"
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="p-3 rounded-xl bg-muted/40 text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">نحوه چیدمان دروس:</p>
              <p>
                پس از ایجاد، چارت در ویرایشگر گرافیکی باز خواهد شد و می‌توانید دروس را با کشیدن و رها کردن (Drag & Drop) در ترم‌های ۱ تا ۸ بچینید.
              </p>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateModalOpen(false)}
                className="h-8 text-xs"
              >
                انصراف
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-8 text-xs font-semibold"
              >
                {isSubmitting ? "در حال ایجاد..." : "ایجاد چارت مصوب"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CLONE APPROVED CHART MODAL */}
      <Dialog open={cloneModalOpen} onOpenChange={setCloneModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Copy className="h-4 w-4 text-primary" />
              کپی چارت مصوب از گرایش دیگر
            </DialogTitle>
            <DialogDescription className="text-xs">
              الگوی ترم‌بندی یک گرایش دیگر را به عنوان پایه برای گرایش {currentTrack?.name} کپی کنید.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCloneApprovedChart} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">انتخاب چارت مبدا برای کپی</Label>
              <Select
                items={cloneOptions}
                value={sourceChartIdToClone}
                onValueChange={setSourceChartIdToClone}
                required
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="چارت مصوب مبدا را انتخاب کنید..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {cloneOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">عنوان چارت جدید</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="عنوان چارت مصوب جدید..."
                required
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCloneModalOpen(false)}
                className="h-8 text-xs"
              >
                انصراف
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !sourceChartIdToClone}
                className="h-8 text-xs font-semibold"
              >
                {isSubmitting ? "در حال کپی..." : "کپی و ایجاد چارت"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}