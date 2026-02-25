import { format, isValid, parse } from "date-fns";

export const DDMMYYYY_PATTERN = "dd/MM/yyyy" as const;

const toAsciiDigits = (value: string): string =>
  value
    // Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩)
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    // Eastern Arabic-Indic digits (۰۱۲۳۴۵۶۷۸۹)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

export function formatDDMMYYYYInput(raw: string): string {
  const normalized = toAsciiDigits(raw).trim();

  // Accept common manual entry/paste like: 25/2/2026 or 25-02-2026
  const loose = normalized.match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/);
  if (loose) {
    const [, d, m, y] = loose;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  // Fallback: digits-only typing (ddMMyyyy) with auto-inserted slashes
  const digits = normalized.replace(/[^\d]/g, "").slice(0, 8); // ddMMyyyy
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseDDMMYYYY(value: string, referenceDate: Date = new Date()): Date | undefined {
  if (value.length !== 10) return undefined;
  const parsed = parse(value, DDMMYYYY_PATTERN, referenceDate);
  if (!isValid(parsed)) return undefined;
  if (format(parsed, DDMMYYYY_PATTERN) !== value) return undefined;
  return parsed;
}
