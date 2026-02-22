import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // ضروري جداً لمنع الصفحة البيضاء

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
                center={[32.4845, 3.6792]} // مركز وادي ميزاب
                zoom={15}
                maxZoom={22} // يسمح بعمل زوم لغاية مستوى 22
                style={{ height: '100%', width: '100%' }}
            >
                {/* طبقة الأقمار الصناعية من Esri مع حل مشكلة الزوم */}
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='Tiles &copy; Esri &mdash; Source: Esri'
                    maxZoom={22}
                    maxNativeZoom={18} // يمنع ظهور المربعات الرمادية بتكبير صور مستوى 18 رقمياً
                />

                {geoJsonData && (
                    <GeoJSON
                        data={geoJsonData}
                        style={{
                            color: '#FF0000',     // 🔴 لون الحدود (أحمر)
                            weight: 2,            // 📏 سمك الخط (زدناه قليلاً ليكون أوضح)
                            fillColor: '#FF0000', // 🔴 لون التعبئة الداخلية
                            fillOpacity: 0.1      // 👁️ شفافية عالية (10%) لكي ترى أسطح المنازل بوضوح تحتها
                        }}
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

                export default MzabValleyMap;