"use client";

import { useEffect, useState } from "react";
import { MessageSquare, RefreshCw, Star } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RecentReview = {
  id: string;
  comment: string;
  author_name: string;
  target_name: string;
  target_label: string;
  overall_rating: number | null;
  created_at: string;
  is_anonymous: number;
};

export function RecentReviewsManager() {
  const [reviews, setReviews] = useState<RecentReview[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const load = async (page = pagination.page) => {
    setLoading(true);
    try {
      const result = await fetchJson(
        `/api/admin/reviews?page=${page}&pageSize=20&_=${Date.now()}`,
        { cache: "no-store" }
      );
      if (result.success) {
        setReviews(result.data || []);
        setPagination(result.pagination || pagination);
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load(1);
    const refreshOnFocus = () => load(1);
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, []);

  return <Card dir="rtl"><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4 text-primary" /> آخرین نظرات کاربران</CardTitle><p className="mt-1 text-xs text-muted-foreground">نمایش صفحه‌ای نظرات ثبت‌شده دربارهٔ استادها و ارائه‌های درسی.</p></div><Button variant="ghost" size="sm" onClick={() => load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button></CardHeader><CardContent className="space-y-3">
    {loading && reviews.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">در حال دریافت نظرات...</div> : reviews.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">هنوز نظری ثبت نشده است.</div> : reviews.map((review) => <article key={review.id} className="rounded-xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-sm">{review.author_name}</div><div className="mt-1 flex flex-wrap items-center gap-1.5"><Badge variant="outline" className="text-[10px]">{review.target_label}</Badge><span className="text-xs text-primary font-medium">{review.target_name}</span></div></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><time dir="ltr">{new Date(review.created_at).toLocaleString("fa-IR")}</time>{review.overall_rating ? <span className="inline-flex items-center gap-1 text-amber-600"><Star className="h-3.5 w-3.5 fill-current" />{review.overall_rating}</span> : null}</div></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/90">{review.comment}</p></article>)}
    {pagination.totalPages > 1 && <div className="flex items-center justify-center gap-3 pt-3"><Button variant="outline" size="sm" disabled={pagination.page <= 1 || loading} onClick={() => load(pagination.page - 1)}>قبلی</Button><span className="text-xs text-muted-foreground">صفحه {pagination.page} از {pagination.totalPages}</span><Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => load(pagination.page + 1)}>بعدی</Button></div>}
  </CardContent></Card>;
}
