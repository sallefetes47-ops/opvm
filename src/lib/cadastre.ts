const toAsciiDigits = (value: string): string =>
  value
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

const digitsOnly = (value: string): string => toAsciiDigits(value).replace(/\D/g, "");

export function clampSectionDigits(value: string): string {
  return digitsOnly(value).slice(0, 3);
}

export function clampPropertyGroupDigits(value: string): string {
  return digitsOnly(value).slice(0, 4);
}

export function formatSection(value: unknown): string {
  const digits = clampSectionDigits(String(value ?? "").trim());
  if (!digits) return "";
  return digits.padStart(3, "0");
}

export function formatPropertyGroup(value: unknown): string {
  const digits = clampPropertyGroupDigits(String(value ?? "").trim());
  if (!digits) return "";
  return digits.padStart(4, "0");
}
