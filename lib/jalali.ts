export type JalaliDate = {
  year: number;
  month: number;
  day: number;
};

const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export function isJalaliLeap(year: number): boolean {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  let jp = breaks[0];
  let jm: number;
  let jump: number;
  let leap: number;
  let n: number;

  if (year < jp || year >= breaks[breaks.length - 1]) return false;

  for (let i = 1; i < breaks.length; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (year < jm) {
      n = year - jp;
      leap = (n + 1) % 33;
      if (leap === 1 || leap === 5 || leap === 9 || leap === 13 || leap === 17 || leap === 22 || leap === 26 || leap === 30) {
        return true;
      }
      return false;
    }
    jp = jm;
  }
  return false;
}

export function jalaliMonthLength(year: number, month: number): number {
  if (month >= 1 && month <= 6) return 31;
  if (month >= 7 && month <= 11) return 30;
  if (month === 12) return isJalaliLeap(year) ? 30 : 29;
  return 30;
}

export function jalaliMonthName(month: number): string {
  const idx = Math.max(1, Math.min(12, month)) - 1;
  return JALALI_MONTH_NAMES[idx] || "";
}

export function normalizeJalaliDate(date: JalaliDate): JalaliDate {
  let year = Math.max(1300, Math.min(1450, date.year || 1403));
  let month = Math.max(1, Math.min(12, date.month || 1));
  const maxDay = jalaliMonthLength(year, month);
  let day = Math.max(1, Math.min(maxDay, date.day || 1));
  return { year, month, day };
}

export function formatJalaliDisplay(date: JalaliDate): string {
  const norm = normalizeJalaliDate(date);
  return `${norm.day} ${jalaliMonthName(norm.month)} ${norm.year}`;
}

export function jalaliToIso(date: JalaliDate): string {
  const norm = normalizeJalaliDate(date);
  const mm = String(norm.month).padStart(2, "0");
  const dd = String(norm.day).padStart(2, "0");
  return `${norm.year}/${mm}/${dd}`;
}

/**
 * Parses either a Jalali string ("1403/10/22" or "1403-10-22")
 * or a Gregorian ISO string ("2025-01-11").
 */
export function parseGregorianIso(value: string | undefined | null): JalaliDate | null {
  if (!value || typeof value !== "string" || !value.trim()) return null;
  const str = value.trim();

  // Check if it's already a Jalali string format (starts with 13xx or 14xx)
  const jalaliMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (jalaliMatch) {
    const y = parseInt(jalaliMatch[1], 10);
    const m = parseInt(jalaliMatch[2], 10);
    const d = parseInt(jalaliMatch[3], 10);
    if (y >= 1300 && y <= 1499) {
      return normalizeJalaliDate({ year: y, month: m, day: d });
    }
  }

  // Otherwise try parsing as Gregorian date
  const gDate = new Date(str);
  if (isNaN(gDate.getTime())) return null;

  return gregorianToJalali(gDate.getFullYear(), gDate.getMonth() + 1, gDate.getDate());
}

export function todayJalali(): JalaliDate {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    (365 * gy) +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { year: jy, month: jm, day: jd };
}

export function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number
): { gy: number; gm: number; gd: number } {
  const jy2 = jy + 1595;
  let days =
    -355668 +
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  while (gm < 13 && gd > sal_a[gm]) {
    gd -= sal_a[gm];
    gm++;
  }
  return { gy, gm, gd };
}

/**
 * Calculates the difference in calendar days between two Jalali dates (dateStr2 - dateStr1).
 * Accepts strings like "1403/10/22" or "1403-10-22" or Gregorian ISO.
 */
export function getJalaliDaysDifference(
  dateStr1: string | undefined | null,
  dateStr2: string | undefined | null
): number | null {
  const d1 = parseGregorianIso(dateStr1);
  const d2 = parseGregorianIso(dateStr2);
  if (!d1 || !d2) return null;

  const g1 = jalaliToGregorian(d1.year, d1.month, d1.day);
  const g2 = jalaliToGregorian(d2.year, d2.month, d2.day);

  const u1 = Date.UTC(g1.gy, g1.gm - 1, g1.gd);
  const u2 = Date.UTC(g2.gy, g2.gm - 1, g2.gd);

  return Math.round((u2 - u1) / (1000 * 60 * 60 * 24));
}

