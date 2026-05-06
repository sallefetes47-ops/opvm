import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Satellite, Layers, Map as MapIcon } from 'lucide-react';
import {
    WMS_ENDPOINT,
    CADASTRAL_LAYERS,
} from '@/lib/fadaa-el-djazair';

// Loaded dynamically to avoid OOM during build

const CADASTRE_GEOJSON_URL = `${import.meta.env.BASE_URL}mzab_cadastre_map.json`;

// Fadaa El Djazair WMS tile URL (EPSG:3857, used by MapLibre internally)
const FADAA_WMS_TILE_URL =
    `${WMS_ENDPOINT}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=${encodeURIComponent(CADASTRAL_LAYERS.SECTIONS + ',' + CADASTRAL_LAYERS.PROPERTY_GROUPS + ',' + CADASTRAL_LAYERS.PARCELS)}` +
    `&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}`;

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


// Basemap tile providers
const BASEMAPS = {
    osm: {
        label: 'OSM',
        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
        attribution: '© OpenStreetMap contributors',
        maxzoom: 19,
    },
    google_sat: {
        label: 'Google Satellite',
        tiles: [
            'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        ],
        attribution: '© Google',
        maxzoom: 20,
    },
    google_hybrid: {
        label: 'Google Hybrid',
        tiles: [
            'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        ],
        attribution: '© Google',
        maxzoom: 20,
    },
    esri_sat: {
        label: 'OSM Satellite',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: '© Esri, Maxar, Earthstar Geographics',
        maxzoom: 19,
    },
} as const;

type BasemapKey = keyof typeof BASEMAPS;

function makeStyle(key: BasemapKey) {
    const b = BASEMAPS[key];
    return {
        version: 8 as const,
        sources: {
            basemap: {
                type: 'raster' as const,
                tiles: [...b.tiles],
                tileSize: 256,
                attribution: b.attribution,
                maxzoom: b.maxzoom,
            },
        },
        layers: [
            { id: 'basemap-layer', type: 'raster' as const, source: 'basemap', minzoom: 0 },
        ],
    };
}

export interface ArchiveMapProps {
    onParcelSelect?: (section: string, ilot: string) => void;
}

export default function ArchiveMap({ onParcelSelect }: ArchiveMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const popupRef = useRef<maplibregl.Popup | null>(null);
    const selectedFeatureIdRef = useRef<string | number | null>(null);
    const cadastreDataRef = useRef<any>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [fadaaVisible, setFadaaVisible] = useState(true);
    const [basemap, setBasemap] = useState<BasemapKey>('osm');

    // Initialize MapLibre GL map
    useEffect(() => {
        if (!mapContainerRef.current) {
            console.error('[Archive Map] Map container ref is null');
            return;
        }

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: makeStyle(basemap),
            center: GHARDAIA_CENTER,
            zoom: 14,
            maxZoom: 20,
            attributionControl: false,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        mapRef.current = map;

        const clearSelection = () => {
            if (selectedFeatureIdRef.current !== null) {
                map.setFeatureState(
                    { source: 'cadastre-parcels', id: selectedFeatureIdRef.current },
                    { selected: false },
                );
                selectedFeatureIdRef.current = null;
            }
        };

        map.on('load', () => {
            console.log('[Archive Map] ✅ Map loaded');
            setIsMapLoaded(true);

            map.addSource('cadastre-parcels', {
                type: 'geojson',
                data: ({ type: 'FeatureCollection', features: [] }) as any,
                generateId: true, // required for feature-state
            });

            // Fill: highlight selected parcel
            map.addLayer({
                id: 'cadastre-parcels-fill',
                type: 'fill',
                source: 'cadastre-parcels',
                minzoom: 0,
                maxzoom: 24,
                paint: {
                    'fill-color': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false],
                        '#dc2626', // red when selected
                        '#64748b', // slate gray default
                    ],
                    'fill-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false],
                        0.45,
                        0.25,
                    ],
                },
            });

            // Outline: thicker red when selected
            map.addLayer({
                id: 'cadastre-parcels-line',
                type: 'line',
                source: 'cadastre-parcels',
                minzoom: 0,
                maxzoom: 24,
                paint: {
                    'line-color': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false],
                        '#dc2626',
                        '#64748b',
                    ],
                    'line-width': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false],
                        3,
                        2,
                    ],
                    'line-opacity': 1,
                },
            });

            console.log('[Archive Map] ✅ Cadastral layers added');

            map.on('mouseenter', 'cadastre-parcels-fill', () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'cadastre-parcels-fill', () => {
                map.getCanvas().style.cursor = '';
            });

            map.on('click', 'cadastre-parcels-fill', (e) => {
                if (!e.features || e.features.length === 0) return;

                const feature = e.features[0];
                const properties = feature.properties || {};

                // Update selection (feature-state highlight)
                clearSelection();
                if (feature.id !== undefined && feature.id !== null) {
                    map.setFeatureState(
                        { source: 'cadastre-parcels', id: feature.id },
                        { selected: true },
                    );
                    selectedFeatureIdRef.current = feature.id;
                }

                const sectionRaw = properties.SECTION ?? properties.Section ?? properties.section ?? '';
                const ilotRaw = properties.ILOT ?? properties.Ilot ?? properties.ilot ?? properties.group ?? '';
                const communeRaw = properties.COMMUNE ?? properties.Commune ?? properties.commune ?? 'غير متوفر';

                const section = String(sectionRaw).padStart(3, '0');
                const ilot = String(ilotRaw).padStart(4, '0');
                const commune = String(communeRaw);

                if (onParcelSelect && section && ilot) {
                    onParcelSelect(section, ilot);
                }

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

                // Reuse a single pinned popup
                if (!popupRef.current) {
                    popupRef.current = new maplibregl.Popup({
                        closeButton: true,
                        closeOnClick: false,
                        closeOnMove: false,
                        maxWidth: '280px',
                    });
                    popupRef.current.on('close', () => {
                        clearSelection();
                    });
                }

                popupRef.current
                    .setLngLat(e.lngLat)
                    .setHTML(popupContent)
                    .addTo(map);
            });

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

            map.on('error', (e) => {
                console.error('[Archive Map] ❌ Error:', e);
            });
        });

        return () => {
            console.log('[Archive Map] 🧹 Cleaning up map instance...');
            if (popupRef.current) {
                popupRef.current.remove();
                popupRef.current = null;
            }
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            selectedFeatureIdRef.current = null;
            setIsMapLoaded(false);
        };
    }, [onParcelSelect]);

    // Toggle Fadaa WMS layer visibility (added on-demand to avoid CORS errors on load)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !isMapLoaded) return;

        if (fadaaVisible) {
            if (!map.getSource('fadaa-wms')) {
                map.addSource('fadaa-wms', {
                    type: 'raster',
                    tiles: [FADAA_WMS_TILE_URL],
                    tileSize: 256,
                    attribution: '© Fadaa El Djazair',
                    maxzoom: 22,
                } as any);
            }
            if (!map.getLayer('fadaa-wms-layer')) {
                // Insert above OSM but below cadastre fill
                const beforeId = map.getLayer('cadastre-parcels-fill') ? 'cadastre-parcels-fill' : undefined;
                map.addLayer({
                    id: 'fadaa-wms-layer',
                    type: 'raster',
                    source: 'fadaa-wms',
                    paint: { 'raster-opacity': 0.75 },
                }, beforeId);
            }
        } else {
            if (map.getLayer('fadaa-wms-layer')) map.removeLayer('fadaa-wms-layer');
            if (map.getSource('fadaa-wms')) map.removeSource('fadaa-wms');
        }
    }, [fadaaVisible, isMapLoaded]);

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

                {/* Fadaa WMS Toggle - Top Right */}
                <div className="absolute top-4 right-16 z-[45]">
                    <Button
                        size="sm"
                        variant={fadaaVisible ? 'default' : 'outline'}
                        onClick={() => setFadaaVisible(v => !v)}
                        className="shadow-lg gap-2 bg-white text-slate-800 hover:bg-slate-100 border-2 border-slate-200"
                        title="إظهار/إخفاء طبقة فضاء الجزائر الرسمية"
                    >
                        <Layers className="w-4 h-4" />
                        <span className="text-xs font-bold">
                            فضاء الجزائر {fadaaVisible ? '●' : '○'}
                        </span>
                    </Button>
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
                            {fadaaVisible && (
                                <p className="mt-2 text-[11px] text-emerald-700 font-semibold">
                                    ✓ طبقة فضاء الجزائر الرسمية مفعّلة
                                </p>
                            )}
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

