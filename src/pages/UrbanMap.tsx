import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import MapSelector from '@/components/MapSelector';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

/**
 * Urban Map page.
 *
 * Supports URL query parameters for focusing on a specific contract location:
 *   /urban-map?lat=32.4909&lng=3.6738           → zoom 17 (default)
 *   /urban-map?lat=32.4909&lng=3.6738&zoom=18   → custom zoom
 *
 * When no query params are provided, the map shows the full M'zab Valley overview.
 */
export default function UrbanMap() {
    const [searchParams] = useSearchParams();

    // Parse optional focus coordinates from URL
    const focusCoords = useMemo(() => {
        const latStr = searchParams.get('lat');
        const lngStr = searchParams.get('lng');
        const zoomStr = searchParams.get('zoom');

        if (latStr && lngStr) {
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            if (!isNaN(lat) && !isNaN(lng)) {
                return {
                    focusLat: lat,
                    focusLng: lng,
                    focusZoom: zoomStr ? parseInt(zoomStr, 10) || 17 : 17,
                };
            }
        }
        return null;
    }, [searchParams]);

    const isFocused = focusCoords !== null;

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">🗺️ الخريطة العمرانية</h1>
                    <p className="text-muted-foreground">
                        {isFocused
                            ? 'عرض موقع العقد على الخريطة'
                            : 'تحديد وتبويب المواقع الجغرافية للملفات العقارية'}
                    </p>
                </div>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{isFocused ? 'موقع العقد' : 'محدد المواقع'}</CardTitle>
                        <CardDescription aria-hidden="true">
                            {isFocused
                                ? `الموقع: ${focusCoords!.focusLat.toFixed(6)}°N, ${focusCoords!.focusLng.toFixed(6)}°E`
                                : 'استخدم الخريطة أدناه لتحديد موقع العقد أو الملف العمراني بدقة. يمكنك البحث عن العنوان أو سحب العلامة على الخريطة.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MapSelector
                            focusLat={focusCoords?.focusLat}
                            focusLng={focusCoords?.focusLng}
                            focusZoom={focusCoords?.focusZoom}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
