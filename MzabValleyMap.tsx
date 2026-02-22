import React, { useMemo } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';

// إعدادات التصميم للموقع
const containerStyle = {
    width: '100%',
    height: '100%' // لكي يأخذ مساحة الحاوية في UrbanMap
};

// مركز وادي ميزاب (غرداية)
const center = {
    lat: 32.4845,
    lng: 3.6792,
};

interface MzabValleyMapProps {
    onParcelSelect: (data: { section: string; ilot: string }) => void;
}

export const MzabValleyMap: React.FC<MzabValleyMapProps> = ({ onParcelSelect }) => {
    // 1. تحميل المكتبة مع مراعاة بيئة Vite في IDX
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        // ملاحظة: في Vite نستخدم import.meta.env بدلاً من process.env
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "", 
        libraries: ['visualization', 'geometry'],
    });

    // 2. وظيفة التحميل ورسم البيانات العقارية
    const onLoad = React.useCallback(function callback(map: google.maps.Map) {
        // تحميل ملف الـ 2327 قطعة أرضية من مجلد public
        map.data.loadGeoJson('/mzab_cadastre_map.geojson');

        // تنسيق الحدود لتكون شفافة وحمراء
        map.data.setStyle({
            strokeColor: '#FF0000',
            strokeWeight: 2,
            fillColor: '#FF0000',
            fillOpacity: 0.1,
        });

        // التقاط البيانات عند الضغط
        map.data.addListener('click', (event: google.maps.Data.MouseEvent) => {
            const section = event.feature.getProperty('SECTION');
            const ilot = event.feature.getProperty('ILOT');
            
            if (section && ilot) {
                onParcelSelect({ section, ilot });
            }
        });
    }, [onParcelSelect]);

    // 3. معالجة حالات الخطأ والتحميل (لمنع الصفحة البيضاء)
    if (loadError) {
        return <div style={{ padding: '20px', color: 'red' }}>⚠️ خطأ في تحميل خرائط جوجل. تأكد من مفتاح API.</div>;
    }

    if (!isLoaded) {
        return <div style={{ padding: '20px' }}>⏳ جاري تجهيز المخطط العقاري لوادي ميزاب...</div>;
    }

    return (
        <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={15}
            onLoad={onLoad}
            options={{
                mapTypeId: 'satellite',
                tilt: 0,
            }}
        >
            {/* تم تحميل البيانات عبر onLoad.data */}
        </GoogleMap>
    );
};