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
  return <main className="min-h-screen bg-gradient-to-b from-background via-background to-primary/[0.04] px-4 py-10 sm:py-14 [&_form]:space-y-6 [&_textarea]:min-h-40 [&_input]:h-11 [&_button]:h-11 [&_button]:rounded-xl" dir="rtl"><div className="mx-auto max-w-3xl">
    <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowRight className="h-4 w-4" /> بازگشت به صفحه اصلی</Link>
    <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-xl shadow-primary/[0.05] sm:p-8"><div className="mb-8 flex items-start gap-4 border-b border-border/70 pb-6"><div className="rounded-2xl bg-primary/10 p-3.5 text-primary"><Mail className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold tracking-tight">ارتباط با ما</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">پیشنهادها و پیام‌های خود را برای ما بفرستید.</p></div></div>
      <form onSubmit={submit} className="space-y-6"><div className="space-y-2"><Label htmlFor="name">نام</Label><Input id="name" required maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="email">ایمیل</Label><Input id="email" type="email" required maxLength={254} dir="ltr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="message">پیام</Label><Textarea id="message" required minLength={5} maxLength={5000} rows={8} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></div>{status && <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm leading-6 text-primary">{status}</p>}<Button disabled={sending} className="h-11 w-full gap-2 rounded-xl shadow-lg shadow-primary/15"> <Send className="h-4 w-4" />{sending ? "در حال ارسال..." : "ارسال پیام"}</Button></form>
    </div></div></main>;
}
