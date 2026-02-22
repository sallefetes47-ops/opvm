// إضافة Prop لاستقبال الحدث عند اختيار قطعة أرض
export const MzabValleyMap = ({ onParcelSelect }: { onParcelSelect: (data: any) => void }) => {
    // ... نفس الكود السابق الخاص بـ useJsApiLoader ...

    const onLoad = React.useCallback(function callback(map: google.maps.Map) {
        // تحميل ملف البيانات من مجلد public
        map.data.loadGeoJson('/mzab_cadastre_map.geojson');

        map.data.setStyle({
            strokeColor: '#FF0000',
            strokeWeight: 2,
            fillColor: '#FF0000',
            fillOpacity: 0.2,
        });

        // التقاط البيانات عند الضغط وإرسالها للأعلى
        map.data.addListener('click', (event: any) => {
            const section = event.feature.getProperty('SECTION');
            const ilot = event.feature.getProperty('ILOT');
            onParcelSelect({ section, ilot });
        });
    }, [onParcelSelect]);

    // ... باقي المكون ...
    return (
        <GoogleMap /* ... الخيارات ... */ onLoad={onLoad}>
            {/* محتوى الخريطة */}
        </GoogleMap>
    );
};