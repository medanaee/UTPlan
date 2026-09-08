"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Plus,
  Sparkles,
  ArrowLeft,
  Trash2,
  Edit,
  ExternalLink,
  CheckCircle2,
  BookOpen,
  Copy,
  Clock,
  Layers,
  GraduationCap,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Navbar } from "@/components/navbar";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { fetchJson, postJson, deleteJson } from "@/lib/api-client";
import type { StudentChart, Track, UserSession } from "@/lib/types";

export default function ChartsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [charts, setCharts] = useState<StudentChart[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  // New Chart Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedTrackId, setSelectedTrackId] = usePersistedState<string>("ut_ece_chart_new_track_id", "");
  const [selectedTemplateChartId, setSelectedTemplateChartId] = usePersistedState<string>("ut_ece_chart_new_template_id", "empty");
  const [isCreating, setIsCreating] = useState(false);

  const trackSelectItems = useMemo(
    () => tracks.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` })),
    [tracks]
  );

  const templateSelectItems = useMemo(() => {
    const items = [{ value: "empty", label: "-- چارت خام (بدون درس) --" }];
    const approved = charts.filter(
      (c) => c.isApprovedDefault && (!selectedTrackId || c.trackId === selectedTrackId)
    );
    approved.forEach((ac) => {
      items.push({
        value: ac.id,
        label: `${ac.title} (${ac.semesters.length} ترم)`,
      });
    });
    return items;
  }, [charts, selectedTrackId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [authRes, chartsRes, tracksRes] = await Promise.all([
        fetchJson("/api/auth/me"),
        fetchJson("/api/charts"),
        fetchJson("/api/tracks"),
      ]);

      if (!authRes.authenticated || !authRes.user) {
        router.push("/login");
        return;
      }

      setUser(authRes.user);
      if (!selectedTrackId && authRes.user?.trackId) {
        setSelectedTrackId(authRes.user.trackId);
      }

      if (chartsRes.success) {
        setCharts(chartsRes.data || []);
      }

      if (tracksRes.success) {
        setTracks(tracksRes.data || []);
        if (tracksRes.data?.length > 0 && !selectedTrackId && !authRes.user?.trackId) {
          setSelectedTrackId(tracksRes.data[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading charts page:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateChart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push("/login");
      return;
    }

    setIsCreating(true);
    try {
      const res = await postJson("/api/charts", {
        title: newTitle.trim() || "چارت تحصیلی جدید",
        trackId: selectedTrackId,
        cloneFromId: selectedTemplateChartId !== "empty" ? selectedTemplateChartId : undefined,
      });

      if (res.success && res.data) {
        setCreateModalOpen(false);
        setNewTitle("");
        setSelectedTemplateChartId("empty");
        router.push(`/charts/${res.data.id}`);
      } else {
        alert(res.message || "خطا در ایجاد چارت");
      }
    } catch {
      alert("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCloneApprovedChart = async (approvedChart: StudentChart) => {
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      const res = await postJson("/api/charts", {
        title: `نسخه من از ${approvedChart.title}`,
        trackId: approvedChart.trackId,
        cloneFromId: approvedChart.id,
      });

      if (res.success && res.data) {
        router.push(`/charts/${res.data.id}`);
      } else {
        alert(res.message || "خطا در کلون چارت");
      }
    } catch {
      alert("خطا در ایجاد چارت");
    }
  };

  const handleDeleteChart = async (id: string, title: string) => {
    if (!confirm(`آیا از حذف چارت «${title}» مطمئن هستید؟`)) return;

    try {
      const res = await deleteJson(`/api/charts?id=${id}`);
      if (res.success) {
        await loadData();
      } else {
        alert(res.message || "خطا در حذف چارت");
      }
    } catch {
      alert("خطا در حذف چارت");
    }
  };

  const userCharts = charts.filter((c) => !c.isApprovedDefault && c.userId === user?.id);
  const approvedCharts = charts.filter((c) => c.isApprovedDefault);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <Navbar user={user} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Header Title & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">چارت‌های تحصیلی</h1>
              <Badge variant="secondary" className="text-xs px-2">
                برنامه‌ریزی ترمی و فارغ‌التحصیلی
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ساخت، ویرایش و پایش چارت‌های ۸ تا ۱۲ ترمه با اعتبارسنجی زنده پیش‌نیازها و قوانین چارت مصوب
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                if (!user) {
                  router.push("/login");
                  return;
                }
                setCreateModalOpen(true);
              }}
              className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Plus className="h-4 w-4" />
              ایجاد چارت جدید
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">در حال دریافت چارت‌های تحصیلی...</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* ========================================================= */}
            {/* 1. USER'S SAVED CHARTS */}
            {/* ========================================================= */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  چارت‌های شخصی من ({userCharts.length})
                </h2>
              </div>

              {userCharts.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {userCharts.map((c) => {
                    const track = tracks.find((t) => t.id === c.trackId);
                    const totalCoursesCount = c.semesters.reduce((sum, s) => sum + s.courseIds.length, 0);

                    return (
                      <Card
                        key={c.id}
                        className="border-border/80 hover:border-primary/50 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-sm font-bold leading-snug">
                                {c.title}
                              </CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {track?.name || "گرایش نرم‌افزار"}
                              </CardDescription>
                            </div>
                            <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary shrink-0">
                              {c.semesters.length} ترم
                            </span>
                          </div>
                        </CardHeader>

                        <CardContent className="pb-3 text-xs text-muted-foreground space-y-2">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-[11px]">
                            <span>تعداد کل دروس قرار گرفته:</span>
                            <span className="font-bold text-foreground">{totalCoursesCount} درس</span>
                          </div>
                        </CardContent>

                        <CardFooter className="pt-2 border-t border-border/60 flex items-center justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteChart(c.id, c.title)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="حذف چارت"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>

                          <Link href={`/charts/${c.id}`}>
                            <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold">
                              <Edit className="h-3.5 w-3.5" />
                              ورود به ویرایشگر
                            </Button>
                          </Link>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-dashed border-2 border-border/70 p-8 text-center space-y-3 bg-card/40">
                  <Layers className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <div>
                    <h3 className="text-xs font-bold">هنوز چارتی برای خود نساخته‌اید</h3>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      می‌توانید یک چارت خام بسازید یا یکی از چارت‌های مصوب زیر را با ۱ کلیک در پنل خود کپی کنید.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setCreateModalOpen(true)}
                    className="h-8 text-xs gap-1 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    ایجاد اولین چارت
                  </Button>
                </Card>
              )}
            </div>

            {/* ========================================================= */}
            {/* 2. OFFICIAL APPROVED DEGREE CHARTS */}
            {/* ========================================================= */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  چارت‌های مصوب دانشگاه تهران (رسمی)
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {approvedCharts.map((ac) => {
                  const track = tracks.find((t) => t.id === ac.trackId);
                  const totalCoursesCount = ac.semesters.reduce((sum, s) => sum + s.courseIds.length, 0);

                  return (
                    <Card
                      key={ac.id}
                      className="border-primary/30 bg-primary/[0.02] hover:border-primary/60 transition-all shadow-2xs flex flex-col justify-between"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-sm font-bold text-foreground">
                              {ac.title}
                            </CardTitle>
                            <CardDescription className="text-xs mt-1 text-muted-foreground">
                              دانشکده مهندسی برق و کامپیوتر • {track?.name || "مهندسی کامپیوتر"}
                            </CardDescription>
                          </div>
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] shrink-0">
                            چارت مصوب
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="pb-3 text-xs text-muted-foreground space-y-1.5">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-card text-[11px] border border-border/60">
                          <span>طول دوره مصوب:</span>
                          <span className="font-bold text-foreground">{ac.semesters.length} ترم تحصیلی</span>
                        </div>
                      </CardContent>

                      <CardFooter className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                        <Link href={`/charts/${ac.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1">
                            <ExternalLink className="h-3 w-3" />
                            مشاهده چارت
                          </Button>
                        </Link>

                        <Button
                          size="sm"
                          onClick={() => handleCloneApprovedChart(ac)}
                          className="flex-1 h-8 text-xs gap-1 font-semibold"
                        >
                          <Copy className="h-3 w-3" />
                          کپی در چارت‌های من
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* CREATE NEW CHART MODAL */}
      {/* ========================================================= */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              ایجاد چارت تحصیلی جدید
            </DialogTitle>
            <DialogDescription className="text-xs">
              یک عنوان برای برنامه تحصیلی خود انتخاب و گرایش مد نظر را مشخص کنید.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateChart} className="space-y-3.5 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">عنوان چارت</Label>
              <Input
                required
                placeholder="مثلاً چارت اصلی ۸ ترمه یا پلن جایگزین"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">گرایش تحصیلی</Label>
                <Link href="/profile" className="text-[10px] text-primary hover:underline">
                  تنظیم پیش‌فرض در پروفایل
                </Link>
              </div>
              <Select
                value={selectedTrackId}
                onValueChange={(val) => val && setSelectedTrackId(val)}
              >
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder="انتخاب گرایش..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {trackSelectItems.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              
            </div>


            

            {/* Template Selection */}
            <div className="space-y-1">
              <Label className="text-xs">الگوی اولیه چارت (اختیاری)</Label>
              <Select
                value={selectedTemplateChartId}
                onValueChange={(val) => setSelectedTemplateChartId(val || "empty")}
              >
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder="انتخاب الگو..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {templateSelectItems.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-1.5">
                          {opt.value !== "empty" && (
                            <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                می‌توانید با چارت مصوب یا پیشنهادی دانشکده شروع کنید یا یک چارت خالی بسازید.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" size="sm" disabled={isCreating} className="w-full h-8 text-xs font-semibold">
                {isCreating ? "در حال ایجاد..." : "ایجاد چارت و ورود به ویرایشگر"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
