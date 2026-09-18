"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { fetchJson, postJson, putJson, deleteJson } from "@/lib/api-client";
import {
  BookOpen,
  User,
  Calendar,
  Clock,
  GraduationCap,
  MapPin,
  Star,
  MessageSquare,
  Trash2,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Share2,
  Check,
  Send,
  Loader2,
  Sparkles,
  Info,
  FileText,
  AlertCircle,
  FolderArchive,
  Video,
  ExternalLink,
  Link2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ReviewReactionsBar } from "@/components/reviews/review-reactions-bar";
import { getClientId } from "@/lib/client-id";
import type { CourseOffering, ReviewItem, UserSession, OfferingResource } from "@/lib/types";

function formatSemesterLabel(termStr: string): string {
  if (!termStr) return "تعیین‌نشده";
  const parts = termStr.split("-");
  if (parts.length === 2) {
    const year = parts[0];
    const sem = parts[1];
    if (sem === "1" || sem === "spring") return `بهار ${year}`;
    if (sem === "2" || sem === "fall") return `پاییز ${year}`;
    return `${sem} ${year}`;
  }
  return termStr;
}

const DAYS_NAMES: Record<number, string> = {
  0: "شنبه",
  1: "یکشنبه",
  2: "دوشنبه",
  3: "سه‌شنبه",
  4: "چهارشنبه",
  5: "پنج‌شنبه",
  6: "جمعه",
};

function getScoreBarColor(score: number): string {
  if (score >= 7) return "bg-emerald-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-rose-500";
}

function getScoreTextColor(score: number): string {
  if (score >= 7) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 5) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

interface OfferingDetailViewProps {
  offering: CourseOffering;
}

export function OfferingDetailView({ offering }: OfferingDetailViewProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Create Review Dialog state
  const [createReviewOpen, setCreateReviewOpen] = useState(false);

  // Resources state
  const [resources, setResources] = useState<OfferingResource[]>(offering.resources || []);
  const [loadingResources, setLoadingResources] = useState(!offering.resources);

  useEffect(() => {
    fetchJson(`/api/offerings/resources?offeringId=${offering.id}`)
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setResources(d.data);
        }
      })
      .catch((err) => console.error("Error loading offering resources:", err))
      .finally(() => setLoadingResources(false));
  }, [offering.id]);

  // New Form state
  const [commentText, setCommentText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [studentGrade, setStudentGrade] = useState<string>("");
  const [scores, setScores] = useState<{
    teaching?: number;
    grading?: number;
    content?: number;
    difficulty?: number;
  }>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Semesters & Events Selection State
  const availableSemesters = React.useMemo(() => {
    const sems = new Set<string>();
    if (offering.events && offering.events.length > 0) {
      offering.events.forEach((e) => {
        if (e.term) sems.add(e.term);
      });
    }
    if (offering.finalizedSemesters && offering.finalizedSemesters.length > 0) {
      offering.finalizedSemesters.forEach((s) => sems.add(s));
    }
    const arr = Array.from(sems);
    if (arr.length === 0) {
      return ["1404-2"];
    }
    return arr.sort().reverse();
  }, [offering.events, offering.finalizedSemesters]);

  const defaultSemester = React.useMemo(() => {
    if (offering.events && offering.events.length > 0) {
      return offering.events[0].term || "1404-2";
    }
    if (offering.finalizedSemesters && offering.finalizedSemesters.length > 0) {
      return offering.finalizedSemesters[0];
    }
    return "1404-2";
  }, [offering.events, offering.finalizedSemesters]);

  const [selectedSemester, setSelectedSemester] = usePersistedState<string>(
    "ut_ece_offering_detail_semester",
    defaultSemester
  );

  useEffect(() => {
    if (availableSemesters.length > 0 && !availableSemesters.includes(selectedSemester)) {
      setSelectedSemester(availableSemesters[0]);
    }
  }, [availableSemesters]);

  const isSelectedSemesterFinalized = Boolean(
    offering.finalizedSemesters && offering.finalizedSemesters.includes(selectedSemester)
  );

  const filteredEvents = React.useMemo(() => {
    if (!offering.events) return [];
    return offering.events.filter((e) => e.term === selectedSemester);
  }, [offering.events, selectedSemester]);

  // Edit Review Modal State
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [editComment, setEditComment] = useState("");
  const [editIsAnonymous, setEditIsAnonymous] = useState(false);
  const [editStudentGrade, setEditStudentGrade] = useState<string>("");
  const [editScores, setEditScores] = useState<{
    teaching?: number;
    grading?: number;
    content?: number;
    difficulty?: number;
  }>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Load current user
  useEffect(() => {
    fetchJson("/api/auth/me")
      .then((data) => {
        if (data.authenticated) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  // Load reviews for this offering
  const loadReviews = async () => {
    try {
      setLoadingReviews(true);
      const clientId = getClientId();
      const res = await fetchJson(
        `/api/offerings/reviews?offeringId=${offering.id}&clientId=${encodeURIComponent(clientId)}`
      );
      if (res.success && Array.isArray(res.data)) {
        setReviews(res.data);
      }
    } catch (err) {
      console.error("Error loading offering reviews:", err);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [offering.id]);

  const handleScoreChange = (field: "teaching" | "grading" | "content" | "difficulty", val: number) => {
    setScores((prev) => ({
      ...prev,
      [field]: prev[field] === val ? undefined : val,
    }));
  };

  const handleEditScoreChange = (field: "teaching" | "grading" | "content" | "difficulty", val: number) => {
    setEditScores((prev) => ({
      ...prev,
      [field]: prev[field] === val ? undefined : val,
    }));
  };

  // Submit New Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!commentText.trim()) {
      setSubmitError("لطفاً متن نظر یا تجربه خود را بنویسید.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await postJson("/api/offerings/reviews", {
        offeringId: offering.id,
        comment: commentText.trim(),
        isAnonymous,
        criteriaRatings: scores,
        studentGrade: studentGrade ? Number(studentGrade) : null,
      });

      if (res.success) {
        setSubmitSuccess("نظر شما با موفقیت ثبت شد و در دسترس دانشجویان قرار گرفت.");
        setCommentText("");
        setIsAnonymous(false);
        setStudentGrade("");
        setScores({});
        setCreateReviewOpen(false);
        await loadReviews();
      } else {
        setSubmitError(res.message || "خطا در ثبت نظر");
      }
    } catch (err) {
      console.error("Submit review error:", err);
      setSubmitError("خطا در ارتباط با سرور.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (rev: ReviewItem) => {
    setEditingReview(rev);
    setEditComment(rev.comment);
    setEditIsAnonymous(rev.isAnonymous);
    setEditScores(rev.criteriaRatings || {});
    setEditStudentGrade(rev.studentGrade !== null && rev.studentGrade !== undefined ? String(rev.studentGrade) : "");
    setEditError(null);
  };

  // Save Edited Review
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;
    setEditError(null);

    if (!editComment.trim()) {
      setEditError("متن نظر نمی‌تواند خالی باشد.");
      return;
    }

    try {
      setSavingEdit(true);
      const res = await putJson("/api/offerings/reviews", {
        id: editingReview.id,
        comment: editComment.trim(),
        isAnonymous: editIsAnonymous,
        criteriaRatings: editScores,
        studentGrade: editStudentGrade ? Number(editStudentGrade) : null,
      });

      if (res.success) {
        setEditingReview(null);
        await loadReviews();
      } else {
        setEditError(res.message || "خطا در ویرایش نظر");
      }
    } catch (err) {
      console.error("Save edit error:", err);
      setEditError("خطا در ارتباط با سرور.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Review (Author or Admin)
  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm("آیا از حذف این نظر اطمینان دارید؟")) return;

    try {
      const res = await deleteJson(`/api/offerings/reviews?id=${reviewId}`);

      if (res.success) {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      } else {
        alert(res.message || "خطا در حذف نظر");
      }
    } catch (err) {
      console.error("Delete review error:", err);
      alert("خطا در حذف نظر");
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "super_admin";

  const totalAvg =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + (r.overallRating || 10), 0) / reviews.length).toFixed(1)
      : null;

  const avgReportedGrade = React.useMemo(() => {
    const validGrades = reviews
      .filter((r) => r.studentGrade !== null && r.studentGrade !== undefined)
      .map((r) => Number(r.studentGrade));
    if (validGrades.length === 0) return null;
    return (validGrades.reduce((a, b) => a + b, 0) / validGrades.length).toFixed(1);
  }, [reviews]);

  const criteriaAverages = React.useMemo(() => {
    const t: number[] = [];
    const g: number[] = [];
    const c: number[] = [];
    const d: number[] = [];

    reviews.forEach((r) => {
      if (r.criteriaRatings?.teaching) t.push(r.criteriaRatings.teaching);
      if (r.criteriaRatings?.grading) g.push(r.criteriaRatings.grading);
      if (r.criteriaRatings?.content) c.push(r.criteriaRatings.content);
      if (r.criteriaRatings?.difficulty) d.push(r.criteriaRatings.difficulty);
    });

    const calc = (arr: number[]) => (arr.length > 0 ? (arr.reduce((x, y) => x + y, 0) / arr.length).toFixed(1) : null);
    const teaching = calc(t);
    const grading = calc(g);
    const content = calc(c);
    const difficulty = calc(d);

    return {
      teaching,
      grading,
      content,
      difficulty,
      hasAny: Boolean(teaching || grading || content || difficulty),
    };
  }, [reviews]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Top Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <Link href="/" className="hover:text-foreground transition-colors">
            خانه
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rotate-180 opacity-50" />
          <Link href="/offerings" className="hover:text-foreground transition-colors">
            ارائه‌های درسی
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rotate-180 opacity-50" />
          <span className="text-foreground font-bold">
            {offering.courseName} — {offering.professorName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="h-8 gap-1.5 text-xs shadow-2xs"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>لینک کپی شد</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>اشتراک‌گذاری</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/offerings")}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>بازگشت به ارائه‌ها</span>
          </Button>
        </div>
      </div>

      {/* Hero Header Card - Flat & Minimal */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-b from-primary/10 via-background to-background p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-4 max-w-3xl">
            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className=" text-xs font-bold px-3 py-1 bg-background/80">
                {offering.courseCode || "کد درس"}
              </Badge>
              <Badge variant="secondary" className="text-xs font-bold px-2.5 py-1">
                {offering.courseUnits || 3} واحد تحصیلی
              </Badge>
              <Badge className="text-xs font-semibold px-3 py-1 rounded-full border bg-primary/10 text-primary border-primary/30">
                ارائه فعال در دانشکده
              </Badge>
            </div>

            {/* Course & Professor Title */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {offering.courseName}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground font-semibold mt-1 flex items-center gap-2">
                <span>مدرس:</span>
                <span className="text-foreground">{offering.professorName}</span>
                {offering.professorTitle && (
                  <span className="text-xs font-normal opacity-80">({offering.professorTitle})</span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Score Box */}
          <div className="flex items-center gap-3 shrink-0 self-start lg:self-end">
            <div className="rounded-xl border border-border/80 p-4 text-center min-w-27.5 shadow-2xs">
              <div className="flex items-center justify-center gap-1 text-primary">
                <Star className="h-5 w-5 fill-primary text-primary" />
                <span className="text-2xl font-black">{totalAvg || "۱۰"}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">
                میانگین رضایت از ۱۰
              </span>
            </div>

            <div className="rounded-xl border border-border/80 p-4 text-center min-w-22.5 shadow-2xs">
              <span className="text-2xl font-black text-foreground block">{reviews.length}</span>
              <span className="text-[10px] text-muted-foreground font-medium mt-1 block">
                نظر و تجربه
              </span>
            </div>

            {avgReportedGrade && (
              <div className="rounded-2xl border border-emerald-500/30 bg-card p-4 text-center min-w-27.5 shadow-2xs">
                <div className="flex items-center justify-center gap-1 text-emerald-600">
                  <GraduationCap className="h-5 w-5" />
                  <span className="text-2xl font-black">{avgReportedGrade}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">
                  میانگین نمره از ۲۰
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Right 2 Columns: Classes/Schedule + Reviews Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Class Schedule & Events Card with Semester Selector & Status Badge */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    زمان‌بندی کلاس‌ها و تاریخ امتحانات
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    برنامه جلسات هفتگی، محل تشکیل کلاس و امتحانات به تفکیک نیمسال
                  </CardDescription>
                </div>

                {/* Semester Selector & Status Badge */}
                <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                  {/* Status Badge */}
                  {isSelectedSemesterFinalized ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 gap-1 text-[11px] font-semibold px-2.5 py-1 shadow-2xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>اطلاعات نهایی و کامل</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 gap-1 text-[11px] font-semibold px-2.5 py-1 shadow-2xs">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>اطلاعات در حال تکمیل</span>
                    </Badge>
                  )}

                  {/* Semester Dropdown */}
                  <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                    <SelectTrigger className="text-xs font-semibold bg-background min-w-36">
                      <SelectValue placeholder="انتخاب نیمسال" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {availableSemesters.map((sem) => (
                          <SelectItem key={sem} value={sem} className="text-xs">
                            {formatSemesterLabel(sem)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 rounded-2xl border border-border/80 bg-card/60 space-y-3 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        {evt.code ? (
                          <Badge variant="outline" className="text-xs font-mono font-bold">
                            {evt.code}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs font-bold">
                            رویداد کلاس
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          نیمسال {formatSemesterLabel(evt.term)}
                        </span>
                      </div>
                      {evt.location ? (
                        <span className="text-xs text-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border/60 flex items-center gap-1.5 font-medium">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>محل تشکیل: {evt.location}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                          <span>محل تشکیل: تعیین‌نشده</span>
                        </span>
                      )}
                    </div>

                    {/* Weekly Class Slots */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-muted-foreground block">
                        زمان جلسات کلاسی:
                      </span>
                      {evt.slots && evt.slots.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {evt.slots.map((s, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-primary/5 text-primary border border-primary/20 shadow-2xs"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {DAYS_NAMES[s.dayOfWeek] || "روز"}: ساعت {s.startTime} تا {s.endTime}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">تعیین‌نشده</span>
                      )}
                    </div>

                    {/* Exam Date & Time */}
                    {evt.examDate ? (
                      <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/25 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <GraduationCap className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>روز و تاریخ امتحان پایان‌ترم: {evt.examDate}</span>
                        </div>
                        <div className="flex items-center gap-1 font-medium">
                          <Clock className="h-3.5 w-3.5 opacity-80" />
                          <span>ساعت: {evt.examStartTime || "۰۸:۳۰"} تا {evt.examEndTime || "۱۱:۰۰"}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground bg-muted/20 p-2 rounded-lg border border-dashed flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                        <span>تاریخ و ساعت امتحان پایان‌ترم در سامانه ثبت نشده است.</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed p-6 space-y-2">
                  <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="font-semibold text-foreground">
                    در نیمسال {formatSemesterLabel(selectedSemester)} رویداد کلاسی ثبت نشده است.
                  </p>
                  <p className="text-[11px]">
                    می‌توانید از منوی بالا سایر نیمسال‌های تحصیلی را برای مشاهده زمان‌بندی انتخاب کنید.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Offering Resources Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FolderArchive className="h-4 w-4 text-primary" />
                    <span>منابع و مراجع آموزشی درس</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    اسلایدها، ویدئوهای جلسات، آرشیو فایل‌ها و پیوندهای آموزشی مرتبط با این ارائه
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[11px] font-semibold">
                  {resources.length} منبع ثبت‌شده
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {loadingResources ? (
                <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>در حال دریافت منابع آموزشی...</span>
                </div>
              ) : resources.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {resources.map((res) => {
                    const typeLabel =
                      res.type === "video"
                        ? "ویدئو"
                        : res.type === "slide"
                        ? "اسلاید"
                        : "آرشیو";

                    return (
                      <a
                        key={res.id}
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group p-3 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all flex items-center justify-between gap-3 shadow-2xs cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:text-primary transition-colors font-semibold text-xs shrink-0 border border-border/60">
                            {res.type === "video" ? (
                              <Video className="h-4 w-4" />
                            ) : res.type === "slide" ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <FolderArchive className="h-4 w-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                              {res.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-muted/50 border-border text-foreground font-normal shrink-0"
                              >
                                {typeLabel}
                              </Badge>
                              {res.term && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 shrink-0 font-normal"
                                >
                                  {formatSemesterLabel(res.term)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                          <ExternalLink className="h-4 w-4" />
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed p-6 space-y-1.5">
                  <FolderArchive className="h-7 w-7 mx-auto text-muted-foreground/40" />
                  <p className="font-semibold text-foreground">
                    هنوز منبع آموزشی برای این ارائه ثبت نشده است.
                  </p>
                  <p className="text-[11px]">
                    اساتید و مدیران می‌توانند اسلایدها، ویدئوها و جزوات را در این بخش قرار دهند.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student Reviews & Discussions Section */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  نظرات و تجربیات دانشجویان در این ارائه ({reviews.length})
                </CardTitle>
                {isAdmin && (
                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                    مدیریت سامانه: دسترسی حذف کلیه نظرات
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                نظرات و تجربیات دانشجویانی که قبلاً این درس را با این استاد گذرانده‌اند.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {submitSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{submitSuccess}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSubmitSuccess(null)}
                    className="h-6 px-2 text-[11px] hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  >
                    بستن
                  </Button>
                </div>
              )}

              {/* Compact Card to prompt for review */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-primary/20 bg-primary/5 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 border border-primary/20 shadow-2xs">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">
                      نظرتان را درباره این ارائه ثبت کنید
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      دیدگاه‌ها و ارزیابی تجربیات شما به سایر دانشجویان در شناخت بهتر این ارائه و انتخاب درس کمک می‌کند.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setSubmitError(null);
                    setCreateReviewOpen(true);
                  }}
                  className="h-8 text-xs font-bold gap-1.5 px-4 shrink-0 shadow-2xs self-start sm:self-auto"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>ثبت نظر</span>
                </Button>
              </div>

              {/* Reviews Feed */}
              {loadingReviews ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs">در حال دریافت نظرات...</span>
                </div>
              ) : reviews.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground/80 bg-muted/20 rounded-2xl border border-dashed p-6 space-y-2">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="font-bold text-foreground">هنوز نظری برای این ارائه ثبت نشده است.</p>
                  <p className="text-[11px]">اولین نفری باشید که تجربه خود را با سایر دانشجویان به اشتراک می‌گذارد.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Overall Criteria Breakdown Header */}
                  {criteriaAverages.hasAny && (
                    <div className="p-4 rounded-2xl border border-border/80 bg-card space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Star className="h-4 w-4 fill-primary text-primary" />
                          میانگین نمرات معیارها در این ارائه:
                        </span>
                        <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary">
                          برآیند کلی
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {criteriaAverages.teaching && (
                          <div className="space-y-1 bg-card/80 p-2.5 rounded-xl border">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium">کیفیت تدریس</span>
                              <span className={`font-bold ${getScoreTextColor(Number(criteriaAverages.teaching))}`}>
                                {criteriaAverages.teaching} <span className="text-[10px] text-muted-foreground font-normal">/ ۱۰</span>
                              </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${getScoreBarColor(Number(criteriaAverages.teaching))}`}
                                style={{ width: `${(Number(criteriaAverages.teaching) / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {criteriaAverages.grading && (
                          <div className="space-y-1 bg-card/80 p-2.5 rounded-xl border">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium">نحوه نمره‌دهی</span>
                              <span className={`font-bold ${getScoreTextColor(Number(criteriaAverages.grading))}`}>
                                {criteriaAverages.grading} <span className="text-[10px] text-muted-foreground font-normal">/ ۱۰</span>
                              </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${getScoreBarColor(Number(criteriaAverages.grading))}`}
                                style={{ width: `${(Number(criteriaAverages.grading) / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {criteriaAverages.content && (
                          <div className="space-y-1 bg-card/80 p-2.5 rounded-xl border">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium">کیفیت محتوا و اسلایدها</span>
                              <span className={`font-bold ${getScoreTextColor(Number(criteriaAverages.content))}`}>
                                {criteriaAverages.content} <span className="text-[10px] text-muted-foreground font-normal">/ ۱۰</span>
                              </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${getScoreBarColor(Number(criteriaAverages.content))}`}
                                style={{ width: `${(Number(criteriaAverages.content) / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {criteriaAverages.difficulty && (
                          <div className="space-y-1 bg-card/80 p-2.5 rounded-xl border">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium">سطح دشواری و تکالیف</span>
                              <span className={`font-bold ${getScoreTextColor(Number(criteriaAverages.difficulty))}`}>
                                {criteriaAverages.difficulty} <span className="text-[10px] text-muted-foreground font-normal">/ ۱۰</span>
                              </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${getScoreBarColor(Number(criteriaAverages.difficulty))}`}
                                style={{ width: `${(Number(criteriaAverages.difficulty) / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {reviews.map((rev) => {
                    const cRatings = rev.criteriaRatings || {};
                    const isMyReview = currentUser && rev.userId && rev.userId === currentUser.id;
                    const canDelete = isMyReview || isAdmin;
                    const canEdit = isMyReview || isAdmin;

                    return (
                      <div
                        key={rev.id}
                        className={`p-4 rounded-2xl border ${
                          isMyReview ? "border-primary/40 bg-primary/5 shadow-xs" : "border-border/80 bg-card shadow-2xs"
                        } space-y-3`}
                      >
                        {/* Review Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {rev.isAnonymous ? "ن" : rev.authorName?.[0] || "ک"}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs block text-foreground">
                                  {rev.isAnonymous ? "دانشجوی دانشگاه تهران (ناشناس)" : (rev.authorName || "کاربر سامانه")}
                                </span>
                                {isMyReview && (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/15 text-primary border border-primary/25">
                                    نظر شما
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(rev.createdAt).toLocaleDateString("fa-IR")}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Student Grade Badge if present */}
                            {rev.studentGrade !== null && rev.studentGrade !== undefined && (
                              <Badge
                                variant="outline"
                                className="text-xs font-bold gap-1 px-2.5 py-0.5 border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                              >
                                <GraduationCap className="h-3.5 w-3.5" />
                                <span>نمره: {rev.studentGrade} از ۲۰</span>
                              </Badge>
                            )}

                            {/* Score badge */}
                            <Badge
                              variant="outline"
                              className="text-xs font-bold gap-1 px-2.5 py-0.5 border-primary/30 text-primary bg-primary/5"
                            >
                              <Star className="h-3 w-3 fill-primary text-primary" />
                              <span>{rev.overallRating} / 10</span>
                            </Badge>

                            {/* User Edit Button */}
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(rev)}
                                title="ویرایش نظر شما"
                                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* User / Admin Delete Button */}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteReview(rev.id)}
                                title={isMyReview ? "حذف نظر شما" : "حذف این نظر (ویژه مدیر)"}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Compact Individual Review Criteria Scores */}
                        {(cRatings.teaching || cRatings.grading || cRatings.content || cRatings.difficulty) && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {cRatings.teaching && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/50 border border-border/60 text-[11px]">
                                <span className="text-muted-foreground">تدریس:</span>
                                <span className={`font-bold ${getScoreTextColor(cRatings.teaching)}`}>
                                  {cRatings.teaching}
                                </span>
                                <span className="text-[9px] text-muted-foreground/60">/۱۰</span>
                              </span>
                            )}
                            {cRatings.grading && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/50 border border-border/60 text-[11px]">
                                <span className="text-muted-foreground">نمره‌دهی:</span>
                                <span className={`font-bold ${getScoreTextColor(cRatings.grading)}`}>
                                  {cRatings.grading}
                                </span>
                                <span className="text-[9px] text-muted-foreground/60">/۱۰</span>
                              </span>
                            )}
                            {cRatings.content && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/50 border border-border/60 text-[11px]">
                                <span className="text-muted-foreground">محتوا:</span>
                                <span className={`font-bold ${getScoreTextColor(cRatings.content)}`}>
                                  {cRatings.content}
                                </span>
                                <span className="text-[9px] text-muted-foreground/60">/۱۰</span>
                              </span>
                            )}
                            {cRatings.difficulty && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/50 border border-border/60 text-[11px]">
                                <span className="text-muted-foreground">دشواری:</span>
                                <span className={`font-bold ${getScoreTextColor(cRatings.difficulty)}`}>
                                  {cRatings.difficulty}
                                </span>
                                <span className="text-[9px] text-muted-foreground/60">/۱۰</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Comment Text */}
                        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                          {rev.comment}
                        </p>

                        {/* Emoji Reactions */}
                        <ReviewReactionsBar
                          reviewId={rev.id}
                          initialReactions={rev.reactions}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Left 1 Column: Linked Course & Professor Details */}
        <div className="space-y-6">
          {/* Offering Specific Description Card */}
          {offering.description && (
            <Card className="border-primary/30 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  توضیحات و نکات این ارائه
                </CardTitle>
              </CardHeader>
              <CardContent className="">
                <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
                  {offering.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Linked Course Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                شناسنامه درس مربوطه
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href={`/courses/${offering.courseId}`}
                className="group flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-xs transition-all text-xs"
              >
                <div className="space-y-1 truncate flex-1 min-w-0 pr-1">
                  <span className="font-bold text-sm block truncate group-hover:text-primary transition-colors text-foreground">
                    {offering.courseName}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className=" text-[10px]">
                      {offering.courseCode || "---"}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {offering.courseUnits || 3} واحد تحصیلی
                    </span>
                  </div>
                </div>
                <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all shrink-0 mr-2" />
              </Link>

              {offering.courseDescription && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 bg-muted/20 p-2.5 rounded-xl border border-border/50">
                  {offering.courseDescription}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Professor Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span>{offering.professors && offering.professors.length > 1 ? "اساتید مدرس (هم‌تدریس)" : "مشخصات استاد مدرس"}</span>
                </div>
                {offering.professors && offering.professors.length > 1 && (
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5">
                    {offering.professors.length} استاد
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const profs =
                  offering.professors && offering.professors.length > 0
                    ? offering.professors
                    : [
                        {
                          id: offering.professorId || "",
                          name: offering.professorName || "استاد درس",
                          title: offering.professorTitle,
                          avatarUrl: offering.professorAvatarUrl,
                          email: offering.professorEmail,
                          isPrimary: true,
                        },
                      ];

                return profs.map((p, idx) => (
                  <div key={p.id || idx} className="space-y-2">
                    <Link
                      href={`/professors/${p.id}`}
                      className="group flex items-center justify-between p-3 rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-xs transition-all text-xs"
                    >
                      <div className="flex items-center gap-3 truncate flex-1 min-w-0 pr-1">
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden border border-border/60">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <span>{p.name?.[0] || "ا"}</span>
                          )}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm block truncate group-hover:text-primary transition-colors text-foreground">
                              {p.name}
                            </span>
                            {profs.length > 1 && (
                              <Badge
                                variant={p.isPrimary ? "default" : "outline"}
                                className={`text-[9px] px-1 py-0 ${p.isPrimary ? "text-primary-foreground" : "text-muted-foreground"}`}
                              >
                                {p.isPrimary ? "اصلی" : "هم‌تدریس"}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground block truncate mt-0.5">
                            {[p.title, p.code].filter(Boolean).join(" • ") || "استاد دانشگاه"}
                          </span>
                        </div>
                      </div>
                      <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all shrink-0 mr-2" />
                    </Link>
                    {p.email && (
                      <div className="text-[11px] text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-xl border border-border/50" dir="ltr">
                        {p.email}
                      </div>
                    )}
                  </div>
                ));
              })()}
            </CardContent>
          </Card>

          {/* Academic Policy Note */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-primary">
              <Info className="h-4 w-4 shrink-0" />
              <span>قوانین ارسال نظر</span>
            </div>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              شما می‌توانید هر زمان مایل بودید نظر خود را ویرایش کرده یا حذف نمایید.
            </p>
          </div>
        </div>
      </div>

      {/* Create Review Dialog */}
      <Dialog open={createReviewOpen} onOpenChange={setCreateReviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>ثبت نظر و بازخورد درباره این ارائه</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              دیدگاه و ارزیابی تجربیات خود را با سایر دانشجویان به اشتراک بگذارید.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitReview} className="space-y-4 pt-2">
            {submitError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Criteria Scores */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground block">
                امتیاز به معیارهای درس (از ۱۰ - اختیاری):
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Teaching */}
                <div className="space-y-1.5 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">کیفیت و شیوه تدریس:</span>
                    <Badge variant="outline" className={`text-xs font-bold border-primary/30 ${scores.teaching ? getScoreTextColor(scores.teaching) : "text-muted-foreground"}`}>
                      {scores.teaching ? `${scores.teaching} از ۱۰` : "بدون امتیاز"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleScoreChange("teaching", num)}
                        className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                          scores.teaching === num
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grading */}
                <div className="space-y-1.5 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">نحوه نمره‌دهی و تصحیح:</span>
                    <Badge variant="outline" className={`text-xs font-bold border-primary/30 ${scores.grading ? getScoreTextColor(scores.grading) : "text-muted-foreground"}`}>
                      {scores.grading ? `${scores.grading} از ۱۰` : "بدون امتیاز"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleScoreChange("grading", num)}
                        className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                          scores.grading === num
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-1.5 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">کیفیت محتوا و منابع:</span>
                    <Badge variant="outline" className={`text-xs font-bold border-primary/30 ${scores.content ? getScoreTextColor(scores.content) : "text-muted-foreground"}`}>
                      {scores.content ? `${scores.content} از ۱۰` : "بدون امتیاز"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleScoreChange("content", num)}
                        className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                          scores.content === num
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="space-y-1.5 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">سطح دشواری و تکالیف:</span>
                    <Badge variant="outline" className={`text-xs font-bold border-primary/30 ${scores.difficulty ? getScoreTextColor(scores.difficulty) : "text-muted-foreground"}`}>
                      {scores.difficulty ? `${scores.difficulty} از ۱۰` : "بدون امتیاز"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleScoreChange("difficulty", num)}
                        className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                          scores.difficulty === num
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Student Grade */}
            <div className="space-y-1.5 border-border/50">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <GraduationCap className="h-4 w-4 text-primary" />
                <span>نمره کسب‌شده از این درس (اختیاری - از ۲۰):</span>
              </Label>
              <div className="flex items-center gap-2">
                <NumberInput
                  min={0}
                  max={20}
                  step={0.25}
                  sizeVariant="lg"
                  placeholder="مثال: ۱۸.۵"
                  value={studentGrade}
                  onChange={(val) => setStudentGrade(String(val))}
                  className="w-32 bg-background"
                />
                <span className="text-xs text-muted-foreground">از ۲۰</span>
              </div>
            </div>

            {/* Textarea */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">متن نظر یا تجربه شما *</Label>
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="دیدگاه خود درباره شیوه تدریس استاد، نحوه برگزاری، امتحانات، تکالیف و پروژه‌ها را بنویسید..."
                rows={4}
                className="text-xs bg-background resize-none leading-relaxed"
                required
              />
            </div>

            {/* Anonymous Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={isAnonymous}
                onCheckedChange={(c) => setIsAnonymous(Boolean(c))}
              />
              <span className="text-xs font-medium text-foreground">
                ارسال به صورت ناشناس (نام شما مخفی خواهد ماند)
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateReviewOpen(false)}
                className="h-8 text-xs"
              >
                انصراف
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || !commentText.trim()}
                className="h-8 text-xs font-bold gap-1.5 px-4"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>در حال ارسال...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>ثبت و ارسال نظر</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Review Dialog */}
      <Dialog open={Boolean(editingReview)} onOpenChange={(open) => !open && setEditingReview(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              <span>ویرایش نظر شما درباره این ارائه</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              تغییرات مورد نظر در متن، نمره یا امتیازات را اعمال کرده و ذخیره نمایید.
            </DialogDescription>
          </DialogHeader>

          {editingReview && (
            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
              {editError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Criteria Scores */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground block">
                  ویرایش امتیاز به معیارهای درس (از ۱۰ - اختیاری):
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Teaching */}
                  <div className="space-y-1.5 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">کیفیت و شیوه تدریس:</span>
                      <Badge variant="outline" className={`text-xs font-bold border-primary/30 ${editScores.teaching ? getScoreTextColor(editScores.teaching) : "text-muted-foreground"}`}>
                        {editScores.teaching ? `${editScores.teaching} از ۱۰` : "بدون امتیاز"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleEditScoreChange("teaching", num)}
                          className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                            editScores.teaching === num
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted hover:bg-muted/80 text-foreground"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grading */}
                  <div className="space-y-1.5 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">نحوه نمره‌دهی و تصحیح:</span>
                      <Badge variant="outline" className={`text-xs font-bold border-primary/30 ${editScores.grading ? getScoreTextColor(editScores.grading) : "text-muted-foreground"}`}>
                        {editScores.grading ? `${editScores.grading} از ۱۰` : "بدون امتیاز"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleEditScoreChange("grading", num)}
                          className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                            editScores.grading === num
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted hover:bg-muted/80 text-foreground"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-1.5 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">کیفیت محتوا و منابع:</span>
                      <Badge variant="outline" className={`text-xs font-bold border-primary/30 ${editScores.content ? getScoreTextColor(editScores.content) : "text-muted-foreground"}`}>
                        {editScores.content ? `${editScores.content} از ۱۰` : "بدون امتیاز"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleEditScoreChange("content", num)}
                          className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                            editScores.content === num
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted hover:bg-muted/80 text-foreground"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Difficulty */}
                  <div className="space-y-1.5 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">سطح دشواری و تکالیف:</span>
                      <Badge variant="outline" className={`text-xs font-bold border-primary/30 ${editScores.difficulty ? getScoreTextColor(editScores.difficulty) : "text-muted-foreground"}`}>
                        {editScores.difficulty ? `${editScores.difficulty} از ۱۰` : "بدون امتیاز"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleEditScoreChange("difficulty", num)}
                          className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                            editScores.difficulty === num
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted hover:bg-muted/80 text-foreground"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Edit Student Grade */}
              <div className="space-y-1.5 border-border/50">
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  <span>نمره کسب‌شده از این درس (اختیاری - از ۲۰):</span>
                </Label>
                <div className="flex items-center gap-2">
                  <NumberInput
                    min={0}
                    max={20}
                    step={0.25}
                    sizeVariant="lg"
                    placeholder="مثال: ۱۸.۵"
                    value={editStudentGrade}
                    onChange={(val) => setEditStudentGrade(String(val))}
                    className="w-32 bg-background"
                  />
                  <span className="text-xs text-muted-foreground">از ۲۰</span>
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">متن نظر یا تجربه شما *</Label>
                <Textarea
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  rows={4}
                  className="text-xs bg-background resize-none leading-relaxed"
                  required
                />
              </div>

              {/* Anonymous Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={editIsAnonymous}
                  onCheckedChange={(c) => setEditIsAnonymous(Boolean(c))}
                />
                <span className="text-xs font-medium text-foreground">
                  نمایش به صورت ناشناس (نام شما مخفی خواهد ماند)
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingReview(null)}
                  className="h-8 text-xs"
                >
                  انصراف
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingEdit || !editComment.trim()}
                  className="h-8 text-xs font-bold gap-1.5 px-4"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>در حال ذخیره...</span>
                    </>
                  ) : (
                    "ذخیره تغییرات"
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
