import { format, isValid, parse } from "date-fns";

export const YYYYMMDD_PATTERN = "yyyy/MM/dd" as const;

export function formatYYYYMMDDInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "").slice(0, 8); // yyyyMMdd
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
