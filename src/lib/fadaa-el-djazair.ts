/**
 * Fadaa El Djazair Official Cadastral Integration
 * 
 * Integration with the official Algerian Land Registry (Fadaa El Djazair)
 * Ministry of Finance - Wilaya 47 (Ghardaïa)
 * 
 * LIVE API ENDPOINTS:
 * - WMS: https://fadaeldjazair.mf.gov.dz/geoserver/wms
 * - WFS: https://fadaeldjazair.mf.gov.dz/geoserver/wfs
 * 
 * This module provides:
 * - WMS (Web Map Service) layer integration for visual overlays
 * - WFS (Web Feature Service) integration for vector data extraction
 * - CORS proxy handling for government server requests
 * - GetFeatureInfo extraction for cadastral metadata
 */

import { formatSection, formatPropertyGroup } from '@/lib/cadastre';

// ============================================================================
// CONFIGURATION - Official Fadaa El Djazair Endpoints (LIVE)
// ============================================================================

/**
 * Official Fadaa El Djazair base URL (LIVE)
 * Source: https://fadaeldjazair.mf.gov.dz/mission-documentaire/index_public_47.html
 */
export const FADAA_EL_DJAZAIR_BASE_URL = 'https://fadaeldjazair.mf.gov.dz';

/**
 * WMS (Web Map Service) Endpoint - LIVE
 * Used for visual map overlays with transparent cadastral boundaries
 */
export const WMS_ENDPOINT = `${FADAA_EL_DJAZAIR_BASE_URL}/geoserver/wms`;

/**
 * WFS (Web Feature Service) Endpoint - LIVE
 * Used for fetching raw vector data (GeoJSON) with property attributes
 */
export const WFS_ENDPOINT = `${FADAA_EL_DJAZAIR_BASE_URL}/geoserver/wfs`;

/**
 * Local CORS Proxy Endpoint
 * Bypasses browser CORS restrictions for government server requests
 */
export const CADASTRAL_PROXY_ENDPOINT = '/api/cadastral-proxy';

/**
 * Wilaya code for Ghardaïa
 */
export const WILAYA_47_CODE = '47';

/**
 * Available layers for Fadaa El Djazair cadastral data
 * Based on typical GeoServer layer naming conventions
 */
export const CADASTRAL_LAYERS = {
  /** Cadastral sections (Sections cadastrales) */
  SECTIONS: 'cadastre:sections',
  /** Property groups (Ilots/Groupes de propriété) */
  PROPERTY_GROUPS: 'cadastre:groupes_propriete',
  /** Parcels (Parcelles) */
  PARCELS: 'cadastre:parcelles',
  /** Communes */
  COMMUNES: 'cadastre:communes',
} as const;

/**
 * Alternative layer names (common variations)
 */
export const CADASTRAL_LAYERS_ALT = {
  SECTIONS: ['cadastre:sections', 'cadastre:section', 'sections', 'section_cadastrale'],
  PROPERTY_GROUPS: ['cadastre:groupes_propriete', 'cadastre:ilot', 'ilots', 'groupes'],
  PARCELS: ['cadastre:parcelles', 'cadastre:parcelle', 'parcelles', 'parcelles_cadastrales'],
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface WMSLayerConfig {
  url: string;
  layers: string;
  format: string;
  transparent: boolean;
  attribution?: string;
}

export interface WFSQueryParams {
  typeName: string;
  wilayaCode?: string;
  communeCode?: string;
  section?: string;
  propertyGroup?: string;
  outputFormat?: 'application/json' | 'text/xml' | 'application/gml+xml';
  srsName?: string;
}

export interface GetFeatureInfoParams {
  layers: string;
  queryLayers: string;
  x: number;
  y: number;
  bbox: string;
  width: number;
  height: number;
  crs: string;
  infoFormat?: 'application/json' | 'text/html' | 'text/plain';
}

export interface CadastralFeatureInfo {
  section: string;
  propertyGroup: string;
  municipality: string;
  wilaya: string;
  area?: number;
  propertyType?: string;
  namedPlace?: string;
  [key: string]: string | number | undefined;
}

export interface WFSFeature {
  type: 'Feature';
  id?: string;
  geometry: {
    type: string;
    coordinates: unknown[];
  };
  properties: Record<string, string | number | null>;
}

export interface WFSFeatureCollection {
  type: 'FeatureCollection';
  features: WFSFeature[];
  totalFeatures?: number;
  numberMatched?: number;
  numberReturned?: number;
}

// ============================================================================
// WMS LAYER CONFIGURATION
// ============================================================================

/**
 * Creates WMS layer configuration for Fadaa El Djazair cadastral overlay
 * 
 * @param layers - Comma-separated list of layer names
 * @param options - Additional WMS options
 * @returns WMSLayerConfig object
 */
export function createWMSLayerConfig(
  layers: string = CADASTRAL_LAYERS.SECTIONS,
  options: Partial<WMSLayerConfig> = {}
): WMSLayerConfig {
  return {
    url: WMS_ENDPOINT,
    layers,
    format: 'image/png',
    transparent: true,
    attribution: '© Fadaa El Djazair - Ministère des Finances',
    ...options,
  };
}

/**
 * Builds WMS tile URL with proper parameters
 * 
 * @param config - WMS layer configuration
 * @param tileCoords - Tile coordinates {x, y, z}
 * @returns Complete WMS tile URL
 */
export function buildWMSTileUrl(
  config: WMSLayerConfig,
  tileCoords: { x: number; y: number; z: number }
): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: config.layers,
    FORMAT: config.format,
    TRANSPARENT: String(config.transparent),
    CRS: 'EPSG:3857',
    WIDTH: '256',
    HEIGHT: '256',
    BBOX: getTileBBox(tileCoords),
  });

  return `${config.url}?${params.toString()}`;
}

/**
 * Calculates bounding box for a tile at given zoom level
 */
function getTileBBox(tileCoords: { x: number; y: number; z: number }): string {
  const { x, y, z } = tileCoords;
  const tileSize = 360 / Math.pow(2, z);
  const minX = -180 + x * tileSize;
  const maxY = 90 - y * tileSize;
  const maxX = minX + tileSize;
  const minY = maxY - tileSize;
  return `${minY},${minX},${maxY},${maxX}`;
}

// ============================================================================
// WFS QUERY BUILDING
// ============================================================================

/**
 * Builds WFS GetFeature URL for fetching vector data
 * 
 * @param params - WFS query parameters
 * @returns Complete WFS GetFeature URL
 */
export function buildWFSGetFeatureUrl(params: WFSQueryParams): string {
  const queryParams: Record<string, string> = {
    SERVICE: 'WFS',
    VERSION: '2.0.0',
    REQUEST: 'GetFeature',
    TYPENAME: params.typeName,
    OUTPUTFORMAT: params.outputFormat || 'application/json',
    SRSNAME: params.srsName || 'EPSG:4326',
  };

  // Add CQL filter for spatial/attribute filtering
  const filters: string[] = [];
  
  if (params.wilayaCode) {
    filters.push(`wilaya_code='${params.wilayaCode}'`);
  }
  
  if (params.communeCode) {
    filters.push(`commune_code='${params.communeCode}'`);
  }
  
  if (params.section) {
    const formattedSection = formatSection(params.section);
    filters.push(`section='${formattedSection}'`);
  }
  
  if (params.propertyGroup) {
    const formattedGroup = formatPropertyGroup(params.propertyGroup);
    filters.push(`groupe_propriete='${formattedGroup}'`);
  }

  if (filters.length > 0) {
    queryParams.CQL_FILTER = filters.join(' AND ');
  }

  const queryString = Object.entries(queryParams)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${WFS_ENDPOINT}?${queryString}`;
}

// ============================================================================
// CORS PROXY HANDLING
// ============================================================================

/**
 * Fetches data through the local CORS proxy
 * This bypasses browser CORS restrictions for government server requests
 * 
 * @param targetUrl - The target government server URL
 * @param options - Fetch options
 * @returns Promise resolving to Response
 */
export async function fetchThroughProxy(
  targetUrl: string,
  options: RequestInit = {}
): Promise<Response> {
  const proxyUrl = `${CADASTRAL_PROXY_ENDPOINT}?targetUrl=${encodeURIComponent(targetUrl)}`;
  
  try {
    const response = await fetch(proxyUrl, {
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json, application/xml, text/plain',
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error('CORS Proxy fetch failed:', error);
    throw error;
  }
}

/**
 * Fetches WFS data through CORS proxy
 * 
 * @param params - WFS query parameters
 * @returns Promise resolving to FeatureCollection
 */
export async function fetchWFSThroughProxy(
  params: WFSQueryParams
): Promise<WFSFeatureCollection> {
  const targetUrl = buildWFSGetFeatureUrl(params);
  
  try {
    const response = await fetchThroughProxy(targetUrl);
    const data: WFSFeatureCollection = await response.json();
    return data;
  } catch (error) {
    console.error('WFS fetch failed:', error);
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }
}

// ============================================================================
// GETFEATUREINFO EXTRACTION (WMS)
// ============================================================================

/**
 * Builds GetFeatureInfo URL for WMS layer
 * 
 * @param config - WMS layer configuration
 * @param params - GetFeatureInfo parameters
 * @returns Complete GetFeatureInfo URL
 */
export function buildGetFeatureInfoUrl(
  config: WMSLayerConfig,
  params: GetFeatureInfoParams
): string {
  const queryParams: Record<string, string> = {
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetFeatureInfo',
    LAYERS: params.layers,
    QUERY_LAYERS: params.queryLayers,
    CRS: params.crs,
    BBOX: params.bbox,
    WIDTH: String(params.width),
    HEIGHT: String(params.height),
    X: String(params.x),
    Y: String(params.y),
    INFO_FORMAT: params.infoFormat || 'application/json',
    FEATURE_COUNT: '10',
  };

  const queryString = Object.entries(queryParams)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${config.url}?${queryString}`;
}

/**
 * Extracts and formats cadastral metadata from GetFeatureInfo response
 * 
 * STRICT FORMATTING:
 * - Section: Padded to 3 digits (e.g., 012)
 * - Property Group: Padded to 4 digits (e.g., 0158)
 * 
 * @param featureInfo - Raw feature info from WMS GetFeatureInfo
 * @returns Formatted CadastralFeatureInfo
 */
export function extractFeatureInfo(featureInfo: Record<string, unknown>): CadastralFeatureInfo {
  const props = featureInfo as Record<string, string | number | null>;

  // Extract and format section (3 digits)
  const sectionRaw = String(
    props.section ?? 
    props.Section ?? 
    props.SECTION ?? 
    props.num_section ??
    ''
  );
  const section = formatSection(sectionRaw);

  // Extract and format property group (4 digits)
  const groupRaw = String(
    props.groupe_propriete ??
    props.propertyGroup ??
    props.PropertyGroup ??
    props.PROPERTYGROUP ??
    props.ilot ??
    props.ILOT ??
    props.groupe ??
    props.Group ??
    ''
  );
  const propertyGroup = formatPropertyGroup(groupRaw);

  // Extract other metadata
  const municipality = String(
    props.commune ??
    props.COMMUNE ??
    props.municipality ??
    props.nom_commune ??
    ''
  );

  const wilaya = String(
    props.wilaya ??
    props.WILAYA ??
    props.nom_wilaya ??
    WILAYA_47_CODE
  );

  const area = typeof props.area === 'number' 
    ? props.area 
    : typeof props.SUPERFICIE === 'number'
    ? props.SUPERFICIE
    : undefined;

  const propertyType = String(
    props.type_propriete ??
    props.propertyType ??
    props.nature ??
    ''
  );

  const namedPlace = String(
    props.lieu_dit ??
    props.namedPlace ??
    props.nom_lieu ??
    props['المكان المسمى'] ??
    ''
  );

  return {
    section,
    propertyGroup,
    municipality,
    wilaya,
    area,
    propertyType,
    namedPlace,
  };
}

/**
 * Parses Arabic property names from Fadaa El Djazair response
 * Handles UTF-8 encoding properly to prevent mojibake
 * 
 * @param props - Raw properties object
 * @returns Parsed properties with Arabic support
 */
export function parseArabicProperties(props: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};

  // Arabic property name mappings
  const arabicMappings: Record<string, string> = {
    'المكان المسمى': 'namedPlace',
    'طبيعة الملكية': 'propertyType',
    'القسم': 'section',
    'المجموعة': 'propertyGroup',
    'البلدية': 'municipality',
    'الولاية': 'wilaya',
    'المساحة': 'area',
    'رقم القطعة': 'parcelNumber',
    'اسم المالك': 'ownerName',
    'نشاط': 'activity',
  };

  for (const [arabicKey, standardKey] of Object.entries(arabicMappings)) {
    if (props[arabicKey] !== undefined) {
      result[standardKey] = String(props[arabicKey]);
    }
  }

  // Also include original Arabic keys for reference
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' && value.trim()) {
      result[key] = value;
    }
  }

  return result;
}

// ============================================================================
// MAIN FETCHING FUNCTIONS (LIVE API WITH CRASH PREVENTION)
// ============================================================================

/**
 * Fetches cadastral data from Fadaa El Djazair WFS service (LIVE API)
 * 
 * BULLETPROOF ERROR HANDLING:
 * - Wraps fetch in strict try/catch
 * - Checks response.ok explicitly
 * - Returns empty FeatureCollection on error (never crashes)
 * 
 * @param wilayaCode - Wilaya code (e.g., '47' for Ghardaïa)
 * @param communeCode - Commune code (optional)
 * @param useProxy - Whether to use CORS proxy (default: true)
 * @returns Promise resolving to FeatureCollection (empty on error)
 * 
 * @example
 * // Fetch all sections for Wilaya 47
 * const data = await fetchOfficialCadastralData('47');
 */
export async function fetchOfficialCadastralData(
  wilayaCode: string = WILAYA_47_CODE,
  communeCode?: string,
  useProxy: boolean = true
): Promise<WFSFeatureCollection> {
  // Try primary layer name first
  const primaryLayer = CADASTRAL_LAYERS.SECTIONS;
  
  try {
    const data = await fetchWFSLayer(primaryLayer, wilayaCode, communeCode, useProxy);
    
    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response structure');
    }
    
    if (!Array.isArray(data.features)) {
      throw new Error('Invalid features array');
    }
    
    console.log(`[Fadaa El Djazair LIVE] Successfully fetched ${data.features.length} features from ${primaryLayer}`);
    return data;
    
  } catch (error: any) {
    // Log error but don't crash
    console.warn(`[Fadaa El Djazair] Primary layer failed (${primaryLayer}):`, error?.message || error);
    
    // Try alternative layer names
    for (const altLayer of CADASTRAL_LAYERS_ALT.SECTIONS) {
      if (altLayer === primaryLayer) continue;
      
      try {
        console.log(`[Fadaa El Djazair] Trying alternative layer: ${altLayer}`);
        const altData = await fetchWFSLayer(altLayer, wilayaCode, communeCode, useProxy);
        
        if (altData && Array.isArray(altData.features) && altData.features.length > 0) {
          console.log(`[Fadaa El Djazair LIVE] Success with alternative layer ${altLayer}: ${altData.features.length} features`);
          return altData;
        }
      } catch (altError: any) {
        console.warn(`[Fadaa El Djazair] Alternative layer failed (${altLayer}):`, altError?.message || altError);
      }
    }
    
    // All attempts failed - return empty collection (DON'T CRASH)
    console.warn('[Fadaa El Djazair] All layer attempts failed, returning empty data');
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }
}

/**
 * Internal function to fetch a specific WFS layer
 */
async function fetchWFSLayer(
  layerName: string,
  wilayaCode: string,
  communeCode: string | undefined,
  useProxy: boolean
): Promise<WFSFeatureCollection> {
  const params: WFSQueryParams = {
    typeName: layerName,
    wilayaCode,
    communeCode,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
  };

  // Build the WFS URL
  const wfsUrl = buildWFSGetFeatureUrl(params);
  
  // CRITICAL: Explicit 404/error checking
  if (useProxy) {
    // Use CORS proxy
    const proxyUrl = `${CADASTRAL_PROXY_ENDPOINT}?targetUrl=${encodeURIComponent(wfsUrl)}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, application/xml, text/plain',
        'Accept-Language': 'ar-DZ,ar;q=0.9,fr;q=0.8,en;q=0.7',
        'Accept-Charset': 'UTF-8',
      },
    });
    
    // EXPLICIT ERROR CHECKING - Throw on any non-OK status
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`WFS HTTP ${response.status}: ${errorText.slice(0, 200)}`);
    }
    
    const data = await response.json();
    
    // Validate JSON response
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON response from server');
    }
    
    return data as WFSFeatureCollection;
    
  } else {
    // Direct fetch (may fail due to CORS)
    const response = await fetch(wfsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'ar-DZ,ar;q=0.9',
      },
    });
    
    // EXPLICIT ERROR CHECKING
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`WFS HTTP ${response.status}: ${errorText.slice(0, 200)}`);
    }
    
    const data = await response.json();
    return data as WFSFeatureCollection;
  }
}

/**
 * Performs GetFeatureInfo query at specific coordinates
 * 
 * @param config - WMS layer configuration
 * @param params - GetFeatureInfo parameters
 * @param useProxy - Whether to use CORS proxy
 * @returns Promise resolving to array of feature info
 */
export async function queryFeatureInfo(
  config: WMSLayerConfig,
  params: GetFeatureInfoParams,
  useProxy: boolean = true
): Promise<CadastralFeatureInfo[]> {
  try {
    const url = buildGetFeatureInfoUrl(config, params);
    
    const response = useProxy
      ? await fetchThroughProxy(url)
      : await fetch(url, {
          headers: {
            'Accept': params.infoFormat || 'application/json',
          },
        });

    if (!response.ok) {
      throw new Error(`GetFeatureInfo error: ${response.status}`);
    }

    const data = await response.json();
    
    // Handle different response formats
    const features = data.features || data || [];
    
    return features.map((feature: Record<string, unknown>) => 
      extractFeatureInfo(feature)
    );
  } catch (error) {
    console.error('GetFeatureInfo query failed:', error);
    return [];
  }
}

/**
 * Searches for a specific cadastral section and property group
 * 
 * @param wilayaCode - Wilaya code
 * @param section - Section number (will be formatted to 3 digits)
 * @param propertyGroup - Property group number (will be formatted to 4 digits)
 * @param useProxy - Whether to use CORS proxy
 * @returns Promise resolving to matching features
 */
export async function searchCadastralParcel(
  wilayaCode: string,
  section: string,
  propertyGroup: string,
  useProxy: boolean = true
): Promise<WFSFeatureCollection> {
  const params: WFSQueryParams = {
    typeName: CADASTRAL_LAYERS.SECTIONS,
    wilayaCode,
    section: formatSection(section),
    propertyGroup: formatPropertyGroup(propertyGroup),
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
  };

  return fetchWFSThroughProxy(params);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validates if a URL belongs to the official Fadaa El Djazair domain
 * 
 * @param url - URL to validate
 * @returns true if URL is from official domain
 */
export function isOfficialFadaaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'fadaeldjazair.mf.gov.dz' ||
           parsed.hostname.endsWith('.fadaeldjazair.mf.gov.dz') ||
           parsed.hostname === 'mf.gov.dz' ||
           parsed.hostname.endsWith('.mf.gov.dz');
  } catch {
    return false;
  }
}

/**
 * Formats area value with proper units
 * 
 * @param area - Area in square meters
 * @returns Formatted area string with Arabic units
 */
export function formatArea(area: number | undefined): string {
  if (area === undefined || area === null) return '';
  return `${area.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} م²`;
}
