"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/api-client";

type AbuseEvent = {
  event_type: string;
  ip: string;
  subject: string;
  blocked_count: number;
  first_seen_at: string;
  last_seen_at: string;
};

const labels: Record<string, string> = { login: "ورود", otp: "OTP", review: "کامنت" };

export function AbuseEventsManager() {
  const [items, setItems] = useState<AbuseEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetchJson("/api/admin/security/abuse-events?limit=100");
      if (response.success && Array.isArray(response.data)) setItems(response.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="flex-row items-center justify-between border-b">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" />گزارش رخدادهای مسدودشده</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">فقط درخواست‌هایی که rate limit شده‌اند؛ نگهداری حداکثر ۳۰ روز</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/40 text-right text-muted-foreground"><th className="p-3">نوع</th><th className="p-3">IP</th><th className="p-3">شناسه</th><th className="p-3">تعداد</th><th className="p-3">آخرین رخداد</th></tr></thead>
            <tbody className="divide-y divide-border/40">
              {!loading && items.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">رخداد مسدودشده‌ای ثبت نشده است.</td></tr>}
              {items.map((item) => <tr key={`${item.event_type}:${item.ip}:${item.subject}`} className="hover:bg-muted/20">
                <td className="p-3">{labels[item.event_type] || item.event_type}</td>
                <td className="p-3 font-mono" dir="ltr">{item.ip}</td>
                <td className="p-3 max-w-64 truncate" dir="ltr">{item.subject || "—"}</td>
                <td className="p-3 font-semibold">{item.blocked_count}</td>
                <td className="p-3 text-muted-foreground">{new Date(item.last_seen_at).toLocaleString("fa-IR")}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
