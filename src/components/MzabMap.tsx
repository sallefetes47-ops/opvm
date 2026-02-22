import React, { useEffect, useRef, useState } from 'react';

export default function MzabMap() {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

    useEffect(() => {
        // التحقق من تحميل مكتبة Google Maps من ملف index.html
        if (!window.google || !window.google.maps) {
            console.error("مكتبة خرائط جوجل لم يتم تحميلها بعد. تأكد من إعداد index.html.");
            return;
        }

        if (mapContainerRef.current && !mapInstance) {
            // 1. تهيئة الخريطة وتوسيطها على وادي ميزاب (غرداية)
            const map = new window.google.maps.Map(mapContainerRef.current, {
                center: { lat: 32.49094, lng: 3.67354 },
                zoom: 16,
                mapTypeId: 'satellite', // تفعيل وضع الأقمار الصناعية كخلفية
                mapTypeControl: true,
                streetViewControl: false,
            });

            // 2. تحميل ملف GeoJSON الخاص بالخريطة العمرانية
            map.data.loadGeoJson('/mzab_cadastre_map.geojson');

            // 3. تصميم المضلعات (حدود حمراء وتعبئة شفافة لتوضيح المباني تحتها)
            map.data.setStyle({
                fillColor: '#ef4444', // أحمر
                fillOpacity: 0.1,     // شفاف جداً
                strokeColor: '#ef4444',
                strokeWeight: 2,
            });

            // 4. نافذة المعلومات
            const infoWindow = new window.google.maps.InfoWindow();

            // 5. التفاعل عند النقر على أي قطعة أرضية
            map.data.addListener('click', (event: google.maps.Data.MouseEvent) => {
                const section = event.feature.getProperty('SECTION');
                const ilot = event.feature.getProperty('ILOT');

                // محتوى النافذة منسق باللغة العربية
                const infoContent = `
                    <div style="padding: 10px; font-family: inherit; text-align: right;" dir="rtl">
                        <h3 style="margin-top: 0; margin-bottom: 8px; color: #b91c1c; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; font-size: 16px;">
                            🏢 بيانات الملكية العمرانية
                        </h3>
                        <div style="font-size: 14px; line-height: 1.6;">
                            <p style="margin: 0;"><strong>رقم القسم (Section):</strong> <span style="color: #2563eb;">${section || 'غير متوفر'}</span></p>
                            <p style="margin: 0;"><strong>مجموعة الملكية (Ilot):</strong> <span style="color: #2563eb;">${ilot || 'غير متوفر'}</span></p>
                        </div>
                    </div>
                `;

                infoWindow.setContent(infoContent);
                // تعيين موضع النافذة بناءً على مكان النقر
                if (event.latLng) {
                    infoWindow.setPosition(event.latLng);
                }
                infoWindow.open(map);
            });

            setMapInstance(map);
        }
    }, [mapInstance]);

    // عرض الخريطة بملء الشاشة أو الحاوية التي تحتضنها
    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
}
