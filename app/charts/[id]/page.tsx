"use client";

import React, { useState, useEffect } from "react";
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

        // Fetch auth session, chart, tracks, and courses in parallel
        const [authRes, chartRes, tracksRes, coursesRes] = await Promise.all([
          fetchJson("/api/auth/me"),
          fetchJson(`/api/charts?id=${chartId}`),
          fetchJson("/api/tracks"),
          fetchJson("/api/courses"),
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
        if (coursesRes.success) setCourses(coursesRes.data || []);

        // Fetch categories for the chart's track
        if (loadedChart.trackId) {
          const catsRes = await fetchJson(`/api/categories?trackId=${loadedChart.trackId}`);
          if (catsRes.success && catsRes.data) {
            setVisualCategories(catsRes.data.visualCategories || catsRes.data.visual || []);
            setRuleCategories(catsRes.data.ruleCategories || catsRes.data.rule || []);
          }
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
        visualCategories={visualCategories}
        ruleCategories={ruleCategories}
        user={user}
      />
    </div>
  );
}
