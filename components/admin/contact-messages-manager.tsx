"use client";

import { useEffect, useState } from "react";
import { Check, Mail, RefreshCw } from "lucide-react";
import { fetchJson, patchJson } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ContactMessage = { id: string; name: string; email: string; message: string; is_read: number; created_at: string };

export function ContactMessagesManager() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0, unread: 0 });
  const [loading, setLoading] = useState(true);
  const load = async (page = pagination.page) => {
    setLoading(true);
    const result = await fetchJson(`/api/admin/contact?page=${page}&pageSize=20`);
    if (result.success) { setMessages(result.data || []); setPagination(result.pagination || pagination); }
    setLoading(false);
  };
  useEffect(() => { load(1); }, []);
  const markRead = async (id: string, isRead: boolean) => {
    const result = await patchJson("/api/admin/contact", { id, isRead });
    if (result.success) await load();
  };
  return <Card dir="rtl"><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4 text-primary" /> پیام‌های ارتباط با ما</CardTitle><p className="mt-1 text-xs text-muted-foreground">پیام‌ها فقط در این پنل و برای مدیران احراز‌شده قابل مشاهده‌اند.</p></div><div className="flex items-center gap-2"><Badge variant="secondary">خوانده‌نشده: {pagination.unread}</Badge><Button variant="ghost" size="sm" onClick={() => load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button></div></CardHeader><CardContent className="space-y-3">
    {loading && messages.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">در حال دریافت پیام‌ها...</div> : messages.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">هنوز پیامی ثبت نشده است.</div> : messages.map((item) => <article key={item.id} className={`rounded-xl border p-4 ${item.is_read ? "bg-card" : "border-primary/30 bg-primary/5"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{item.name}</div><a href={`mailto:${item.email}`} dir="ltr" className="text-xs text-primary hover:underline">{item.email}</a></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><time dir="ltr">{new Date(item.created_at).toLocaleString("fa-IR")}</time>{!item.is_read && <Badge>جدید</Badge>}</div></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{item.message}</p><div className="mt-3 flex justify-end"> <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => markRead(item.id, !Boolean(item.is_read))}><Check className="h-3.5 w-3.5" />{item.is_read ? "علامت‌گذاری به‌عنوان خوانده‌نشده" : "علامت‌گذاری به‌عنوان خوانده‌شده"}</Button></div></article>)}
    {pagination.totalPages > 1 && <div className="flex items-center justify-center gap-3 pt-3"><Button variant="outline" size="sm" disabled={pagination.page <= 1 || loading} onClick={() => load(pagination.page - 1)}>قبلی</Button><span className="text-xs text-muted-foreground">صفحه {pagination.page} از {pagination.totalPages}</span><Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => load(pagination.page + 1)}>بعدی</Button></div>}
  </CardContent></Card>;
}
