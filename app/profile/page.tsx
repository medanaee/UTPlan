"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  GraduationCap,
  Lock,
  Save,
  Upload,
  Check,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Navbar } from "@/components/navbar";
import type { Faculty, Major, Track, UserSession } from "@/lib/types";
import { fetchJson, postJson, putJson } from "@/lib/api-client";

const ACADEMIC_YEARS = ["1400", "1401", "1402", "1403", "1404", "1405", "1406"];

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  // University Structure Data
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [majorId, setMajorId] = useState("");
  const [trackId, setTrackId] = useState("");

  // Entry Semester split into Year + Type
  const [entryYear, setEntryYear] = useState("1402");
  const [entryType, setEntryType] = useState("2"); // 1 = spring, 2 = fall

  // Password Change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Status & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [authRes, facRes, majRes, trkRes] = await Promise.all([
          fetchJson("/api/auth/me"),
          fetchJson("/api/faculties"),
          fetchJson("/api/majors"),
          fetchJson("/api/tracks"),
        ]);

        if (!authRes.authenticated || !authRes.user) {
          router.push("/login");
          return;
        }

        const u: UserSession = authRes.user;
        setUser(u);
        setFirstName(u.firstName || "");
        setLastName(u.lastName || "");
        setName(u.name || "");
        setAvatarUrl((u as any).avatarUrl || "");
        setFacultyId(u.facultyId || "");
        setMajorId(u.majorId || "");
        setTrackId(u.trackId || "");

        // Parse entry semester (e.g. "1402-1" or "fall_1402" or "1402")
        if (u.entrySemester) {
          const parts = u.entrySemester.split("-");
          if (parts.length === 2) {
            setEntryYear(parts[0]);
            setEntryType(parts[1]);
          } else {
            setEntryYear(u.entrySemester);
          }
        }

        if (facRes.success) setFaculties(facRes.data || []);
        if (majRes.success) setMajors(majRes.data || []);
        if (trkRes.success) setTracks(trkRes.data || []);
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  // Filtered Majors & Tracks
  const filteredMajors = useMemo(() => majors.filter((m) => !facultyId || m.facultyId === facultyId), [majors, facultyId]);
  const filteredTracks = useMemo(() => tracks.filter((t) => !majorId || t.majorId === majorId), [tracks, majorId]);

  const facultyOptions = useMemo(
    () => faculties.map((f) => ({ value: f.id, label: `${f.name}` })),
    [faculties]
  );
  const majorOptions = useMemo(
    () => filteredMajors.map((m) => ({ value: m.id, label: `${m.name}` })),
    [filteredMajors]
  );
  const trackOptions = useMemo(
    () => filteredTracks.map((t) => ({ value: t.id, label: `${t.name} ` })),
    [filteredTracks]
  );
  const yearOptions = useMemo(
    () => ACADEMIC_YEARS.map((yr) => ({ value: yr, label: `سال ${yr}` })),
    []
  );
  const semesterTypeOptions = useMemo(
    () => [
      { value: "1", label: "بهار" },
      { value: "2", label: "پاییز" },
    ],
    []
  );

  // Upload Avatar to Cloudflare / local dev
  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await postJson("/api/upload", formData);

      if (res.success && res.url) {
        setAvatarUrl(res.url);
      } else {
        setErrorMessage(res.message || "خطا در بارگذاری تصویر");
      }
    } catch {
      setErrorMessage("خطا در برقراری ارتباط با سرور آپلود");
    } finally {
      setUploadingImage(false);
    }
  };

  // Submit Profile Form
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    // Password validation if attempting change
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        setErrorMessage("رمز عبور جدید با تکرار آن یکسان نیست.");
        setIsSaving(false);
        return;
      }
      if (newPassword.length < 6) {
        setErrorMessage("رمز عبور جدید باید حداقل ۶ کاراکتر باشد.");
        setIsSaving(false);
        return;
      }
      if (!currentPassword) {
        setErrorMessage("برای تغییر رمز، وارد کردن رمز عبور فعلی الزامی است.");
        setIsSaving(false);
        return;
      }
    }

    const formattedEntrySemester = `${entryYear}-${entryType}`;

    try {
      const res = await putJson("/api/auth/me", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
        avatarUrl,
        facultyId,
        majorId,
        trackId,
        entrySemester: formattedEntrySemester,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });

      if (res.success && res.user) {
        setUser(res.user);
        setSaveMessage("پروفایل و اطلاعات تحصیلی با موفقیت ذخیره شدند.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setSaveMessage(null), 4000);
      } else {
        setErrorMessage(res.message || "خطا در ذخیره‌سازی اطلاعات پروفایل");
      }
    } catch {
      setErrorMessage("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        <Navbar user={user} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">در حال بارگذاری اطلاعات حساب کاربری...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <Navbar user={user} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        {/* Header Title */}
        <div className="flex items-center justify-between pb-4 border-b border-border/70">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">تنظیمات حساب کاربری و پروفایل تحصیلی</h1>
            <p className="text-xs text-muted-foreground mt-1">
              تعیین مشخصات دانشجو، دانشکده، رشته، گرایش و نیمسال ورودی برای اتصال خودکار به چارت‌ها
            </p>
          </div>
          <Button
            type="submit"
            form="profile-form"
            disabled={isSaving || uploadingImage}
            className="font-semibold"
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "در حال ذخیره‌سازی..." : "ذخیره تغییرات پروفایل"}
          </Button>
        </div>

        {/* Notifications */}
        {saveMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300 shadow-2xs">
            <Check className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{saveMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive shadow-2xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form id="profile-form" onSubmit={handleSaveProfile} className="space-y-6">
          {/* ========================================================================= */}
          {/* 1. PERSONAL INFORMATION & AVATAR */}
          {/* ========================================================================= */}
          <Card className="border-border/80 shadow-2xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                مشخصات فردی و تصویر حساب کاربری
              </CardTitle>
              <CardDescription className="text-xs">
                نام نمایشی و عکس پرسنلی شما در سامانه (ذخیره مستقیم بر بستر Cloudflare)
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Avatar Upload */}
              <div className="flex items-center gap-4 p-3 rounded-2xl border border-border/70 bg-muted/20">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-border/80 bg-background overflow-hidden shadow-2xs">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="تصویر پروفایل" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-7 w-7 text-muted-foreground/50" />
                  )}
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  <p className="text-xs font-bold text-foreground">تصویر پروفایل</p>
                  <p className="text-[11px] text-muted-foreground">فرمت‌های مجاز: JPG، PNG یا WebP</p>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadAvatar}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors shadow-2xs">
                        <Upload className="h-3 w-3" />
                        {uploadingImage ? "در حال آپلود..." : "انتخاب و آپلود عکس"}
                      </span>
                    </label>
                    {avatarUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                      
                        onClick={() => setAvatarUrl("")}
                        className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
                      >
                        حذف عکس
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* First Name, Last Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">نام</Label>
                  <Input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="مثلاً علی"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">نام خانوادگی</Label>
                  <Input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="مثلاً رضایی"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">ایمیل دانشگاهی / حساب کاربری</Label>
                  <Input
                    disabled
                    value={user?.email || ""}
                    className="bg-muted/50 cursor-not-allowed opacity-80"
                    dir="ltr"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ========================================================================= */}
          {/* 2. ACADEMIC & CURRICULUM PROFILE (دانشکده، رشته، گرایش، نیمسال ورودی) */}
          {/* ========================================================================= */}
          <Card className="border-border/80 shadow-2xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                اطلاعات تحصیلی و گرایش مصوب
              </CardTitle>
              <CardDescription className="text-xs">
                با تنظیم رشته و گرایش، در هنگام ایجاد چارت‌های تحصیلی نیازی به انتخاب مجدد نخواهد بود.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Faculty & Major */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">دانشکده</Label>
                  <Select
                    value={facultyId}
                    onValueChange={(val) => {
                      if (val) {
                        setFacultyId(val);
                        // Reset major & track if changing faculty
                        const newMajs = majors.filter((m) => m.facultyId === val);
                        if (newMajs.length > 0) {
                          setMajorId(newMajs[0].id);
                          const newTrks = tracks.filter((t) => t.majorId === newMajs[0].id);
                          if (newTrks.length > 0) setTrackId(newTrks[0].id);
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="w-full text-xs h-9">
                      <SelectValue placeholder="انتخاب دانشکده..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {facultyOptions.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">رشته تحصیلی</Label>
                  <Select
                    value={majorId}
                    onValueChange={(val) => {
                      if (val) {
                        setMajorId(val);
                        const newTrks = tracks.filter((t) => t.majorId === val);
                        if (newTrks.length > 0) setTrackId(newTrks[0].id);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full text-xs h-9">
                      <SelectValue placeholder="انتخاب رشته..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {majorOptions.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Track & Entry Semester */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">گرایش تخصصی</Label>
                  <Select
                    value={trackId}
                    onValueChange={(val) => val && setTrackId(val)}
                  >
                    <SelectTrigger className="w-full text-xs h-9">
                      <SelectValue placeholder="انتخاب گرایش..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {trackOptions.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Entry Semester Year & Season */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">نیمسال ورود به دانشگاه</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={entryYear} onValueChange={(val) => val && setEntryYear(val)}>
                      <SelectTrigger className="w-full text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {yearOptions.map((yr) => (
                            <SelectItem key={yr.value} value={yr.value}>
                              {yr.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    <Select value={entryType} onValueChange={(val) => val && setEntryType(val)}>
                      <SelectTrigger className="w-full text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {semesterTypeOptions.map((st) => (
                            <SelectItem key={st.value} value={st.value}>
                              {st.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Calendar mapping helper alert */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground flex items-center gap-2">
                <span>
                  با ثبت ورودی <strong>{entryType === "1" ? "بهار" : "پاییز"} {entryYear}</strong>، ترم ۱ چارت شما متناظر با {entryType === "1" ? "بهار" : "پاییز"} {entryYear} و ترم ۲ متناظر با {entryType === "1" ? `پاییز ${entryYear}` : `بهار ${Number(entryYear) + 1}`} در تقویم هفتگی قرار خواهد گرفت.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ========================================================================= */}
          {/* 3. SECURITY & PASSWORD */}
          {/* ========================================================================= */}
          <Card className="border-border/80 shadow-2xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                امنیت و تغییر رمز عبور
              </CardTitle>
              <CardDescription className="text-xs">
                در صورت تمایل به تغییر کلمه عبور، فیلدهای زیر را پر کنید (در غیر این صورت خالی بگذارید)
              </CardDescription>
            </CardHeader>

            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رمز عبور فعلی</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رمز عبور جدید</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="حداقل ۶ کاراکتر"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">تکرار رمز عبور جدید</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="تکرار رمز عبور جدید"
                />
              </div>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
}
