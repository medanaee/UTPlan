"use client";

import { useEffect, useState } from "react";
import { Activity, Clock3, Mail, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Quota = { used: number; limit: number | null; remaining: number | null; resetsAt: string | null } | null;
type Usage = { emails?: { daily: Quota; monthly: Quota }; contacts: Quota; segments: Quota; broadcasts: Quota; domains: Quota; aiCredits: Quota; automationRuns: Quota; rateLimit: { limit: number | null; duration: string | null; remaining: string | null; reset: string | null } | null; fetchedAt: string };

function formatNumber(value: number | null) { return value === null ? "نامحدود" : value.toLocaleString("fa-IR"); }
function QuotaCard({ title, icon: Icon, value }: { title: string; icon: any; value: Quota }) {
  if (!value) return null;
  const percent = value.limit && value.limit > 0 ? Math.min(100, (value.used / value.limit) * 100) : 0;
  return <div className="rounded-xl border bg-card p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</div><Badge variant={percent >= 90 ? "destructive" : "secondary"}>{value.limit === null ? "بدون سقف" : `${Math.round(percent)}٪ مصرف`}</Badge></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div><div className="text-muted-foreground">مصرف‌شده</div><strong className="mt-1 block text-base">{formatNumber(value.used)}</strong></div><div><div className="text-muted-foreground">سقف</div><strong className="mt-1 block text-base">{formatNumber(value.limit)}</strong></div><div><div className="text-muted-foreground">باقی‌مانده</div><strong className="mt-1 block text-base text-primary">{formatNumber(value.remaining)}</strong></div></div>{value.resetsAt && <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" />ریست: <span dir="ltr">{new Date(value.resetsAt).toLocaleString("fa-IR")}</span></div>}<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${percent >= 90 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${percent}%` }} /></div></div>;
}

export function ResendUsageManager() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); setError(""); const result = await fetchJson("/api/admin/resend-usage"); if (result.success) setUsage(result.data); else setError(result.message || "خطا در دریافت مصرف Resend"); setLoading(false); };
  useEffect(() => { load(); }, []);
  return <Card dir="rtl"><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" /> مصرف و محدودیت‌های Resend</CardTitle><p className="mt-1 text-xs text-muted-foreground">این اطلاعات فقط برای super admin نمایش داده می‌شود و کلید API به مرورگر ارسال نمی‌شود.</p></div><Button variant="ghost" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button></CardHeader><CardContent>{error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : loading && !usage ? <div className="py-10 text-center text-sm text-muted-foreground">در حال دریافت اطلاعات از Resend...</div> : usage ? <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><QuotaCard title="ایمیل روزانه" icon={Mail} value={usage.emails?.daily || null} /><QuotaCard title="ایمیل ماهانه" icon={Mail} value={usage.emails?.monthly || null} /><QuotaCard title="Contacts" icon={Server} value={usage.contacts} /><QuotaCard title="Domains" icon={ShieldCheck} value={usage.domains} /><QuotaCard title="Segments" icon={Server} value={usage.segments} /><QuotaCard title="Broadcasts" icon={Mail} value={usage.broadcasts} /><QuotaCard title="Automation runs" icon={Activity} value={usage.automationRuns} /><QuotaCard title="AI credits" icon={Activity} value={usage.aiCredits} /></div>{usage.rateLimit && <div className="rounded-xl border bg-muted/20 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />محدودیت درخواست API</div><div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs"><div><div className="text-muted-foreground">سقف پنجره</div><strong className="mt-1 block text-base">{formatNumber(usage.rateLimit.limit)}</strong></div><div><div className="text-muted-foreground">باقی‌مانده فعلی</div><strong className="mt-1 block text-base text-primary">{usage.rateLimit.remaining || "در header برنگشت"}</strong></div><div><div className="text-muted-foreground">Reset</div><strong className="mt-1 block text-base">{usage.rateLimit.reset || "—"}</strong></div></div></div>}<p className="text-[11px] text-muted-foreground">آخرین دریافت: <span dir="ltr">{new Date(usage.fetchedAt).toLocaleString("fa-IR")}</span></p></div> : null}</CardContent></Card>;
}
