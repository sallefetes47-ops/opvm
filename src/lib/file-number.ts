const normalizeText = (value: unknown): string => String(value ?? "").trim();

/**
 * Format section number to 3 digits (e.g., 012)
 */
export function formatSectionNumber(section: unknown): string {
  const text = normalizeText(section);
  if (!text) return "";
  const num = parseInt(text, 10);
  if (isNaN(num)) return text;
  return String(num).padStart(3, "0");
}

/**
 * Format property group number to 4 digits (e.g., 0158)
 */
export function formatPropertyGroupNumber(group: unknown): string {
  const text = normalizeText(group);
  if (!text) return "";
  const num = parseInt(text, 10);
  if (isNaN(num)) return text;
  return String(num).padStart(4, "0");
}

/**
 * Format date to strict YYYY/MM/DD format
 */
export function formatDateStrict(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  
  return `${year}/${month}/${day}`;
}

/**
 * Format file number to 3 digits
 */
export function formatFileNumberDisplay(fileNumber: unknown): string {
  const text = normalizeText(fileNumber);
  if (!text) return "";
  return /^\d+$/.test(text) ? text.padStart(3, "0") : text;
}

/**
 * Format file number with year in strict YYYY/MM/DD style
 */
export function formatFileNumberWithYear(fileNumber: unknown, year: unknown): string {
  const numberPart = formatFileNumberDisplay(fileNumber);
  const yearText = normalizeText(year);
  if (!numberPart) return "";
  if (!yearText) return numberPart;
  return `${numberPart} / ${yearText}`;
}

