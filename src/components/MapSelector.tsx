import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polygon, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Zap, Satellite, Plus, FileText, Calendar, Hash, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPropertyGroup, formatSection } from '@/lib/cadastre';
import { formatFileNumberWithYear } from '@/lib/file-number';
import 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// --- Fix Leaflet Default Icons (Critical) ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// --- Constants ---
const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const CENTER_POS: [number, number] = [32.4810, 3.6900];

// --- Helper Functions ---

const getColorByContractType = (type: string | null): string => {
    if (!type) return '#64748b'; // Gray
    const normalized = type.trim();
    if (normalized.includes('بناء') || normalized === 'Building Permit') return '#3b82f6'; // Blue
    if (normalized.includes('هدم') || normalized === 'Demolition') return '#ef4444'; // Red
    if (normalized.includes('تجزئة') || normalized === 'Subdivision') return '#10b981'; // Green
    if (normalized.includes('تسوية') || normalized === 'Regularization') return '#f59e0b'; // Amber
    if (normalized.includes('شهادة') || normalized.includes('تقسيم') || normalized === 'Certificate') return '#f97316'; // Orange
    return '#64748b'; // Slate (Gray)
};

const createCustomMarkerIcon = (type: string | null) => {
    const color = getColorByContractType(type);

    // Create an SVG-based icon
    return L.divIcon({
        className: 'custom-pin-icon',
        html: `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="${color}" stroke="white" stroke-width="2">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32], // Tip of the pin
        popupAnchor: [0, -34] // Above the pin
    });
};

// --- Helper Components ---

function MapController({ flyToLocation }: { flyToLocation?: { lat: number; lng: number; zoom?: number } | null }) {
    const map = useMap();
    useEffect(() => {
        if (flyToLocation) {
            map.flyTo([flyToLocation.lat, flyToLocation.lng], flyToLocation.zoom || 18, {
                animate: true,
                duration: 1.5
            });
        }
    }, [flyToLocation, map]);
    return null;
}

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

/**
 * MapLibre GL Vector Tile Layer for Ghardaia Cadastral Parcels (Ilots)
 * MVT Source: https://fadaeldjazair.mf.gov.dz/pm/ghardaia_ilot/{z}/{x}/{y}.mvt
 */
function MapLibreVectorLayer() {
    const map = useMap();
    const containerRef = useRef<HTMLDivElement>(null);
    const maplibreMapRef = useRef<maplibregl.Map | null>(null);

    useEffect(() => {
        if (!containerRef.current || !map) return;

        // Get Leaflet map container
        const leafletContainer = map.getContainer();
        const overlayContainer = document.createElement('div');
        overlayContainer.style.position = 'absolute';
        overlayContainer.style.top = '0';
        overlayContainer.style.left = '0';
        overlayContainer.style.width = '100%';
        overlayContainer.style.height = '100%';
        overlayContainer.style.pointerEvents = 'none'; // Let clicks pass through to Leaflet
        overlayContainer.style.zIndex = '400';
        leafletContainer.appendChild(overlayContainer);

        // Initialize MapLibre map synced with Leaflet
        const center = map.getCenter();
        const zoom = map.getZoom();

        const maplibreMap = new maplibregl.Map({
            container: overlayContainer,
            style: {
                version: 8,
                sources: {},
                layers: [],
            },
            center: [center.lng, center.lat],
            zoom: zoom,
            interactive: true,
            attributionControl: false,
        });

        maplibreMapRef.current = maplibreMap;

        // Add MVT source for Ghardaia cadastral parcels
        maplibreMap.on('load', () => {
            console.log('[MVT] MapLibre loaded, adding Ghardaia cadastral source...');

            maplibreMap.addSource('ghardaia-cadastre', {
                type: 'vector',
                tiles: [
                    'https://fadaeldjazair.mf.gov.dz/pm/ghardaia_ilot/{z}/{x}/{y}.mvt'
                ],
                minzoom: 0,
                maxzoom: 22,
                scheme: 'xyz',
            });

            // Add fill layer with subtle blue color
            maplibreMap.addLayer({
                id: 'ghardaia-cadastre-fill',
                type: 'fill',
                source: 'ghardaia-cadastre',
                'source-layer': 'ghardaia_ilot',
                paint: {
                    'fill-color': '#3b82f6',
                    'fill-opacity': 0.2,
                },
            });

            // Add line layer with solid border
            maplibreMap.addLayer({
                id: 'ghardaia-cadastre-line',
                type: 'line',
                source: 'ghardaia-cadastre',
                'source-layer': 'ghardaia_ilot',
                paint: {
                    'line-color': '#1e40af',
                    'line-width': 2,
                    'line-opacity': 1,
                },
            });

            console.log('[MVT] Layers added. Listening for sourcedata events...');

            // Debug: Log sourcedata events to verify source-layer name
            maplibreMap.on('sourcedata', (e) => {
                if (e.sourceId === 'ghardaia-cadastre' && e.isSourceLoaded) {
                    console.log('[MVT] Source loaded successfully:', e);
                }
                if (e.sourceId === 'ghardaia-cadastre' && e.tile) {
                    console.log('[MVT] Tile event:', e.tile.tileID, 'loaded:', e.isSourceLoaded);
                }
            });

            // Debug: Log errors
            maplibreMap.on('error', (e) => {
                console.error('[MVT] MapLibre error:', e);
            });
        });

        // Sync MapLibre view with Leaflet
        const updateMapLibreView = () => {
            if (!maplibreMapRef.current) return;
            const center = map.getCenter();
            const zoom = map.getZoom();
            const size = map.getSize();

            maplibreMapRef.current.resize();
            maplibreMapRef.current.jumpTo({
                center: [center.lng, center.lat],
                zoom: zoom,
            });

            // Update container size
            if (containerRef.current) {
                const bounds = map.getBounds();
                const topLeft = map.latLngToContainerPoint(bounds.getNorthWest());
                const bottomRight = map.latLngToContainerPoint(bounds.getSouthEast());
                containerRef.current.style.width = `${Math.abs(bottomRight.x - topLeft.x)}px`;
                containerRef.current.style.height = `${Math.abs(bottomRight.y - topLeft.y)}px`;
            }
        };

        map.on('move', updateMapLibreView);
        map.on('moveend', updateMapLibreView);
        map.on('resize', updateMapLibreView);

        // Add click interaction for parcels
        const onClick = (e: maplibregl.MapMouseEvent) => {
            if (!maplibreMapRef.current) return;

            const features = maplibreMapRef.current.queryRenderedFeatures(e.point, {
                layers: ['ghardaia-cadastre-fill'],
            });

            if (features.length > 0) {
                const props = features[0].properties;
                console.log('[MVT] Parcel clicked:', props);

                // Extract and display properties in popup
                const commune = props?.Commune || props?.COMMUNE || props?.commune || '---';
                const section = formatSection(props?.Section || props?.SECTION || props?.section || '---');
                const ilot = formatPropertyGroup(props?.Ilot || props?.ILOT || props?.ilot || props?.group || '---');

                const popupContent = `
                    <div dir="rtl" style="text-align: right; font-family: 'Cairo', sans-serif; min-width: 180px;">
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

                new maplibregl.Popup({ closeButton: true })
                    .setLngLat(e.lngLat)
                    .setHTML(popupContent)
                    .addTo(maplibreMapRef.current!);
            }
        };

        maplibreMap.on('click', 'ghardaia-cadastre-fill', onClick);

        // Change cursor on hover
        const onMouseEnter = () => {
            if (maplibreMapRef.current) {
                maplibreMapRef.current.getCanvas().style.cursor = 'pointer';
            }
        };

        const onMouseLeave = () => {
            if (maplibreMapRef.current) {
                maplibreMapRef.current.getCanvas().style.cursor = '';
            }
        };

        maplibreMap.on('mouseenter', 'ghardaia-cadastre-fill', onMouseEnter);
        maplibreMap.on('mouseleave', 'ghardaia-cadastre-fill', onMouseLeave);

        // Initial sync
        updateMapLibreView();

        // Cleanup
        return () => {
            map.off('move', updateMapLibreView);
            map.off('moveend', updateMapLibreView);
            map.off('resize', updateMapLibreView);

            if (maplibreMapRef.current) {
                maplibreMapRef.current.remove();
            }
            if (overlayContainer.parentNode) {
                overlayContainer.parentNode.removeChild(overlayContainer);
            }
        };
    }, [map]);

    return null;
}

// --- Main Component ---

export interface MapSelectorProps {
    flyToLocation?: { lat: number; lng: number; zoom?: number } | null;
    selectedContractId?: string | null;
    onContractSelect?: (contractId: string) => void;
}

export default function MapSelector({ flyToLocation, selectedContractId, onContractSelect }: MapSelectorProps) {
    const { user, role, isViewer } = useAuth();
    const canEdit = !isViewer && role !== 'viewer';
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // --- GeoJSON Cadastre Data ---
    const [cadastreGeoJson, setCadastreGeoJson] = useState<any>(null);
    useEffect(() => {
        fetch('/mzab_cadastre_map.geojson')
            .then(res => { if (!res.ok) throw new Error('GeoJSON not found'); return res.json(); })
            .then(data => setCadastreGeoJson(data))
            .catch(err => console.warn('لم يتم تحميل بيانات المسح العقاري:', err.message));
    }, []);
    const hasCadastreGeoJson = Array.isArray(cadastreGeoJson?.features) && cadastreGeoJson.features.length > 0;

    // --- STATE ---

    const [cadastreInfo, setCadastreInfo] = useState<{
        section: string;
        group: string;
        lat: number;
        lng: number;
        loading: boolean;
        error: string | null
    } | null>(null);

    // 1. Fetch Contracts
    const { data: rawContracts, isLoading, error } = useQuery({
        queryKey: ['map-contracts-safe'],
        queryFn: async () => {
            try {
                const { data, error } = await supabase.from('files').select('*');
                if (error) {
                    if (error.code === '42703') {
                        toast({ title: "Database Warning", description: "Column mismatch detected. Map running in safe mode.", variant: "destructive" });
                        return [];
                    }
                    throw error;
                }
                return data || [];
            } catch (err) {
                console.error("Fetch Error:", err);
                return [];
            }
        }
    });

    // 2. Mutations (Removed deprecated createMutation for point markers)

    // Cadastre Fetch Logic
    const handleCadastreFetch = async (lat: number, lng: number) => {
        setCadastreInfo({ section: '...', group: '...', lat, lng, loading: true, error: null });

        try {
            const apiUrl = `https://fadaeldjazair.mf.gov.dz/api/cadastre/from?get&lat=${lat}&lng=${lng}`;
            console.log("🌐 Fetching from:", apiUrl);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(apiUrl, {
                signal: controller.signal,
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            const data = await response.json();
            console.log("✅ CADASTRE_RESPONSE:", data);

            setCadastreInfo({
                section: data.section || '---',
                group: data.group || data.propertyGroup || '---',
                lat,
                lng,
                loading: false,
                error: null
            });

        } catch (error: any) {
            console.error("❌ Fetch Error:", error);
            setCadastreInfo({
                section: '',
                group: '',
                lat,
                lng,
                loading: false,
                error: `خطأ في الاتصال: ${error.message}`
            });
        }
    };

    const handleMapClick = (lat: number, lng: number) => {
        handleCadastreFetch(lat, lng);
    };

    const getCoords = (item: any): [number, number] | null => {
        const lat = item.location_lat ?? item.lat ?? item.latitude;
        const lng = item.location_lng ?? item.lng ?? item.longitude;
        if (typeof lat === 'number' && typeof lng === 'number') return [lat, lng];
        return null;
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
                {/* STRICT MAP CAGE - CRITICAL FIX */}
                <div className="relative w-full h-[500px] lg:h-[600px] z-0 isolate shrink-0 overflow-hidden">
                    <MapContainer
                        center={CENTER_POS}
                        zoom={16}
                        style={{ height: '100%', width: '100%', zIndex: 1 }}
                        scrollWheelZoom={true}
                    >
                        <TileLayer
                            attribution=""
                            url={OSM_URL}
                            maxZoom={19}
                        />

                        {/* MVT Vector Layer for Ghardaia Cadastral Parcels */}
                        <MapLibreVectorLayer />

                        {/* طبقة القطع العقارية من ملف GeoJSON */}
                        {hasCadastreGeoJson && (
                            <GeoJSON
                                key={rawContracts ? `geojson-${rawContracts.length}` : 'geojson-init'}
                                data={cadastreGeoJson}
                                style={(feature: any) => {
                                    const p = feature?.properties;
                                    const sectionStr = p?.SECTION || "";
                                    const ilotStr = p?.ILOT || p?.group || "";

                                    const section = Number(sectionStr);
                                    const ilot = Number(ilotStr);

                                    // Check if this feature has an associated contract
                                    const matchedContract = rawContracts?.find((c: any) => {
                                        const cSection = Number(c.section);
                                        const cIlot = Number(c.property_group || c.ilot);
                                        return !isNaN(section) && !isNaN(cSection) && !isNaN(ilot) && !isNaN(cIlot) &&
                                            section === cSection && ilot === cIlot;
                                    });

                                    if (matchedContract) {
                                        const contractType = (matchedContract as any).permit_type || (matchedContract as any).contract_type;
                                        const color = getColorByContractType(contractType);
                                        return {
                                            color: color,
                                            weight: 2,
                                            fillColor: color,
                                            fillOpacity: 0.6,
                                        };
                                    }

                                    // Default red style for empty parcels
                                    return {
                                        color: '#FF0000',
                                        weight: 1.5,
                                        fillColor: '#FF0000',
                                        fillOpacity: 0.05,
                                    };
                                }}
                                onEachFeature={(feature: any, layer: any) => {
                                    const p = feature?.properties;
                                    const sectionStr = p?.SECTION || "";
                                    const ilotStr = p?.ILOT || p?.group || "";

                                    const section = Number(sectionStr);
                                    const ilot = Number(ilotStr);

                                    const matchedContract = rawContracts?.find((c: any) => {
                                        const cSection = Number(c.section);
                                        const cIlot = Number(c.property_group || c.ilot);
                                        return !isNaN(section) && !isNaN(cSection) && !isNaN(ilot) && !isNaN(cIlot) &&
                                            section === cSection && ilot === cIlot;
                                    });

                                    // Add a hover tooltip if there's a contract
                                    if (matchedContract) {
                                        console.log(`✅ تم إيجاد تطابق! القسم: ${sectionStr} - القطعة: ${ilotStr} -> الملف: ${formatFileNumberWithYear(matchedContract.file_number, matchedContract.year)}`);
                                        const contractType = (matchedContract as any).permit_type || (matchedContract as any).contract_type;
                                        const color = getColorByContractType(contractType);
                                        const popupContent = `
                                            <div dir="rtl" style="text-align: right; font-family: sans-serif; min-width: 150px;">
                                                <div style="border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                                                    <strong style="color: #334155;">${matchedContract.full_name || 'بدون اسم'}</strong>
                                                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${color}; margin-right: 8px;"></span>
                                                </div>
                                                <div style="font-size: 11px; color: #475569; margin-bottom: 4px;"> رقم الملف: <strong style="color: #0f172a;">${formatFileNumberWithYear(matchedContract.file_number, matchedContract.year)}</strong></div>
                                                <div style="font-size: 11px; color: #475569;"> نوع العقد: <strong>${contractType || '---'}</strong></div>
                                            </div>
                                        `;
                                        layer.bindTooltip(popupContent, { sticky: true, opacity: 0.95 });
                                    }

                                    // Allow clicking empty parcels to log/show standard popup or add logic if needed
                                    layer.on({
                                        click: (e: any) => {
                                            if (matchedContract) {
                                                L.DomEvent.stopPropagation(e);
                                                if (onContractSelect) onContractSelect(matchedContract.id);
                                            }
                                        }
                                    });
                                }}
                            />
                        )}

                        <MapEvents onMapClick={handleMapClick} />
                        <MapController flyToLocation={flyToLocation} />

                        {/* Cadastre Info Popup */}
                        {cadastreInfo && (
                            <Popup position={[cadastreInfo.lat, cadastreInfo.lng]} eventHandlers={{ remove: () => setCadastreInfo(null) }}>
                                <div className="text-right p-1 min-w-[200px]" dir="rtl">
                                    <h4 className="font-bold text-sm border-b pb-2 mb-2 flex items-center gap-2 bg-slate-50 p-1 rounded-t">
                                        <Satellite className="w-3 h-3 text-blue-500" />
                                        بيانات المسح العقاري
                                    </h4>

                                    {cadastreInfo.loading ? (
                                        <div className="flex flex-col items-center justify-center py-4 space-y-2">
                                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                            <span className="text-xs text-muted-foreground">جاري التحليل الهندسي...</span>
                                        </div>
                                    ) : cadastreInfo.error ? (
                                        <div className="text-red-500 text-xs py-2 bg-red-50 p-2 rounded border border-red-100 mb-2">
                                            <p className="font-bold mb-1">تعذر الجلب</p>
                                            <p className="opacity-80 break-words">{cadastreInfo.error}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between items-center bg-white border p-1.5 rounded">
                                                 <span className="text-muted-foreground">القسم (Section):</span>
                                                <span className="font-mono font-bold text-sm">{formatSection(cadastreInfo.section) || cadastreInfo.section}</span>
                                             </div>
                                             <div className="flex justify-between items-center bg-white border p-1.5 rounded">
                                                 <span className="text-muted-foreground">مجموعة الملكية:</span>
                                                <span className="font-mono font-bold text-sm">{formatPropertyGroup(cadastreInfo.group) || cadastreInfo.group}</span>
                                             </div>
                                         </div>
                                     )}

                                </div>
                            </Popup>
                        )}

                        {/* Real Contracts Layer: Now handled entirely by GeoJSON overlay above. Old markers are hidden. */}
                    </MapContainer>
                </div>

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white/95 p-3 rounded-lg shadow-lg z-[40] text-xs text-right rtl border border-slate-200 backdrop-blur-sm" dir="rtl">
                    <div className="font-bold flex items-center gap-2 mb-2 text-slate-700 border-b pb-1">
                        <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        مفتاح الخريطة
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f6' }}></div>
                            <span>رخصة بناء</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }}></div>
                            <span>رخصة تجزئة</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }}></div>
                            <span>رخصة هدم</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f97316' }}></div>
                            <span>شهادة تقسيم</span>
                        </div>
                    </div>
                </div>

            </CardContent>

        </Card>
    );
}

// Sub-component for clean Popup content
function ContractPopupContent({ contract, color }: { contract: any; color: string }) {
    return (
        <div className="text-right min-w-[180px]" dir="rtl">
            <div className="border-b pb-2 mb-2 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">{contract.full_name || 'بدون اسم'}</span>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3" />
                    <span>رقم الملف: </span>
                    <span className="font-mono font-bold text-slate-900">{formatFileNumberWithYear(contract.file_number, contract.year)}</span>
                </div>

                <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>النوع: </span>
                    <span className="font-bold text-slate-900">{contract.permit_type || contract.contract_type || '---'}</span>
                </div>

                {(contract.section || contract.property_group) && (
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                        {contract.section && (
                            <div className="flex justify-between">
                                <span>القسم العقاري:</span>
                                <span className="font-mono font-bold text-slate-900">{formatSection(contract.section) || contract.section}</span>
                            </div>
                        )}
                        {contract.property_group && (
                            <div className="flex justify-between">
                                <span>مجموعة الملكية:</span>
                                <span className="font-mono font-bold text-slate-900">{formatPropertyGroup(contract.property_group) || contract.property_group}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-2">
                    <Hash className="w-3 h-3 text-slate-400" />
                    <span className="font-mono text-[10px] text-slate-400">{contract.id?.slice(0, 8)}...</span>
                </div>
            </div>
        </div>
    );
}
