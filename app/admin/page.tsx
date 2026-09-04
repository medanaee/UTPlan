"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  LogOut,
  Building2,
  GraduationCap,
  BookOpen,
  Users,
  Layers,
  RefreshCw,
  ArrowRight,
  Sparkles,
  GitBranch,
  UserCheck,
  PanelRightClose,
  PanelRightOpen,
  CalendarDays,
  Database,
  Check,
  BookUser,
  DatabaseBackup,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

import { useAdminStore } from "@/lib/stores/admin-store";
import { UniversityStructureManager } from "@/components/admin/university-structure-manager";
import { CourseManager } from "@/components/admin/course-manager";
import { OfferingManager } from "@/components/admin/offering-manager";
import { EventManager } from "@/components/admin/event-manager";
import { ProfessorManager } from "@/components/admin/professor-manager";
import { CategoryManager } from "@/components/admin/category-manager";
import { ApprovedChartsManager } from "@/components/admin/approved-charts-manager";
import { RuleQueryBuilder } from "@/components/admin/rule-query-builder";
import { RuleSandboxTester } from "@/components/admin/rule-sandbox-tester";
import { UserManager } from "@/components/admin/user-manager";
import { BackupManager } from "@/components/admin/backup-manager";
import { RecycleBinManager } from "@/components/admin/recycle-bin-manager";

export default function AdminDashboardPage() {
  const router = useRouter();
  const {
    user,
    setUser,
    loading,
    faculties,
    majors,
    tracks,
    courses,
    professors,
    ruleCats,
    trackAssignments,
    selectedFacultyId,
    selectedMajorId,
    selectedTrackId,
    actionMessage,
    loadAllData,
    setActionMessage,
  } = useAdminStore();

  const [activeTab, setActiveTab] = useState<
    | "structure"
    | "courses"
    | "offerings"
    | "events"
    | "professors"
    | "categories"
    | "approved-charts"
    | "rules"
    | "users"
    | "backup"
    | "trash"
  >("structure");

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Authentication check and initial data load
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
      }
    }
    checkAuthAndLoad();
  }, [router, setUser, loadAllData]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">در حال بارگذاری پنل مدیریت...</p>
        </div>
      </div>
    );
  }

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);
  const currentMajor = majors.find((m) => m.id === selectedMajorId);
  const currentTrack = tracks.find((t) => t.id === selectedTrackId);

  const navItems = [
    {
      id: "structure" as const,
      label: "ساختار دانشگاه",
      icon: Building2,
    },
    {
      id: "courses" as const,
      label: "دروس و پیش‌نیازها",
      icon: BookOpen,
    },
    {
      id: "professors" as const,
      label: "اساتید هیئت علمی",
      icon: Users,
    },
    {
      id: "offerings" as const,
      label: "ارائه‌های درسی",
      icon: BookUser,
    },
    {
      id: "categories" as const,
      label: "دسته‌بندی و انتساب دروس",
      icon: Layers,
    },
    {
      id: "rules" as const,
      label: "موتور قوانین و شبیه‌ساز",
      icon: GitBranch,
    },
    {
      id: "approved-charts" as const,
      label: "چارت‌های مصوب گرایش‌ها",
      icon: GraduationCap,
    },
    {
      id: "events" as const,
      label: "رویدادها و برنامه‌ریزی کلاسی",
      icon: CalendarDays,
    },
    {
      id: "users" as const,
      label: "کاربران و سطوح دسترسی",
      icon: UserCheck,
    },
    {
      id: "backup" as const,
      label: "بکاپ و بازیابی پایگاه داده",
      icon: DatabaseBackup,
    },
    {
      id: "trash" as const,
      label: "سطل بازیافت (حذف نهایی)",
      icon: Trash2,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold tracking-tight">پنل مدیریت دانشگاه</h1>
                  <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-normal">
                    {user?.role === "super_admin" ? "مدیر ارشد" : "مدیر سامانه"}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            {/* Always Visible Active Context Path on Right side without background/border with larger icons */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-md bg-muted">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-xs text-muted-foreground font-semibold">موقعیت:</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    <Building2 className="h-4.5 w-4.5 text-primary shrink-0" />
                    <span>{currentFaculty ? currentFaculty.name : "بدون دانشکده"}</span>
                  </span>
                  <span className="text-muted-foreground/60 font-bold mx-1">←</span>
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    <GraduationCap className="h-4.5 w-4.5 text-violet-600 shrink-0" />
                    <span>{currentMajor ? currentMajor.name : "بدون رشته"}</span>
                  </span>
                  <span className="text-muted-foreground/60 font-bold mx-1">←</span>
                  <span className="flex items-center gap-2 font-bold text-primary">
                    <Layers className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                    <span>{currentTrack ? currentTrack.name : "بدون گرایش"}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {process.env.NODE_ENV !== "production" && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (
                    confirm(
                      "آیا مایل به بازنشانی و بارگذاری کامل داده‌های نمونه دولوپ (شامل دروس، اساتید، ارائه‌ها و چارت نمونه) هستید؟"
                    )
                  ) {
                    const res = await fetch("/api/admin/seed", { method: "POST" }).then((r) => r.json());
                    if (res.success) {
                      await loadAllData();
                      alert("داده‌های نمونه دانشگاهی با موفقیت در محیط دولوپ بارگذاری شدند.");
                    } else {
                      alert(res.message || "خطا در بارگذاری دیتای نمونه");
                    }
                  }
                }}
                className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10 shadow-2xs"
                title="بارگذاری مجدد دیتای نمونه دولوپ"
              >
                <Database className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">دیتای نمونه (Dev)</span>
              </Button>
            )}

            <ThemeToggle />

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

      {/* Main Admin Layout with Collapsible Right Sidebar */}
      <div className="flex min-h-[calc(100vh-59px)] bg-background">
        {/* Right Minimal Flat Collapsible Sidebar */}
        <aside
          className={`sticky top-[59px] h-[calc(100vh-59px)] shrink-0 border-l border-border bg-background transition-all duration-200 flex flex-col justify-between z-30 ${
            isSidebarCollapsed ? "w-14" : "w-56"
          }`}
        >
          {/* Top Section */}
          <div className="p-2 space-y-2">
            {/* Header & Collapse Toggle Button */}
            <div className="flex items-center justify-between px-2 py-1.5 text-muted-foreground">
              {!isSidebarCollapsed && (
                <span className="text-[11px] font-medium tracking-wider text-muted-foreground/70">
                  بخش‌های سامانه
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className={`h-6 w-6 p-0 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 ${
                  isSidebarCollapsed ? "mx-auto" : ""
                }`}
                title={isSidebarCollapsed ? "باز کردن منو" : "جمع کردن منو"}
              >
                {isSidebarCollapsed ? (
                  <PanelRightOpen className="h-3.5 w-3.5" />
                ) : (
                  <PanelRightClose className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {/* Navigation Buttons */}
            <nav className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    title={isSidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-lg text-xs transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    } ${
                      isSidebarCollapsed
                        ? "justify-center h-9 w-full px-0"
                        : "justify-start gap-2.5 px-2.5 py-2"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-primary" : "text-muted-foreground/80"
                      }`}
                    />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Minimal Sidebar Footer */}
          <div className="p-2.5 border-t border-border">
            {!isSidebarCollapsed ? (
              <div className="flex items-center justify-between px-2 text-[11px] text-muted-foreground/70">
                <span className="truncate">دانشکده فنی</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px]">آنلاین</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="آنلاین" />
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="mx-auto space-y-5">
            {/* Banner notification */}
            {actionMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4 shrink-0" />
                <span>{actionMessage}</span>
              </div>
            )}

            {/* TAB 1: UNIVERSITY STRUCTURE */}
            {activeTab === "structure" && <UniversityStructureManager />}

            {/* TAB 2: COURSES & PREREQUISITES */}
            {activeTab === "courses" && (
              <CourseManager onNavigateToStructure={() => setActiveTab("structure")} />
            )}

            {/* TAB 3: OFFERINGS */}
            {activeTab === "offerings" && (
              <OfferingManager
                courses={courses}
                professors={professors}
                faculties={faculties}
                selectedFacultyId={selectedFacultyId}
              />
            )}

            {/* TAB 4: EVENTS & TIMETABLE */}
            {activeTab === "events" && (
              <EventManager
                faculties={faculties}
                selectedFacultyId={selectedFacultyId}
              />
            )}

            {/* TAB 5: PROFESSORS */}
            {activeTab === "professors" && (
              <ProfessorManager
                professors={professors}
                faculties={faculties}
                selectedFacultyId={selectedFacultyId}
                onDataChanged={loadAllData}
              />
            )}

            {/* TAB 6: CATEGORIES */}
            {activeTab === "categories" && (
              <CategoryManager onNavigateToStructure={() => setActiveTab("structure")} />
            )}

            {/* TAB 7: APPROVED CHARTS */}
            {activeTab === "approved-charts" && (
              <ApprovedChartsManager
                faculties={faculties}
                majors={majors}
                tracks={tracks}
                courses={courses}
                selectedTrackId={selectedTrackId}
              />
            )}

            {/* TAB 8: RULES ENGINE & QUERY BUILDER */}
            {activeTab === "rules" && (
              <div className="space-y-6">
                {/* Active Track Banner */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 shrink-0">
                        <GitBranch className="h-5 w-5" />
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
                          شروط فارغ‌التحصیلی و اعتبارسنجی چارت دانشجو برای این گرایش محاسبه می‌شود.
                        </p>
                      </div>
                    </div>

                    {!currentTrack && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveTab("structure")}
                        className="h-8 text-xs gap-1 shadow-2xs"
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        انتخاب در ساختار دانشگاه
                      </Button>
                    )}
                  </div>
                </div>

                {selectedTrackId ? (
                  <>
                    <RuleQueryBuilder
                      trackId={selectedTrackId}
                      trackName={tracks.find((t) => t.id === selectedTrackId)?.name || "گرایش انتخابی"}
                      initialTree={tracks.find((t) => t.id === selectedTrackId)?.rulesTree}
                      ruleCategories={ruleCats}
                      courses={courses}
                      onTreeSaved={async () => {
                        setActionMessage("درخت قوانین با موفقیت ذخیره شد.");
                        await loadAllData();
                      }}
                    />

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
              </div>
            )}

            {/* TAB 9: USERS & PERMISSIONS */}
            {activeTab === "users" && user && <UserManager currentUser={user} />}

            {/* TAB 10: DATABASE BACKUP & RESTORE */}
            {activeTab === "backup" && <BackupManager />}

            {/* TAB 11: RECYCLE BIN & CASCADE RESOLUTION */}
            {activeTab === "trash" && (
              <RecycleBinManager
                onDataChanged={loadAllData}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
