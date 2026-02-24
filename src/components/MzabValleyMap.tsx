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
    '4702': 'ضاية بن ضحوة',
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

const MzabValleyMap: React.FC<MzabValleyMapProps> = ({ onParcelSelect }) => {
    const [geoJsonData, setGeoJsonData] = useState(null);

    useEffect(() => {
        fetch('/mzab_cadastre_map.geojson')
            .then(res => {
                if (!res.ok) throw new Error('البيانات العقارية غير متوفرة');
                return res.json();
            })
            .then(data => setGeoJsonData(data))
            .catch(err => console.error('خطأ في تحميل بيانات القطع:', err));
    }, []);

    return (
        <div style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
            <MapContainer
                center={[32.4845, 3.6792]}
                zoom={15}
                maxZoom={22}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    attribution='Tiles &copy; Esri'
                    maxZoom={22}
                    maxNativeZoom={18}
                />

                {geoJsonData && (
                    <GeoJSON
                        data={geoJsonData}
                        style={{
                            color: '#FF0000',
                            weight: 2,
                            fillColor: '#FF0000',
                            fillOpacity: 0.1,
                        }}
                        eventHandlers={{
                            click: (e) => {
                                const props = e?.propagatedFrom?.feature?.properties || {};
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
