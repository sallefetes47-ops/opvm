import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // 💡 هذا السطر ضروري جداً لمنع الصفحة البيضاء

interface MzabValleyMapProps {
    onParcelSelect?: (data: { section: string; ilot: string }) => void;
}

const MzabValleyMap: React.FC<MzabValleyMapProps> = ({ onParcelSelect }) => {
    const [geoJsonData, setGeoJsonData] = useState(null);

    // جلب بيانات الـ 2327 قطعة أرضية من مجلد public
    useEffect(() => {
        fetch('/mzab_cadastre_map.geojson')
            .then(res => res.json())
            .then(data => setGeoJsonData(data))
            .catch(err => console.error("خطأ في جلب البيانات العقارية:", err));
    }, []);

    return (
        <div style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
            <MapContainer
                center={[32.4845, 3.6792]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
            >
                {/* طبقة الأقمار الصناعية من Esri - مجانية واحترافية */}
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
                />

                {geoJsonData && (
                    <GeoJSON
                        data={geoJsonData}
                        style={{ color: '#FFD700', weight: 1.5, fillOpacity: 0.2 }}
                        eventHandlers={{
                            click: (e) => {
                                const props = e.propagatedFrom.feature.properties;
                                if (onParcelSelect) {
                                    onParcelSelect({ section: props.SECTION, ilot: props.ILOT });
                                }
                            }
                        }}
                    />
                )}
            </MapContainer>
        </div>
    );
};

export default MzabValleyMap;