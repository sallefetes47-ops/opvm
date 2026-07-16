import { format, isValid, parse } from "date-fns";

export const DATE_INPUT_PATTERN = "dd/MM/yyyy" as const;

const toAsciiDigits = (value: string): string =>
  value
    // Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩)
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    // Eastern Arabic-Indic digits (۰۱۲۳۴۵۶۷۸۹)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

export function formatDateInput(raw: string): string {
  const normalized = toAsciiDigits(raw).trim();
  if (!normalized) return "";

  // Full year-first date: 2026/2/25 or 2026-02-25 -> convert to dd/MM/yyyy
  const yyyyFirst = normalized.match(/^(\d{4})\D(\d{1,2})\D(\d{1,2})$/);
  if (yyyyFirst) {
    const [, y, m, d] = yyyyFirst;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  // Day-first date: 25/2/2026 or 25-02-2026
  const ddFirst = normalized.match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/);
  if (ddFirst) {
    const [, d, m, y] = ddFirst;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  // Digits-only typing
  const digits = normalized.replace(/[^\d]/g, "").slice(0, 8);
  const first4 = digits.length >= 4 ? parseInt(digits.slice(0, 4), 10) : 0;
  const looksLikeYearFirst = first4 >= 1900 && first4 <= 2100;

  if (looksLikeYearFirst) {
    if (digits.length === 8) {
      return `${digits.slice(6, 8)}/${digits.slice(4, 6)}/${digits.slice(0, 4)}`;
    }
    if (digits.length <= 4) return digits.slice(0, 4);
    if (digits.length <= 6) return `${digits.slice(0, 4)}/${digits.slice(4)}`;
    return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6)}`;
  }

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseDateInput(value: string, referenceDate: Date = new Date()): Date | undefined {
  if (value.length !== 10) return undefined;
  const parsed = parse(value, DATE_INPUT_PATTERN, referenceDate);
  if (!isValid(parsed)) return undefined;
  if (format(parsed, DATE_INPUT_PATTERN) !== value) return undefined;
  return parsed;
}

