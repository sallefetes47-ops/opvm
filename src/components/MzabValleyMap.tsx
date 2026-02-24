import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface MzabValleyMapProps {
    onParcelSelect?: (data: {
        municipality: string;
        section: string;
        propertyGroup: string;
        area: number | null;
    }) => void;
}

const MUNICIPALITY_CODE_TO_NAME: Record<string, string> = {
    '4701': 'غرداية',
    '4707': 'العطف',
    '4706': 'بنورة',
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
    if (normalizedCode === '4701') return '#3b82f6';
    if (normalizedCode === '4707') return '#f97316';
    if (normalizedCode === '4706') return '#8b5cf6';
    if (normalizedCode === '4703') return '#10b981';
    return '#94a3b8';
};

const getMunicipalityBorderColor = (code: unknown): string => {
    const normalizedCode = normalizeMunicipalityCode(code);
    if (normalizedCode === '4701') return '#1d4ed8';
    if (normalizedCode === '4707') return '#c2410c';
    if (normalizedCode === '4706') return '#6d28d9';
    if (normalizedCode === '4703') return '#047857';
    return '#64748b';
};

const resolveMunicipalityName = (rawValue: unknown): string => {
    if (rawValue === null || rawValue === undefined) return '';

    const text = String(rawValue).trim();
    if (!text) return '';

    if (MUNICIPALITY_CODE_TO_NAME[text]) {
        return MUNICIPALITY_CODE_TO_NAME[text];
    }

    const digitsOnly = text.replace(/\D/g, '');
    if (MUNICIPALITY_CODE_TO_NAME[digitsOnly]) {
        return MUNICIPALITY_CODE_TO_NAME[digitsOnly];
    }

    const last4 = digitsOnly.slice(-4);
    if (MUNICIPALITY_CODE_TO_NAME[last4]) {
        return MUNICIPALITY_CODE_TO_NAME[last4];
    }

    return text;
};

const getParcelKey = (props: Record<string, unknown>): string => {
    const municipalityCode = normalizeMunicipalityCode(props.Municipality ?? props.MUNICIPALITY ?? props.COMMUNE ?? '');
    const section = String(props.Section ?? props.SECTION ?? '');
    const propertyGroup = String(props.PropertyGroup ?? props.PROPERTYGROUP ?? props.ILOT ?? props.group ?? '');
    return `${municipalityCode}|${section}|${propertyGroup}`;
};

const MzabValleyMap: React.FC<MzabValleyMapProps> = ({ onParcelSelect }) => {
    const [geoJsonData, setGeoJsonData] = useState(null);
    const [hoveredParcelKey, setHoveredParcelKey] = useState('');
    const [selectedParcelKey, setSelectedParcelKey] = useState('');

    useEffect(() => {
        fetch('/mzab_cadastre_map.geojson')
            .then((res) => {
                if (!res.ok) throw new Error('البيانات العقارية غير متوفرة');
                return res.json();
            })
            .then((data) => setGeoJsonData(data))
            .catch((err) => console.error('خطأ في تحميل بيانات القطع:', err));
    }, []);

    return (
        <div style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
            <MapContainer center={[32.4845, 3.6792]} zoom={15} maxZoom={22} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    attribution='Tiles &copy; Esri'
                    maxZoom={22}
                    maxNativeZoom={18}
                />

                {geoJsonData && (
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
                            mouseout: () => {
                                setHoveredParcelKey('');
                            },
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
        </div>
    );
};

export default MzabValleyMap;
