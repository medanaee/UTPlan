"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { postJson } from "@/lib/api-client";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSending(true); setStatus(null);
    const result = await postJson("/api/contact", form);
    setStatus(result.success ? "پیام شما با موفقیت ارسال شد." : (result.message || "ارسال پیام ناموفق بود."));
    if (result.success) setForm({ name: "", email: "", message: "" });
    setSending(false);
  }
  return <main className="min-h-screen bg-background px-4 py-12" dir="rtl"><div className="mx-auto max-w-xl">
    <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowRight className="h-4 w-4" /> بازگشت به صفحه اصلی</Link>
    <div className="rounded-2xl border bg-card p-6 shadow-sm"><div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Mail className="h-5 w-5" /></div><div><h1 className="text-xl font-bold">ارتباط با ما</h1><p className="text-sm text-muted-foreground">پیشنهادها و پیام‌های خود را برای ما بفرستید.</p></div></div>
      <form onSubmit={submit} className="space-y-4"><div><Label htmlFor="name">نام</Label><Input id="name" required maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div><div><Label htmlFor="email">ایمیل</Label><Input id="email" type="email" required maxLength={254} dir="ltr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div><div><Label htmlFor="message">پیام</Label><Textarea id="message" required minLength={5} maxLength={5000} rows={7} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></div>{status && <p className="rounded-lg bg-muted p-3 text-sm">{status}</p>}<Button disabled={sending} className="w-full gap-2"> <Send className="h-4 w-4" />{sending ? "در حال ارسال..." : "ارسال پیام"}</Button></form>
    </div></div></main>;
}
