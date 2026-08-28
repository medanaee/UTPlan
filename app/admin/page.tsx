"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  LogOut,
  Building2,
  GraduationCap,
  BookOpen,
  Users,
  Layers,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Link as LinkIcon,
  Tag,
  Clock,
  Check,
  GitBranch,
  Play,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CourseCategoryManager } from "@/components/admin/course-category-manager";
import { RuleQueryBuilder } from "@/components/admin/rule-query-builder";
import { RuleSandboxTester } from "@/components/admin/rule-sandbox-tester";
import type {
  UserSession,
  Faculty,
  Major,
  Track,
  VisualCategory,
  RuleCategory,
  Course,
  Professor,
  TrackCourseAssignment,
  RuleGroupNode,
} from "@/lib/types";

const COLOR_PRESETS = [
  { name: "آبی", hex: "#3b82f6" },
  { name: "بنفش", hex: "#8b5cf6" },
  { name: "سبز زمردی", hex: "#10b981" },
  { name: "آسمانی", hex: "#0ea5e9" },
  { name: "خاکستری", hex: "#64748b" },
  { name: "کهربایی", hex: "#f59e0b" },
  { name: "رز", hex: "#f43f5e" },
  { name: "نیلی", hex: "#6366f1" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Data states
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [trackAssignments, setTrackAssignments] = useState<TrackCourseAssignment[]>([]);

  // Selection states
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>("");
  const [selectedMajorId, setSelectedMajorId] = useState<string>("");
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");

  // Categories for selected track
  const [visualCats, setVisualCats] = useState<VisualCategory[]>([]);
  const [ruleCats, setRuleCats] = useState<RuleCategory[]>([]);

  // Search filter
  const [courseSearch, setCourseSearch] = useState("");

  // Modals
  const [facultyModalOpen, setFacultyModalOpen] = useState(false);
  const [majorModalOpen, setMajorModalOpen] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [prereqModalOpen, setPrereqModalOpen] = useState(false);
  const [selectedCourseForPrereq, setSelectedCourseForPrereq] = useState<Course | null>(null);
  const [profModalOpen, setProfModalOpen] = useState(false);
  const [vcatModalOpen, setVcatModalOpen] = useState(false);
  const [rcatModalOpen, setRcatModalOpen] = useState(false);

  // Form states
  const [facultyForm, setFacultyForm] = useState({ name: "", code: "" });
  const [majorForm, setMajorForm] = useState({ name: "", code: "" });
  const [trackForm, setTrackForm] = useState({ name: "", code: "" });
  const [courseForm, setCourseForm] = useState({
    name: "",
    code: "",
    units: 3,
    facultyId: "",
    offeredIn: "both" as "fall" | "spring" | "both",
    visualCategoryId: "",
    ruleCategoryId: "",
    description: "",
  });
  const [prereqForm, setPrereqForm] = useState({
    requiredCourseId: "",
    type: "prerequisite" as "prerequisite" | "corequisite",
  });
  const [prereqError, setPrereqError] = useState<string | null>(null);
  const [profForm, setProfForm] = useState({
    name: "",
    title: "استاد",
    email: "",
    facultyId: "",
  });
  const [vcatForm, setVcatForm] = useState({ name: "", color: "#3b82f6", sortOrder: 1 });
  const [rcatForm, setRcatForm] = useState({ name: "", minCredits: 0 });

  // Status message
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Fetch all basic data
  const loadAllData = async () => {
    try {
      const [facRes, majRes, trkRes, crsRes, prfRes] = await Promise.all([
        fetch("/api/faculties").then((r) => r.json()),
        fetch("/api/majors").then((r) => r.json()),
        fetch("/api/tracks").then((r) => r.json()),
        fetch("/api/courses").then((r) => r.json()),
        fetch("/api/professors").then((r) => r.json()),
      ]);

      if (facRes.success) {
        setFaculties(facRes.data);
        if (facRes.data.length > 0 && !selectedFacultyId) {
          setSelectedFacultyId(facRes.data[0].id);
        }
      }
      if (majRes.success) setMajors(majRes.data);
      if (trkRes.success) setTracks(trkRes.data);
      if (crsRes.success) setCourses(crsRes.data);
      if (prfRes.success) setProfessors(prfRes.data);
    } catch (e) {
      console.error("Load data error:", e);
    }
  };

  // Auth check and initial load
  useEffect(() => {
    async function checkAuthAndLoad() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        if (!data.authenticated || (data.user.role !== "admin" && data.user.role !== "super_admin")) {
          router.push("/login");
          return;
        }
        setUser(data.user);
        await loadAllData();
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    checkAuthAndLoad();
  }, [router]);

  // Load categories and assignments when track changes
  useEffect(() => {
    if (!selectedTrackId) return;
    async function loadCatsAndAssignments() {
      try {
        const [catRes, assignRes] = await Promise.all([
          fetch(`/api/categories?trackId=${selectedTrackId}`).then((r) => r.json()),
          fetch(`/api/tracks/assignments?trackId=${selectedTrackId}`).then((r) => r.json()),
        ]);
        if (catRes.success) {
          setVisualCats(catRes.data.visual);
          setRuleCats(catRes.data.rule);
        }
        if (assignRes.success) {
          setTrackAssignments(assignRes.data);
        }
      } catch (e) {
        console.error("Error loading track details:", e);
      }
    }
    loadCatsAndAssignments();
  }, [selectedTrackId]);

  // Auto select major and track when faculty changes
  useEffect(() => {
    if (!selectedFacultyId) return;
    const relatedMajors = majors.filter((m) => m.facultyId === selectedFacultyId);
    if (relatedMajors.length > 0) {
      setSelectedMajorId(relatedMajors[0].id);
    } else {
      setSelectedMajorId("");
      setSelectedTrackId("");
    }
  }, [selectedFacultyId, majors]);

  useEffect(() => {
    if (!selectedMajorId) return;
    const relatedTracks = tracks.filter((t) => t.majorId === selectedMajorId);
    if (relatedTracks.length > 0) {
      setSelectedTrackId(relatedTracks[0].id);
    } else {
      setSelectedTrackId("");
    }
  }, [selectedMajorId, tracks]);

  // Handlers
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const handleSeedData = async () => {
    if (!confirm("آیا مایل به بارگذاری مجدد داده‌های نمونه دانشکده فنی دانشگاه تهران هستید؟")) return;
    startTransition(async () => {
      const res = await fetch("/api/admin/seed", { method: "POST" }).then((r) => r.json());
      if (res.success) {
        setActionMessage(res.message);
        await loadAllData();
        setTimeout(() => setActionMessage(null), 4000);
      }
    });
  };

  // Create Faculty
  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/faculties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(facultyForm),
    }).then((r) => r.json());
    if (res.success) {
      setFacultyModalOpen(false);
      setFacultyForm({ name: "", code: "" });
      await loadAllData();
    }
  };

  // Create Major
  const handleCreateMajor = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/majors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...majorForm, facultyId: selectedFacultyId }),
    }).then((r) => r.json());
    if (res.success) {
      setMajorModalOpen(false);
      setMajorForm({ name: "", code: "" });
      await loadAllData();
    }
  };

  // Create Track
  const handleCreateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...trackForm, majorId: selectedMajorId }),
    }).then((r) => r.json());
    if (res.success) {
      setTrackModalOpen(false);
      setTrackForm({ name: "", code: "" });
      await loadAllData();
    }
  };

  // Create Visual Category
  const handleCreateVcat = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "visual",
        trackId: selectedTrackId,
        ...vcatForm,
      }),
    }).then((r) => r.json());
    if (res.success) {
      setVcatModalOpen(false);
      setVcatForm({ name: "", color: "#3b82f6", sortOrder: visualCats.length + 1 });
      const updated = await fetch(`/api/categories?trackId=${selectedTrackId}`).then((r) => r.json());
      if (updated.success) setVisualCats(updated.data.visual);
    }
  };

  // Create Rule Category
  const handleCreateRcat = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "rule",
        trackId: selectedTrackId,
        ...rcatForm,
      }),
    }).then((r) => r.json());
    if (res.success) {
      setRcatModalOpen(false);
      setRcatForm({ name: "", minCredits: 0 });
      const updated = await fetch(`/api/categories?trackId=${selectedTrackId}`).then((r) => r.json());
      if (updated.success) setRuleCats(updated.data.rule);
    }
  };

  // Create Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...courseForm,
        facultyId: courseForm.facultyId || selectedFacultyId,
        trackId: selectedTrackId || undefined,
      }),
    }).then((r) => r.json());
    if (res.success) {
      setCourseModalOpen(false);
      setCourseForm({
        name: "",
        code: "",
        units: 3,
        facultyId: selectedFacultyId,
        offeredIn: "both",
        visualCategoryId: "",
        ruleCategoryId: "",
        description: "",
      });
      await loadAllData();
    }
  };

  // Add Prerequisite with Cycle Check
  const handleAddPrerequisite = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrereqError(null);
    if (!selectedCourseForPrereq || !prereqForm.requiredCourseId) return;

    const res = await fetch("/api/courses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_prerequisite",
        courseId: selectedCourseForPrereq.id,
        requiredCourseId: prereqForm.requiredCourseId,
        type: prereqForm.type,
      }),
    }).then((r) => r.json());

    if (!res.success) {
      setPrereqError(res.message);
      return;
    }

    setPrereqForm({ requiredCourseId: "", type: "prerequisite" });
    await loadAllData();
    // Refresh selected course details
    const updatedCourse = await fetch(`/api/courses?id=${selectedCourseForPrereq.id}`).then((r) => r.json());
    if (updatedCourse.success) setSelectedCourseForPrereq(updatedCourse.data);
  };

  // Remove Prerequisite
  const handleRemovePrerequisite = async (relationId: string) => {
    if (!selectedCourseForPrereq) return;
    await fetch("/api/courses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "remove_prerequisite",
        relationId,
      }),
    });
    await loadAllData();
    const updatedCourse = await fetch(`/api/courses?id=${selectedCourseForPrereq.id}`).then((r) => r.json());
    if (updatedCourse.success) setSelectedCourseForPrereq(updatedCourse.data);
  };

  // Create Professor
  const handleCreateProf = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/professors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...profForm,
        facultyId: profForm.facultyId || selectedFacultyId,
      }),
    }).then((r) => r.json());
    if (res.success) {
      setProfModalOpen(false);
      setProfForm({ name: "", title: "استاد", email: "", facultyId: selectedFacultyId });
      await loadAllData();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">در حال بارگذاری پنل مدیریت...</p>
        </div>
      </div>
    );
  }

  const filteredCourses = courses.filter(
    (c) =>
      c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
      c.code.toLowerCase().includes(courseSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-muted/15 font-sans text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold">پنل مدیریت جامع سامانه</h1>
                <Badge variant="default" className="text-[10px] h-5">
                  {user?.role === "super_admin" ? "مدیر ارشد" : "مدیر سیستم"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">مدیریت ساختار دانشگاه، دروس، پیش‌نیازها و اساتید</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedData}
              disabled={isPending}
              className="h-8 gap-1.5 border-primary/30 text-xs text-primary hover:bg-primary/5"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              {isPending ? "در حال بارگذاری..." : "تزریق داده‌های دانشگاه تهران (Seed)"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="h-8 gap-1 text-xs"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              صفحه اصلی
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="h-8 gap-1 border-destructive/20 text-xs text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        {/* Banner notification */}
        {actionMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <Check className="h-4 w-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-border/60 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">دانشکده‌ها</p>
                <p className="text-base font-bold">{faculties.length}</p>
              </div>
            </div>
          </Card>

          <Card className="border-border/60 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">رشته‌ها و گرایش‌ها</p>
                <p className="text-base font-bold">
                  {majors.length} رشته / {tracks.length} گرایش
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-border/60 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">کل دروس تعریف‌شده</p>
                <p className="text-base font-bold">{courses.length} درس</p>
              </div>
            </div>
          </Card>

          <Card className="border-border/60 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">اساتید ثبت‌شده</p>
                <p className="text-base font-bold">{professors.length} استاد</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tab Navigation */}
        <Tabs defaultValue="courses" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 sm:w-auto sm:inline-flex">
            <TabsTrigger value="courses" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              دروس و پیش‌نیازها
            </TabsTrigger>
            <TabsTrigger value="structure" className="gap-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5" />
              ساختار دانشگاه
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" />
              دسته‌بندی و انتساب دروس
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-1.5 text-xs">
              <GitBranch className="h-3.5 w-3.5" />
              موتور قوانین و شبیه‌ساز
            </TabsTrigger>
            <TabsTrigger value="professors" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              اساتید
            </TabsTrigger>
          </TabsList>

          {/* ========================================================= */}
          {/* TAB 1: COURSES & PREREQUISITES */}
          {/* ========================================================= */}
          <TabsContent value="courses" className="space-y-4">
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
                <div>
                  <CardTitle className="text-base">بانک اطلاعاتی دروس و روابط پیشنیازی</CardTitle>
                  <CardDescription className="text-xs">
                    مدیریت تعداد واحدها، نوع ارائه و تعیین پیش‌نیازها و هم‌نیازها با کنترل آنلاین چرخه
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setCourseForm({
                      name: "",
                      code: "",
                      units: 3,
                      facultyId: selectedFacultyId,
                      offeredIn: "both",
                      visualCategoryId: "",
                      ruleCategoryId: "",
                      description: "",
                    });
                    setCourseModalOpen(true);
                  }}
                  className="h-8 gap-1 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  افزودن درس جدید
                </Button>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Search Bar */}
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="جستجو بر اساس نام یا کد درس..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="h-9 max-w-sm text-xs"
                  />
                  <span className="text-xs text-muted-foreground">
                    نمایش {filteredCourses.length} از {courses.length} درس
                  </span>
                </div>

                {/* Courses Grid */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCourses.map((course) => (
                    <div
                      key={course.id}
                      className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors"
                    >
                      <div className="space-y-2">
                        {/* Course header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-xs font-bold text-foreground">{course.name}</h3>
                            <span className="font-mono text-[11px] text-muted-foreground">{course.code}</span>
                          </div>
                          <Badge variant="outline" className="text-[11px] font-semibold">
                            {course.units} واحد
                          </Badge>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-1 text-[10px]">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            ارائه:{" "}
                            {course.offeredIn === "fall"
                              ? "فقط پاییز"
                              : course.offeredIn === "spring"
                              ? "فقط بهار"
                              : "پاییز و بهار"}
                          </Badge>
                        </div>

                        {/* Prerequisites & Corequisites */}
                        <div className="space-y-1 pt-1 border-t border-border/50">
                          <p className="text-[10px] font-semibold text-muted-foreground">وابستگی‌ها:</p>
                          {(!course.prerequisites || course.prerequisites.length === 0) ? (
                            <span className="text-[10px] text-muted-foreground/70 italic">بدون پیش‌نیاز</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {course.prerequisites.map((p) => (
                                <span
                                  key={p.id}
                                  className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    p.type === "prerequisite"
                                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                      : "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                  }`}
                                >
                                  {p.type === "prerequisite" ? "پیش:" : "هم:"} {p.requiredCourseName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCourseForPrereq(course);
                            setPrereqError(null);
                            setPrereqModalOpen(true);
                          }}
                          className="h-7 gap-1 text-[11px]"
                        >
                          <LinkIcon className="h-3 w-3" />
                          پیش‌نیازها ({course.prerequisites?.length || 0})
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (confirm(`آیا از حذف درس ${course.name} مطمئن هستید؟`)) {
                              await fetch(`/api/courses?id=${course.id}`, { method: "DELETE" });
                              await loadAllData();
                            }
                          }}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================= */}
          {/* TAB 2: UNIVERSITY STRUCTURE */}
          {/* ========================================================= */}
          <TabsContent value="structure" className="space-y-4">
            {/* Hierarchical Breadcrumb & Flow Path */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-muted-foreground">مسیر انتخابی:</span>
                <Badge variant="secondary" className="gap-1 font-semibold text-xs py-1">
                  <Building2 className="h-3 w-3 text-primary" />
                  {faculties.find((f) => f.id === selectedFacultyId)?.name || "انتخاب دانشکده"}
                </Badge>
                <span className="text-muted-foreground font-bold">←</span>
                <Badge variant="secondary" className="gap-1 font-semibold text-xs py-1">
                  <GraduationCap className="h-3 w-3 text-violet-500" />
                  {majors.find((m) => m.id === selectedMajorId)?.name || "انتخاب رشته"}
                </Badge>
                <span className="text-muted-foreground font-bold">←</span>
                <Badge variant="default" className="gap-1 font-semibold text-xs py-1 shadow-xs">
                  <Layers className="h-3 w-3 text-primary-foreground" />
                  {tracks.find((t) => t.id === selectedTrackId)?.name || "انتخاب گرایش"}
                </Badge>
              </div>
              <span className="text-[11px] text-muted-foreground">
                روی هر سطح کلیک کنید تا زیرمجموعه‌های آن در ستون بعدی نمایش داده شوند
              </span>
            </div>

            {/* 3-Column Connected Hierarchical Grid */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Column 1: Faculties */}
              <Card className="border-border/70 shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/20">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        ۱
                      </span>
                      <CardTitle className="text-xs font-bold">دانشکده‌ها</CardTitle>
                    </div>
                    <CardDescription className="text-[10px]">سطح اول ساختار دانشگاهی</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFacultyModalOpen(true)}
                    className="h-7 text-[11px] gap-1 shadow-2xs"
                  >
                    <Plus className="h-3 w-3" /> جدید
                  </Button>
                </CardHeader>
                <CardContent className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
                  {faculties.map((f) => {
                    const isSelected = selectedFacultyId === f.id;
                    const majorsCount = majors.filter((m) => m.facultyId === f.id).length;
                    return (
                      <div
                        key={f.id}
                        onClick={() => setSelectedFacultyId(f.id)}
                        className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 font-bold text-primary shadow-xs ring-1 ring-primary/40"
                            : "border-border/60 bg-card hover:border-border hover:bg-muted/40"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <p className="text-xs leading-snug">{f.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="font-mono">{f.code}</span>
                            <span>•</span>
                            <span>{majorsCount} رشته</span>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="rounded-full bg-primary p-1 text-primary-foreground shadow-2xs">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {faculties.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-6">دانشکده‌ای ثبت نشده است.</p>
                  )}
                </CardContent>
              </Card>

              {/* Column 2: Majors */}
              <Card className="border-border/70 shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/20">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-primary-foreground">
                        ۲
                      </span>
                      <CardTitle className="text-xs font-bold">
                        رشته‌های {faculties.find((f) => f.id === selectedFacultyId)?.name ? `«${faculties.find((f) => f.id === selectedFacultyId)?.code}»` : ""}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-[10px]">سطح دوم: رشته‌های زیرمجموعه</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedFacultyId}
                    onClick={() => setMajorModalOpen(true)}
                    className="h-7 text-[11px] gap-1 shadow-2xs"
                  >
                    <Plus className="h-3 w-3" /> جدید
                  </Button>
                </CardHeader>
                <CardContent className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
                  {majors
                    .filter((m) => m.facultyId === selectedFacultyId)
                    .map((m) => {
                      const isSelected = selectedMajorId === m.id;
                      const tracksCount = tracks.filter((t) => t.majorId === m.id).length;
                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelectedMajorId(m.id)}
                          className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs transition-all ${
                            isSelected
                              ? "border-violet-500 bg-violet-500/10 font-bold text-violet-700 dark:text-violet-300 shadow-xs ring-1 ring-violet-500/40"
                              : "border-border/60 bg-card hover:border-border hover:bg-muted/40"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs leading-snug">{m.name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="font-mono">{m.code}</span>
                              <span>•</span>
                              <span>{tracksCount} گرایش</span>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="rounded-full bg-violet-600 p-1 text-white shadow-2xs">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  {selectedFacultyId && majors.filter((m) => m.facultyId === selectedFacultyId).length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-6 space-y-2">
                      <p>هیچ رشته‌ای برای این دانشکده ثبت نشده است.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMajorModalOpen(true)}
                        className="h-7 text-xs"
                      >
                        + ایجاد اولین رشته
                      </Button>
                    </div>
                  )}
                  {!selectedFacultyId && (
                    <p className="text-center text-xs text-muted-foreground py-6">ابتدا یک دانشکده را از ستون اول انتخاب کنید.</p>
                  )}
                </CardContent>
              </Card>

              {/* Column 3: Tracks */}
              <Card className="border-border/70 shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/20">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-primary-foreground">
                        ۳
                      </span>
                      <CardTitle className="text-xs font-bold">
                        گرایش‌های {majors.find((m) => m.id === selectedMajorId)?.name ? `«${majors.find((m) => m.id === selectedMajorId)?.name}»` : ""}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-[10px]">سطح سوم: گرایش‌ها، قوانین و چارت</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedMajorId}
                    onClick={() => setTrackModalOpen(true)}
                    className="h-7 text-[11px] gap-1 shadow-2xs"
                  >
                    <Plus className="h-3 w-3" /> جدید
                  </Button>
                </CardHeader>
                <CardContent className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
                  {tracks
                    .filter((t) => t.majorId === selectedMajorId)
                    .map((t) => {
                      const isSelected = selectedTrackId === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTrackId(t.id)}
                          className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs transition-all ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500/40"
                              : "border-border/60 bg-card hover:border-border hover:bg-muted/40"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs leading-snug">{t.name}</p>
                            <span className="font-mono text-[10px] text-muted-foreground">{t.code}</span>
                          </div>

                          {isSelected && (
                            <span className="rounded-full bg-emerald-600 p-1 text-white shadow-2xs">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  {selectedMajorId && tracks.filter((t) => t.majorId === selectedMajorId).length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-6 space-y-2">
                      <p>هیچ گرایشی برای این رشته ثبت نشده است.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTrackModalOpen(true)}
                        className="h-7 text-xs"
                      >
                        + ایجاد اولین گرایش
                      </Button>
                    </div>
                  )}
                  {!selectedMajorId && (
                    <p className="text-center text-xs text-muted-foreground py-6">ابتدا یک رشته را از ستون دوم انتخاب کنید.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ========================================================= */}
          {/* TAB 3: CATEGORIES */}
          {/* ========================================================= */}
          <TabsContent value="categories" className="space-y-4">
            <div className="flex items-center justify-between bg-card p-3.5 rounded-xl border border-border/70">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">گرایش انتخاب‌شده:</span>
                <span className="font-bold text-foreground">
                  {tracks.find((t) => t.id === selectedTrackId)?.name || "هیچ گرایشی انتخاب نشده"}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Visual Categories */}
              <Card className="border-border/70">
                <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                  <div>
                    <CardTitle className="text-xs font-bold">دسته‌های بصری (رنگی سایدبار چارت)</CardTitle>
                    <CardDescription className="text-[11px]">
                      این دسته‌ها با رنگ دلخواه در سایدبار ساخت چارت به دانشجو نشان داده می‌شوند.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    disabled={!selectedTrackId}
                    onClick={() => setVcatModalOpen(true)}
                    className="h-7 text-[11px] gap-1"
                  >
                    <Plus className="h-3 w-3" /> افزودن
                  </Button>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {visualCats.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-full border shadow-xs"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-semibold">{cat.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await fetch(`/api/categories?id=${cat.id}&type=visual`, { method: "DELETE" });
                          const res = await fetch(`/api/categories?trackId=${selectedTrackId}`).then((r) =>
                            r.json()
                          );
                          if (res.success) setVisualCats(res.data.visual);
                        }}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Rule Categories */}
              <Card className="border-border/70">
                <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                  <div>
                    <CardTitle className="text-xs font-bold">دسته‌های قوانین (درختی و شروط واحدی)</CardTitle>
                    <CardDescription className="text-[11px]">
                      این دسته‌ها مبنای ساخت درخت شروط فارغ‌التحصیلی و محاسبه حداقل واحدها هستند.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    disabled={!selectedTrackId}
                    onClick={() => setRcatModalOpen(true)}
                    className="h-7 text-[11px] gap-1"
                  >
                    <Plus className="h-3 w-3" /> افزودن
                  </Button>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {ruleCats.map((rcat) => (
                    <div
                      key={rcat.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs"
                    >
                      <div>
                        <span className="font-semibold">{rcat.name}</span>
                        {rcat.minCredits ? (
                          <span className="mr-2 text-[11px] text-muted-foreground">
                            (حداقل {rcat.minCredits} واحد)
                          </span>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await fetch(`/api/categories?id=${rcat.id}&type=rule`, { method: "DELETE" });
                          const res = await fetch(`/api/categories?trackId=${selectedTrackId}`).then((r) =>
                            r.json()
                          );
                          if (res.success) setRuleCats(res.data.rule);
                        }}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Course Category Assignment Manager */}
            {selectedTrackId && (
              <CourseCategoryManager
                trackId={selectedTrackId}
                trackName={tracks.find((t) => t.id === selectedTrackId)?.name || "گرایش انتخابی"}
                courses={courses}
                visualCategories={visualCats}
                ruleCategories={ruleCats}
                onAssignmentsUpdated={async () => {
                  const assignRes = await fetch(`/api/tracks/assignments?trackId=${selectedTrackId}`).then(
                    (r) => r.json()
                  );
                  if (assignRes.success) setTrackAssignments(assignRes.data);
                }}
              />
            )}
          </TabsContent>

          {/* ========================================================= */}
          {/* TAB 4: RULES ENGINE & QUERY BUILDER */}
          {/* ========================================================= */}
          <TabsContent value="rules" className="space-y-6">
            <div className="flex items-center justify-between bg-card p-3.5 rounded-xl border border-border/70">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">گرایش فعال:</span>
                <Badge variant="default" className="font-bold text-xs">
                  {tracks.find((t) => t.id === selectedTrackId)?.name || "گرایشی انتخاب نشده است"}
                </Badge>
              </div>
            </div>

            {selectedTrackId ? (
              <>
                {/* Visual Query Builder */}
                <RuleQueryBuilder
                  trackId={selectedTrackId}
                  trackName={tracks.find((t) => t.id === selectedTrackId)?.name || "گرایش انتخابی"}
                  initialTree={tracks.find((t) => t.id === selectedTrackId)?.rulesTree}
                  ruleCategories={ruleCats}
                  courses={courses}
                  onTreeSaved={loadAllData}
                />

                {/* Sandbox Live Tester */}
                <RuleSandboxTester
                  trackId={selectedTrackId}
                  trackName={tracks.find((t) => t.id === selectedTrackId)?.name || "گرایش انتخابی"}
                  rulesTree={tracks.find((t) => t.id === selectedTrackId)?.rulesTree}
                  ruleCategories={ruleCats}
                  courses={courses}
                  prerequisites={courses.flatMap((c) => c.prerequisites || [])}
                  trackAssignments={trackAssignments}
                />
              </>
            ) : (
              <Card className="p-8 text-center text-xs text-muted-foreground">
                لطفاً ابتدا یک گرایش را از تب ساختار دانشگاه انتخاب کنید.
              </Card>
            )}
          </TabsContent>

          {/* ========================================================= */}
          {/* TAB 5: PROFESSORS */}
          {/* ========================================================= */}
          <TabsContent value="professors" className="space-y-4">
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
                <div>
                  <CardTitle className="text-base">لیست اساتید و اعضای هیئت علمی</CardTitle>
                  <CardDescription className="text-xs">
                    مدیریت اساتید جهت اتصال به ارائه‌های درسی و ثبت نظرات دانشجویان
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setProfForm({ name: "", title: "استاد", email: "", facultyId: selectedFacultyId });
                    setProfModalOpen(true);
                  }}
                  className="h-8 gap-1 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  افزودن استاد جدید
                </Button>
              </CardHeader>

              <CardContent className="p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {professors.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">{p.title || "استاد"}</p>
                          {p.email && <p className="font-mono text-[10px] text-muted-foreground">{p.email}</p>}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (confirm(`آیا از حذف ${p.name} مطمئن هستید؟`)) {
                            await fetch(`/api/professors?id=${p.id}`, { method: "DELETE" });
                            await loadAllData();
                          }
                        }}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ========================================================= */}
      {/* MODALS */}
      {/* ========================================================= */}

      {/* 1. Prerequisite Management Modal */}
      <Dialog open={prereqModalOpen} onOpenChange={setPrereqModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              مدیریت پیش‌نیازهای درس: {selectedCourseForPrereq?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              پیش‌نیازها یا هم‌نیازهای این درس را تعیین کنید. سیستم از ایجاد روابط چرخشی جلوگیری می‌کند.
            </DialogDescription>
          </DialogHeader>

          {prereqError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{prereqError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAddPrerequisite} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">انتخاب درس وابسته:</Label>
              <select
                value={prereqForm.requiredCourseId}
                onChange={(e) => setPrereqForm({ ...prereqForm, requiredCourseId: e.target.value })}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">-- یک درس را انتخاب کنید --</option>
                {courses
                  .filter((c) => c.id !== selectedCourseForPrereq?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code} - {c.units} واحد)
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">نوع وابستگی:</Label>
              <select
                value={prereqForm.type}
                onChange={(e) =>
                  setPrereqForm({
                    ...prereqForm,
                    type: e.target.value as "prerequisite" | "corequisite",
                  })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
              >
                <option value="prerequisite">پیش‌نیاز (باید در ترم‌های قبل گذرانده شود)</option>
                <option value="corequisite">هم‌نیاز (می‌تواند در همان ترم یا قبل از آن اخذ شود)</option>
              </select>
            </div>

            <Button type="submit" size="sm" className="w-full h-8 text-xs font-semibold">
              افزودن رابطه
            </Button>
          </form>

          {/* Current List */}
          <div className="space-y-2 pt-3 border-t">
            <p className="text-xs font-semibold">روابط فعلی این درس:</p>
            {(!selectedCourseForPrereq?.prerequisites || selectedCourseForPrereq.prerequisites.length === 0) ? (
              <p className="text-xs text-muted-foreground">هیچ پیش‌نیاز یا هم‌نیازی ثبت نشده است.</p>
            ) : (
              <div className="space-y-1.5">
                {selectedCourseForPrereq.prerequisites.map((rel) => (
                  <div
                    key={rel.id}
                    className="flex items-center justify-between rounded-lg border bg-muted/30 p-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold">{rel.requiredCourseName}</span>
                      <Badge
                        variant="outline"
                        className={`mr-2 text-[10px] ${
                          rel.type === "prerequisite" ? "text-amber-600" : "text-sky-600"
                        }`}
                      >
                        {rel.type === "prerequisite" ? "پیش‌نیاز" : "هم‌نیاز"}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePrerequisite(rel.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. Add Course Modal */}
      <Dialog open={courseModalOpen} onOpenChange={setCourseModalOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">تعریف درس جدید</DialogTitle>
            <DialogDescription className="text-xs">
              مشخصات درس، تعداد واحد و دسته‌بندی آن را مشخص نمایید.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCourse} className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">نام درس</Label>
                <Input
                  required
                  placeholder="مثلاً ریاضی عمومی ۱"
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">کد درس</Label>
                <Input
                  required
                  placeholder="مثلاً MATH101"
                  value={courseForm.code}
                  onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                  className="h-8 text-xs font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">تعداد واحد</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={courseForm.units}
                  onChange={(e) => setCourseForm({ ...courseForm, units: parseInt(e.target.value) || 3 })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ترم ارائه</Label>
                <select
                  value={courseForm.offeredIn}
                  onChange={(e) =>
                    setCourseForm({
                      ...courseForm,
                      offeredIn: e.target.value as "fall" | "spring" | "both",
                    })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                >
                  <option value="both">هردو ترم (پاییز و بهار)</option>
                  <option value="fall">فقط ترم پاییز (فرد)</option>
                  <option value="spring">فقط ترم بهار (زوج)</option>
                </select>
              </div>
            </div>

            {selectedTrackId && (
              <div className="space-y-1">
                <Label className="text-xs">دسته بصری (برای گرایش فعلی):</Label>
                <select
                  value={courseForm.visualCategoryId}
                  onChange={(e) => setCourseForm({ ...courseForm, visualCategoryId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                >
                  <option value="">-- بدون دسته بصری --</option>
                  {visualCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="submit" size="sm" className="h-8 text-xs font-semibold w-full">
                ذخیره درس
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Add Faculty Modal */}
      <Dialog open={facultyModalOpen} onOpenChange={setFacultyModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن دانشکده جدید</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateFaculty} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">نام دانشکده</Label>
              <Input
                required
                placeholder="مثلاً دانشکده فنی و مهندسی"
                value={facultyForm.name}
                onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">کد اختصاری</Label>
              <Input
                required
                placeholder="مثلاً ENG"
                value={facultyForm.code}
                onChange={(e) => setFacultyForm({ ...facultyForm, code: e.target.value })}
                className="h-8 text-xs font-mono"
                dir="ltr"
              />
            </div>
            <Button type="submit" size="sm" className="w-full h-8 text-xs">
              ثبت دانشکده
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Add Major Modal */}
      <Dialog open={majorModalOpen} onOpenChange={setMajorModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن رشته جدید</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMajor} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">نام رشته</Label>
              <Input
                required
                placeholder="مثلاً مهندسی برق"
                value={majorForm.name}
                onChange={(e) => setMajorForm({ ...majorForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">کد رشته</Label>
              <Input
                required
                placeholder="مثلاً EE"
                value={majorForm.code}
                onChange={(e) => setMajorForm({ ...majorForm, code: e.target.value })}
                className="h-8 text-xs font-mono"
                dir="ltr"
              />
            </div>
            <Button type="submit" size="sm" className="w-full h-8 text-xs">
              ثبت رشته
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Add Track Modal */}
      <Dialog open={trackModalOpen} onOpenChange={setTrackModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن گرایش جدید</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTrack} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">نام گرایش</Label>
              <Input
                required
                placeholder="مثلاً هوش مصنوعی و رباتیک"
                value={trackForm.name}
                onChange={(e) => setTrackForm({ ...trackForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">کد گرایش</Label>
              <Input
                required
                placeholder="مثلاً AI"
                value={trackForm.code}
                onChange={(e) => setTrackForm({ ...trackForm, code: e.target.value })}
                className="h-8 text-xs font-mono"
                dir="ltr"
              />
            </div>
            <Button type="submit" size="sm" className="w-full h-8 text-xs">
              ثبت گرایش
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. Add Visual Category Modal */}
      <Dialog open={vcatModalOpen} onOpenChange={setVcatModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن دسته بصری رنگی</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateVcat} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">نام دسته</Label>
              <Input
                required
                placeholder="مثلاً دروس پایه"
                value={vcatForm.name}
                onChange={(e) => setVcatForm({ ...vcatForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">رنگ شاخص:</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    type="button"
                    key={color.hex}
                    onClick={() => setVcatForm({ ...vcatForm, color: color.hex })}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${
                      vcatForm.color === color.hex ? "scale-110 border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <Button type="submit" size="sm" className="w-full h-8 text-xs">
              ثبت دسته بصری
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 7. Add Rule Category Modal */}
      <Dialog open={rcatModalOpen} onOpenChange={setRcatModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن دسته قوانین</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRcat} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">نام دسته قوانین</Label>
              <Input
                required
                placeholder="مثلاً دروس تخصصی اجباری"
                value={rcatForm.name}
                onChange={(e) => setRcatForm({ ...rcatForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">حداقل واحد مورد نیاز (اختیاری):</Label>
              <Input
                type="number"
                min={0}
                value={rcatForm.minCredits}
                onChange={(e) => setRcatForm({ ...rcatForm, minCredits: parseInt(e.target.value) || 0 })}
                className="h-8 text-xs"
              />
            </div>
            <Button type="submit" size="sm" className="w-full h-8 text-xs">
              ثبت دسته قوانین
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 8. Add Professor Modal */}
      <Dialog open={profModalOpen} onOpenChange={setProfModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن استاد جدید</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProf} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">نام استاد</Label>
              <Input
                required
                placeholder="مثلاً دکتر محمدی"
                value={profForm.name}
                onChange={(e) => setProfForm({ ...profForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">مرتبه علمی</Label>
              <select
                value={profForm.title}
                onChange={(e) => setProfForm({ ...profForm, title: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
              >
                <option value="استاد تمام">استاد تمام</option>
                <option value="دانشیار">دانشیار</option>
                <option value="استادیار">استادیار</option>
                <option value="مربی">مربی</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ایمیل دانشگاهی (اختیاری)</Label>
              <Input
                type="email"
                placeholder="name@ut.ac.ir"
                value={profForm.email}
                onChange={(e) => setProfForm({ ...profForm, email: e.target.value })}
                className="h-8 text-xs font-mono"
                dir="ltr"
              />
            </div>
            <Button type="submit" size="sm" className="w-full h-8 text-xs">
              ثبت استاد
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
