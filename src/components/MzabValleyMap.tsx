import React, { useEffect, useMemo, useState } from 'react';
import L, { type Coords, type TileLayerOptions } from 'leaflet';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface MzabValleyMapProps {
    onParcelSelect?: (data: {
        municipality: string;
        section: string;
        propertyGroup: string;
        area: number | null;
    }) => void;
}

type LayerMode = 'map' | 'satellite';
type ProviderId = 'osm' | 'google' | 'esri' | 'bing';
type LayerProviderKey =
    | 'osm_street'
    | 'esri_world_street'
    | 'esri_world_imagery'
    | 'google_satellite'
    | 'google_hybrid'
    | 'bing_aerial';

type LayerDefinition = {
    key: LayerProviderKey;
    provider: ProviderId;
    label: string;
    mode: LayerMode;
    url: string;
    attribution: string;
    subdomains?: string[];
    maxNativeZoom?: number;
};

type SafeFeatureCollection = {
    type: 'FeatureCollection';
    features: any[];
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const hasValidCoordinates = (geometry: any): boolean => {
    if (!geometry || typeof geometry !== 'object') return false;
    const { type, coordinates, geometries } = geometry;

    if (type === 'GeometryCollection') {
        return Array.isArray(geometries) && geometries.length > 0 && geometries.every(hasValidCoordinates);
    }

    if (!Array.isArray(coordinates) || coordinates.length === 0) return false;

    if (type === 'Point') {
        return coordinates.length >= 2 && isFiniteNumber(coordinates[0]) && isFiniteNumber(coordinates[1]);
    }

    return true;
};

const normalizeGeoJson = (raw: any): SafeFeatureCollection => {
    const rawFeatures = Array.isArray(raw?.features) ? raw.features : [];

    const cleaned = rawFeatures.filter((feature: any) => {
        if (!feature || feature.type !== 'Feature') return false;
        return hasValidCoordinates(feature.geometry);
    });

    return {
        type: 'FeatureCollection',
        features: cleaned,
    };
};

const MUNICIPALITY_CODE_TO_NAME: Record<string, string> = {
    '4701': 'غرداية',
    '4707': 'العطف',
    '4710': 'بلدية بنورة',
    '4703': 'بلدية الضاية',
};

const normalizeMunicipalityCode = (rawValue: unknown): string => {
    if (rawValue === null || rawValue === undefined) return '';
    const text = String(rawValue).trim();
    if (!text) return '';
    const digitsOnly = text.replace(/\D/g, '');
    if (!digitsOnly) return text;
    return digitsOnly.length >= 4 ? digitsOnly.slice(-4) : digitsOnly;
};

const getMunicipalityColor = (code: unknown): string => {
    const normalizedCode = normalizeMunicipalityCode(code);
    if (normalizedCode === '4701') return '#4f46e5';
    if (normalizedCode === '4707') return '#d97706';
    if (normalizedCode === '4710') return '#7c3aed';
    if (normalizedCode === '4703') return '#10b981';
    return '#94a3b8';
};

const getMunicipalityBorderColor = (code: unknown): string => {
    const normalizedCode = normalizeMunicipalityCode(code);
    if (normalizedCode === '4701') return '#3730a3';
    if (normalizedCode === '4707') return '#92400e';
    if (normalizedCode === '4710') return '#5b21b6';
    if (normalizedCode === '4703') return '#047857';
    return '#64748b';
};

const resolveMunicipalityName = (rawValue: unknown): string => {
    if (rawValue === null || rawValue === undefined) return '';
    const text = String(rawValue).trim();
    if (!text) return '';
    if (MUNICIPALITY_CODE_TO_NAME[text]) return MUNICIPALITY_CODE_TO_NAME[text];
    const digitsOnly = text.replace(/\D/g, '');
    if (MUNICIPALITY_CODE_TO_NAME[digitsOnly]) return MUNICIPALITY_CODE_TO_NAME[digitsOnly];
    const last4 = digitsOnly.slice(-4);
    if (MUNICIPALITY_CODE_TO_NAME[last4]) return MUNICIPALITY_CODE_TO_NAME[last4];
    return text;
};

const getParcelKey = (props: Record<string, unknown>): string => {
    const municipalityCode = normalizeMunicipalityCode(props.Municipality ?? props.MUNICIPALITY ?? props.COMMUNE ?? '');
    const section = String(props.Section ?? props.SECTION ?? '');
    const propertyGroup = String(props.PropertyGroup ?? props.PROPERTYGROUP ?? props.ILOT ?? props.group ?? '');
    return `${municipalityCode}|${section}|${propertyGroup}`;
};

const BING_MAPS_API_KEY = (import.meta.env.VITE_BING_MAPS_API_KEY ?? '').trim();
const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();

const LAYERS: LayerDefinition[] = [
    {
        key: 'osm_street',
        provider: 'osm',
        label: 'خريطة الشارع (OSM)',
        mode: 'map',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors',
        maxNativeZoom: 19,
    },
    {
        key: 'esri_world_street',
        provider: 'esri',
        label: 'Esri - Street',
        mode: 'map',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: 19,
    },
    {
        key: 'esri_world_imagery',
        provider: 'esri',
        label: 'قمر صناعي Esri',
        mode: 'satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: 19,
    },
    {
        key: 'google_satellite',
        provider: 'google',
        label: 'جوجل مابس - قمر صناعي',
        mode: 'satellite',
        url: `https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}${GOOGLE_MAPS_API_KEY ? `&key=${GOOGLE_MAPS_API_KEY}` : ''}`,
        attribution: '&copy; Google',
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        maxNativeZoom: 20,
    },
    {
        key: 'google_hybrid',
        provider: 'google',
        label: 'جوجل مابس - هجين',
        mode: 'satellite',
        url: `https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}${GOOGLE_MAPS_API_KEY ? `&key=${GOOGLE_MAPS_API_KEY}` : ''}`,
        attribution: '&copy; Google',
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        maxNativeZoom: 20,
    },
    {
        key: 'bing_aerial',
        provider: 'bing',
        label: 'Bing - عرض جوي',
        mode: 'satellite',
        url: `https://ecn.t3.tiles.virtualearth.net/tiles/a{q}.jpeg?g=1&mkt=ar-DZ${BING_MAPS_API_KEY ? `&key=${BING_MAPS_API_KEY}` : ''}`,
        attribution: '&copy; Microsoft Bing',
        maxNativeZoom: 19,
    },
];

const toQuadKey = (x: number, y: number, z: number): string => {
    let quadKey = '';
    for (let i = z; i > 0; i -= 1) {
        let digit = 0;
        const mask = 1 << (i - 1);
        if ((x & mask) !== 0) digit += 1;
        if ((y & mask) !== 0) digit += 2;
        quadKey += digit.toString();
    }
    return quadKey;
};

class BingQuadKeyTileLayer extends L.TileLayer {
    getTileUrl(coords: Coords): string {
        const quadKey = toQuadKey(coords.x, coords.y, coords.z);
        const data = {
            r: L.Browser.retina ? '@2x' : '',
            s: this._getSubdomain(coords),
            x: coords.x,
            y: coords.y,
            z: this._getZoomForUrl(),
            q: quadKey,
        };
        return L.Util.template(this._url, data);
    }
}

const BingLayer = ({ url, attribution, maxNativeZoom }: { url: string; attribution: string; maxNativeZoom?: number }) => {
    const map = useMap();
    useEffect(() => {
        const options: TileLayerOptions = {
            attribution,
            maxZoom: 22,
            maxNativeZoom: maxNativeZoom ?? 19,
            detectRetina: true,
        };
        const layer = new BingQuadKeyTileLayer(url, options);
        layer.addTo(map);
        return () => map.removeLayer(layer);
    }, [map, url, attribution, maxNativeZoom]);
    return null;
};

const MzabValleyMap: React.FC<MzabValleyMapProps> = ({ onParcelSelect }) => {
    const [geoJsonData, setGeoJsonData] = useState<SafeFeatureCollection>({ type: 'FeatureCollection', features: [] });
    const [hoveredParcelKey, setHoveredParcelKey] = useState('');
    const [selectedParcelKey, setSelectedParcelKey] = useState('');
    const [activeLayerKey, setActiveLayerKey] = useState<LayerProviderKey>('osm_street');
    const [layerLoadError, setLayerLoadError] = useState('');

    const activeLayer = useMemo(() => LAYERS.find((layer) => layer.key === activeLayerKey) ?? LAYERS[0], [activeLayerKey]);
    const hasRenderableGeoJson = useMemo(() => (geoJsonData?.features?.length ?? 0) > 0, [geoJsonData]);

    useEffect(() => {
        fetch('/mzab_cadastre_map.geojson')
            .then((res) => {
                if (!res.ok) throw new Error('البيانات العقارية غير متوفرة');
                return res.json();
            })
            .then((data: any) => {
                const normalized = normalizeGeoJson(data);
                setGeoJsonData(normalized);
                if ((normalized.features?.length ?? 0) === 0) {
                    setLayerLoadError('تم تحميل الخريطة لكن بيانات GeoJSON غير صالحة للعرض.');
                }
            })
            .catch((err) => {
                console.error('خطأ في تحميل بيانات القطع:', err);
                setGeoJsonData({ type: 'FeatureCollection', features: [] });
                setLayerLoadError('تعذر تحميل GeoJSON. تم عرض الخريطة الأساسية فقط.');
            });
    }, []);

    useEffect(() => {
        if (activeLayer.provider === 'google' && !GOOGLE_MAPS_API_KEY) {
            setActiveLayerKey('osm_street');
            setLayerLoadError('مفتاح Google Maps API غير موجود، تم التحويل تلقائياً إلى OSM.');
        }
    }, [activeLayer.provider]);

    const handleQuickToggle = () => {
        const targetMode: LayerMode = activeLayer.mode === 'satellite' ? 'map' : 'satellite';
        const sameProviderLayer = LAYERS.find((layer) => layer.provider === activeLayer.provider && layer.mode === targetMode);
        const preferredGoogle = LAYERS.find((layer) => layer.provider === 'google' && layer.mode === targetMode);
        const fallback = LAYERS.find((layer) => layer.mode === targetMode);
        const nextLayer = sameProviderLayer ?? preferredGoogle ?? fallback;
        if (nextLayer) setActiveLayerKey(nextLayer.key);
    };

    const handleBaseLayerError = () => {
        if (activeLayer.provider === 'google') {
            setLayerLoadError('تعذر تحميل طبقة Google. تحقق من قيود المفتاح (HTTP referrer/API).');
            setActiveLayerKey('osm_street');
            return;
        }
        setLayerLoadError('تعذر تحميل طبقة الخريطة الحالية.');
    };

    return (
        <div className='relative' style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
            <MapContainer center={[32.4845, 3.6792]} zoom={15} maxZoom={22} style={{ height: '100%', width: '100%' }}>
                {activeLayer.key === 'bing_aerial' ? (
                    <BingLayer
                        key={activeLayer.key}
                        url={activeLayer.url}
                        attribution={activeLayer.attribution}
                        maxNativeZoom={activeLayer.maxNativeZoom}
                    />
                ) : (
                    <TileLayer
                        key={activeLayer.key}
                        url={activeLayer.url}
                        attribution={activeLayer.attribution}
                        maxZoom={22}
                        maxNativeZoom={activeLayer.maxNativeZoom ?? 19}
                        subdomains={activeLayer.subdomains}
                        detectRetina
                        eventHandlers={{ tileerror: handleBaseLayerError }}
                    />
                )}

                {hasRenderableGeoJson && (
                    <GeoJSON
                        data={geoJsonData}
                        style={(feature) => {
                            const props = (feature?.properties || {}) as Record<string, unknown>;
                            const municipalityCode = props.Municipality ?? props.MUNICIPALITY ?? props.COMMUNE ?? '';
                            const fillColor = getMunicipalityColor(municipalityCode);
                            const borderColor = getMunicipalityBorderColor(municipalityCode);
                            const parcelKey = getParcelKey(props);
                            const isHovered = hoveredParcelKey === parcelKey;
                            const isSelected = selectedParcelKey === parcelKey;
                            return {
                                fillColor,
                                fillOpacity: 0.5,
                                color: isHovered || isSelected ? borderColor : '#ffffff',
                                weight: isSelected ? 3 : isHovered ? 2.5 : 1.1,
                            };
                        }}
                        eventHandlers={{
                            mouseover: (e) => {
                                const props = e?.propagatedFrom?.feature?.properties || {};
                                setHoveredParcelKey(getParcelKey(props));
                            },
                            mouseout: () => setHoveredParcelKey(''),
                            click: (e) => {
                                const props = e?.propagatedFrom?.feature?.properties || {};
                                setSelectedParcelKey(getParcelKey(props));
                                if (!onParcelSelect) return;
                                const municipality = resolveMunicipalityName(
                                    props.Municipality ?? props.MUNICIPALITY ?? props.COMMUNE ?? ''
                                );
                                const section = String(props.Section ?? props.SECTION ?? '');
                                const propertyGroup = String(
                                    props.PropertyGroup ?? props.PROPERTYGROUP ?? props.ILOT ?? props.group ?? ''
                                );
                                const rawArea = Number(props.Area ?? props.AREA);
                                const area = Number.isFinite(rawArea) ? rawArea : null;
                                onParcelSelect({ municipality, section, propertyGroup, area });
                            },
                        }}
                    />
                )}
            </MapContainer>

            <div className='absolute right-4 top-4 z-[600] w-64 rounded-lg border border-white/70 bg-white/95 p-3 text-right shadow-lg backdrop-blur-sm'>
                <p className='mb-2 text-xs font-semibold text-slate-700'>تغيير المصدر</p>
                <div className='max-h-52 space-y-1 overflow-y-auto'>
                    {LAYERS.map((layer) => (
                        <button
                            key={layer.key}
                            type='button'
                            onClick={() => setActiveLayerKey(layer.key)}
                            className={`w-full rounded-md border px-2 py-1.5 text-right text-xs transition ${
                                activeLayerKey === layer.key
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            {layer.label}
                        </button>
                    ))}
                </div>
                {!GOOGLE_MAPS_API_KEY && <p className='mt-2 text-[11px] text-amber-700'>مفتاح Google غير مضبوط، طبقات Google غير متاحة.</p>}
                {!BING_MAPS_API_KEY && <p className='mt-2 text-[11px] text-amber-700'>مفتاح Bing غير مضبوط في البيئة.</p>}
            </div>

            {layerLoadError && (
                <div className='absolute left-4 top-4 z-[650] max-w-xs rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-right text-xs text-amber-800 shadow'>
                    {layerLoadError}
                </div>
            )}

            <button
                type='button'
                onClick={handleQuickToggle}
                className='absolute bottom-4 right-4 z-[600] rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-800 shadow-lg transition hover:bg-slate-50'
            >
                {activeLayer.mode === 'satellite' ? 'خريطة' : 'قمر صناعي'}
            </button>

            <div className='pointer-events-none absolute right-4 top-[17.5rem] z-[500] w-52 rounded-lg border border-white/50 bg-white/90 p-3 text-right shadow-lg backdrop-blur-sm'>
                <p className='mb-2 text-xs font-semibold text-slate-700'>دليل الألوان</p>
                <div className='space-y-1.5 text-xs text-slate-700'>
                    <div className='flex items-center justify-between gap-2'>
                        <span>غرداية</span>
                        <span className='h-3 w-3 rounded-sm' style={{ backgroundColor: '#4f46e5' }} />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <span>العطف</span>
                        <span className='h-3 w-3 rounded-sm' style={{ backgroundColor: '#d97706' }} />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <span>بلدية بنورة</span>
                        <span className='h-3 w-3 rounded-sm' style={{ backgroundColor: '#7c3aed' }} />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <span>بلدية الضاية</span>
                        <span className='h-3 w-3 rounded-sm' style={{ backgroundColor: '#10b981' }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MzabValleyMap;
