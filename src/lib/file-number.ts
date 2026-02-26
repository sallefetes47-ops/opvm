﻿const normalizeText = (value: unknown): string => String(value ?? "").trim();

export function formatFileNumberDisplay(fileNumber: unknown): string {
  const text = normalizeText(fileNumber);
  if (!text) return "";
  return /^\d+$/.test(text) ? text.padStart(3, "0") : text;
}

export function formatFileNumberWithYear(fileNumber: unknown, year: unknown): string {
  const numberPart = formatFileNumberDisplay(fileNumber);
  const yearText = normalizeText(year);
  if (!numberPart) return "";
  if (!yearText) return numberPart;
  return `${numberPart} / ${yearText}`;
}

