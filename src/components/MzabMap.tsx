import React, { useEffect, useRef } from 'react';

// تعريف أنواع البيانات المتوقعة
interface MzabMapProps {
    onParcelSelect: (data: { section: string; ilot: string }) => void;
}

const MzabMap: React.FC<MzabMapProps> = ({ onParcelSelect }) => {
    const mapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (mapRef.current) {
            const map = new google.maps.Map(mapRef.current, {
                center: { lat: 32.49, lng: 3.67 }, // مركز غرداية
                zoom: 16,
                mapTypeId: 'satellite',
            });

            // تحميل الكنز الجغرافي من مجلد public
            map.data.loadGeoJson('/mzab_cadastre_map.geojson');

            map.data.setStyle({
                strokeColor: '#FF0000',
                strokeWeight: 2,
                fillColor: '#FF0000',
                fillOpacity: 0.1,
            });

            // عند الضغط على قطعة أرض
            map.data.addListener('click', (event: any) => {
                const section = event.feature.getProperty('SECTION');
                const ilot = event.feature.getProperty('ILOT');

                // إرسال البيانات فوراً إلى الاستمارة
                onParcelSelect({ section, ilot });
            });
        }
    }, [onParcelSelect]);

    return <div ref={mapRef} style={{ width: '100%', height: '500px' }} />;
};

export default MzabMap;
