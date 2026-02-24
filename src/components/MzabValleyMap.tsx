import React, { useEffect, useImperativeHandle, useMemo, useState } from 'react';
import L from 'leaflet';
import { GeoJSON, LayersControl, MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';

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
    '4701': 'ط؛ط±ط¯ط§ظٹط©',
    '4707': 'ط§ظ„ط¹ط·ظپ',
    '4710': 'ط¨ظ†ظˆط±ط©',
    '4705': 'ظ…طھظ„ظٹظ„ظٹ',
    '4703': 'ط§ظ„ط¶ط§ظٹط©',
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
                if (!res.ok) throw new Error('ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¹ظ‚ط§ط±ظٹط© ط؛ظٹط± ظ…طھظˆظپط±ط©');
                return res.json();
            })
            .then((data) => setGeojsonData(normalizeGeoJson(data)))
            .catch((err) => {
                console.error('ط®ط·ط£ ظپظٹ طھط­ظ…ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ‚ط·ط¹:', err);
                setGeojsonData({ type: 'FeatureCollection', features: [] });
            });
    }, []);

    const emitSelection = (props: Record<string, unknown>) => {
        if (!onParcelSelect) return;
        const municipality = resolveMunicipalityName(props.Municipality ?? props.MUNICIPALITY ?? props.COMMUNE ?? props.commune_code ?? '');
        const section = String(props.Section ?? props.SECTION ?? props.section ?? '');
        const propertyGroup = String(props.PropertyGroup ?? props.PROPERTYGROUP ?? props.ILOT ?? props.group ?? '');
        const rawArea = Number(props.Area ?? props.AREA);
        const actualArea = Number.isFinite(rawArea) ? Number(rawArea.toFixed(2)) : null;
        const cadastralArea = actualArea === null ? null : toCadastralArea(actualArea);
        onParcelSelect({ municipality, section, propertyGroup, actualArea, cadastralArea });
    };

    const searchParcel = (payload: ParcelSearchPayload) => {
        if (!geojsonData || !geojsonData.features) {
            return { ok: false, message: 'ط§ظ„ط¨ظٹط§ظ†ط§طھ ط؛ظٹط± ط¬ط§ظ‡ط²ط© ط¨ط¹ط¯طŒ ظٹط±ط¬ظ‰ ط§ظ„ط§ظ†طھط¸ط§ط±.' };
        }

        const municipalityCode = payload.municipalityCode.trim();
        const section = payload.section.trim();
        const group = payload.group.trim();
        if (!municipalityCode || !section || !group) {
            return { ok: false, message: 'ظٹط±ط¬ظ‰ ط§ط®طھظٹط§ط± ط§ظ„ط¨ظ„ط¯ظٹط© ظˆط¥ط¯ط®ط§ظ„ ط±ظ‚ظ… ط§ظ„ظ‚ط³ظ… ظˆظ…ط¬ظ…ظˆط¹ط© ط§ظ„ظ…ظ„ظƒظٹط©.' };
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
            return { ok: false, message: 'ظ„ظ… ظٹطھظ… ط§ظ„ط¹ط«ظˆط± ط¹ظ„ظ‰ ظ‚ط·ط¹ط© ط¨ظ‡ط°ظ‡ ط§ظ„ظ…ط¹ط§ظٹظٹط±.' };
        }

        const props = (match.properties || {}) as Record<string, unknown>;
        const key = getParcelKey(props);
        setFoundParcelKey(key);
        setSelectedParcelKey(key);
        setSearchedFeature(match);
        emitSelection(props);
        return { ok: true, message: 'طھظ… ط§ظ„ط¹ط«ظˆط± ط¹ظ„ظ‰ ط§ظ„ظ‚ط·ط¹ط© ط¨ظ†ط¬ط§ط­.' };
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
                        emitSelection(props);
                    },
                }}
            />
        );
    }, [geojsonData, hoveredParcelKey, selectedParcelKey, foundParcelKey]);

    return (
        <div className='relative' style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
            <MapContainer center={[32.4845, 3.6792]} zoom={15} maxZoom={22} style={{ height: '100%', width: '100%' }}>
                <LayersControl position='topright'>
                    <LayersControl.BaseLayer checked name='ط®ط±ظٹط·ط© ط§ظ„ط´ط§ط±ط¹ (OSM)'>
                        <TileLayer
                            attribution='&copy; OpenStreetMap contributors'
                            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                            maxNativeZoom={19}
                            maxZoom={22}
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name='ظ‚ظ…ط± طµظ†ط§ط¹ظٹ Esri'>
                        <TileLayer
                            attribution='Tiles &copy; Esri'
                            url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                            maxNativeZoom={19}
                            maxZoom={22}
                        />
                    </LayersControl.BaseLayer>
                    {GOOGLE_MAPS_API_KEY && (
                        <LayersControl.BaseLayer name='ط¬ظˆط¬ظ„ ظ…ط§ط¨ط³ - ظ‡ط¬ظٹظ†'>
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
                    ظ…ظپطھط§ط­ Google ط؛ظٹط± ظ…ط¶ط¨ظˆط·طŒ ط·ط¨ظ‚ط© Google Hybrid ط؛ظٹط± ظ…طھط§ط­ط©.
                </div>
            )}

            <div className='pointer-events-none absolute right-4 top-[17.5rem] z-[500] w-52 rounded-lg border border-white/50 bg-white/90 p-3 text-right shadow-lg backdrop-blur-sm'>
                <p className='mb-2 text-xs font-semibold text-slate-700'>ط¯ظ„ظٹظ„ ط§ظ„ط£ظ„ظˆط§ظ†</p>
                <div className='space-y-1.5 text-xs text-slate-700'>
                    <div className='flex items-center justify-between gap-2'>
                        <span>ط؛ط±ط¯ط§ظٹط©</span>
                        <span className='h-3 w-3 rounded-sm' style={{ backgroundColor: '#4f46e5' }} />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <span>ط§ظ„ط¹ط·ظپ</span>
                        <span className='h-3 w-3 rounded-sm' style={{ backgroundColor: '#d97706' }} />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <span>ط¨ظ†ظˆط±ط©</span>
                        <span className='h-3 w-3 rounded-sm' style={{ backgroundColor: '#d946ef' }} />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <span>ظ…طھظ„ظٹظ„ظٹ</span>
                        <span className='h-3 w-3 rounded-sm' style={{ backgroundColor: '#a85507' }} />
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <span>ط§ظ„ط¶ط§ظٹط©</span>
                        <span className='h-3 w-3 rounded-sm' style={{ backgroundColor: '#10b981' }} />
                    </div>
                </div>
            </div>
        </div>
    );
});

MzabValleyMap.displayName = 'MzabValleyMap';

export default MzabValleyMap;


