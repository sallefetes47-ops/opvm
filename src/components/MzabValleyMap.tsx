import React, { useEffect, useMemo, useState } from 'react';
import { GeoJSON, LayersControl, MapContainer, TileLayer } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';

interface MzabValleyMapProps {
    onParcelSelect?: (data: {
        municipality: string;
        section: string;
        propertyGroup: string;
        area: number | null;
    }) => void;
}

type GeoJsonFeatureCollectionLike = {
    type: 'FeatureCollection';
    features: Array<{
        type: 'Feature';
        geometry?: { type?: string; coordinates?: unknown; geometries?: unknown[] } | null;
        properties?: Record<string, unknown>;
    }>;
};

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();

const MUNICIPALITY_CODE_TO_NAME: Record<string, string> = {
    '4701': 'غرداية',
    '4707': 'العطف',
    '4710': 'بنورة',
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

const hasGeometry = (geometry: GeoJsonFeatureCollectionLike['features'][number]['geometry']): boolean => {
    if (!geometry || typeof geometry !== 'object') return false;
    if (geometry.type === 'GeometryCollection') {
        return Array.isArray(geometry.geometries);
    }
    return Array.isArray(geometry.coordinates);
};

const normalizeGeoJson = (raw: any): GeoJsonFeatureCollectionLike => {
    const features = Array.isArray(raw?.features) ? raw.features : [];
    const safeFeatures = features.filter((f: any) => f?.type === 'Feature' && hasGeometry(f?.geometry));
    return { type: 'FeatureCollection', features: safeFeatures };
};

const MzabValleyMap: React.FC<MzabValleyMapProps> = ({ onParcelSelect }) => {
    const [geojsonData, setGeojsonData] = useState<GeoJsonFeatureCollectionLike | null>(null);
    const [hoveredParcelKey, setHoveredParcelKey] = useState('');
    const [selectedParcelKey, setSelectedParcelKey] = useState('');

    useEffect(() => {
        fetch('/mzab_cadastre_map.geojson')
            .then((res) => {
                if (!res.ok) throw new Error('البيانات العقارية غير متوفرة');
                return res.json();
            })
            .then((data) => setGeojsonData(normalizeGeoJson(data)))
            .catch((err) => {
                console.error('خطأ في تحميل بيانات القطع:', err);
                setGeojsonData({ type: 'FeatureCollection', features: [] });
            });
    }, []);

    const geoJsonLayer = useMemo(() => {
        // Strict safety guard to prevent reading `.length` on undefined.
        if (!geojsonData || !geojsonData.features) return null;
        if (geojsonData.features.length === 0) return null;

        return (
            <GeoJSON
                data={geojsonData as unknown as GeoJsonObject}
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

                        const municipality = resolveMunicipalityName(props.Municipality ?? props.MUNICIPALITY ?? props.COMMUNE ?? '');
                        const section = String(props.Section ?? props.SECTION ?? '');
                        const propertyGroup = String(props.PropertyGroup ?? props.PROPERTYGROUP ?? props.ILOT ?? props.group ?? '');
                        const rawArea = Number(props.Area ?? props.AREA);
                        const area = Number.isFinite(rawArea) ? rawArea : null;

                        onParcelSelect({ municipality, section, propertyGroup, area });
                    },
                }}
            />
        );
    }, [geojsonData, hoveredParcelKey, selectedParcelKey, onParcelSelect]);

    return (
        <div className='relative' style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
            <MapContainer center={[32.4845, 3.6792]} zoom={15} maxZoom={22} style={{ height: '100%', width: '100%' }}>
                <LayersControl position='topright'>
                    <LayersControl.BaseLayer checked name='خريطة الشارع (OSM)'>
                        <TileLayer
                            attribution='&copy; OpenStreetMap contributors'
                            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                            maxNativeZoom={19}
                            maxZoom={22}
                        />
                    </LayersControl.BaseLayer>

                    <LayersControl.BaseLayer name='قمر صناعي Esri'>
                        <TileLayer
                            attribution='Tiles &copy; Esri'
                            url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                            maxNativeZoom={19}
                            maxZoom={22}
                        />
                    </LayersControl.BaseLayer>

                    {GOOGLE_MAPS_API_KEY && (
                        <LayersControl.BaseLayer name='جوجل مابس - هجين'>
                            <TileLayer
                                attribution='&copy; Google'
                                url={`https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_API_KEY}`}
                                subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                maxNativeZoom={20}
                                maxZoom={22}
                            />
                        </LayersControl.BaseLayer>
                    )}
                </LayersControl>

                {geoJsonLayer}
            </MapContainer>

            {!GOOGLE_MAPS_API_KEY && (
                <div className='absolute left-4 top-4 z-[650] rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow'>
                    مفتاح Google غير مضبوط، طبقة Google Hybrid غير متاحة.
                </div>
            )}

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
                        <span>بنورة</span>
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
