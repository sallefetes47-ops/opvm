import { useState, useEffect } from 'react';

/**
 * Overpass API query to extract all buildings in the M'zab Valley.
 * Searches within 6km of (32.4833, 3.6766).
 */
const OVERPASS_QUERY = `
[out:json][timeout:25];
(
  way["building"](around:6000, 32.4833, 3.6766);
  relation["building"](around:6000, 32.4833, 3.6766);
);
out body;
>;
out skel qt;
`.trim();

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Local-storage cache key
const CACHE_KEY = 'mzab_overpass_buildings_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData {
  timestamp: number;
  buildings: { lat: number; lng: number }[];
}

/**
 * Compute the centroid of a list of node IDs using the provided node map.
 */
function computeCentroid(
  nodeIds: number[],
  nodeMap: Map<number, { lat: number; lon: number }>,
): { lat: number; lng: number } | null {
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  for (const id of nodeIds) {
    const node = nodeMap.get(id);
    if (node) {
      sumLat += node.lat;
      sumLng += node.lon;
      count++;
    }
  }

  if (count === 0) return null;
  return { lat: sumLat / count, lng: sumLng / count };
}

/**
 * Parse Overpass JSON response into an array of building centroids.
 */
function parseOverpassResponse(data: any): { lat: number; lng: number }[] {
  const elements: any[] = data.elements || [];

  // Build a map of node id → { lat, lon }
  const nodeMap = new Map<number, { lat: number; lon: number }>();
  for (const el of elements) {
    if (el.type === 'node' && el.lat != null && el.lon != null) {
      nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
    }
  }

  const buildings: { lat: number; lng: number }[] = [];

  for (const el of elements) {
    if (el.type === 'way' && el.nodes) {
      const centroid = computeCentroid(el.nodes, nodeMap);
      if (centroid) buildings.push(centroid);
    } else if (el.type === 'relation' && el.members) {
      // For relations, collect all node references from member ways
      const allNodeIds: number[] = [];
      for (const member of el.members) {
        if (member.type === 'way') {
          // Find the corresponding way element
          const wayEl = elements.find(
            (e: any) => e.type === 'way' && e.id === member.ref,
          );
          if (wayEl?.nodes) {
            allNodeIds.push(...wayEl.nodes);
          }
        } else if (member.type === 'node') {
          allNodeIds.push(member.ref);
        }
      }
      const centroid = computeCentroid(allNodeIds, nodeMap);
      if (centroid) buildings.push(centroid);
    }
  }

  return buildings;
}

/**
 * Try to load cached building data from localStorage.
 */
function loadFromCache(): { lat: number; lng: number }[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedData = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.buildings;
  } catch {
    return null;
  }
}

/**
 * Save building data to localStorage cache.
 */
function saveToCache(buildings: { lat: number; lng: number }[]) {
  try {
    const data: CachedData = { timestamp: Date.now(), buildings };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export interface UseOverpassBuildingsResult {
  /** Array of building centroid coordinates */
  buildings: { lat: number; lng: number }[];
  /** True while the fetch is in progress */
  isLoading: boolean;
  /** Error message if the fetch failed */
  error: string | null;
  /** Total building count */
  count: number;
  /** Whether we're using cached/real data vs mock fallback */
  isRealData: boolean;
}

/**
 * Hook that fetches real building centroids from the Overpass API
 * for the M'zab Valley. Results are cached in localStorage for 24h.
 */
export function useOverpassBuildings(): UseOverpassBuildingsResult {
  const [buildings, setBuildings] = useState<{ lat: number; lng: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealData, setIsRealData] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchBuildings() {
      // 1. Try cache first
      const cached = loadFromCache();
      if (cached && cached.length > 0) {
        if (!cancelled) {
          setBuildings(cached);
          setIsRealData(true);
          setIsLoading(false);
          console.log(`[Overpass] Loaded ${cached.length} buildings from cache`);
        }
        return;
      }

      // 2. Fetch from Overpass API
      try {
        console.log('[Overpass] Fetching real building data from Overpass API…');
        const response = await fetch(OVERPASS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
        });

        if (!response.ok) {
          throw new Error(`Overpass API returned ${response.status}`);
        }

        const data = await response.json();
        const parsed = parseOverpassResponse(data);

        if (!cancelled) {
          setBuildings(parsed);
          setIsRealData(true);
          setIsLoading(false);
          saveToCache(parsed);
          console.log(`[Overpass] Fetched ${parsed.length} real buildings`);
        }
      } catch (err: any) {
        console.warn('[Overpass] Fetch failed, will fall back to mock data:', err.message);
        if (!cancelled) {
          setError(err.message || 'Failed to fetch building data');
          setIsRealData(false);
          setIsLoading(false);
        }
      }
    }

    fetchBuildings();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    buildings,
    isLoading,
    error,
    count: buildings.length,
    isRealData,
  };
}
