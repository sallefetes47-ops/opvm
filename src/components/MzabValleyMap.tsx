import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { GeoJSON, LayersControl, MapContainer, TileLayer, useMap } from 'react-leaflet';
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
    '4705': 'متليلي',
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
    if (normalizedCode === '4710') return '#d946ef';
    if (normalizedCode === '4705') return '#a85507';
    if (normalizedCode === '4703') return '#10b981';
    return '#94a3b8';
};

const getMunicipalityBorderColor = (code: unknown): string => {
    const normalizedCode = normalizeMunicipalityCode(code);
    if (normalizedCode === '4701') return '#3730a3';
    if (normalizedCode === '4707') return '#92400e';
    if (normalizedCode === '4710') return '#a21caf';
    if (normalizedCode === '4705') return '#78350f';
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

const getCommuneCodeFromProps = (props: Record<string, unknown>): string =>
    normalizeMunicipalityCode(props.commune_code ?? props.COMMUNE_CODE ?? props.COMMUNE ?? props.Municipality ?? props.MUNICIPALITY ?? '');

const getSectionFromProps = (props: Record<string, unknown>): string =>
    String(props.section ?? props.Section ?? props.SECTION ?? '').trim();

const getGroupFromProps = (props: Record<string, unknown>): string =>
    String(props.group ?? props.Group ?? props.ILOT ?? props.PropertyGroup ?? props.PROPERTYGROUP ?? '').trim();

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

const MzabValleyMap: React.FC<MzabValleyMapProps> = ({ onParcelSelect }) => {
    const [geojsonData, setGeojsonData] = useState<GeoJsonFeatureCollectionLike | null>(null);
    const [hoveredParcelKey, setHoveredParcelKey] = useState('');
    const [selectedParcelKey, setSelectedParcelKey] = useState('');
    const [foundParcelKey, setFoundParcelKey] = useState('');
    const [searchMunicipalityCode, setSearchMunicipalityCode] = useState('');
    const [searchSection, setSearchSection] = useState('');
    const [searchGroup, setSearchGroup] = useState('');
    const [searchMessage, setSearchMessage] = useState('');
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
                    const isFound = foundParcelKey === parcelKey;

                    return {
                        fillColor,
                        fillOpacity: 0.5,
                        color: isFound ? '#eaff00' : isHovered || isSelected ? borderColor : '#ffffff',
                        weight: isFound ? 4 : isSelected ? 3 : isHovered ? 2.5 : 1.1,
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
                        setSearchMessage('');
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
    }, [geojsonData, hoveredParcelKey, selectedParcelKey, foundParcelKey, onParcelSelect]);

    const handleSearch = () => {
        if (!geojsonData || !geojsonData.features) {
            setSearchMessage('البيانات غير جاهزة بعد، يرجى الانتظار.');
            return;
        }

        if (!searchMunicipalityCode || !searchSection.trim() || !searchGroup.trim()) {
            setSearchMessage('يرجى اختيار البلدية وإدخال رقم القسم ومجموعة الملكية.');
            return;
        }

        const targetSection = searchSection.trim();
        const targetGroup = searchGroup.trim();

        const match = geojsonData.features.find((feature) => {
            const props = (feature?.properties || {}) as Record<string, unknown>;
            const communeCode = getCommuneCodeFromProps(props);
            const section = getSectionFromProps(props);
            const group = getGroupFromProps(props);
            return communeCode === searchMunicipalityCode && section === targetSection && group === targetGroup;
        });

        if (!match) {
            setSearchMessage('لم يتم العثور على قطعة بهذه المعايير.');
            setSearchedFeature(null);
            setFoundParcelKey('');
            return;
        }

        const props = (match.properties || {}) as Record<string, unknown>;
        const key = getParcelKey(props);
        setFoundParcelKey(key);
        setSelectedParcelKey(key);
        setSearchedFeature(match);
        setSearchMessage('تم العثور على القطعة بنجاح.');

        if (onParcelSelect) {
            const municipality = resolveMunicipalityName(props.Municipality ?? props.MUNICIPALITY ?? props.COMMUNE ?? props.commune_code ?? '');
            const section = String(props.Section ?? props.SECTION ?? props.section ?? '');
            const propertyGroup = String(props.PropertyGroup ?? props.PROPERTYGROUP ?? props.ILOT ?? props.group ?? '');
            const rawArea = Number(props.Area ?? props.AREA);
            const area = Number.isFinite(rawArea) ? rawArea : null;
            onParcelSelect({ municipality, section, propertyGroup, area });
        }
    };

    const handleClearSearch = () => {
        setSearchMunicipalityCode('');
        setSearchSection('');
        setSearchGroup('');
        setSearchMessage('');
        setFoundParcelKey('');
        setSelectedParcelKey('');
        setSearchedFeature(null);
        setResetSignal((prev) => prev + 1);
    };

    return (
        <div className='relative' style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
            <div className='absolute left-4 top-4 z-[700] w-[28rem] rounded-xl border border-white/70 bg-white/95 p-3 shadow-lg backdrop-blur-sm'>
                <p className='mb-2 text-right text-xs font-semibold text-slate-700'>البحث الذكي عن القطعة</p>
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-4'>
                    <select
                        value={searchMunicipalityCode}
                        onChange={(e) => setSearchMunicipalityCode(e.target.value)}
                        className='rounded-md border border-slate-200 px-2 py-2 text-right text-xs text-slate-700 outline-none focus:border-emerald-400'
                    >
                        <option value=''>اختر البلدية</option>
                        <option value='4701'>غرداية (4701)</option>
                        <option value='4707'>العطف (4707)</option>
                        <option value='4710'>بنورة (4710)</option>
                        <option value='4703'>بلدية الضاية (4703)</option>
                        <option value='4705'>متليلي (4705)</option>
                    </select>
                    <input
                        value={searchSection}
                        onChange={(e) => setSearchSection(e.target.value)}
                        placeholder='رقم القسم'
                        className='rounded-md border border-slate-200 px-2 py-2 text-right text-xs text-slate-700 outline-none focus:border-emerald-400'
                    />
                    <input
                        value={searchGroup}
                        onChange={(e) => setSearchGroup(e.target.value)}
                        placeholder='مجموعة الملكية'
                        className='rounded-md border border-slate-200 px-2 py-2 text-right text-xs text-slate-700 outline-none focus:border-emerald-400'
                    />
                    <div className='flex gap-2'>
                        <button
                            type='button'
                            onClick={handleSearch}
                            className='w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700'
                        >
                            بحث
                        </button>
                        <button
                            type='button'
                            onClick={handleClearSearch}
                            className='w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50'
                        >
                            مسح
                        </button>
                    </div>
                </div>
                {searchMessage && <p className='mt-2 text-right text-[11px] text-slate-600'>{searchMessage}</p>}
            </div>

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
                <MapSearchController targetFeature={searchedFeature} resetSignal={resetSignal} />
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
                        <span className='h-3 w-3 rounded-sm' style={{ backgroundColor: '#d946ef' }} />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <span>متليلي</span>
                        <span className='h-3 w-3 rounded-sm' style={{ backgroundColor: '#a85507' }} />
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
