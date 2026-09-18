/**
 * Intelligent Persian Search Engine for Courses
 * Features:
 * 1. Typo-tolerance (Damerau-Levenshtein distance)
 * 2. Complete half-space (نیم‌فاصله / ZWNJ) invariance
 * 3. Space normalization & compound-word matching (مدار منطقی === مدارمنطقی === مدار‌منطقی)
 * 4. Persian/Arabic character normalization (ي/ی, ك/ک, آ/أ/إ/ا, ة/ه, etc.)
 * 5. Arabic/Persian numeral conversion to Latin (ریاضی ۱ === ریاضی 1)
 * 6. Multi-token unordered matching (الگوریتم ساختمان === ساختمان داده‌ها و الگوریتم‌ها)
 * 7. Persian affix/plural stripping (سیستم عامل === سیستم‌های عامل)
 * 8. Multi-field search (name, code, abbreviation) with relevance ranking
 */

export interface SearchableCourse {
  name: string;
  code?: string | null;
  abbreviation?: string | null;
  degreeLevel?: string | null;
  [key: string]: any;
}

/**
 * Normalizes Persian and Arabic text for search matching:
 * - Lowercases English letters
 * - Converts Persian & Arabic numerals to standard Latin digits
 * - Unifies Arabic Yeh variations to Persian Yeh
 * - Unifies Arabic Kaf to Persian Kaf
 * - Normalizes all forms of Alef to bare Alef
 * - Replaces Teh Marbuta with Heh and Hamza variations
 * - Removes Arabic diacritics / Tanwin / Harakat / Tashdid
 * - Removes Tatweel / Kashida
 * - Replaces ZWNJ (نیم‌فاصله) and other zero-width/non-breaking spaces with standard space
 * - Trims and collapses multiple spaces into a single space
 */
export function normalizePersian(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    // Persian & Arabic numbers to English (0-9)
    .replace(/[۰٠]/g, "0")
    .replace(/[۱١]/g, "1")
    .replace(/[۲٢]/g, "2")
    .replace(/[۳٣]/g, "3")
    .replace(/[۴٤]/g, "4")
    .replace(/[۵٥]/g, "5")
    .replace(/[۶٦]/g, "6")
    .replace(/[۷٧]/g, "7")
    .replace(/[۸٨]/g, "8")
    .replace(/[۹٩]/g, "9")
    // Arabic Yeh and variations to Persian Yeh
    .replace(/[يىئ]/g, "ی")
    // Arabic Kaf to Persian Kaf
    .replace(/ك/g, "ک")
    // Alef variations (آ, أ, إ, ٱ) -> ا
    .replace(/[آأإٱ]/g, "ا")
    // Teh Marbuta -> Heh
    .replace(/ة/g, "ه")
    // Waw with Hamza -> Waw
    .replace(/ؤ/g, "و")
    // Remove diacritics / Tanwin / Harakat (َ ُ ِ ً ٌ ٍ ّ ْ ْ)
    .replace(/[\u064B-\u065F\u0670]/g, "")
    // Remove Tatweel (Kashida ـ)
    .replace(/\u0640/g, "")
    // Remove ZWNJ (نیم‌فاصله) and zero-width / non-breaking spaces
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u200C]/g, " ")
    // Collapse consecutive whitespaces and trim
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strips all spaces from normalized text to enable space-agnostic matching
 * e.g. "مدار منطقی" -> "مدارمنطقی"
 */
export function stripAllSpaces(text: string | null | undefined): string {
  return normalizePersian(text).replace(/\s+/g, "");
}

/**
 * Strips common Persian plural suffixes (های, ها) and connector words
 * e.g. "سیستم‌های عامل" -> "سیستم عامل"
 */
export function stripPersianAffixes(text: string | null | undefined): string {
  return normalizePersian(text)
    .replace(/(\s|^)های(\s|$)/g, " ")
    .replace(/(\w|[\u0600-\u06FF])های(\s|$)/g, "$1 ")
    .replace(/(\w|[\u0600-\u06FF])ها(\s|$)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculates Damerau-Levenshtein distance between two strings
 * (handles insertions, deletions, substitutions, and adjacent transpositions)
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix: number[][] = Array.from({ length: al + 1 }, () =>
    new Array(bl + 1).fill(0)
  );

  for (let i = 0; i <= al; i++) matrix[i][0] = i;
  for (let j = 0; j <= bl; j++) matrix[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }

  return matrix[al][bl];
}

/**
 * Evaluates how well a single query token matches against target tokens
 */
function tokenMatchScore(
  queryToken: string,
  targetTokens: string[],
  targetNoSpace: string
): number {
  if (!queryToken) return 0;

  // 1. Exact match with any target word
  for (const word of targetTokens) {
    if (word === queryToken) return 100;
  }

  // 2. Starts with query token (prefix match)
  for (const word of targetTokens) {
    if (word.startsWith(queryToken)) return 85;
  }

  // 3. Substring match inside any target word
  for (const word of targetTokens) {
    if (word.includes(queryToken)) return 75;
  }

  // 4. Substring in contiguous no-space string
  if (targetNoSpace.includes(queryToken)) return 70;

  // 5. Fuzzy match with slight typo (Damerau-Levenshtein)
  // For tokens of length <= 2: exact only (no typos allowed)
  // For tokens of length 3-5: allow 1 edit
  // For tokens of length >= 6: allow up to 2 edits
  const maxDistance =
    queryToken.length <= 2 ? 0 : queryToken.length <= 5 ? 1 : 2;

  if (maxDistance > 0) {
    let bestFuzzyScore = 0;
    for (const word of targetTokens) {
      if (Math.abs(word.length - queryToken.length) <= maxDistance) {
        const dist = damerauLevenshtein(queryToken, word);
        if (dist <= maxDistance) {
          const score = 60 - dist * 15;
          if (score > bestFuzzyScore) bestFuzzyScore = score;
        }
      }
    }
    if (bestFuzzyScore > 0) return bestFuzzyScore;
  }

  return 0;
}

/**
 * Computes relevance score between a course and a user query
 * Returns 0 if not matched, or a positive integer (higher = more relevant)
 */
export function scoreCourse(course: SearchableCourse, query: string): number {
  const normQuery = normalizePersian(query);
  if (!normQuery) return 100;

  const queryNoSpace = stripAllSpaces(query);
  const queryTokens = normQuery.split(" ").filter(Boolean);

  const normName = normalizePersian(course.name);
  const nameNoSpace = stripAllSpaces(course.name);
  const nameTokens = normName.split(" ").filter(Boolean);

  const normCode = normalizePersian(course.code || "");
  const normAbbr = normalizePersian(course.abbreviation || "");
  const normDegree = normalizePersian(
    course.degreeLevel === "master"
      ? "کارشناسی ارشد ارشد master"
      : course.degreeLevel === "undergrad"
      ? "کارشناسی لیسانس undergrad bachelor"
      : ""
  );

  // 1. Direct exact or prefix match in course code or abbreviation
  if (normCode === normQuery || normAbbr === normQuery) return 1000;
  if (normCode.startsWith(normQuery) || (normAbbr && normAbbr.startsWith(normQuery))) return 950;
  if (normCode.includes(normQuery) || (normAbbr && normAbbr.includes(normQuery))) return 900;

  // 2. Exact match on course name
  if (normName === normQuery) return 800;

  // 3. Exact match with spaces removed (e.g. "مدار منطقی" vs "مدارمنطقی")
  if (nameNoSpace === queryNoSpace) return 750;

  // 4. Exact match with affixes and spaces stripped (e.g. "سیستم‌های عامل" vs "سیستم عامل" vs "سیستمعامل")
  const nameAffixStripped = stripAllSpaces(stripPersianAffixes(course.name));
  const queryAffixStripped = stripAllSpaces(stripPersianAffixes(query));
  if (nameAffixStripped === queryAffixStripped) return 740;

  // 5. Course name starts with query
  if (normName.startsWith(normQuery)) return 700;

  // 6. Contiguous substring match
  if (normName.includes(normQuery)) return 600;

  // 7. Substring match with affixes stripped
  if (nameAffixStripped.includes(queryAffixStripped)) return 560;

  // 8. Query no-space substring in name no-space
  if (nameNoSpace.includes(queryNoSpace)) return 550;

  // 9. Multi-token matching: all query tokens must match the target in some form
  let totalTokenScore = 0;
  for (const qToken of queryTokens) {
    const tokenScore = tokenMatchScore(qToken, nameTokens, nameNoSpace);
    if (tokenScore === 0) {
      // Check if token matches code, abbreviation, or degree level
      if (normCode.includes(qToken) || normAbbr.includes(qToken) || (normDegree && normDegree.includes(qToken))) {
        totalTokenScore += 50;
      } else {
        return 0; // Token not found anywhere -> disqualified
      }
    } else {
      totalTokenScore += tokenScore;
    }
  }

  return Math.round(totalTokenScore / queryTokens.length);
}

/**
 * Searches and ranks courses based on intelligent Persian matching
 * Returns courses sorted by relevance (highest match first)
 */
export function searchCourses<T extends SearchableCourse>(
  items: T[],
  query: string
): T[] {
  if (!query || !query.trim()) return items;

  const trimmedQuery = query.trim();
  const scoredItems: { item: T; score: number }[] = [];

  for (const item of items) {
    const score = scoreCourse(item, trimmedQuery);
    if (score > 0) {
      scoredItems.push({ item, score });
    }
  }

  // Sort descending by score
  scoredItems.sort((a, b) => b.score - a.score);

  return scoredItems.map((s) => s.item);
}
