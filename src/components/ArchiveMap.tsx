import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl, { Map, Popup, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Satellite, Loader2 } from 'lucide-react';
import { formatPropertyGroup, formatSection } from '@/lib/cadastre';

// Ghardaia center coordinates
const GHARDAIA_CENTER: [number, number] = [3.6900, 32.4810];

// Custom OSM style for MapLibre (no token required)
const OSM_STYLE = {
    version: 8,
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
            maxzoom: 19,
        },
    ],
};

export interface ArchiveMapProps {
    onParcelSelect?: (section: string, ilot: string) => void;
}

export default function ArchiveMap({ onParcelSelect }: ArchiveMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Map | null>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [popup, setPopup] = useState<Popup | null>(null);
    const [cadastreGeoJson, setCadastreGeoJson] = useState<any>(null);

    // Load local cadastral GeoJSON data
    useEffect(() => {
        fetch('/mzab_cadastre_map.geojson')
            .then((res) => {
                if (!res.ok) throw new Error('GeoJSON not found');
                return res.json();
            })
            .then((data) => {
                console.log('[Archive Map] GeoJSON loaded:', data.features?.length || 0, 'features');
                setCadastreGeoJson(data);
            })
            .catch((err) => {
                console.error('[Archive Map] Failed to load GeoJSON:', err.message);
            });
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapContainerRef.current) return;

        // Initialize MapLibre GL map (open-source, no token required)
        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: OSM_STYLE,
            center: GHARDAIA_CENTER,
            zoom: 14,
            attributionControl: true,
        });

        // Add navigation controls
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

        mapRef.current = map;

        // Map load event
        map.on('load', () => {
            console.log('[Archive Map] Map loaded');
            setIsMapLoaded(true);

            // Add GeoJSON source for cadastral parcels
            map.addSource('cadastre-parcels', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [],
                } as GeoJSON.GeoJSON,
            });

            // Add fill layer with transparent red
            map.addLayer({
                id: 'cadastre-parcels-fill',
                type: 'fill',
                source: 'cadastre-parcels',
                paint: {
                    'fill-color': '#FF0000',
                    'fill-opacity': 0.2,
                },
            });

            // Add line layer with red outline
            map.addLayer({
                id: 'cadastre-parcels-line',
                type: 'line',
                source: 'cadastre-parcels',
                paint: {
                    'line-color': '#FF0000',
                    'line-width': 1.5,
                    'line-opacity': 1,
                },
            });

            console.log('[Archive Map] Cadastral layers added');

            // Change cursor to pointer on hover
            map.on('mouseenter', 'cadastre-parcels-fill', () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', 'cadastre-parcels-fill', () => {
                map.getCanvas().style.cursor = '';
            });

            // Handle parcel click - AUTO-FILL ARCHIVE SEARCH
            map.on('click', 'cadastre-parcels-fill', (e) => {
                console.log('[Archive Map] Parcel clicked:', e.features);

                if (!e.features || e.features.length === 0) return;

                const properties = e.features[0].properties || {};
                console.log('[Archive Map] Parcel properties:', properties);

                // Extract SECTION and ILOT from properties
                const section = formatSection(
                    properties.SECTION || properties.Section || properties.section || ''
                );
                const ilot = formatPropertyGroup(
                    properties.ILOT ||
                    properties.Ilot ||
                    properties.ilot ||
                    properties.group ||
                    ''
                );
                const commune =
                    properties.COMMUNE ||
                    properties.Commune ||
                    properties.commune ||
                    'غير متوفر';

                console.log('[Archive Map] Extracted:', { section, ilot, commune });

                // Auto-fill archive search filters
                if (onParcelSelect && section && ilot) {
                    onParcelSelect(section, ilot);
                    console.log('[Archive Map] Calling onParcelSelect with:', section, ilot);
                }

                // Show popup
                if (popup) {
                    popup.remove();
                }

                const popupContent = `
                    <div style="font-family: 'Cairo', sans-serif; padding: 8px; text-align: right; direction: rtl; min-width: 200px;">
                        <h4 style="margin: 0 0 8px 0; color: #dc2626; border-bottom: 1px solid #ccc; padding-bottom: 4px; font-size: 14px; font-weight: bold;">
                            معلومات القطعة
                        </h4>
                        <p style="margin: 4px 0; font-size: 12px;">
                            <strong>البلدية:</strong> ${commune}
                        </p>
                        <p style="margin: 4px 0; font-size: 12px;">
                            <strong>القسم:</strong> ${section || '---'}
                        </p>
                        <p style="margin: 4px 0; font-size: 12px;">
                            <strong>مجموعة الملكية:</strong> ${ilot || '---'}
                        </p>
                        <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b; font-style: italic;">
                            📋 تم تطبيق الفلتر على الأرشيف
                        </p>
                    </div>
                `;

                const newPopup = new maplibregl.Popup({
                    closeButton: true,
                    closeOnClick: false,
                    maxWidth: '250px',
                })
                    .setLngLat(e.lngLat)
                    .setHTML(popupContent)
                    .addTo(map);

                setPopup(newPopup);
            });

            // Update GeoJSON data when loaded
            if (cadastreGeoJson) {
                const source = map.getSource('cadastre-parcels') as GeoJSONSource;
                if (source) {
                    source.setData(cadastreGeoJson);
                    console.log('[Archive Map] GeoJSON data set on source');
                }
            }

            // Debug: Log errors
            map.on('error', (e) => {
                console.error('[Archive Map] Error:', e);
            });
        });

        // Cleanup function
        return () => {
            console.log('[Archive Map] Cleaning up map instance...');
            if (popup) {
                popup.remove();
            }
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            setIsMapLoaded(false);
        };
    }, [cadastreGeoJson, onParcelSelect, popup]);

    // Update GeoJSON data when it changes
    useEffect(() => {
        if (mapRef.current && isMapLoaded && cadastreGeoJson) {
            const source = mapRef.current.getSource('cadastre-parcels') as GeoJSONSource;
            if (source) {
                source.setData(cadastreGeoJson);
                console.log('[Archive Map] GeoJSON data updated');
            }
        }
    }, [cadastreGeoJson, isMapLoaded]);

    return (
        <Card className="w-full h-full flex flex-col border-0 rounded-none shadow-none text-right" dir="rtl">
            <CardHeader className="bg-slate-900 text-white p-3 shrink-0">
                <CardTitle className="text-sm flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                        <Satellite className="w-4 h-4 text-blue-400" />
                        خريطة الأرشيف
                    </div>
                </CardTitle>
            </CardHeader>

            <CardContent className="p-0 flex-1 relative bg-slate-100">
                <div className="relative w-full h-[400px] lg:h-[500px] z-0 isolate shrink-0 overflow-hidden">
                    {/* Map container with explicit dimensions */}
                    <div
                        ref={mapContainerRef}
                        style={{ width: '100%', height: '100%' }}
                        className="map-container"
                    />
                </div>

                {/* Info Banner */}
                <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg z-[40] text-xs text-right rtl border border-slate-200 max-w-[280px]">
                    <div className="flex items-start gap-2">
                        <div className="w-6 h-6 bg-red-100 rounded flex items-center justify-center shrink-0">
                            <span className="text-lg">📍</span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-700 mb-1">بحث حسب الموقع</p>
                            <p className="text-slate-600 leading-tight">
                                انقر على أي قطعة عقارية لتصفية الأرشيف حسب القسم ومجموعة الملكية
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
