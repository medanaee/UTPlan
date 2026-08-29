"use client";

import React, { useState, useEffect } from "react";
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
  selectedFacultyId: string;
  onSelectFaculty: (id: string) => void;
  selectedMajorId: string;
  onSelectMajor: (id: string) => void;
  selectedTrackId: string;
  onSelectTrack: (id: string) => void;
}

export function ApprovedChartsManager({
  faculties,
  majors,
  tracks,
  courses,
  selectedFacultyId,
  onSelectFaculty,
  selectedMajorId,
  onSelectMajor,
  selectedTrackId,
  onSelectTrack,
}: ApprovedChartsManagerProps) {
  const [allApprovedCharts, setAllApprovedCharts] = useState<StudentChart[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [sourceChartIdToClone, setSourceChartIdToClone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Filter majors & tracks
  const filteredMajors = majors.filter((m) => !selectedFacultyId || m.facultyId === selectedFacultyId);
  const filteredTracks = tracks.filter((t) => !selectedMajorId || t.majorId === selectedMajorId);
  const currentTrack = tracks.find((t) => t.id === selectedTrackId);
  const currentApprovedChart = allApprovedCharts.find((c) => c.trackId === selectedTrackId && c.isApprovedDefault);

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

      {/* Faculty / Major / Track Selector Toolbar */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="p-4 border-b pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                مدیریت چارت‌های مصوب و پیش‌فرض گرایش‌ها
              </CardTitle>
              <CardDescription className="text-xs">
                تعریف و ویرایش چارت‌های استاندارد دانشگاهی که دانشجویان در هنگام بارگذاری چارت مصوب از آن‌ها استفاده می‌کنند
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadApprovedCharts}
              disabled={loading}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              به‌روزرسانی
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Faculty */}
            <div className="space-y-1.5">
              <Label className="text-xs">دانشکده</Label>
              <Select value={selectedFacultyId} onValueChange={onSelectFaculty}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="انتخاب دانشکده" />
                </SelectTrigger>
                <SelectContent>
                  {faculties.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      {f.name} ({f.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Major */}
            <div className="space-y-1.5">
              <Label className="text-xs">رشته تحصیلی</Label>
              <Select value={selectedMajorId} onValueChange={onSelectMajor}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="انتخاب رشته" />
                </SelectTrigger>
                <SelectContent>
                  {filteredMajors.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.name} ({m.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Track */}
            <div className="space-y-1.5">
              <Label className="text-xs">گرایش تخصصی</Label>
              <Select value={selectedTrackId} onValueChange={onSelectTrack}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="انتخاب گرایش" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTracks.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name} ({t.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Selected Track Status Card */}
      {selectedTrackId && (
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 sm:p-5 border-b pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span>گرایش: {currentTrack?.name}</span>
                    <Badge variant="outline" className="text-[10px] h-5 font-mono">
                      {currentTrack?.code}
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    وضعیت چارت مصوب رسمی این گرایش در سامانه
                  </p>
                </div>
              </div>

              {/* Action buttons if chart does or doesn't exist */}
              {currentApprovedChart ? (
                <div className="flex items-center gap-2">
                  <Link href={`/charts/${currentApprovedChart.id}`} target="_blank">
                    <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold shadow-xs">
                      <Edit className="h-3.5 w-3.5" />
                      ویرایش بصری چارت در ویرایشگر چارت
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteChart(currentApprovedChart.id)}
                    className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                    title="حذف چارت مصوب"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setNewTitle(`چارت مصوب ${currentTrack?.name || ""}`);
                      setCreateModalOpen(true);
                    }}
                    className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    ساخت چارت مصوب جدید
                  </Button>

                  {allApprovedCharts.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewTitle(`چارت مصوب ${currentTrack?.name || ""}`);
                        setCloneModalOpen(true);
                      }}
                      className="h-8 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      کپی از چارت مصوب دیگر
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            {currentApprovedChart ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-foreground">
                        {currentApprovedChart.title}
                      </span>
                      <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] h-5">
                        چارت مصوب رسمی
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      شناسه چارت: <span className="font-mono">{currentApprovedChart.id}</span> | آخرین ویرایش:{" "}
                      {new Date(currentApprovedChart.updatedAt).toLocaleDateString("fa-IR")}
                    </p>
                  </div>

                  {/* Stats grid */}
                  {(() => {
                    const stats = getChartStats(currentApprovedChart);
                    return (
                      <div className="flex items-center gap-3 text-center">
                        <div className="px-3 py-1.5 rounded-lg bg-background border border-border/60">
                          <p className="text-[10px] text-muted-foreground">تعداد ترم‌ها</p>
                          <p className="text-xs font-bold text-foreground font-mono">
                            {stats.semestersCount} ترم
                          </p>
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-background border border-border/60">
                          <p className="text-[10px] text-muted-foreground">تعداد دروس</p>
                          <p className="text-xs font-bold text-foreground font-mono">
                            {stats.totalCourses} درس
                          </p>
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-background border border-border/60">
                          <p className="text-[10px] text-muted-foreground">مجموع واحدها</p>
                          <p className="text-xs font-bold text-primary font-mono">
                            {stats.totalCredits} واحد
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Term breakdown preview */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground">چیدمان ترم‌ها در چارت مصوب:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    {currentApprovedChart.semesters.map((sem) => {
                      let semCredits = 0;
                      sem.courseIds.forEach((cId) => {
                        const c = courses.find((course) => course.id === cId);
                        if (c) semCredits += c.units;
                      });

                      return (
                        <div
                          key={sem.semesterNumber}
                          className="p-2 rounded-xl border bg-muted/20 text-center space-y-1"
                        >
                          <span className="text-[11px] font-bold text-foreground block">
                            ترم {sem.semesterNumber}
                          </span>
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            {sem.courseIds.length} درس ({semCredits} واحد)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-2xl border-2 border-dashed border-border/70 text-center space-y-3">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto opacity-75" />
                <h4 className="text-xs font-bold">برای این گرایش هنوز چارت مصوب تعریف نشده است</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  با ایجاد چارت مصوب رسمی، دانشجویان می‌توانند با یک کلیک چیدمان دروس استاندارد این گرایش را در چارت شخصی خود بارگذاری کنند.
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
                  ایجاد چارت مصوب برای این گرایش
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Approved Charts List Table */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="p-4 border-b pb-3">
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
                        <td className="p-3 font-bold text-foreground flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span>{chart.title}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-foreground">{track?.name || "نامشخص"}</span>
                          <span className="text-[10px] text-muted-foreground font-mono block">
                            {track?.code || "---"}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          <span>{major?.name || "نامشخص"}</span>
                          <span className="text-[10px] opacity-75 block">{faculty?.name}</span>
                        </td>
                        <td className="p-3 font-mono font-medium">{stats.semestersCount} ترم</td>
                        <td className="p-3 font-mono font-medium">{stats.totalCourses} درس</td>
                        <td className="p-3 font-mono font-bold text-primary">{stats.totalCredits} واحد</td>
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
      </Card>

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
              <Select value={sourceChartIdToClone} onValueChange={setSourceChartIdToClone} required>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="چارت مصوب مبدا را انتخاب کنید..." />
                </SelectTrigger>
                <SelectContent>
                  {allApprovedCharts.map((c) => {
                    const trk = tracks.find((t) => t.id === c.trackId);
                    return (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.title} ({trk?.name || "گرایش"})
                      </SelectItem>
                    );
                  })}
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