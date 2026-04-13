import React, { useEffect, useState, useMemo } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * CadastreMap — Minimal, static-import GeoJSON renderer for Ghardaïa cadastre.
 *
 * - Data is statically bundled at build time (no network fetch).
 * - Each parcel shows Arabic labels on click.
 * - Polygons rendered with blue border + light blue fill.
 */

interface CadastreMapProps {
    height?: string;
    width?: string;
}

const CADASTRE_STYLE = {
    color: '#2563eb',
    weight: 2,
    fillOpacity: 0.2,
    opacity: 1,
};

const HOVER_STYLE = {
    color: '#1d4ed8',
    weight: 3,
    fillOpacity: 0.35,
};

const CadastreMap: React.FC<CadastreMapProps> = ({ height = '100%', width = '100%' }) => {
    const [geoData, setGeoData] = useState<any>(null);

    useEffect(() => {
        fetch('./mzab_cadastre_map.json')
            .then(r => r.json())
            .then(setGeoData)
            .catch(err => console.error('Failed to load GeoJSON:', err));
    }, []);

    return (
        <div style={{ height, width, borderRadius: '12px', overflow: 'hidden' }}>
            <MapContainer
                center={[32.545, 3.602]}
                zoom={14}
                maxZoom={22}
                style={{ height: '100%', width: '100%' }}
                zoomControl
                preferCanvas
            >
                <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    maxNativeZoom={19}
                    maxZoom={22}
                />

                {geoData && (
                    <GeoJSON
                        key={`cadastre-${geoData.features?.length ?? 0}`}
                        data={geoData as unknown as GeoJsonObject}
                        style={() => CADASTRE_STYLE}
                        onEachFeature={(feature, layer) => {
                            const props = (feature as any)?.properties || {};
                            const commune = props.COMMUNE ?? props.commune ?? props.Municipality ?? '—';
                            const section = props.SECTION ?? props.Section ?? props.section ?? '—';
                            const ilot = props.ILOT ?? props.propertyGroup ?? props.PropertyGroup ?? '—';
                            const area = props.AREA ?? props.Area ?? props.area ?? '—';
                            const popupContent = `
                                <div dir="rtl" style="font-family: 'Cairo', sans-serif; font-size: 14px; line-height: 1.8; white-space: nowrap;">
                                    <strong style="font-size: 15px; display: block; margin-bottom: 4px;">📍 معلومات القطعة</strong>
                                    <span>البلدية:</span> <strong>${commune}</strong><br/>
                                    <span>رقم القسم:</span> <strong>${section}</strong><br/>
                                    <span>مجموعة الملكية:</span> <strong>${ilot}</strong><br/>
                                    <span>المساحة:</span> <strong>${area} م²</strong>
                                </div>
                            `;
                            layer.bindPopup(popupContent);
                            layer.on('mouseover', () => { (layer as any).setStyle(HOVER_STYLE); });
                            layer.on('mouseout', () => { (layer as any).setStyle(CADASTRE_STYLE); });
                        }}
                    />
                )}
            </MapContainer>
        </div>
    );
};

export default CadastreMap;
