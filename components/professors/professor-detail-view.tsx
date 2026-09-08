"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchJson, postJson, putJson, deleteJson } from "@/lib/api-client";
import {
  Users,
  BookOpen,
  Building2,
  Mail,
  Globe,
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
  ExternalLink,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Professor, ReviewItem, UserSession } from "@/lib/types";

interface ProfessorDetailViewProps {
  professor: Professor;
}

export function ProfessorDetailView({ professor }: ProfessorDetailViewProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // New Form state
  const [commentText, setCommentText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [scores, setScores] = useState<{
    teaching?: number;
    grading?: number;
    behavior?: number;
    mastery?: number;
  }>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit Review Modal State
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [editComment, setEditComment] = useState("");
  const [editIsAnonymous, setEditIsAnonymous] = useState(false);
  const [editScores, setEditScores] = useState<{
    teaching?: number;
    grading?: number;
    behavior?: number;
    mastery?: number;
  }>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Load current user session
  useEffect(() => {
    fetchJson("/api/auth/me")
      .then((data) => {
        if (data.authenticated) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  // Load reviews for this professor
  const loadReviews = async () => {
    try {
      setLoadingReviews(true);
      const res = await fetchJson(`/api/professors/reviews?professorId=${professor.id}`);
      if (res.success && Array.isArray(res.data)) {
        setReviews(res.data);
      }
    } catch (err) {
      console.error("Error loading professor reviews:", err);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [professor.id]);

  const handleScoreChange = (field: "teaching" | "grading" | "behavior" | "mastery", val: number) => {
    setScores((prev) => ({
      ...prev,
      [field]: prev[field] === val ? undefined : val,
    }));
  };

  const handleEditScoreChange = (field: "teaching" | "grading" | "behavior" | "mastery", val: number) => {
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
      setSubmitError("لطفاً متن نظر یا تجربه خود درباره این استاد را بنویسید.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/professors/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professorId: professor.id,
          comment: commentText.trim(),
          isAnonymous,
          criteriaRatings: scores,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSubmitSuccess("نظر شما با موفقیت برای این استاد ثبت شد.");
        setCommentText("");
        setIsAnonymous(false);
        setScores({});
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
      const res = await fetch("/api/professors/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingReview.id,
          comment: editComment.trim(),
          isAnonymous: editIsAnonymous,
          criteriaRatings: editScores,
        }),
      }).then((r) => r.json());

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
      const res = await fetch(`/api/professors/reviews?id=${reviewId}`, {
        method: "DELETE",
      }).then((r) => r.json());

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

  const criteriaAverages = React.useMemo(() => {
    const t: number[] = [];
    const g: number[] = [];
    const b: number[] = [];
    const m: number[] = [];

    reviews.forEach((r) => {
      if (r.criteriaRatings?.teaching) t.push(r.criteriaRatings.teaching);
      if (r.criteriaRatings?.grading) g.push(r.criteriaRatings.grading);
      if (r.criteriaRatings?.behavior) b.push(r.criteriaRatings.behavior);
      if (r.criteriaRatings?.mastery) m.push(r.criteriaRatings.mastery);
    });

    const calc = (arr: number[]) => (arr.length > 0 ? (arr.reduce((x, y) => x + y, 0) / arr.length).toFixed(1) : null);
    const teaching = calc(t);
    const grading = calc(g);
    const behavior = calc(b);
    const mastery = calc(m);

    return {
      teaching,
      grading,
      behavior,
      mastery,
      hasAny: Boolean(teaching || grading || behavior || mastery),
    };
  }, [reviews]);

  const offerings = professor.offerings || [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <Link href="/" className="hover:text-foreground transition-colors">
            خانه
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rotate-180 opacity-50" />
          <Link href="/professors" className="hover:text-foreground transition-colors">
            جستجوی اساتید
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rotate-180 opacity-50" />
          <span className="text-foreground font-bold">{professor.name}</span>
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
            onClick={() => router.push("/professors")}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>بازگشت به لیست اساتید</span>
          </Button>
        </div>
      </div>

      {/* Hero Header Card - Flat & Minimal */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-b from-primary/10 via-background to-background p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 max-w-3xl">
            {/* Avatar */}
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-2xl sm:text-3xl shrink-0 border-2 border-primary/30 shadow-xs overflow-hidden">
              {professor.avatarUrl ? (
                <img
                  src={professor.avatarUrl}
                  alt={professor.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{professor.name ? professor.name.charAt(0) : "ا"}</span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs font-bold bg-background/80">
                  {professor.title || "استاد تمام"}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-primary shrink-0 opacity-80" />
                  <span>{professor.facultyName || "دانشکده مهندسی برق و کامپیوتر"}</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                {professor.name}
              </h1>
            </div>
          </div>

          {/* Quick Stats Box */}
          <div className="flex items-center gap-3 shrink-0 self-start lg:self-end">
            <div className="rounded-xl border border-border/80 p-4 text-center min-w-[110px] shadow-2xs">
              <div className="flex items-center justify-center gap-1 text-primary">
                <Star className="h-5 w-5 fill-primary text-primary" />
                <span className="text-2xl font-black">{totalAvg || "۱۰"}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">
                میانگین رضایت از ۱۰
              </span>
            </div>

            <div className="rounded-xl border border-border/80 p-4 text-center min-w-[90px] shadow-2xs">
              <span className="text-2xl font-black text-foreground block">{reviews.length}</span>
              <span className="text-[10px] text-muted-foreground font-medium mt-1 block">
                نظر و ارزیابی
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Right 2 Columns: Offered Courses & Reviews Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Courses Taught by this Professor */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                دروس و ارائه‌های فعال این استاد ({offerings.length})
              </CardTitle>
              <CardDescription className="text-xs">
                دروسی که توسط این استاد در دانشکده ارائه و تدریس می‌شوند.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {offerings.length > 0 ? (
                offerings.map((off) => (
                  <Link
                    key={off.id}
                    href={`/offerings/${off.id}`}
                    className="group flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-xs transition-all text-xs"
                  >
                    <div className="space-y-1 truncate flex-1 min-w-0 pr-1">
                      <span className="font-bold text-sm block truncate group-hover:text-primary transition-colors text-foreground">
                        {off.courseName}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className=" text-[10px]">
                          {off.courseCode || "---"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {off.courseUnits || 3} واحد تحصیلی
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-primary font-semibold shrink-0">
                      <span>مشاهده صفحه ارائه و نظرات</span>
                      <ArrowLeft className="h-3.5 w-3.5 transition-transform" />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground/70 bg-muted/20 rounded-xl border border-dashed">
                  درسی برای این استاد در سامانه ثبت نشده است.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student Reviews & Ratings Section */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  ارزیابی و نظرات دانشجویان درباره استاد ({reviews.length})
                </CardTitle>
                {isAdmin && (
                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                    مدیریت سامانه: دسترسی حذف کلیه نظرات
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                دیدگاه‌ها، نقدها و تجربیات ثبت‌شده توسط دانشجویان درباره نحوه تدریس و اخلاق استاد
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Form to submit review */}
              <form
                onSubmit={handleSubmitReview}
                className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-4"
              >
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  ثبت ارزیابی و نظر شما برای این استاد:
                </span>

                {submitError && (
                  <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {submitSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{submitSuccess}</span>
                  </div>
                )}

                {/* 4 Optional Criteria Sliders/Rating 1 to 10 */}
                <div className="space-y-2 pt-1 border-t border-border/40">
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    امتیاز به معیارهای استاد (از ۱۰ - اختیاری):
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Teaching */}
                    <div className="space-y-1 bg-card p-2 rounded-xl border border-border/70">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold">کیفیت و شیوه تدریس:</span>
                        <span className=" font-bold text-primary">
                          {scores.teaching ? `${scores.teaching} / 10` : "ثبت‌نشده"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleScoreChange("teaching", num)}
                            className={`flex-1 h-6 rounded text-[10px] font-bold transition-all ${
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
                    <div className="space-y-1 bg-card p-2 rounded-xl border border-border/70">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold">نحوه نمره‌دهی و تصحیح:</span>
                        <span className=" font-bold text-primary">
                          {scores.grading ? `${scores.grading} / 10` : "ثبت‌نشده"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleScoreChange("grading", num)}
                            className={`flex-1 h-6 rounded text-[10px] font-bold transition-all ${
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

                    {/* Behavior */}
                    <div className="space-y-1 bg-card p-2 rounded-xl border border-border/70">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold">اخلاق و تعامل با دانشجو:</span>
                        <span className=" font-bold text-primary">
                          {scores.behavior ? `${scores.behavior} / 10` : "ثبت‌نشده"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleScoreChange("behavior", num)}
                            className={`flex-1 h-6 rounded text-[10px] font-bold transition-all ${
                              scores.behavior === num
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "bg-muted hover:bg-muted/80 text-foreground"
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mastery */}
                    <div className="space-y-1 bg-card p-2 rounded-xl border border-border/70">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold">تسلط علمی و پاسخگویی:</span>
                        <span className=" font-bold text-primary">
                          {scores.mastery ? `${scores.mastery} / 10` : "ثبت‌نشده"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleScoreChange("mastery", num)}
                            className={`flex-1 h-6 rounded text-[10px] font-bold transition-all ${
                              scores.mastery === num
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

                {/* Comment Textarea */}
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-semibold">متن نظر یا تجربه شما *</Label>
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="دیدگاه خود درباره شیوه تدریس استاد، نحوه برخورد، امتحانات و تکالیف را بنویسید..."
                    rows={3}
                    className="text-xs bg-background resize-none"
                    required
                  />
                </div>

                {/* Anonymous checkbox & Submit */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={isAnonymous}
                      onCheckedChange={(c) => setIsAnonymous(Boolean(c))}
                    />
                    <span className="text-xs font-medium text-foreground">
                      ارسال به صورت ناشناس (نام شما مخفی خواهد ماند)
                    </span>
                  </label>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || !commentText.trim()}
                    className="h-8 text-xs font-bold gap-1.5 px-4"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        در حال ارسال...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        ثبت نظر
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Reviews Feed */}
              {loadingReviews ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs">در حال دریافت نظرات...</span>
                </div>
              ) : reviews.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground/80 bg-muted/20 rounded-2xl border border-dashed p-6 space-y-2">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="font-bold text-foreground">هنوز نظری برای این استاد ثبت نشده است.</p>
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
                          میانگین نمرات معیارها بر اساس تجربیات دانشجویان:
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
                              <span className=" font-bold text-foreground">
                                {criteriaAverages.teaching} <span className="text-[10px] text-muted-foreground font-normal">/ ۱۰</span>
                              </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                                style={{ width: `${(Number(criteriaAverages.teaching) / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {criteriaAverages.grading && (
                          <div className="space-y-1 bg-card/80 p-2.5 rounded-xl border">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium">نحوه نمره‌دهی</span>
                              <span className=" font-bold text-foreground">
                                {criteriaAverages.grading} <span className="text-[10px] text-muted-foreground font-normal">/ ۱۰</span>
                              </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-linear-to-r from-blue-500 to-cyan-400 transition-all duration-700"
                                style={{ width: `${(Number(criteriaAverages.grading) / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {criteriaAverages.behavior && (
                          <div className="space-y-1 bg-card/80 p-2.5 rounded-xl border">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium">اخلاق و پاسخگویی</span>
                              <span className=" font-bold text-foreground">
                                {criteriaAverages.behavior} <span className="text-[10px] text-muted-foreground font-normal">/ ۱۰</span>
                              </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-linear-to-r from-purple-500 to-pink-400 transition-all duration-700"
                                style={{ width: `${(Number(criteriaAverages.behavior) / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {criteriaAverages.mastery && (
                          <div className="space-y-1 bg-card/80 p-2.5 rounded-xl border">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium">تسلط علمی</span>
                              <span className=" font-bold text-foreground">
                                {criteriaAverages.mastery} <span className="text-[10px] text-muted-foreground font-normal">/ ۱۰</span>
                              </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-linear-to-r from-amber-500 to-yellow-400 transition-all duration-700"
                                style={{ width: `${(Number(criteriaAverages.mastery) / 10) * 100}%` }}
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
                            {/* Overall score badge */}
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

                        {/* Criteria Score Progress Bars */}
                        {(cRatings.teaching || cRatings.grading || cRatings.behavior || cRatings.mastery) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-2xl bg-muted/20 border border-border/60">
                            {cRatings.teaching && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-muted-foreground font-medium">شیوه و کیفیت تدریس</span>
                                  <span className=" font-bold text-foreground">
                                    {cRatings.teaching} <span className="text-[9px] text-muted-foreground font-normal">/ ۱۰</span>
                                  </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-muted/70 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      cRatings.teaching >= 8
                                        ? "bg-linear-to-r from-emerald-500 to-teal-400"
                                        : cRatings.teaching >= 5
                                        ? "bg-linear-to-r from-amber-500 to-yellow-400"
                                        : "bg-linear-to-r from-rose-500 to-red-400"
                                    }`}
                                    style={{ width: `${(cRatings.teaching / 10) * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {cRatings.grading && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-muted-foreground font-medium">نحوه نمره‌دهی و تصحیح</span>
                                  <span className=" font-bold text-foreground">
                                    {cRatings.grading} <span className="text-[9px] text-muted-foreground font-normal">/ ۱۰</span>
                                  </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-muted/70 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      cRatings.grading >= 8
                                        ? "bg-linear-to-r from-emerald-500 to-teal-400"
                                        : cRatings.grading >= 5
                                        ? "bg-linear-to-r from-amber-500 to-yellow-400"
                                        : "bg-linear-to-r from-rose-500 to-red-400"
                                    }`}
                                    style={{ width: `${(cRatings.grading / 10) * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {cRatings.behavior && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-muted-foreground font-medium">اخلاق و تعامل با دانشجو</span>
                                  <span className=" font-bold text-foreground">
                                    {cRatings.behavior} <span className="text-[9px] text-muted-foreground font-normal">/ ۱۰</span>
                                  </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-muted/70 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      cRatings.behavior >= 8
                                        ? "bg-linear-to-r from-emerald-500 to-teal-400"
                                        : cRatings.behavior >= 5
                                        ? "bg-linear-to-r from-amber-500 to-yellow-400"
                                        : "bg-linear-to-r from-rose-500 to-red-400"
                                    }`}
                                    style={{ width: `${(cRatings.behavior / 10) * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {cRatings.mastery && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-muted-foreground font-medium">تسلط علمی و پاسخگویی</span>
                                  <span className=" font-bold text-foreground">
                                    {cRatings.mastery} <span className="text-[9px] text-muted-foreground font-normal">/ ۱۰</span>
                                  </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-muted/70 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      cRatings.mastery >= 8
                                        ? "bg-linear-to-r from-emerald-500 to-teal-400"
                                        : cRatings.mastery >= 5
                                        ? "bg-linear-to-r from-amber-500 to-yellow-400"
                                        : "bg-linear-to-r from-rose-500 to-red-400"
                                    }`}
                                    style={{ width: `${(cRatings.mastery / 10) * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Comment Text */}
                        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                          {rev.comment}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Left 1 Column: Contact & Links & Guide */}
        <div className="space-y-6">
          {/* Contact and Academic Profile Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                راه‌های ارتباطی و پروفایل علمی
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {professor.email ? (
                <div className="p-3 rounded-2xl border border-border/80 bg-muted/20 space-y-1">
                  <span className="text-[11px] text-muted-foreground block">آدرس پست الکترونیکی:</span>
                  <a
                    href={`mailto:${professor.email}`}
                    className=" text-xs text-primary font-bold hover:underline block truncate"
                  >
                    {professor.email}
                  </a>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground/70 p-3 rounded-2xl border border-dashed bg-muted/10 text-center">
                  ایمیلی ثبت نشده است.
                </div>
              )}

              {professor.links && Object.keys(professor.links).length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-semibold text-foreground block">صفحات و پیوندهای علمی:</span>
                  {professor.links.website && (
                    <a
                      href={professor.links.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card hover:border-primary/50 text-xs transition-colors"
                    >
                      <span className="truncate">وب‌سایت شخصی / دانشگاهی</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                    </a>
                  )}
                  {professor.links.scholar && (
                    <a
                      href={professor.links.scholar}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card hover:border-primary/50 text-xs transition-colors"
                    >
                      <span className="truncate">صفحه Google Scholar</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Academic Policy Note */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-primary">
              <Info className="h-4 w-4 shrink-0" />
              <span>قوانین ثبت نظر استاد</span>
            </div>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              شما می‌توانید در هر زمان نظر و ارزیابی خود را ویرایش نمایید یا آن را حذف کنید.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Review Dialog */}
      <Dialog open={Boolean(editingReview)} onOpenChange={(open) => !open && setEditingReview(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              ویرایش نظر شما درباره استاد
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              تغییرات مورد نظر در متن یا امتیازات را اعمال کرده و ذخیره نمایید.
            </DialogDescription>
          </DialogHeader>

          {editingReview && (
            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
              {editError && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Criteria Scores */}
              <div className="space-y-2">
                <span className="text-[11px] text-muted-foreground font-medium block">
                  ویرایش امتیاز به معیارها (از ۱۰ - اختیاری):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Teaching */}
                  <div className="space-y-1 bg-muted/30 p-2 rounded-xl border">
                    <div className="flex justify-between items-center text-[11px]">
                      <span>کیفیت تدریس:</span>
                      <span className=" font-bold text-primary">{editScores.teaching || "---"}</span>
                    </div>
                    <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleEditScoreChange("teaching", num)}
                          className={`flex-1 h-6 rounded text-[10px] font-bold ${
                            editScores.teaching === num ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grading */}
                  <div className="space-y-1 bg-muted/30 p-2 rounded-xl border">
                    <div className="flex justify-between items-center text-[11px]">
                      <span>نمره‌دهی:</span>
                      <span className=" font-bold text-primary">{editScores.grading || "---"}</span>
                    </div>
                    <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleEditScoreChange("grading", num)}
                          className={`flex-1 h-6 rounded text-[10px] font-bold ${
                            editScores.grading === num ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Behavior */}
                  <div className="space-y-1 bg-muted/30 p-2 rounded-xl border">
                    <div className="flex justify-between items-center text-[11px]">
                      <span>اخلاق و تعامل:</span>
                      <span className=" font-bold text-primary">{editScores.behavior || "---"}</span>
                    </div>
                    <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleEditScoreChange("behavior", num)}
                          className={`flex-1 h-6 rounded text-[10px] font-bold ${
                            editScores.behavior === num ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mastery */}
                  <div className="space-y-1 bg-muted/30 p-2 rounded-xl border">
                    <div className="flex justify-between items-center text-[11px]">
                      <span>تسلط علمی:</span>
                      <span className=" font-bold text-primary">{editScores.mastery || "---"}</span>
                    </div>
                    <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleEditScoreChange("mastery", num)}
                          className={`flex-1 h-6 rounded text-[10px] font-bold ${
                            editScores.mastery === num ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">متن نظر</Label>
                <Textarea
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  rows={3}
                  className="text-xs bg-background resize-none"
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
                  نمایش به صورت ناشناس
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
                  className="h-8 text-xs font-bold gap-1 px-4"
                >
                  {savingEdit ? "در حال ذخیره..." : "ذخیره تغییرات"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
