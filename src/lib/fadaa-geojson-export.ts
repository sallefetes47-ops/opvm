/**
 * Fadaa El Djazair -> GeoJSON exporter (browser-side)
 *
 * The official server (https://fadaeldjazair.mf.gov.dz) is only reachable from
 * Algerian networks, so all requests run in the user's browser (not on a server).
 * Data is collected from the GeoServer WFS service and written to a .geojson file.
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

/**
 * Fetches a Fadaa URL: first through the backend proxy (no CORS),
 * then directly from the browser (works on Algerian networks).
 */
const fetchFadaa = async (targetUrl: string, ms = 60000): Promise<Response> => {
  try {
    const res = await withTimeout(viaProxy(targetUrl), ms);
    if (res.ok) return res;
  } catch {
    // fall through to direct attempt
  }
  return withTimeout(targetUrl, ms);
};

/** Lists all published WFS layers via GetCapabilities. */
export async function fetchWfsLayers(): Promise<WfsLayer[]> {
  const url = `${WFS_ENDPOINT}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetCapabilities`;
  const res = await fetchFadaa(url);
  if (!res.ok) throw new Error(`GetCapabilities فشل [${res.status}]`);
  const xml = new DOMParser().parseFromString(await res.text(), "text/xml");

  const layers: WfsLayer[] = [];
  xml.querySelectorAll("FeatureType").forEach((node) => {
    const name = node.getElementsByTagName("Name")[0]?.textContent?.trim();
    const title = node.getElementsByTagName("Title")[0]?.textContent?.trim();
    if (name) layers.push({ name, title: title || name });
  });
  return layers;
}


/** Fetches one layer as GeoJSON, limited to the Ghardaia bounding box. */
export async function fetchLayerGeoJson(
  typeName: string,
  maxFeatures = 5000
): Promise<GeoJsonCollection> {
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

  const res = await fetchFadaa(`${WFS_ENDPOINT}?${params.toString()}`);
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

/** Triggers a browser download of the collection as a .geojson file. */
export function downloadGeoJson(collection: GeoJsonCollection, fileName: string) {
  const blob = new Blob([JSON.stringify(collection, null, 2)], {
    type: "application/geo+json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".geojson") ? fileName : `${fileName}.geojson`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
