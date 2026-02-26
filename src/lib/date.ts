import { format, isValid, parse } from "date-fns";

export const YYYYMMDD_PATTERN = "yyyy/MM/dd" as const;

const toAsciiDigits = (value: string): string =>
  value
    // Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩)
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    // Eastern Arabic-Indic digits (۰۱۲۳۴۵۶۷۸۹)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

export function formatYYYYMMDDInput(raw: string): string {
  const normalized = toAsciiDigits(raw).trim();

  // Accept common manual entry/paste like: 2026/2/25 or 2026-02-25
  const loose = normalized.match(/^(\d{4})\D(\d{1,2})\D(\d{1,2})$/);
  if (loose) {
    const [, y, m, d] = loose;
    return `${y}/${m.padStart(2, "0")}/${d.padStart(2, "0")}`;
  }

  // Fallback: digits-only typing (yyyyMMdd) with auto-inserted slashes
  const digits = normalized.replace(/[^\d]/g, "").slice(0, 8); // yyyyMMdd
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}/${digits.slice(4)}`;
  return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6)}`;
}

export function parseYYYYMMDD(value: string, referenceDate: Date = new Date()): Date | undefined {
  if (value.length !== 10) return undefined;
  const parsed = parse(value, YYYYMMDD_PATTERN, referenceDate);
  if (!isValid(parsed)) return undefined;
  if (format(parsed, YYYYMMDD_PATTERN) !== value) return undefined;
  return parsed;
}
