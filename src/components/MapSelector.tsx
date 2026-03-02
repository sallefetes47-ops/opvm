import React, { useState, useCallback, useRef, useEffect } from 'react';
import Map, { Source, Layer, Popup, MapRef } from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Zap, Satellite, FileText, CheckCircle2, Hash } from 'lucide-react';
import { formatPropertyGroup, formatSection } from '@/lib/cadastre';
import { formatFileNumberWithYear } from '@/lib/file-number';

// MapLibre GL configuration
const MAPLIBRE_STYLE = {
    version: 8,
    sources: {
        'osm-tiles': {
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
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
        },
    ],
};

// Ghardaia center coordinates
const GHARDAIA_CENTER = {
    lng: 3.6900,
    lat: 32.4810,
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
    const mapRef = useRef<MapRef>(null);
    const [popupInfo, setPopupInfo] = useState<{
        lng: number;
        lat: number;
        properties: Record<string, unknown>;
    } | null>(null);

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

    // Handle map click for cadastre info
    const handleMapClick = useCallback((event: any) => {
        const { lngLat } = event;
        console.log('🌐 Fetching cadastre info from:', lngLat);

        // Fetch cadastre data from government API
        const apiUrl = `https://fadaeldjazair.mf.gov.dz/api/cadastre/from?get&lat=${lngLat.lat}&lng=${lngLat.lng}`;

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
                setPopupInfo({
                    lng: lngLat.lng,
                    lat: lngLat.lat,
                    properties: {
                        section: data.section || '---',
                        group: data.group || data.propertyGroup || '---',
                        ...data,
                    },
                });
            })
            .catch((error) => {
                console.error('❌ Fetch Error:', error);
                setPopupInfo({
                    lng: lngLat.lng,
                    lat: lngLat.lat,
                    properties: {
                        error: `خطأ في الاتصال: ${error.message}`,
                    },
                });
            });
    }, []);

    // Handle parcel click from vector tile
    const handleParcelClick = useCallback((event: any) => {
        if (event.features && event.features.length > 0) {
            const properties = event.features[0].properties || {};
            console.log('[MVT] Parcel clicked:', properties);

            const { lng, lat } = event.lngLat || event.point;

            setPopupInfo({
                lng,
                lat,
                properties: {
                    Commune: properties.Commune || properties.COMMUNE || '---',
                    Section: formatSection(properties.Section || properties.SECTION || '---'),
                    Ilot: formatPropertyGroup(
                        properties.Ilot || properties.ILOT || properties.group || '---'
                    ),
                    ...properties,
                },
            });
        }
    }, []);

    // Fly to location effect
    useEffect(() => {
        if (flyToLocation && mapRef.current) {
            mapRef.current.flyTo({
                center: [flyToLocation.lng, flyToLocation.lat],
                zoom: flyToLocation.zoom || 16,
                duration: 1500,
            });
        }
    }, [flyToLocation]);

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
                    <Map
                        ref={mapRef}
                        mapLib={maplibregl as any}
                        initialViewState={{
                            longitude: GHARDAIA_CENTER.lng,
                            latitude: GHARDAIA_CENTER.lat,
                            zoom: 16,
                        }}
                        style={{ width: '100%', height: '100%' }}
                        mapStyle={MAPLIBRE_STYLE as any}
                        onClick={handleMapClick}
                        interactiveLayerIds={['ghardaia-cadastre-fill', 'ghardaia-cadastre-line']}
                    >
                        {/* MVT Vector Source for Ghardaia Cadastral Parcels */}
                        <Source
                            id="ghardaia-cadastre"
                            type="vector"
                            tiles={[
                                'https://fadaeldjazair.mf.gov.dz/pm/ghardaia_ilot/{z}/{x}/{y}.mvt',
                            ]}
                            minzoom={0}
                            maxzoom={22}
                            scheme="xyz"
                        >
                            {/* Fill layer with light red color */}
                            <Layer
                                id="ghardaia-cadastre-fill"
                                type="fill"
                                source-layer="ghardaia_ilot"
                                paint={{
                                    'fill-color': '#FF0000',
                                    'fill-opacity': 0.3,
                                }}
                                onClick={handleParcelClick}
                            />

                            {/* Line layer with red outline */}
                            <Layer
                                id="ghardaia-cadastre-line"
                                type="line"
                                source-layer="ghardaia_ilot"
                                paint={{
                                    'line-color': '#FF0000',
                                    'line-width': 2,
                                    'line-opacity': 1,
                                }}
                            />
                        </Source>

                        {/* Popup for parcel info */}
                        {popupInfo && (
                            <Popup
                                anchor="top"
                                longitude={popupInfo.lng}
                                latitude={popupInfo.lat}
                                onClose={() => setPopupInfo(null)}
                                closeOnClick={false}
                                className="font-cairo"
                            >
                                <div className="text-right p-1 min-w-[200px]" dir="rtl">
                                    <h4 className="font-bold text-sm border-b pb-2 mb-2 flex items-center gap-2 bg-slate-50 p-1 rounded-t">
                                        <Satellite className="w-3 h-3 text-blue-500" />
                                        معلومات القطعة
                                    </h4>

                                    {popupInfo.properties.error ? (
                                        <div className="text-red-500 text-xs py-2 bg-red-50 p-2 rounded border border-red-100 mb-2">
                                            <p className="font-bold mb-1">تعذر الجلب</p>
                                            <p className="opacity-80 break-words">
                                                {popupInfo.properties.error}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between items-center bg-white border p-1.5 rounded">
                                                <span className="text-muted-foreground">
                                                    البلدية:
                                                </span>
                                                <span className="font-mono font-bold text-sm">
                                                    {popupInfo.properties.Commune || '---'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center bg-white border p-1.5 rounded">
                                                <span className="text-muted-foreground">
                                                    القسم (Section):
                                                </span>
                                                <span className="font-mono font-bold text-sm">
                                                    {popupInfo.properties.Section || '---'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center bg-white border p-1.5 rounded">
                                                <span className="text-muted-foreground">
                                                    مجموعة الملكية:
                                                </span>
                                                <span className="font-mono font-bold text-sm">
                                                    {popupInfo.properties.Ilot || '---'}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Popup>
                        )}
                    </Map>
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
