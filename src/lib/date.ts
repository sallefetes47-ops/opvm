import { format, isValid, parse } from "date-fns";

export const DDMMYYYY_PATTERN = "dd/MM/yyyy" as const;

export function formatDDMMYYYYInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "").slice(0, 8); // ddMMyyyy
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

