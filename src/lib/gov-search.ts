/**
 * Government Domain Search Engine
 * Uses Lovable AI to search Algerian government domains
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ────────────────────────────────────────────────────────────

export interface GovSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  fileFormat?: string;
  sourceBadge: SourceBadge;
}

export interface SourceBadge {
  label: string;
  color: string;
  textColor: string;
  borderColor: string;
}

export interface GovSearchResponse {
  results: GovSearchResult[];
  totalResults: number;
  searchTime: number;
  error?: string;
  statusCode?: number;
}

// ── Domain Configuration ─────────────────────────────────────────────

interface DomainConfig {
  domain: string;
  label: string;
  color: string;
  textColor: string;
  borderColor: string;
}

const GOV_DOMAINS: DomainConfig[] = [
  {
    domain: "mhuv.gov.dz",
    label: "وزارة السكن والعمران",
    color: "bg-blue-100 dark:bg-blue-950/40",
    textColor: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-300 dark:border-blue-700",
  },
  {
    domain: "m-culture.gov.dz",
    label: "وزارة الثقافة",
    color: "bg-amber-100 dark:bg-amber-950/40",
    textColor: "text-amber-700 dark:text-amber-300",
    borderColor: "border-amber-300 dark:border-amber-700",
  },
  {
    domain: "interieur.gov.dz",
    label: "وزارة الداخلية",
    color: "bg-emerald-100 dark:bg-emerald-950/40",
    textColor: "text-emerald-700 dark:text-emerald-300",
    borderColor: "border-emerald-300 dark:border-emerald-700",
  },
  {
    domain: "joradp.dz",
    label: "الجريدة الرسمية",
    color: "bg-red-100 dark:bg-red-950/40",
    textColor: "text-red-700 dark:text-red-300",
    borderColor: "border-red-300 dark:border-red-700",
  },
];

const DEFAULT_BADGE: SourceBadge = {
  label: "مصدر حكومي",
  color: "bg-gray-100 dark:bg-gray-800",
  textColor: "text-gray-700 dark:text-gray-300",
  borderColor: "border-gray-300 dark:border-gray-700",
};

// ── Helpers ──────────────────────────────────────────────────────────

export function getSourceBadge(source: string): SourceBadge {
  const lower = source.toLowerCase();
  for (const d of GOV_DOMAINS) {
    if (lower.includes(d.domain)) {
      return {
        label: d.label,
        color: d.color,
        textColor: d.textColor,
        borderColor: d.borderColor,
      };
    }
  }
  return DEFAULT_BADGE;
}

export function isPdfUrl(url: string): boolean {
  return url.toLowerCase().endsWith(".pdf");
}

export function isSearchConfigured(): boolean {
  // Always configured - uses Lovable AI via edge function
  return true;
}

// ── API Call ─────────────────────────────────────────────────────────

export async function searchGovDomains(
  query: string
): Promise<GovSearchResponse> {
  if (!query.trim()) {
    return { results: [], totalResults: 0, searchTime: 0 };
  }

  const startTime = performance.now();

  try {
    const { data, error } = await supabase.functions.invoke("gov-search", {
      body: { query: query.trim() },
    });

    const elapsed = Math.round(performance.now() - startTime);

    if (error) {
      console.error("[GOV-SEARCH] Edge function error:", error);
      return {
        results: [],
        totalResults: 0,
        searchTime: elapsed,
        error: "خطأ في الاتصال بخدمة البحث",
        statusCode: 500,
      };
    }

    if (data?.error) {
      return {
        results: [],
        totalResults: 0,
        searchTime: elapsed,
        error: data.error,
        statusCode: data.statusCode || 500,
      };
    }

    const rawResults = data?.results || [];
    const results: GovSearchResult[] = rawResults.map(
      (item: { title?: string; link?: string; snippet?: string; source?: string }) => ({
        title: item.title || "",
        link: item.link || "",
        snippet: item.snippet || "",
        displayLink: item.source || "",
        sourceBadge: getSourceBadge(item.source || item.link || ""),
      })
    );

    return {
      results,
      totalResults: data?.total_count || results.length,
      searchTime: elapsed,
    };
  } catch (err) {
    console.error("[GOV-SEARCH] Network error:", err);
    const elapsed = Math.round(performance.now() - startTime);
    return {
      results: [],
      totalResults: 0,
      searchTime: elapsed,
      error: "خطأ في الاتصال بالخادم",
      statusCode: 500,
    };
  }
}
