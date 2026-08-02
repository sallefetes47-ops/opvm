import { format, isValid, parseISO } from "date-fns";

/** Formats any date-like value as DD/MM/YYYY. Returns the raw value if unparseable. */
export function formatPdfDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) {
    return isValid(value) ? format(value, "dd/MM/yyyy") : "";
  }
  const raw = String(value).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const iso = parseISO(raw);
  if (isValid(iso)) return format(iso, "dd/MM/yyyy");
  return raw;
}

interface PrintPdfOptions {
  title: string;
  subtitle?: string;
  bodyHtml: string;
}

/**
 * Opens a print-ready RTL Arabic document in a new window so the user can
 * save it as PDF (native rendering keeps Arabic shaping correct).
 */
export function exportHtmlAsPdf({ title, subtitle, bodyHtml }: PrintPdfOptions) {
  const printedAt = formatPdfDate(new Date());
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;

  win.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', sans-serif; margin: 32px; color: #1a1a1a; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 4px; }
  .meta { color: #8a7020; font-size: 12px; margin-bottom: 20px; }
  hr { border: none; border-top: 2px solid #D4AF37; margin: 0 0 20px; }
  .entry { page-break-inside: avoid; margin-bottom: 18px; padding: 12px 14px; border: 1px solid #e5e5e5; border-top: 3px solid #D4AF37; border-radius: 6px; }
  .entry-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 700; margin-bottom: 8px; }
  .entry-head .tag { color: #8a7020; font-weight: 600; font-size: 12px; white-space: nowrap; }
  ul { margin: 0; padding-inline-start: 18px; }
  li { font-size: 13px; line-height: 1.9; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; }
  th { background: #faf5e6; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
  <h1>${title}</h1>
  ${subtitle ? `<div class="sub">${subtitle}</div>` : ""}
  <div class="meta">تاريخ التصدير: ${printedAt} — ديوان حماية وادي مزاب وترقيته</div>
  <hr />
  ${bodyHtml}
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 400); };</script>
</body>
</html>`);
  win.document.close();
  return true;
}

/** Escapes a value for safe HTML interpolation in exported documents. */
export function escapeHtmlValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
