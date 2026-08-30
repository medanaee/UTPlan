"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Layers,
  BookOpen,
  User,
  Calendar,
  Clock,
  MapPin,
  Star,
  MessageSquare,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Share2,
  Check,
  Send,
  Loader2,
  ShieldAlert,
  Sparkles,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CourseOffering, ReviewItem, ReviewCriteria, UserSession } from "@/lib/types";

const DAYS_NAMES: Record<number, string> = {
  0: "شنبه",
  1: "یکشنبه",
  2: "دوشنبه",
  3: "سه‌شنبه",
  4: "چهارشنبه",
  5: "پنج‌شنبه",
  6: "جمعه",
};

interface OfferingDetailViewProps {
  offering: CourseOffering;
}

export function OfferingDetailView({ offering }: OfferingDetailViewProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Form state
  const [commentText, setCommentText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
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

  // Load current user
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
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
      const res = await fetch(`/api/offerings/reviews?offeringId=${offering.id}`).then((r) => r.json());
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

  // Submit Review
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
      const res = await fetch("/api/offerings/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeringId: offering.id,
          comment: commentText.trim(),
          isAnonymous,
          criteriaRatings: scores,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSubmitSuccess("نظر شما با موفقیت ثبت شد و در دسترس دانشجویان قرار گرفت.");
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

  // Admin Delete Review
  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm("آیا از حذف این نظر توسط مدیر اطمینان دارید؟")) return;

    try {
      const res = await fetch(`/api/offerings/reviews?id=${reviewId}`, {
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

  // Calculate overall average
  const totalAvg =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + (r.overallRating || 10), 0) / reviews.length).toFixed(1)
      : null;

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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4 max-w-3xl">
            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs font-bold px-3 py-1 bg-background/80">
                {offering.courseCode || "کد درس"}
              </Badge>
              <Badge variant="secondary" className="text-xs font-bold px-2.5 py-1">
                {offering.courseUnits || 3} واحد تحصیلی
              </Badge>
              <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-primary/10 text-primary border-primary/30">
                ارائه فعال در دانشکده
              </span>
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
          <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
            <div className="rounded-2xl border border-primary/30 bg-card p-4 text-center min-w-[110px] shadow-2xs">
              <div className="flex items-center justify-center gap-1 text-primary">
                <Star className="h-5 w-5 fill-primary text-primary" />
                <span className="text-2xl font-black">{totalAvg || "۱۰"}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">
                میانگین رضایت از ۱۰
              </span>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 text-center min-w-[90px] shadow-2xs">
              <span className="text-2xl font-black text-foreground block">{reviews.length}</span>
              <span className="text-[10px] text-muted-foreground font-medium mt-1 block">
                نظر و تجربه
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Right 2 Columns: Classes/Schedule + Reviews Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Class Schedule & Events Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                زمان‌بندی کلاس‌ها و تاریخ امتحانات ثبت‌شده
              </CardTitle>
              <CardDescription className="text-xs">
                رویدادهای رسمی این ارائه در نیمسال‌های تحصیلی
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {offering.events && offering.events.length > 0 ? (
                offering.events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 rounded-2xl border border-border/80 bg-card/60 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-bold">
                          نیمسال {evt.term}
                        </Badge>
                        {evt.groupCode && (
                          <Badge variant="outline" className="text-xs font-mono">
                            گروه {evt.groupCode}
                          </Badge>
                        )}
                      </div>
                      {evt.location && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary shrink-0" />
                          <span>{evt.location}</span>
                        </span>
                      )}
                    </div>

                    {/* Weekly Class Slots */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-semibold text-muted-foreground">جلسات هفتگی:</span>
                      {evt.slots && evt.slots.length > 0 ? (
                        evt.slots.map((s, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-primary/5 text-primary border border-primary/20"
                          >
                            <Clock className="h-3 w-3" />
                            <span>{DAYS_NAMES[s.dayOfWeek] || "روز"}: {s.startTime} تا {s.endTime}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">تعیین نشده</span>
                      )}
                    </div>

                    {/* Exam Time */}
                    {evt.examDate && (
                      <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 flex items-center justify-between">
                        <span className="font-semibold">امتحان پایان‌ترم: {evt.examDate}</span>
                        <span>ساعت: {evt.examStartTime || "۰۸:۳۰"} تا {evt.examEndTime || "۱۱:۰۰"}</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground/70 bg-muted/20 rounded-xl border border-dashed">
                  هنوز رویداد کلاسی فعالی برای این ارائه در سامانه ثبت نشده است.
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
                    حالت مدیریت: دکمه حذف نظرات فعال است
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                نظرات و امتیازات دانشجویانی که قبلاً این درس را با این استاد گذرانده‌اند.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 space-y-6">
              {/* Form to submit review */}
              <form
                onSubmit={handleSubmitReview}
                className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-4"
              >
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  ثبت نظر و امتیاز شما برای این ارائه درس:
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
                    امتیاز به معیارهای ارائه (از ۱۰ - اختیاری):
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Teaching */}
                    <div className="space-y-1 bg-card p-2 rounded-xl border border-border/70">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold">کیفیت تدریس در ارائه:</span>
                        <span className="font-mono font-bold text-primary">
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
                        <span className="font-mono font-bold text-primary">
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

                    {/* Content */}
                    <div className="space-y-1 bg-card p-2 rounded-xl border border-border/70">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold">کیفیت اسلایدها و محتوا:</span>
                        <span className="font-mono font-bold text-primary">
                          {scores.content ? `${scores.content} / 10` : "ثبت‌نشده"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleScoreChange("content", num)}
                            className={`flex-1 h-6 rounded text-[10px] font-bold transition-all ${
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
                    <div className="space-y-1 bg-card p-2 rounded-xl border border-border/70">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold">سطح دشواری و فشار تکالیف:</span>
                        <span className="font-mono font-bold text-primary">
                          {scores.difficulty ? `${scores.difficulty} / 10` : "ثبت‌نشده"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleScoreChange("difficulty", num)}
                            className={`flex-1 h-6 rounded text-[10px] font-bold transition-all ${
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

                {/* Comment Textarea */}
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-semibold">متن نظر یا تجربه شما *</Label>
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="تجربه خود از حضور در کلاس، نوع آزمون‌ها، پروژه‌ها و رفتار کلاسی استاد را به اشتراک بگذارید..."
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
                      ارسال به صورت ناشناس (نام شما نمایش داده نمی‌شود)
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
                  <p className="font-bold text-foreground">هنوز نظری برای این ارائه ثبت نشده است.</p>
                  <p className="text-[11px]">اولین نفری باشید که تجربه خود را با سایر دانشجویان به اشتراک می‌گذارد.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {reviews.map((rev) => {
                    const cRatings = rev.criteriaRatings || {};
                    return (
                      <div
                        key={rev.id}
                        className="p-4 rounded-2xl border border-border/80 bg-card space-y-3 shadow-2xs"
                      >
                        {/* Review Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {rev.isAnonymous ? "ن" : rev.authorName?.[0] || "ک"}
                            </div>
                            <div>
                              <span className="font-bold text-xs block text-foreground">
                                {rev.isAnonymous ? "دانشجوی دانشگاه تهران (ناشناس)" : (rev.authorName || "کاربر سامانه")}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(rev.createdAt).toLocaleDateString("fa-IR")}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Score badge */}
                            <Badge
                              variant="outline"
                              className="text-xs font-bold gap-1 px-2.5 py-0.5 border-primary/30 text-primary bg-primary/5"
                            >
                              <Star className="h-3 w-3 fill-primary text-primary" />
                              <span>{rev.overallRating} / 10</span>
                            </Badge>

                            {/* Admin Delete Button */}
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteReview(rev.id)}
                                title="حذف این نظر (ویژه مدیر)"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Criteria Sub-Badges if provided */}
                        {(cRatings.teaching || cRatings.grading || cRatings.content || cRatings.difficulty) && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            {cRatings.teaching && (
                              <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground border">
                                تدریس: <strong>{cRatings.teaching}/10</strong>
                              </span>
                            )}
                            {cRatings.grading && (
                              <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground border">
                                نمره‌دهی: <strong>{cRatings.grading}/10</strong>
                              </span>
                            )}
                            {cRatings.content && (
                              <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground border">
                                محتوا: <strong>{cRatings.content}/10</strong>
                              </span>
                            )}
                            {cRatings.difficulty && (
                              <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground border">
                                دشواری: <strong>{cRatings.difficulty}/10</strong>
                              </span>
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

        {/* Left 1 Column: Linked Course & Professor Details */}
        <div className="space-y-6">
          {/* Linked Course Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                شناسنامه درس مربوطه
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="space-y-1">
                <span className="font-bold text-sm block text-foreground">{offering.courseName}</span>
                <span className="font-mono text-xs text-muted-foreground block">{offering.courseCode}</span>
              </div>

              {offering.courseDescription && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {offering.courseDescription}
                </p>
              )}

              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full text-xs font-semibold h-8"
              >
                <Link href={`/courses/${offering.courseId}`}>
                  مشاهده صفحه کامل درس و پیش‌نیازها
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Professor Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                مشخصات استاد مدرس
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {offering.professorName?.[0] || "ا"}
                </div>
                <div>
                  <span className="font-bold text-sm block text-foreground">{offering.professorName}</span>
                  <span className="text-xs text-muted-foreground block">{offering.professorTitle || "استاد تمام"}</span>
                </div>
              </div>

              {offering.professorEmail && (
                <div className="text-xs text-muted-foreground font-mono">
                  ایمیل: {offering.professorEmail}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full text-xs font-semibold h-8"
              >
                <Link href={`/professors/${offering.professorId}`}>
                  مشاهده پروفایل و سایر ارائه‌های استاد
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Academic Policy Note */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-primary">
              <Info className="h-4 w-4 shrink-0" />
              <span>قوانین ارسال نظر</span>
            </div>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              نظرات پس از ارسال بلافاصله نمایش داده می‌شوند. از به کار بردن الفاظ نامناسب خودداری فرمایید؛ نظرات غیراخلاقی توسط مدیران سامانه حذف خواهند شد.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
