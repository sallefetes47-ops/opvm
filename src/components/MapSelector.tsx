import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl, { Map, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Zap, Satellite, FileText, CheckCircle2, Hash } from 'lucide-react';
import { formatPropertyGroup, formatSection } from '@/lib/cadastre';
import { formatFileNumberWithYear } from '@/lib/file-number';

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

export interface MapSelectorProps {
    flyToLocation?: { lat: number; lng: number; zoom?: number } | null;
    selectedContractId?: string | null;
    onContractSelect?: (contractId: string) => void;
}

export default function MapSelector({
    flyToLocation,
    selectedContractId,
    onContractSelect,
}: MapSelectorProps) {
    const { user, role, isViewer } = useAuth();
    const canEdit = !isViewer && role !== 'viewer';
    const { toast } = useToast();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Map | null>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [popup, setPopup] = useState<Popup | null>(null);

    // Fetch contracts from Supabase
    const { data: rawContracts, isLoading } = useQuery({
        queryKey: ['map-contracts-safe'],
        queryFn: async () => {
            try {
                const { data, error } = await supabase.from('files').select('*');
                if (error) {
                    if (error.code === '42703') {
                        toast({
                            title: 'Database Warning',
                            description: 'Column mismatch detected. Map running in safe mode.',
                            variant: 'destructive',
                        });
                        return [];
                    }
                    throw error;
                }
                return data || [];
            } catch (err) {
                console.error('Fetch Error:', err);
                return [];
            }
        },
    });

    // Handle cadastre fetch from government API
    const handleCadastreFetch = useCallback((lat: number, lng: number) => {
        console.log('🌐 Fetching cadastre info from:', lat, lng);

        const apiUrl = `https://fadaeldjazair.mf.gov.dz/api/cadastre/from?get&lat=${lat}&lng=${lng}`;

        fetch(apiUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
        })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
                return res.json();
            })
            .then((data) => {
                console.log('✅ CADASTRE_RESPONSE:', data);

                const section = formatSection(data.section || '---');
                const group = formatPropertyGroup(data.group || data.propertyGroup || '---');

                const popupContent = `
                    <div class="popup-content" dir="rtl" style="text-align: right; font-family: 'Cairo', sans-serif; min-width: 180px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 6px;">
                            🗺️ معلومات المسح العقاري
                        </h4>
                        <div style="font-size: 12px; color: #475569;">
                            <div style="margin-bottom: 6px; display: flex; justify-content: space-between;">
                                <span style="color: #64748b;">القسم (Section):</span>
                                <span style="font-weight: 600; color: #0f172a;">${section}</span>
                            </div>
                            <div style="margin-bottom: 6px; display: flex; justify-content: space-between;">
                                <span style="color: #64748b;">مجموعة الملكية:</span>
                                <span style="font-weight: 600; color: #0f172a;">${group}</span>
                            </div>
                        </div>
                    </div>
                `;

                const newPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: false })
                    .setLngLat([lng, lat])
                    .setHTML(popupContent)
                    .addTo(mapRef.current!);

                setPopup(newPopup);
            })
            .catch((error) => {
                console.error('❌ Fetch Error:', error);

                const errorContent = `
                    <div class="popup-content" dir="rtl" style="text-align: right; font-family: 'Cairo', sans-serif;">
                        <div style="color: #dc2626; font-size: 12px; padding: 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px;">
                            <p style="font-weight: bold; margin: 0 0 4px 0;">تعذر الجلب</p>
                            <p style="margin: 0; opacity: 0.8;">${error.message}</p>
                        </div>
                    </div>
                `;

                const newPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: false })
                    .setLngLat([lng, lat])
                    .setHTML(errorContent)
                    .addTo(mapRef.current!);

                setPopup(newPopup);
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
            zoom: 16,
            attributionControl: true,
        });

        // Add navigation controls
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

        mapRef.current = map;

        // Map load event
        map.on('load', () => {
            console.log('[MapLibre] Map loaded, adding Ghardaia layers...');
            setIsMapLoaded(true);

            // ==========================================
            // LAYER 1: Cadastral Parcels (Ilots) - Bottom
            // ==========================================
            map.addSource('ghardaia-cadastre', {
                type: 'vector',
                tiles: ['https://fadaeldjazair.mf.gov.dz/pm/ghardaia_ilot/{z}/{x}/{y}.mvt'],
                minzoom: 0,
                maxzoom: 22,
                scheme: 'xyz',
            });

            // Add fill layer with transparent red
            map.addLayer({
                id: 'ghardaia-cadastre-fill',
                type: 'fill',
                source: 'ghardaia-cadastre',
                'source-layer': 'ghardaia_ilot',
                paint: {
                    'fill-color': '#FF0000',
                    'fill-opacity': 0.3,
                },
            });

            // Add line layer with red outline
            map.addLayer({
                id: 'ghardaia-cadastre-line',
                type: 'line',
                source: 'ghardaia-cadastre',
                'source-layer': 'ghardaia_ilot',
                paint: {
                    'line-color': '#FF0000',
                    'line-width': 2,
                    'line-opacity': 1,
                },
            });

            console.log('[MapLibre] Cadastral parcel (ilot) layer added');

            // ==========================================
            // LAYER 2: Buildings (Batiments) - ON TOP
            // ==========================================
            map.addSource('ghardaia-batiment-source', {
                type: 'vector',
                tiles: ['https://fadaeldjazair.mf.gov.dz/pm/ghardaia_batiment/{z}/{x}/{y}.mvt'],
                minzoom: 0,
                maxzoom: 22,
                scheme: 'xyz',
            });

            // Add fill layer for buildings (dark gray)
            map.addLayer({
                id: 'ghardaia-batiment-layer',
                type: 'fill',
                source: 'ghardaia-batiment-source',
                'source-layer': 'ghardaia_batiment',
                paint: {
                    'fill-color': '#1f2937',
                    'fill-opacity': 0.7,
                    'fill-outline-color': '#000000',
                },
            });

            console.log('[MapLibre] Building (batiment) layer added on top');

            // Change cursor to pointer on hover (ilots layer)
            map.on('mouseenter', 'ghardaia-cadastre-fill', () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', 'ghardaia-cadastre-fill', () => {
                map.getCanvas().style.cursor = '';
            });

            // Handle parcel click (ilots layer)
            map.on('click', 'ghardaia-cadastre-fill', (e) => {
                if (e.features && e.features.length > 0) {
                    const properties = e.features[0].properties || {};
                    console.log('[MapLibre] Parcel clicked:', properties);

                    const commune = properties.Commune || properties.COMMUNE || '---';
                    const section = formatSection(properties.Section || properties.SECTION || '---');
                    const ilot = formatPropertyGroup(
                        properties.Ilot || properties.ILOT || properties.group || '---'
                    );

                    const popupContent = `
                        <div class="popup-content" dir="rtl" style="text-align: right; font-family: 'Cairo', sans-serif; min-width: 180px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 6px;">
                                🗺️ معلومات القطعة
                            </h4>
                            <div style="font-size: 12px; color: #475569;">
                                <div style="margin-bottom: 6px; display: flex; justify-content: space-between;">
                                    <span style="color: #64748b;">البلدية:</span>
                                    <span style="font-weight: 600; color: #0f172a;">${commune}</span>
                                </div>
                                <div style="margin-bottom: 6px; display: flex; justify-content: space-between;">
                                    <span style="color: #64748b;">القسم:</span>
                                    <span style="font-weight: 600; color: #0f172a;">${section}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: #64748b;">مجموعة الملكية:</span>
                                    <span style="font-weight: 600; color: #0f172a;">${ilot}</span>
                                </div>
                            </div>
                        </div>
                    `;

                    // Close existing popup
                    if (popup) {
                        popup.remove();
                    }

                    const newPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: false })
                        .setLngLat(e.lngLat)
                        .setHTML(popupContent)
                        .addTo(map);

                    setPopup(newPopup);
                }
            });

            // Handle map click (for cadastre API fetch)
            map.on('click', (e) => {
                // Don't trigger if clicking on parcel layer
                const features = map.queryRenderedFeatures(e.point, {
                    layers: ['ghardaia-cadastre-fill'],
                });

                if (features.length === 0) {
                    // Close existing popup
                    if (popup) {
                        popup.remove();
                        setPopup(null);
                    }

                    // Fetch cadastre info from API
                    handleCadastreFetch(e.lngLat.lat, e.lngLat.lng);
                }
            });

            // Debug: Log source data events
            map.on('sourcedata', (e) => {
                if (e.sourceId === 'ghardaia-cadastre' && e.isSourceLoaded) {
                    console.log('[MapLibre] Cadastre source loaded:', e);
                }
                if (e.sourceId === 'ghardaia-batiment-source' && e.isSourceLoaded) {
                    console.log('[MapLibre] Building source loaded:', e);
                }
            });

            // Debug: Log errors
            map.on('error', (e) => {
                console.error('[MapLibre] Error:', e);
            });
        });

        // Cleanup function
        return () => {
            console.log('[MapLibre] Cleaning up map instance...');
            if (popup) {
                popup.remove();
            }
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            setIsMapLoaded(false);
        };
    }, [handleCadastreFetch, popup]);

    // Fly to location effect
    useEffect(() => {
        if (flyToLocation && mapRef.current && isMapLoaded) {
            mapRef.current.flyTo({
                center: [flyToLocation.lng, flyToLocation.lat],
                zoom: flyToLocation.zoom || 16,
                duration: 1500,
            });
        }
    }, [flyToLocation, isMapLoaded]);

    // Get contract color by type
    const getContractColor = (type: string | null): string => {
        if (!type) return '#64748b';
        const normalized = type.trim();
        if (normalized.includes('بناء')) return '#3b82f6';
        if (normalized.includes('هدم')) return '#ef4444';
        if (normalized.includes('تجزئة')) return '#10b981';
        if (normalized.includes('تسوية')) return '#f59e0b';
        if (normalized.includes('شهادة') || normalized.includes('تقسيم'))
            return '#f97316';
        return '#64748b';
    };

    return (
        <Card className="w-full h-full flex flex-col border-0 rounded-none shadow-none text-right" dir="rtl">
            <CardHeader className="bg-slate-900 text-white p-3 shrink-0">
                <CardTitle className="text-sm flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                        <Satellite className="w-4 h-4 text-blue-400" />
                        نظام المعلومات الجغرافية
                        {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    </div>
                </CardTitle>
            </CardHeader>

            <CardContent className="p-0 flex-1 relative bg-slate-100">
                <div className="relative w-full h-[500px] lg:h-[600px] z-0 isolate shrink-0 overflow-hidden">
                    {/* Map container with explicit dimensions */}
                    <div
                        ref={mapContainerRef}
                        style={{ width: '100%', height: '100%' }}
                        className="map-container"
                    />
                </div>

                {/* Legend */}
                <div
                    className="absolute bottom-4 left-4 bg-white/95 p-3 rounded-lg shadow-lg z-[40] text-xs text-right rtl border border-slate-200 backdrop-blur-sm"
                    dir="rtl"
                >
                    <div className="font-bold flex items-center gap-2 mb-2 text-slate-700 border-b pb-1">
                        <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        مفتاح الخريطة
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <div
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    background: '#3b82f6',
                                }}
                            ></div>
                            <span>رخصة بناء</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    background: '#10b981',
                                }}
                            ></div>
                            <span>رخصة تجزئة</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    background: '#ef4444',
                                }}
                            ></div>
                            <span>رخصة هدم</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    background: '#f97316',
                                }}
                            ></div>
                            <span>شهادة تقسيم</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                            <div
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '2px',
                                    background: '#FF0000',
                                    opacity: 0.3,
                                    border: '2px solid #FF0000',
                                }}
                            ></div>
                            <span>قطعة عقارية (إيلو)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '2px',
                                    background: '#1f2937',
                                    opacity: 0.7,
                                    border: '1px solid #000000',
                                }}
                            ></div>
                            <span>مبنى (Building)</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Sub-component for clean Popup content
function ContractPopupContent({
    contract,
    color,
}: {
    contract: any;
    color: string;
}) {
    return (
        <div className="text-right min-w-[180px]" dir="rtl">
            <div className="border-b pb-2 mb-2 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">
                    {contract.full_name || 'بدون اسم'}
                </span>
                <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                ></span>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3" />
                    <span>رقم الملف: </span>
                    <span className="font-mono font-bold text-slate-900">
                        {formatFileNumberWithYear(contract.file_number, contract.year)}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>النوع: </span>
                    <span className="font-bold text-slate-900">
                        {contract.permit_type || contract.contract_type || '---'}
                    </span>
                </div>

                {(contract.section || contract.property_group) && (
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                        {contract.section && (
                            <div className="flex justify-between">
                                <span>القسم العقاري:</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {formatSection(contract.section) || contract.section}
                                </span>
                            </div>
                        )}
                        {contract.property_group && (
                            <div className="flex justify-between">
                                <span>مجموعة الملكية:</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {formatPropertyGroup(contract.property_group) ||
                                        contract.property_group}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-2">
                    <Hash className="w-3 h-3 text-slate-400" />
                    <span className="font-mono text-[10px] text-slate-400">
                        {contract.id?.slice(0, 8)}...
                    </span>
                </div>
            </div>
        </div>
    );
}
