import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // 💡 استدعاء ملف الـ CSS لمنع الصفحة البيضاء

interface MzabValleyMapProps {
    onParcelSelect?: (data: { section: string; ilot: string }) => void;
}

const MzabValleyMap: React.FC<MzabValleyMapProps> = ({ onParcelSelect }) => {
    const [geoJsonData, setGeoJsonData] = useState(null);

    // جلب ملف البيانات الشامل الذي سحبناه (يحتوي على آلاف القطع)
    useEffect(() => {
        fetch('/mzab_cadastre_map.geojson')
            .then(res => {
                if (!res.ok) throw new Error("ملف البيانات غير موجود");
                return res.json();
            })
            .then(data => setGeoJsonData(data))
            .catch(err => console.error("خطأ في جلب البيانات العقارية:", err));
    }, []);

    return (
        <div style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
            <MapContainer
                center={[32.4845, 3.6792]} // مركز وادي ميزاب (غرداية)
                zoom={15}
                maxZoom={22}
                style={{ height: '100%', width: '100%' }}
            >
                {/* طبقة الأقمار الصناعية (Satellite) مع حل مشكلة الزوم العميق */}
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='Tiles &copy; Esri'
                    maxZoom={22}
                    maxNativeZoom={18}
                />

                {/* رسم القطع العقارية باللون الأحمر */}
                {geoJsonData && (
                    <GeoJSON
                        data={geoJsonData}
                        style={{ 
                            color: '#FF0000',     // 🔴 لون الحدود أحمر
                            weight: 2,            // 📏 سمك الخط
                            fillColor: '#FF0000', // 🔴 التعبئة حمراء
                            fillOpacity: 0.1      // 👁️ شفافية خفيفة لرؤية المباني
                        }}
                        eventHandlers={{
                            click: (e) => {
                                const props = e.propagatedFrom.feature.properties;
                                if (onParcelSelect) {
                                    // إرسال رقم القسم والمجموعة للاستمارة
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