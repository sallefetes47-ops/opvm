const digitsOnly = (value: string): string => value.replace(/\D/g, "");

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

