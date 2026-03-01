import React, { useEffect, useImperativeHandle, useMemo, useState } from 'react';
import L from 'leaflet';
import { GeoJSON, LayersControl, MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { formatPropertyGroup, formatSection } from '@/lib/cadastre';

export type ParcelSelectionData = {
    municipality: string;
    section: string;
    propertyGroup: string;
    actualArea: number | null;
    cadastralArea: number | null;
};

export type ParcelSearchPayload = {
    municipalityCode: string;
    section: string;
    group: string;
};

export type MzabValleyMapHandle = {
    searchParcel: (payload: ParcelSearchPayload) => { ok: boolean; message: string };
    clearSearch: () => void;
};

interface MzabValleyMapProps {
    onParcelSelect?: (data: ParcelSelectionData) => void;
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
    '4705': 'متليلي',
    '4703': 'الضاية',
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
    if (normalizedCode === '4701') return '#1e40af';
    if (normalizedCode === '4707') return '#d97706';
    if (normalizedCode === '4710') return '#d946ef';
    if (normalizedCode === '4705') return '#a85507';
    if (normalizedCode === '4703') return '#10b981';
    return '#94a3b8';
};

const getMunicipalityBorderColor = (code: unknown): string => {
    const normalizedCode = normalizeMunicipalityCode(code);
    if (normalizedCode === '4701') return '#1e3a8a';      // غرداية - Dark Blue
    if (normalizedCode === '4707') return '#dc2626';      // العطف - Bright Red
    if (normalizedCode === '4710') return '#a21caf';      // بنورة - Purple
    if (normalizedCode === '4705') return '#ea580c';      // متليلي - Bright Orange
    if (normalizedCode === '4703') return '#047857';      // الضاية - Green
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
    const section = formatSection(props.Section ?? props.SECTION ?? props.section ?? '');
    const propertyGroup = formatPropertyGroup(props.PropertyGroup ?? props.PROPERTYGROUP ?? props.ILOT ?? props.group ?? '');
    return `${municipalityCode}|${section}|${propertyGroup}`;
};

const toCadastralArea = (actualArea: number): number => {
    const integerPart = Math.floor(actualArea);
    const fraction = actualArea - integerPart;
    return fraction >= 0.51 ? integerPart + 1 : integerPart;
};

const hasGeometry = (geometry: GeoJsonFeatureCollectionLike['features'][number]['geometry']): boolean => {
    if (!geometry || typeof geometry !== 'object') return false;
    if (geometry.type === 'GeometryCollection') return Array.isArray(geometry.geometries);
    return Array.isArray(geometry.coordinates);
};

const normalizeGeoJson = (raw: any): GeoJsonFeatureCollectionLike => {
    const features = Array.isArray(raw?.features) ? raw.features : [];
    const safeFeatures = features.filter((f: any) => f?.type === 'Feature' && hasGeometry(f?.geometry));
    return { type: 'FeatureCollection', features: safeFeatures };
};

const getCommuneCodeFromProps = (props: Record<string, unknown>): string =>
    normalizeMunicipalityCode(props.commune_code ?? props.COMMUNE_CODE ?? props.COMMUNE ?? props.Municipality ?? props.MUNICIPALITY ?? '');

const getSectionFromProps = (props: Record<string, unknown>): string =>
    formatSection(props.section ?? props.Section ?? props.SECTION ?? '');

const getGroupFromProps = (props: Record<string, unknown>): string =>
    formatPropertyGroup(props.group ?? props.Group ?? props.ILOT ?? props.PropertyGroup ?? props.PROPERTYGROUP ?? '');

const MapSearchController = ({
    targetFeature,
    resetSignal,
}: {
    targetFeature: GeoJsonFeatureCollectionLike['features'][number] | null;
    resetSignal: number;
}) => {
    const map = useMap();

    useEffect(() => {
        if (!targetFeature) return;
        const layer = L.geoJSON(targetFeature as any);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
            map.flyToBounds(bounds, { padding: [24, 24], maxZoom: 21, duration: 1.1 });
        }
    }, [map, targetFeature]);

    useEffect(() => {
        if (resetSignal === 0) return;
        map.flyTo([32.4845, 3.6792], 15, { duration: 1 });
    }, [map, resetSignal]);

    return null;
};

const MzabValleyMap = React.forwardRef<MzabValleyMapHandle, MzabValleyMapProps>(({ onParcelSelect }, ref) => {
    const [geojsonData, setGeojsonData] = useState<GeoJsonFeatureCollectionLike | null>(null);
    const [hoveredParcelKey, setHoveredParcelKey] = useState('');
    const [selectedParcelKey, setSelectedParcelKey] = useState('');
    const [foundParcelKey, setFoundParcelKey] = useState('');
    const [searchedFeature, setSearchedFeature] = useState<GeoJsonFeatureCollectionLike['features'][number] | null>(null);
    const [resetSignal, setResetSignal] = useState(0);

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

    const emitSelection = (props: Record<string, unknown>) => {
        if (!onParcelSelect) return;
        const municipality = resolveMunicipalityName(props.Municipality ?? props.MUNICIPALITY ?? props.COMMUNE ?? props.commune_code ?? '');
        const section = formatSection(props.Section ?? props.SECTION ?? props.section ?? '');
        const propertyGroup = formatPropertyGroup(props.PropertyGroup ?? props.PROPERTYGROUP ?? props.ILOT ?? props.group ?? '');
        const rawArea = Number(props.Area ?? props.AREA);
        const actualArea = Number.isFinite(rawArea) ? Number(rawArea.toFixed(2)) : null;
        const cadastralArea = actualArea === null ? null : toCadastralArea(actualArea);
        onParcelSelect({ municipality, section, propertyGroup, actualArea, cadastralArea });
    };

    const searchParcel = (payload: ParcelSearchPayload) => {
        if (!geojsonData || !geojsonData.features) {
            return { ok: false, message: 'البيانات غير جاهزة بعد، يرجى الانتظار.' };
        }

        const municipalityCode = payload.municipalityCode.trim();
        const section = payload.section.trim();
        const group = payload.group.trim();
        if (!municipalityCode || !section || !group) {
            return { ok: false, message: 'يرجى اختيار البلدية وإدخال رقم القسم ومجموعة الملكية.' };
        }

        const match = geojsonData.features.find((feature) => {
            const props = (feature?.properties || {}) as Record<string, unknown>;
            return (
                getCommuneCodeFromProps(props) === municipalityCode &&
                getSectionFromProps(props) === section &&
                getGroupFromProps(props) === group
            );
        });

        if (!match) {
            setFoundParcelKey('');
            setSearchedFeature(null);
            return { ok: false, message: 'لم يتم العثور على قطعة بهذه المعايير.' };
        }

        const props = (match.properties || {}) as Record<string, unknown>;
        const key = getParcelKey(props);
        setFoundParcelKey(key);
        setSelectedParcelKey(key);
        setSearchedFeature(match);
        emitSelection(props);
        return { ok: true, message: 'تم العثور على القطعة بنجاح.' };
    };

    const clearSearch = () => {
        setFoundParcelKey('');
        setSelectedParcelKey('');
        setSearchedFeature(null);
        setResetSignal((prev) => prev + 1);
    };

    useImperativeHandle(
        ref,
        () => ({
            searchParcel,
            clearSearch,
        }),
        [geojsonData]
    );

    const geoJsonLayer = useMemo(() => {
        if (!geojsonData || !geojsonData.features) return null;
        if (geojsonData.features.length === 0) return null;

        return (
            <GeoJSON
                data={geojsonData as unknown as GeoJsonObject}
                style={(feature) => {
                    const props = (feature?.properties || {}) as Record<string, unknown>;
                    const municipalityCode = props.Municipality ?? props.MUNICIPALITY ?? props.COMMUNE ?? '';
                    const strokeColor = getMunicipalityBorderColor(municipalityCode);
                    const parcelKey = getParcelKey(props);
                    const isHovered = hoveredParcelKey === parcelKey;
                    const isSelected = selectedParcelKey === parcelKey;
                    const isFound = foundParcelKey === parcelKey;
                    
                    // Outlines only styling - NO FILL
                    return {
                        fillColor: 'transparent',
                        fillOpacity: 0,
                        color: isFound ? '#fbbf24' : isHovered || isSelected ? strokeColor : strokeColor,
                        weight: isFound ? 4 : isSelected ? 4 : isHovered ? 3.5 : 2,
                        opacity: 1,
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
                        const clickedKey = getParcelKey(props);
                        setSelectedParcelKey(clickedKey);
                        setFoundParcelKey(clickedKey);
                        emitSelection(props);
                    },
                }}
            />
        );
    }, [geojsonData, hoveredParcelKey, selectedParcelKey, foundParcelKey]);

    return (
        <div className='relative' style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
            <MapContainer center={[32.4845, 3.6792]} zoom={9} maxZoom={22} style={{ height: '100%', width: '100%' }}>
                <LayersControl position='topright'>
                    <LayersControl.BaseLayer checked name='خريطة الشارع (OSM)'>
                        <TileLayer
                            attribution=""
                            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                            maxNativeZoom={19}
                            maxZoom={22}
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name='قمر صناعي Esri'>
                        <TileLayer
                            attribution=""
                            url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                            maxNativeZoom={19}
                            maxZoom={22}
                        />
                    </LayersControl.BaseLayer>
                    {GOOGLE_MAPS_API_KEY && (
                        <LayersControl.BaseLayer name='جوجل مابس - هجين'>
                            <TileLayer
                                attribution=""
                                url={`https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_API_KEY}`}
                                subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                maxNativeZoom={20}
                                maxZoom={22}
                            />
                        </LayersControl.BaseLayer>
                    )}
                </LayersControl>

                {geoJsonLayer}
                <MapSearchController targetFeature={searchedFeature} resetSignal={resetSignal} />
            </MapContainer>

            {!GOOGLE_MAPS_API_KEY && (
                <div className='absolute left-4 top-4 z-[650] rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow'>
                    مفتاح Google غير مضبوط، طبقة Google Hybrid غير متاحة.
                </div>
            )}

            <div className='pointer-events-none absolute right-4 top-[17.5rem] z-[500] w-64 max-h-[60vh] overflow-y-auto rounded-lg border border-white/50 bg-white/90 p-3 text-right shadow-lg backdrop-blur-sm'>
                <p className='mb-2 text-xs font-semibold text-slate-700 sticky top-0 bg-white/90 p-1'>دليل الألوان - بلديات ولاية غرداية</p>
                <div className='space-y-1.5 text-xs text-slate-700'>
                    <div className='flex items-center justify-between gap-2'>
                        <span>غرداية</span>
                        <span className='h-0.5 w-6 rounded-sm' style={{ backgroundColor: '#1e3a8a', boxShadow: '0 0 0 1px #1e3a8a' }} />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <span>العطف</span>
                        <span className='h-0.5 w-6 rounded-sm' style={{ backgroundColor: '#dc2626', boxShadow: '0 0 0 1px #dc2626' }} />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <span>بنورة</span>
                        <span className='h-0.5 w-6 rounded-sm' style={{ backgroundColor: '#a21caf', boxShadow: '0 0 0 1px #a21caf' }} />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <span>متليلي</span>
                        <span className='h-0.5 w-6 rounded-sm' style={{ backgroundColor: '#ea580c', boxShadow: '0 0 0 1px #ea580c' }} />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <span>الضاية</span>
                        <span className='h-0.5 w-6 rounded-sm' style={{ backgroundColor: '#047857', boxShadow: '0 0 0 1px #047857' }} />
                    </div>
                </div>
            </div>
        </div>
    );
});

MzabValleyMap.displayName = 'MzabValleyMap';

export default MzabValleyMap;
