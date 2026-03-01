/**
 * Government Domain Search Engine
 * Restricts legal queries to official Algerian government domains
 * using Google Custom Search API via Vite dev proxy.
 * 
 * FORCED API FIX: Clean reconnect implementation with debug logging
 */

// ── Types ────────────────────────────────────────────────────────────

export interface GovSearchResult {
    title: string;
    link: string;
    snippet: string;
    displayLink: string;
    fileFormat?: string; // e.g. "PDF"
    sourceBadge: SourceBadge;
}

export interface SourceBadge {
    label: string;
    color: string;       // tailwind bg class
    textColor: string;   // tailwind text class
    borderColor: string; // tailwind border class
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

/**
 * Build the search query with domain restriction.
 * Appends OR-combined site: filters so results come only from the 4 gov domains.
 */
export function buildGovSearchQuery(userQuery: string): string {
    const siteFilter = GOV_DOMAINS.map((d) => `site:${d.domain}`).join(" OR ");
    return `${userQuery.trim()} (${siteFilter})`;
}

/**
 * Parse a result URL and return the matching source badge.
 */
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

/**
 * Check if a URL points to a PDF file.
 */
export function isPdfUrl(url: string): boolean {
    return url.toLowerCase().endsWith(".pdf");
}

/**
 * Check if the required env vars are configured.
 */
export function isSearchConfigured(): boolean {
    const key = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
    const cx = import.meta.env.VITE_GOOGLE_SEARCH_CX;
    return Boolean(key && cx && key.length > 0 && cx.length > 0);
}

// ── API Call ─────────────────────────────────────────────────────────

/**
 * Search Algerian government domains via the Vite proxy.
 * FORCED API FIX: Clean reconnect with debug logging
 */
export async function searchGovDomains(
    query: string,
    start: number = 1
): Promise<GovSearchResponse> {
    if (!query.trim()) {
        return { results: [], totalResults: 0, searchTime: 0 };
    }

    // Explicitly re-read environment variables (fresh read on each call)
    const apiKey = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
    const cx = import.meta.env.VITE_GOOGLE_SEARCH_CX;

    console.log("[Google Search API] Environment check:");
    console.log("[Google Search API] API Key configured:", apiKey ? "Yes (length: " + apiKey.length + ")" : "No");
    console.log("[Google Search API] CX configured:", cx ? "Yes (length: " + cx.length + ")" : "No");

    if (!apiKey || !cx) {
        console.error("[Google Search API] Missing configuration!");
        return {
            results: [],
            totalResults: 0,
            searchTime: 0,
            error: "مفاتيح البحث غير مُعدّة. يرجى إضافة VITE_GOOGLE_SEARCH_API_KEY و VITE_GOOGLE_SEARCH_CX في ملف .env",
        };
    }

    const fullQuery = buildGovSearchQuery(query);
    const startTime = performance.now();

    // Build the exact fetch URL
    const baseUrl = "https://www.googleapis.com/customsearch/v1";
    const params = new URLSearchParams({
        key: apiKey,
        cx: cx,
        q: fullQuery,
        start: String(start),
        num: "10",
        lr: "lang_ar|lang_fr",
    });

    const fetchUrl = `${baseUrl}?${params.toString()}`;
    
    console.log("[Google Search API] Fetch URL:", baseUrl + "?key=***REDACTED***&cx=" + cx + "&q=" + encodeURIComponent(fullQuery));
    console.log("[Google Search API] Sending request...");

    try {
        const response = await fetch(fetchUrl);

        console.log("[Google Search API] Response status:", response.status, response.statusText);

        // Clone response for debugging (in case we need to read it twice)
        const responseClone = response.clone();
        
        // Read response body for debug logging
        const responseBody = await responseClone.json().catch(() => null);
        
        console.log("[Google Search API] Full response object:", JSON.stringify(responseBody, null, 2));

        if (!response.ok) {
            const errorData = responseBody;
            const errorMsg = errorData?.error?.message || `خطأ في الخادم: ${response.status}`;
            
            console.error("[Google Search API] Error details:", {
                status: response.status,
                statusText: response.statusText,
                error: errorData,
            });
            
            return {
                results: [],
                totalResults: 0,
                searchTime: 0,
                error: errorMsg,
            };
        }

        const data = responseBody;
        const elapsed = Math.round(performance.now() - startTime);

        console.log("[Google Search API] Success! Found", data.searchInformation?.totalResults || 0, "results in", elapsed, "ms");

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
        console.error("[Google Search API] Network error:", err);
        return {
            results: [],
            totalResults: 0,
            searchTime: 0,
            error: err instanceof Error ? err.message : "خطأ غير متوقع في الاتصال",
        };
    }
}
