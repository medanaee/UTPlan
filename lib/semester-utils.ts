/**
 * Standard Semester Utilities for UT-ECE
 *
 * System Convention:
 * - Suffix "1" = بهار (Spring)
 * - Suffix "2" = پاییز (Fall)
 *
 * Sequence:
 * 1402-2 (پاییز ۱۴۰۲) -> 1403-1 (بهار ۱۴۰۳) -> 1403-2 (پاییز ۱۴۰۳) -> 1404-1 (بهار ۱۴۰۴) ...
 */

export interface SemesterTypeOption {
  value: "spring" | "fall";
  label: string;
  code: "1" | "2";
}

export const SEMESTER_TYPES: SemesterTypeOption[] = [
  { value: "spring", label: "بهار", code: "1" },
  { value: "fall", label: "پاییز", code: "2" },
];

/**
 * Format a term string (e.g. "1403-1" or "1403-2") into Persian readable label
 * e.g. "1403-1" -> "بهار ۱۴۰۳"
 * e.g. "1403-2" -> "پاییز ۱۴۰۳"
 */
export function formatSemesterLabel(termStr: string): string {
  if (!termStr) return "تعیین‌نشده";
  const parts = termStr.trim().split("-");
  if (parts.length === 2) {
    const year = parts[0];
    const sem = parts[1];
    if (sem === "1" || sem === "spring") return `بهار ${year}`;
    if (sem === "2" || sem === "fall") return `پاییز ${year}`;
    if (sem === "3" || sem === "summer") return `تابستان ${year}`;
    return `${sem} ${year}`;
  }
  return termStr;
}

/**
 * Calculates the exact semester for a given termIndex (1-based or fractional like 2.5 for summer)
 * starting from user's entrySemester (e.g. "1402-2" for Fall 1402)
 */
export function calculateSemesterForTerm(
  entrySemester: string | null | undefined,
  termIndex: number
): string {
  if (!entrySemester || !entrySemester.trim()) {
    // Default fallback if no entry semester is set
    return termIndex % 1 !== 0 ? "1403-3" : "1403-1";
  }

  const parts = entrySemester.trim().split("-");
  let currentYear = parseInt(parts[0], 10) || 1402;
  // 1 = spring, 2 = fall
  let currentSem: 1 | 2 =
    parts[1] === "1" || parts[1] === "spring" ? 1 : 2;

  const isSummer = termIndex % 1 !== 0;
  const baseTerm = Math.max(1, Math.floor(termIndex));

  for (let i = 1; i < baseTerm; i++) {
    if (currentSem === 2) {
      // Fall -> next is Spring of next calendar year
      currentSem = 1;
      currentYear += 1;
    } else {
      // Spring -> next is Fall of same calendar year
      currentSem = 2;
    }
  }

  if (isSummer) {
    return `${currentYear}-3`;
  }

  return `${currentYear}-${currentSem}`;
}
