/**
 * Fadaa Dzair Cadastral Data Fetcher
 * 
 * Dynamic data fetching function for integrating Fadaa Dzair boundaries
 * and metadata into the Urban Map.
 * 
 * IMPORTANT: This uses a placeholder API endpoint that should be replaced
 * with the actual Fadaa Dzair WFS endpoint or local GeoJSON file.
 */

export interface CadastralFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: unknown[];
  };
  properties: {
    section?: string | number;
    propertyGroup?: string | number;
    municipality?: string;
    communeCode?: string;
    wilayaCode?: string;
    area?: number;
    [key: string]: unknown;
  };
}

export interface CadastralDataResponse {
  type: 'FeatureCollection';
  features: CadastralFeature[];
}

export interface CadastralMetadata {
  section: string;
  propertyGroup: string;
  municipality: string;
  area: number | null;
}

/**
 * Default placeholder API endpoint for Fadaa Dzair WFS service.
 * Replace this with the actual endpoint when available.
 * 
 * Example WFS endpoint format:
 * https://api.fadaadzair.dz/wfs/geojson?service=WFS&version=2.0.0&request=GetFeature&typeName=cadastre:sections&outputFormat=application/json
 */
export const FADAA_DZAIR_API_ENDPOINT = 'https://api.fadaadzair.dz/wfs/geojson';

/**
 * Builds the API URL for fetching cadastral data.
 * 
 * @param wilayaCode - The wilaya code (e.g., '47' for Ghardaïa)
 * @param communeCode - The commune code (e.g., '01' for Ghardaïa city)
 * @returns The complete API URL
 */
export const buildCadastralApiUrl = (
  wilayaCode: string,
  communeCode: string
): string => {
  const baseUrl = FADAA_DZAIR_API_ENDPOINT;
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeName: 'cadastre:sections',
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
  });

  // Add filtering parameters if provided
  if (wilayaCode) {
    params.append('wilaya', wilayaCode);
  }
  if (communeCode) {
    params.append('commune', communeCode);
  }

  return `${baseUrl}?${params.toString()}`;
};

/**
 * Fetches cadastral data from the Fadaa Dzair API.
 * 
 * @param wilayaCode - The wilaya code (e.g., '47' for Ghardaïa)
 * @param communeCode - The commune code (e.g., '01' for Ghardaïa city)
 * @returns Promise resolving to GeoJSON FeatureCollection
 * 
 * @example
 * // Fetch data for Ghardaïa
 * const data = await fetchCadastralData('47', '01');
 * 
 * @example
 * // Fetch with custom endpoint
 * const data = await fetchCadastralData('47', '01', 'https://custom-api.local/geojson');
 */
export async function fetchCadastralData(
  wilayaCode: string,
  communeCode: string,
  customEndpoint?: string
): Promise<CadastralDataResponse> {
  const url = customEndpoint || buildCadastralApiUrl(wilayaCode, communeCode);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/geo+json,application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: CadastralDataResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching cadastral data:', error);
    
    // Return empty FeatureCollection on error
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }
}

/**
 * Fetches cadastral data from a local GeoJSON file.
 * 
 * @param filePath - Path to the local GeoJSON file
 * @returns Promise resolving to GeoJSON FeatureCollection
 */
export async function fetchCadastralDataFromFile(
  filePath: string
): Promise<CadastralDataResponse> {
  try {
    const response = await fetch(filePath);
    
    if (!response.ok) {
      throw new Error(`Failed to load file: ${filePath}`);
    }

    const data: CadastralDataResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading cadastral file:', error);
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }
}

/**
 * Extracts and formats metadata from a GeoJSON feature.
 * 
 * Formatting rules (STRICT):
 * - Section: Padded to 3 digits (e.g., 12 → "012")
 * - Property Group: Padded to 4 digits (e.g., 158 → "0158")
 * 
 * @param feature - The GeoJSON feature to extract metadata from
 * @returns Formatted cadastral metadata
 */
export function extractCadastralMetadata(
  feature: CadastralFeature | null
): CadastralMetadata {
  if (!feature || !feature.properties) {
    return {
      section: '',
      propertyGroup: '',
      municipality: '',
      area: null,
    };
  }

  const props = feature.properties;

  // Extract and format section (3 digits padding)
  const sectionRaw = String(props.section ?? props.Section ?? props.SECTION ?? '');
  const sectionDigits = sectionRaw.replace(/\D/g, '').slice(0, 3);
  const section = sectionDigits ? sectionDigits.padStart(3, '0') : '';

  // Extract and format property group (4 digits padding)
  const groupRaw = String(
    props.propertyGroup ??
    props.PropertyGroup ??
    props.PROPERTYGROUP ??
    props.group ??
    props.Group ??
    props.ILOT ??
    ''
  );
  const groupDigits = groupRaw.replace(/\D/g, '').slice(0, 4);
  const propertyGroup = groupDigits ? groupDigits.padStart(4, '0') : '';

  // Extract municipality
  const municipality = String(
    props.municipality ??
    props.Municipality ??
    props.MUNICIPALITY ??
    props.commune ??
    props.COMMUNE ??
    ''
  );

  // Extract area
  const areaRaw = Number(props.area ?? props.Area ?? props.AREA ?? NaN);
  const area = Number.isFinite(areaRaw) ? areaRaw : null;

  return {
    section,
    propertyGroup,
    municipality,
    area,
  };
}

/**
 * Formats section number with 3-digit padding.
 * 
 * @param value - The section value to format
 * @returns Formatted section string (e.g., "012")
 */
export function formatSectionForDisplay(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 3);
  return digits ? digits.padStart(3, '0') : '';
}

/**
 * Formats property group number with 4-digit padding.
 * 
 * @param value - The property group value to format
 * @returns Formatted property group string (e.g., "0158")
 */
export function formatPropertyGroupForDisplay(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 4);
  return digits ? digits.padStart(4, '0') : '';
}

/**
 * Generates tooltip content for cadastral features.
 * 
 * @param metadata - The extracted cadastral metadata
 * @returns Formatted tooltip string in Arabic
 */
export function generateTooltipContent(metadata: CadastralMetadata): string {
  const { section, propertyGroup } = metadata;
  
  if (!section && !propertyGroup) {
    return '';
  }

  // Arabic tooltip format: القسم: XXX | المجموعة: YYYY
  const parts: string[] = [];
  
  if (section) {
    parts.push(`القسم: ${section}`);
  }
  
  if (propertyGroup) {
    parts.push(`المجموعة: ${propertyGroup}`);
  }

  return parts.join(' | ');
}
