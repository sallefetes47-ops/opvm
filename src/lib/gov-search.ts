/**
 * Government Domain Search Engine
 * Restricts legal queries to official Algerian government domains
 * using Google Custom Search API.
 * 
 * FORCED ARCHITECTURAL FIX: Clean fetch implementation with strict key validation
 */

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

export function buildGovSearchQuery(userQuery: string): string {
    const siteFilter = GOV_DOMAINS.map((d) => `site:${d.domain}`).join(" OR ");
    return `${userQuery.trim()} (${siteFilter})`;
}

export function getSourceBadge(url: string): SourceBadge {
    const lower = url.toLowerCase();
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
    const key = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
    const cx = import.meta.env.VITE_GOOGLE_SEARCH_CX;
    return Boolean(key && cx && key.length > 0 && cx.length > 0);
}

// ── API Call ─────────────────────────────────────────────────────────

/**
 * FORCED ARCHITECTURAL FIX: Clean fetch with strict key validation
 */
export async function searchGovDomains(
    query: string,
    start: number = 1
): Promise<GovSearchResponse> {
    if (!query.trim()) {
        return { results: [], totalResults: 0, searchTime: 0 };
    }

    // Strict key validation - check for undefined/null/empty
    const apiKey = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
    const cx = import.meta.env.VITE_GOOGLE_SEARCH_CX;

    console.log("[GOOGLE API] Key check:", {
        hasKey: apiKey !== undefined && apiKey !== null && apiKey.length > 0,
        hasCx: cx !== undefined && cx !== null && cx.length > 0,
        keyLength: apiKey?.length || 0,
        cxLength: cx?.length || 0,
    });

    if (apiKey === undefined || apiKey === null || apiKey.length === 0) {
        console.error("[GOOGLE API] API KEY IS UNDEFINED OR EMPTY");
        return {
            results: [],
            totalResults: 0,
            searchTime: 0,
            error: "مفتاح API غير مُعد. يرجى إضافة VITE_GOOGLE_SEARCH_API_KEY في ملف .env",
        };
    }

    if (cx === undefined || cx === null || cx.length === 0) {
        console.error("[GOOGLE API] CX IS UNDEFINED OR EMPTY");
        return {
            results: [],
            totalResults: 0,
            searchTime: 0,
            error: "معرف محرك البحث غير مُعد. يرجى إضافة VITE_GOOGLE_SEARCH_CX في ملف .env",
        };
    }

    const fullQuery = buildGovSearchQuery(query);
    const startTime = performance.now();

    // Clean fetch URL construction
    const baseUrl = "https://www.googleapis.com/customsearch/v1";
    const params = new URLSearchParams({
        key: apiKey,
        cx: cx,
        q: fullQuery,
        start: String(start),
        num: "10",
        lr: "lang_ar|lang_fr",
    });

    const url = `${baseUrl}?${params.toString()}`;
    console.log("[GOOGLE API] Fetching:", url.replace(apiKey, "***REDACTED***"));

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Debug: Log full response for error diagnosis
        console.log("[GOOGLE API] Full Response:", data);

        if (!response.ok) {
            console.error("[GOOGLE API] Request failed:", response.status, response.statusText);
            console.error("[GOOGLE API] Error response:", data);
            
            let errorMsg: string;
            if (response.status === 403) {
                errorMsg = "جاري مزامنة صلاحيات البحث مع سيرفرات جوجل... يرجى إعادة المحاولة خلال دقيقة";
            } else {
                errorMsg = data?.error?.message || 
                            data?.error?.errors?.[0]?.message || 
                            `خطأ في الخادم: ${response.status}`;
            }
            
            return {
                results: [],
                totalResults: 0,
                searchTime: 0,
                error: errorMsg,
            };
        }

        const elapsed = Math.round(performance.now() - startTime);
        console.log("[GOOGLE API] Success:", data.searchInformation?.totalResults || 0, "results in", elapsed, "ms");

        const results: GovSearchResult[] = (data.items || []).map(
            (item: Record<string, unknown>) => ({
                title: (item.title as string) || "",
                link: (item.link as string) || "",
                snippet: (item.snippet as string) || "",
                displayLink: (item.displayLink as string) || "",
                fileFormat: (item.fileFormat as string) || undefined,
                sourceBadge: getSourceBadge((item.link as string) || ""),
            })
        );

        return {
            results,
            totalResults: Number(data.searchInformation?.totalResults || 0),
            searchTime: elapsed,
        };
    } catch (err) {
        console.error("[GOOGLE API] Network error:", err);
        return {
            results: [],
            totalResults: 0,
            searchTime: 0,
            error: err instanceof Error ? err.message : "خطأ في الاتصال بالخادم",
        };
    }
}
