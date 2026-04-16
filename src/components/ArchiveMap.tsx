import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Satellite } from 'lucide-react';

// Loaded dynamically to avoid OOM during build

const CADASTRE_GEOJSON_URL = `${import.meta.env.BASE_URL}mzab_cadastre_map.json`;

// Ghardaia center coordinates
const GHARDAIA_CENTER: [number, number] = [3.6900, 32.4810];

function extendBoundsFromCoordinates(
    bounds: maplibregl.LngLatBounds,
    coordinates: unknown,
): void {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return;

    if (
        coordinates.length >= 2 &&
        typeof coordinates[0] === 'number' &&
        typeof coordinates[1] === 'number'
    ) {
        bounds.extend([coordinates[0], coordinates[1]]);
        return;
    }

    coordinates.forEach((entry) => extendBoundsFromCoordinates(bounds, entry));
}


// Custom OSM style for Mapbox (free, no token required)
const OSM_STYLE = {
    version: 8 as const,
    sources: {
        'osm': {
            type: 'raster' as const,
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
            maxzoom: 19,
        },
    },
    layers: [
        {
            id: 'osm-layer',
            type: 'raster' as const,
            source: 'osm',
            minzoom: 0,
            maxzoom: 22,
        },
    ],
};

export interface ArchiveMapProps {
    onParcelSelect?: (section: string, ilot: string) => void;
}

export default function ArchiveMap({ onParcelSelect }: ArchiveMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    // Initialize MapLibre GL map
    useEffect(() => {
        if (!mapContainerRef.current) {
            console.error('[Archive Map] Map container ref is null');
            return;
        }

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: OSM_STYLE,
            center: GHARDAIA_CENTER,
            zoom: 14,
            maxZoom: 22,
            attributionControl: false,
        });

        // Add navigation controls
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        mapRef.current = map;

        // Map load event
        map.on('load', () => {
            console.log('[Archive Map] ✅ Map loaded');
            setIsMapLoaded(true);

            // Add GeoJSON source for cadastral parcels
            map.addSource('cadastre-parcels', {
                type: 'geojson',
                data: ({
                    type: 'FeatureCollection',
                    features: [],
                }) as any,
            });

            // Add fill layer with transparent slate gray
            map.addLayer({
                id: 'cadastre-parcels-fill',
                type: 'fill',
                source: 'cadastre-parcels',
                minzoom: 0,
                maxzoom: 24,
                paint: {
                    'fill-color': '#64748b',
                    'fill-opacity': 0.25,
                },
            });

            // Add line layer with slate gray outline
            map.addLayer({
                id: 'cadastre-parcels-line',
                type: 'line',
                source: 'cadastre-parcels',
                minzoom: 0,
                maxzoom: 24,
                paint: {
                    'line-color': '#64748b',
                    'line-width': 2,
                    'line-opacity': 1,
                },
            });

            console.log('[Archive Map] ✅ Cadastral layers added');

            // Change cursor to pointer on hover
            map.on('mouseenter', 'cadastre-parcels-fill', () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', 'cadastre-parcels-fill', () => {
                map.getCanvas().style.cursor = '';
            });

            // Handle parcel click - AUTO-FILL ARCHIVE SEARCH & SHOW POPUP
            map.on('click', 'cadastre-parcels-fill', (e) => {
                console.log('[Archive Map] 🖱️ Parcel clicked');

                if (!e.features || e.features.length === 0) {
                    console.warn('[Archive Map] ⚠️ No features found');
                    return;
                }

                const feature = e.features[0];
                const properties = feature.properties || {};
                console.log('[Archive Map] 📋 Parcel properties:', properties);

                // Extract SECTION and ILOT from properties (uppercase as per GeoJSON)
                const sectionRaw = properties.SECTION ?? properties.Section ?? properties.section ?? '';
                const ilotRaw = properties.ILOT ?? properties.Ilot ?? properties.ilot ?? properties.group ?? '';
                const communeRaw = properties.COMMUNE ?? properties.Commune ?? properties.commune ?? 'غير متوفر';

                // Format section (3 digits) and ilot (4 digits)
                const section = String(sectionRaw).padStart(3, '0');
                const ilot = String(ilotRaw).padStart(4, '0');
                const commune = String(communeRaw);

                console.log('[Archive Map] 📊 Extracted & formatted:', { section, ilot, commune });

                // CRITICAL: Auto-fill archive search filters using React state setters
                if (onParcelSelect && section && ilot) {
                    onParcelSelect(section, ilot);
                    console.log('[Archive Map] ✅ Called onParcelSelect with:', section, ilot);
                }

                // Show popup with Arabic survey data (معلومات المسح)
                const popupContent = `
                    <div style="font-family: 'Cairo', sans-serif; padding: 12px; text-align: right; direction: rtl; min-width: 220px;">
                        <h4 style="margin: 0 0 10px 0; color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 6px; font-size: 15px; font-weight: bold;">
                            معلومات المسح
                        </h4>
                        <div style="font-size: 13px; color: #1e293b; line-height: 1.8;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                <span style="color: #64748b;">البلدية:</span>
                                <span style="font-weight: 700; color: #0f172a;">${commune}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                <span style="color: #64748b;">القسم:</span>
                                <span style="font-weight: 700; color: #0f172a; font-family: monospace;">${section}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: #64748b;">مجموعة الملكية:</span>
                                <span style="font-weight: 700; color: #0f172a; font-family: monospace;">${ilot}</span>
                            </div>
                        </div>
                        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #10b981; font-weight: 600;">
                            ✓ تم تطبيق الفلتر على الأرشيف
                        </div>
                    </div>
                `;

                new maplibregl.Popup({
                    closeButton: true,
                    closeOnClick: false,
                    maxWidth: '280px',
                })
                    .setLngLat(e.lngLat)
                    .setHTML(popupContent)
                    .addTo(map);
            });

            // Load GeoJSON data dynamically
            fetch(CADASTRE_GEOJSON_URL)
                .then(r => r.json())
                .then(geoData => {
                    const source = map.getSource('cadastre-parcels') as any;
                    if (source && geoData) {
                        source.setData(geoData);
                        console.log('[Archive Map] ✅ GeoJSON data set:', geoData.features?.length || 0, 'features');
                    }
                })
                .catch(err => console.error('[Archive Map] Failed to load GeoJSON:', err));

            // Debug: Log errors
            map.on('error', (e) => {
                console.error('[Archive Map] ❌ Error:', e);
            });
        });

        // Cleanup function
        return () => {
            console.log('[Archive Map] 🧹 Cleaning up map instance...');
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            setIsMapLoaded(false);
        };
    }, [onParcelSelect]);

    return (
        <Card className="w-full h-full flex flex-col border-2 border-slate-200 rounded-xl shadow-lg text-right" dir="rtl">
            <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 shrink-0">
                <CardTitle className="text-sm flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                        <Satellite className="w-5 h-5 text-blue-400" />
                        <span className="font-bold">خريطة الأرشيف العقاري</span>
                    </div>
                </CardTitle>
            </CardHeader>

            <CardContent className="p-0 flex-1 relative bg-slate-50">
                {/* 
                    CRITICAL: Map container with explicit dimensions
                    - w-full: full width
                    - h-96: 384px height (Tailwind)
                    - min-h-[400px]: minimum 400px for mobile
                    - relative: required for Mapbox positioning
                */}
                <div className="relative w-full h-96 min-h-[400px] lg:h-[500px] z-0 shrink-0 overflow-hidden bg-white">
                    <div
                        ref={mapContainerRef}
                        className="absolute inset-0 w-full h-full"
                        style={{ width: '100%', height: '100%' }}
                    />
                </div>

                {/* Info Banner - Top Left */}
                <div className="absolute top-4 left-4 bg-white/98 backdrop-blur-sm p-4 rounded-xl shadow-xl z-[40] text-xs text-right rtl border-2 border-slate-200 max-w-[300px]">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                            <span className="text-xl">📍</span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-800 mb-1 text-sm">بحث حسب الموقع</p>
                            <p className="text-slate-600 leading-relaxed">
                                انقر على أي قطعة عقارية لتصفية الأرشيف حسب <span className="font-mono font-bold text-red-600">القسم</span> و <span className="font-mono font-bold text-red-600">مجموعة الملكية</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {!isMapLoaded && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="text-center">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                            <p className="text-slate-600 font-medium">جاري تحميل الخريطة...</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

