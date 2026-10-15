import Link from "next/link";
import { ArrowRight } from "lucide-react";

const rules = [
  {
    title: "استقلال سامانه",
    text: "این سامانه مستقل است و هیچ‌گونه رسمیت، وابستگی یا نمایندگی از سوی دانشگاه تهران ندارد.",
  },
  {
    title: "اعتبار اطلاعات",
    text: "اطلاعات، چارت‌ها و نظرات کاربران با هدف کمک به دانشجویان ارائه می‌شوند و ممکن است کامل، به‌روز یا رسمی نباشند. پیش از تصمیم‌گیری، اطلاعات را از مراجع رسمی بررسی کنید.",
  },
  {
    title: "ضرورت ایمیل دانشجویی",
    text: "استفاده از ایمیل دانشجویی برای کمک به صحت‌سنجی اطلاعات، کاهش حساب‌های جعلی و حفظ کیفیت محتوای سامانه ضروری است. ایمیل دانشجویی به‌عنوان ابزار اعتبارسنجی استفاده می‌شود و محتوای منتشرشده به هویت کاربر نسبت داده نخواهد شد.",
  },
  {
    title: "حفظ محرمانگی هویت",
    text: "هویت و مشخصات حسابی که محتوا را منتشر کرده است به هیچ عنوان در کنار آن محتوا اعلام یا نمایش داده نمی‌شود.",
  },
  {
    title: "رعایت احترام",
    text: "لطفاً هنگام ثبت نظر از توهین، بی‌احترامی، تمسخر و استفاده از ادبیات نامناسب خودداری کنید و دیدگاه خود را محترمانه و سازنده بیان کنید.",
  },
  {
    title: "مدیریت محتوا",
    text: "مدیران سامانه می‌توانند نظرهای خلاف این قوانین، تکراری، تبلیغاتی یا نامرتبط را بدون اطلاع قبلی ویرایش یا حذف کنند.",
  },
  {
    title: "محدودیت ثبت نظر",
    text: "برای جلوگیری از ارسال انبوه و سوءاستفاده، ثبت نظر شامل محدودیت تعداد درخواست در بازه زمانی مشخص است. عبور از این محدودیت موقتاً امکان ثبت نظر را متوقف می‌کند.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-muted/20 px-4 py-10" dir="rtl">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary">
          <ArrowRight className="h-4 w-4" />
          بازگشت به صفحه اصلی
        </Link>

        <article className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-9">
          <header className="mb-8 border-b border-border/60 pb-6">
            <p className="mb-2 text-xs font-medium text-primary">UTPlan</p>
            <h1 className="text-2xl font-bold tracking-tight">قوانین و شرایط استفاده</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              لطفاً پیش از استفاده از امکانات سامانه، این قوانین عمومی را مطالعه کنید.
            </p>
          </header>

          <div className="space-y-6">
            {rules.map((rule, index) => (
              <section key={rule.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <div>
                  <h2 className="text-sm font-bold text-foreground">{rule.title}</h2>
                  <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{rule.text}</p>
                </div>
              </section>
            ))}
          </div>

          <p className="mt-8 border-t border-border/60 pt-5 text-xs leading-6 text-muted-foreground">
            استفاده از سامانه به معنی پذیرش این قوانین است. این قوانین ممکن است برای بهبود امنیت و کیفیت سامانه به‌روزرسانی شوند.
          </p>
        </article>
      </div>
    </main>
  );
}
