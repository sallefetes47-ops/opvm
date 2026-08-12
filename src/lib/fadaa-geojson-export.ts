/**
 * Fadaa El Djazair -> GeoJSON exporter (browser-side)
 *
 * The official server may only be reachable from Algerian networks. Requests use
 * the backend proxy first, then the browser, and finally the bundled cadastral
 * dataset so importing/exporting remains available offline.
 */

import { WFS_ENDPOINT, WILAYA_47_CODE } from "@/lib/fadaa-el-djazair";

export interface WfsLayer {
  name: string;
  title: string;
}

export interface GeoJsonFeature {
  type: "Feature";
  geometry: unknown;
  properties: Record<string, unknown>;
}

export interface GeoJsonCollection {
  type: "FeatureCollection";
  name?: string;
  features: GeoJsonFeature[];
  metadata?: Record<string, unknown>;
}

/** Ghardaia (wilaya 47) bounding box: minLon, minLat, maxLon, maxLat */
export const WILAYA_47_BBOX = [3.2, 32.2, 4.3, 32.75] as const;
export const LOCAL_CADASTRE_LAYER = "opvm:mzab_cadastre";
const LOCAL_CADASTRE_URL = "/mzab_cadastre_map.json";

const PROXY_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fadaa-proxy`;

/** Wraps a Fadaa URL through the backend proxy (avoids browser CORS). */
const viaProxy = (targetUrl: string) =>
  `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;

const withTimeout = async (url: string, ms = 60000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: "*/*" } });
  } finally {
    clearTimeout(timer);
  }
};

/** Why the remote fetch failed, so the UI can show precise guidance. */
export type FetchFailureKind =
  | "proxy_unreachable"
  | "proxy_error"
  | "cors_or_network"
  | "timeout"
  | "http_error"
  | "invalid_response";

export interface FetchDiagnostic {
  kind: FetchFailureKind;
  /** Arabic, human-readable cause. */
  reason: string;
  /** Ordered retry / workaround steps. */
  steps: string[];
  /** Raw technical detail for the details block. */
  detail?: string;
}

const DIAGNOSTIC_LABELS: Record<FetchFailureKind, { reason: string; steps: string[] }> = {
  proxy_unreachable: {
    reason: "وسيط الخادم (fadaa-proxy) لم يستجب — قد يكون متوقفاً أو محجوباً.",
    steps: [
      "أعد المحاولة بالضغط على «استعراض الطبقات المتوفرة» بعد بضع ثوانٍ.",
      "تحقّق من اتصال المنصة بالخدمات الخلفية.",
      "أو استخدم «بيانات المسح العقاري المحلية» المتاحة دون اتصال.",
    ],
  },
  proxy_error: {
    reason: "وسيط الخادم استجاب بخطأ عند الاتصال بموقع فضاء الجزائر (الموقع محجوب جغرافياً غالباً).",
    steps: [
      "أعد المحاولة لاحقاً؛ الموقع الرسمي غير متاح خارج الشبكات الجزائرية.",
      "نزّل الملف من الموقع الرسمي من حاسوب متصل بشبكة جزائرية.",
      "ثم استورده هنا عبر «اختيار ملف GeoJSON».",
    ],
  },
  cors_or_network: {
    reason: "المتصفح منع الطلب المباشر (CORS) أو تعذّر الوصول إلى الشبكة.",
    steps: [
      "أعد المحاولة؛ يجري النظام محاولة عبر وسيط الخادم أولاً.",
      "شغّل الصفحة من شبكة جزائرية للسماح بالطلب المباشر.",
      "أو استخدم الاستيراد المحلي للملف، أو الطبقة المحلية الجاهزة.",
    ],
  },
  timeout: {
    reason: "انتهت المدة المحددة للطلب دون استجابة من موقع فضاء الجزائر.",
    steps: [
      "أعد المحاولة — قد يكون الموقع بطيئاً مؤقتاً.",
      "قلّل عدد الطبقات المحددة عند التصدير.",
      "أو اعتمد على الطبقة المحلية المتاحة دون اتصال.",
    ],
  },
  http_error: {
    reason: "الخدمة الرسمية أرجعت رمز خطأ HTTP.",
    steps: [
      "أعد المحاولة بعد قليل.",
      "إذا استمر الخطأ فالخدمة معطّلة؛ استخدم الاستيراد المحلي.",
    ],
  },
  invalid_response: {
    reason: "الاستجابة لم تكن بصيغة صالحة (ليست GeoJSON أو XML سليم).",
    steps: [
      "أعد المحاولة — قد تكون الاستجابة صفحة خطأ مؤقتة.",
      "استخدم الاستيراد المحلي لملف GeoJSON نزّلته من الموقع الرسمي.",
    ],
  },
};

/** Builds a user-facing diagnostic from a failure kind. */
export function buildDiagnostic(kind: FetchFailureKind, detail?: string): FetchDiagnostic {
  return { kind, ...DIAGNOSTIC_LABELS[kind], detail };
}

/** Classifies a thrown fetch error into a diagnostic kind. */
export function classifyError(error: unknown): FetchDiagnostic {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || /timeout|timed out/i.test(message)) {
    return buildDiagnostic("timeout", message);
  }
  if (/JSON|XML|صالح/i.test(message)) return buildDiagnostic("invalid_response", message);
  if (/\[\d{3}\]/.test(message)) return buildDiagnostic("http_error", message);
  return buildDiagnostic("cors_or_network", message);
}

/**
 * Fetches a Fadaa URL: first through the backend proxy (no CORS),
 * then directly from the browser (works on Algerian networks).
 * Records why each attempt failed in `diagnostics`.
 */
const fetchFadaa = async (
  targetUrl: string,
  ms = 60000,
  diagnostics?: FetchDiagnostic[]
): Promise<Response> => {
  try {
    const res = await withTimeout(viaProxy(targetUrl), ms);
    if (res.ok) return res;
    diagnostics?.push(buildDiagnostic("proxy_error", `الوسيط أرجع الرمز ${res.status}`));
  } catch (e) {
    diagnostics?.push(
      buildDiagnostic("proxy_unreachable", e instanceof Error ? e.message : String(e))
    );
  }
  try {
    const res = await withTimeout(targetUrl, ms);
    if (!res.ok) {
      const diag = buildDiagnostic("http_error", `الموقع الرسمي أرجع الرمز ${res.status}`);
      diagnostics?.push(diag);
    }
    return res;
  } catch (e) {
    diagnostics?.push(classifyError(e));
    throw e;
  }
};

/** Lists all published WFS layers via GetCapabilities. */
export async function fetchWfsLayers(
  diagnostics?: FetchDiagnostic[],
  offlineOnly = false
): Promise<WfsLayer[]> {
  const localLayer: WfsLayer = {
    name: LOCAL_CADASTRE_LAYER,
    title: "بيانات المسح العقاري المحلية — وادي مزاب",
  };
  const local = await fetch(LOCAL_CADASTRE_URL);
  if (!local.ok) throw new Error(`تعذّر تحميل بيانات الخريطة المحلية [${local.status}]`);

  // Offline-only mode: never touch the network beyond the bundled dataset.
  if (offlineOnly) return [localLayer];

  const url = `${WFS_ENDPOINT}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetCapabilities`;
  try {
    const res = await fetchFadaa(url, 8000, diagnostics);
    if (!res.ok) throw new Error(`GetCapabilities فشل [${res.status}]`);
    const xml = new DOMParser().parseFromString(await res.text(), "text/xml");
    const layers: WfsLayer[] = [];
    xml.querySelectorAll("FeatureType").forEach((node) => {
      const name = node.getElementsByTagName("Name")[0]?.textContent?.trim();
      const title = node.getElementsByTagName("Title")[0]?.textContent?.trim();
      if (name) layers.push({ name, title: title || name });
    });
    if (layers.length) return [localLayer, ...layers];
    diagnostics?.push(buildDiagnostic("invalid_response", "GetCapabilities لم يُرجع أي طبقة"));
  } catch (e) {
    // The official host is commonly unreachable outside Algerian networks.
    if (!diagnostics?.length) diagnostics?.push(classifyError(e));
  }
  return [localLayer];
}



/** Fetches one layer as GeoJSON, limited to the Ghardaia bounding box. */
export async function fetchLayerGeoJson(
  typeName: string,
  maxFeatures = 5000,
  diagnostics?: FetchDiagnostic[]
): Promise<GeoJsonCollection> {
  if (typeName === LOCAL_CADASTRE_LAYER) {
    const res = await fetch(LOCAL_CADASTRE_URL);
    if (!res.ok) throw new Error(`تعذّر تحميل بيانات الخريطة المحلية [${res.status}]`);
    const collection = await res.json() as GeoJsonCollection;
    if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
      throw new Error("ملف بيانات الخريطة المحلية غير صالح");
    }
    return collection;
  }

  const [minLon, minLat, maxLon, maxLat] = WILAYA_47_BBOX;
  const params = new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: typeName,
    OUTPUTFORMAT: "application/json",
    SRSNAME: "EPSG:4326",
    MAXFEATURES: String(maxFeatures),
    BBOX: `${minLat},${minLon},${maxLat},${maxLon},EPSG:4326`,
  });

  const res = await fetchFadaa(`${WFS_ENDPOINT}?${params.toString()}`, 60000, diagnostics);
  if (!res.ok) throw new Error(`جلب الطبقة ${typeName} فشل [${res.status}]`);

  const text = await res.text();
  let json: GeoJsonCollection;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`الطبقة ${typeName} لم ترجع GeoJSON صالحاً`);
  }
  if (!json || json.type !== "FeatureCollection") {
    throw new Error(`الطبقة ${typeName} لا تحتوي على معالم جغرافية`);
  }
  return json;
}

/** Merges several layers into one FeatureCollection, tagging each feature with its source layer. */
export function mergeCollections(
  parts: { layer: string; collection: GeoJsonCollection }[]
): GeoJsonCollection {
  const features: GeoJsonFeature[] = [];
  for (const { layer, collection } of parts) {
    for (const feature of collection.features || []) {
      features.push({
        ...feature,
        properties: { ...(feature.properties || {}), source_layer: layer },
      });
    }
  }
  return {
    type: "FeatureCollection",
    name: `fadaa_eldjazair_wilaya_${WILAYA_47_CODE}`,
    metadata: {
      source: "Fadaa El Djazair — Ministère des Finances",
      source_url:
        "https://fadaeldjazair.mf.gov.dz/mission-documentaire/index_public_47.html",
      wilaya: WILAYA_47_CODE,
      layers: parts.map((p) => p.layer),
      feature_count: features.length,
      exported_at: new Date().toISOString(),
    },
    features,
  };
}

/** Triggers a browser download of a blob. */
function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const ensureExt = (fileName: string, ext: string) =>
  fileName.toLowerCase().endsWith(`.${ext}`) ? fileName : `${fileName}.${ext}`;

/** Triggers a browser download of the collection as a .geojson file. */
export function downloadGeoJson(collection: GeoJsonCollection, fileName: string) {
  triggerDownload(
    new Blob([JSON.stringify(collection, null, 2)], { type: "application/geo+json" }),
    ensureExt(fileName, "geojson")
  );
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Normalizes ISO-like date values to DD/MM/YYYY, leaves other values untouched. */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  const match = text.match(ISO_DATE);
  if (match) {
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
  }
  return text;
}

const escapeCsv = (value: string) =>
  /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** Converts a FeatureCollection to CSV, preserving all layer properties. */
export function collectionToCsv(collection: GeoJsonCollection): string {
  const features = collection.features || [];
  const keys: string[] = [];
  for (const feature of features) {
    for (const key of Object.keys(feature.properties || {})) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  const header = [...keys, "geometry_type", "geometry"];
  const rows = features.map((feature) => {
    const props = feature.properties || {};
    const geometry = feature.geometry as { type?: string } | null;
    return [
      ...keys.map((k) => escapeCsv(formatCellValue(props[k]))),
      escapeCsv(geometry?.type ?? ""),
      escapeCsv(JSON.stringify(feature.geometry ?? null)),
    ].join(",");
  });
  // BOM keeps Arabic readable in Excel
  return `\uFEFF${header.map(escapeCsv).join(",")}\n${rows.join("\n")}`;
}

/** Triggers a browser download of the collection as a .csv file. */
export function downloadCsv(collection: GeoJsonCollection, fileName: string) {
  triggerDownload(
    new Blob([collectionToCsv(collection)], { type: "text/csv;charset=utf-8" }),
    ensureExt(fileName, "csv")
  );
}

export type ExportFormat = "geojson" | "csv";

/** Downloads the collection in the requested format. */
export function downloadCollection(
  collection: GeoJsonCollection,
  fileName: string,
  format: ExportFormat
) {
  if (format === "csv") downloadCsv(collection, fileName);
  else downloadGeoJson(collection, fileName);
}

