import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';

export const MzabValleyMap = ({ onParcelSelect }: { onParcelSelect: (data: any) => void }) => {
    const [geoJsonData, setGeoJsonData] = useState(null);

    // حل مشكلة الـ 404: التأكد من المسار الصحيح للملف في مجلد public
    useEffect(() => {
        fetch('/mzab_cadastre_map.geojson') // تأكد أن الملف بهذا الاسم تماماً داخل مجلد public
            .then(res => {
                if (!res.ok) throw new Error('الملف غير موجود (404)');
                return res.json();
            })
            .then(data => setGeoJsonData(data))
            .catch(err => console.error("Error fetching cadastre:", err));
    }, []);

    return (
        <MapContainer 
            center={[32.4845, 3.6792]} 
            zoom={14} 
            style={{ height: '500px', width: '100%' }}
        >
            {/* استخدام طبقة خريطة الشارع المفتوحة المجانية */}
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {geoJsonData && (
                <GeoJSON 
                    data={geoJsonData} 
                    style={{ color: 'red', weight: 2, fillOpacity: 0.1 }}
                    eventHandlers={{
                        click: (e) => {
                            const props = e.propagatedFrom.feature.properties;
                            onParcelSelect({ section: props.SECTION, ilot: props.ILOT });
                        }
                    }}
                />
            )}
        </MapContainer>
    );
};