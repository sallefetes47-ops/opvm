// أضف هذا الـ Interface في الأعلى لتسهيل ربط البيانات
interface MzabValleyMapProps {
    onParcelSelect?: (data: { section: string; ilot: string }) => void;
}

export const MzabValleyMap: React.FC<MzabValleyMapProps> = ({ onParcelSelect }) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        // تأكد من ضبط المفتاح في ملف .env
        googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
        libraries: ['visualization', 'geometry'], 
    });

    const onLoad = React.useCallback(function callback(map: google.maps.Map) {
        // 1. تحميل ملف الـ 2327 قطعة أرضية من مجلد public
        // استخدم المسار المطلق '/' لتجنب خطأ 404
        map.data.loadGeoJson('/mzab_cadastre_map.geojson');

        // 2. تنسيق حدود القطع العقارية (أحمر شفاف)
        map.data.setStyle({
            strokeColor: '#FF0000',
            strokeWeight: 1.5,
            fillColor: '#FF0000',
            fillOpacity: 0.1,
        });

        // 3. إضافة مستشعر الضغط لاستخراج بيانات القسم والمجموعة
        map.data.addListener('click', (event: google.maps.Data.MouseEvent) => {
            const section = event.feature.getProperty('SECTION');
            const ilot = event.feature.getProperty('ILOT');

            console.log(`🎯 تم اختيار القسم: ${section}, المجموعة: ${ilot}`);

            // إرسال البيانات للاستمارة إذا كانت الوظيفة ممررة
            if (onParcelSelect) {
                onParcelSelect({ section, ilot });
            }
        });
    }, [onParcelSelect]);

    if (!isLoaded) return <div>Loading Map...</div>;

    return (
        <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={14}
            onLoad={onLoad}
            options={mapOptions}
        >
            {/* 💡 قمنا بإزالة HeatmapLayer لأننا الآن نستخدم بيانات عقارية حقيقية */}
        </GoogleMap>
    );
};