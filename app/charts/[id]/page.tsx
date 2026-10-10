"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { ChartEditor } from "@/components/chart/chart-editor";
import type {
  StudentChart,
  Track,
  Course,
  Category,
  VisualCategory,
  RuleCategory,
  UserSession,
} from "@/lib/types";
import { fetchJson } from "@/lib/api-client";

export default function ChartEditorPage() {
  const params = useParams();
  const router = useRouter();
  const chartId = params?.id as string;

  const [user, setUser] = useState<UserSession | null>(null);
  const [chart, setChart] = useState<StudentChart | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [visualCategories, setVisualCategories] = useState<VisualCategory[]>([]);
  const [ruleCategories, setRuleCategories] = useState<RuleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAllChartData() {
      if (!chartId) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch lightweight page data first; the course scope depends on the chart track.
        const [authRes, chartRes, tracksRes] = await Promise.all([
          fetchJson("/api/auth/me"),
          fetchJson(`/api/charts?id=${chartId}`),
          fetchJson("/api/tracks"),
        ]);

        if (!authRes.authenticated || !authRes.user) {
          router.push("/login");
          return;
        }

        setUser(authRes.user);

        if (!chartRes.success || !chartRes.data) {
          setError(chartRes.message || "چارت مورد نظر یافت نشد.");
          return;
        }

        const loadedChart: StudentChart = chartRes.data;
        setChart(loadedChart);

        if (tracksRes.success) setTracks(tracksRes.data || []);

        // Fetch categories and the chart's relevant course graph in parallel.
        if (loadedChart.trackId) {
          const [catsRes, coursesRes] = await Promise.all([
            fetchJson(`/api/categories?trackId=${loadedChart.trackId}`),
            fetchJson(`/api/courses/chart-scope?trackId=${loadedChart.trackId}&chartId=${encodeURIComponent(chartId)}`),
          ]);
          if (catsRes.success && catsRes.data) {
            const list = catsRes.data.categories || catsRes.data.items || catsRes.data.rule || [];
            setCategories(list);
            setVisualCategories(list);
            setRuleCategories(list);
          }
          if (coursesRes.success) setCourses(coursesRes.data || []);
        }
      } catch (err: any) {
        console.error("Error loading chart editor page:", err);
        setError("خطا در بارگذاری اطلاعات ویرایشگر چارت");
      } finally {
        setLoading(false);
      }
    }

    loadAllChartData();
  }, [chartId]);

  const handleCourseSearch = useCallback(async (query: string) => {
    if (!chart?.trackId || query.trim().length < 3) return;

    try {
      const result = await fetchJson(
        `/api/courses?q=${encodeURIComponent(query.trim())}&trackId=${encodeURIComponent(chart.trackId)}&limit=20`
      );
      if (!result.success || !Array.isArray(result.data)) return;

      setCourses((current) => {
        const byId = new Map(current.map((course) => [course.id, course]));
        for (const course of result.data) byId.set(course.id, course);
        return Array.from(byId.values());
      });
    } catch (error) {
      console.error("Chart course search error:", error);
    }
  }, [chart?.trackId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar user={user} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">در حال بارگذاری محیط ویرایشگر چارت...</p>
        </div>
      </div>
    );
  }

  if (error || !chart) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar user={user} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md mx-auto">
          <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-foreground">خطا در بارگذاری چارت</h2>
          <p className="text-xs text-muted-foreground">{error || "چارت درخواستی در دسترس نیست."}</p>
          <Link href="/charts">
            <Button size="sm" className="h-8 gap-1 text-xs">
              <ArrowRight className="h-3.5 w-3.5" />
              بازگشت به لیست چارت‌ها
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col">
      <ChartEditor
        initialChart={chart}
        allTracks={tracks}
        allCourses={courses}
        categories={categories}
        visualCategories={categories}
        ruleCategories={categories}
        user={user}
        onCourseSearch={handleCourseSearch}
      />
    </div>
  );
}
