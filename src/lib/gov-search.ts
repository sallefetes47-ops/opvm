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

    // URL construction as specified: https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${query}
    const baseUrl = "https://www.googleapis.com/customsearch/v1";
    const url = `${baseUrl}?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(fullQuery)}&start=${start}&num=10&lr=lang_ar|lang_fr`;
    console.log("[GOOGLE API] Fetching:", url.replace(apiKey, "***REDACTED***"));

    try {
        const response = await fetch(url, {
            method: "GET",
            mode: "cors",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();

        // Enhanced error handling: log status and full JSON error
        if (!response.ok) {
            console.error("[GOOGLE API] Request failed - Status:", response.status);
            console.error("[GOOGLE API] Error response JSON:", JSON.stringify(data, null, 2));

            let errorMsg: string;
            const googleErrorMessage = data?.error?.message || data?.error?.errors?.[0]?.message || "";
            const googleErrorReason = data?.error?.errors?.[0]?.reason || "";

            // Only show "API key expired" if Google explicitly returns this error
            if (googleErrorMessage.toLowerCase().includes("expired") || googleErrorReason === "API_KEY_EXPIRED") {
                console.error("[GOOGLE API] Key Expiration Detected:", googleErrorMessage);
                errorMsg = "مفتاح API منتهي الصلاحية. يرجى تحديث المفتاح في ملف .env";
            } else if (response.status === 403) {
                console.error("[GOOGLE API] 403 Forbidden Details:", googleErrorMessage || "No details");
                errorMsg = "جاري مزامنة صلاحيات البحث مع سيرفرات جوجل... يرجى إعادة المحاولة خلال دقيقة";
            } else if (response.status === 429) {
                console.error("[GOOGLE API] Quota Exceeded:", googleErrorMessage);
                errorMsg = "تم تجاوز حد الاستخدام اليومي. يرجى المحاولة غداً";
            } else {
                errorMsg = googleErrorMessage || `خطأ في الخادم: ${response.status}`;
            }

            return {
                results: [],
                totalResults: 0,
                searchTime: 0,
                error: errorMsg,
                statusCode: response.status,
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
