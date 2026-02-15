import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polygon } from 'react-leaflet';
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

// --- Fix Leaflet Default Icons (Critical) ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// --- Constants ---
const GOOGLE_SATELLITE_URL = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
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

    // --- STATE ---
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [tempCoords, setTempCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [contractForm, setContractForm] = useState({
        full_name: '',
        file_number: '',
        year: new Date().getFullYear(),
    });

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

    // 2. Mutations
    const createMutation = useMutation({
        mutationFn: async (coords: { lat: number; lng: number }) => {
            const { error } = await supabase.from('files').insert({
                ...contractForm,
                location_lat: coords.lat,
                location_lng: coords.lng,
                created_by: user?.id
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Contract added to map" });
            queryClient.invalidateQueries({ queryKey: ['map-contracts-stable'] });
            setIsAddModalOpen(false);
            setContractForm({ full_name: '', file_number: '', year: new Date().getFullYear() });
        },
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });

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
        if (canEdit) {
            setTempCoords({ lat, lng });
        }
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
                <div style={{ height: '600px', width: '100%' }}>
                    <MapContainer
                        center={CENTER_POS}
                        zoom={16}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                    >
                        <TileLayer
                            attribution="Google Satellite"
                            url={GOOGLE_SATELLITE_URL}
                            maxZoom={20}
                        />

                        <MapEvents onMapClick={handleMapClick} />
                        <MapController flyToLocation={flyToLocation} />

                        {/* Cadastre Info Popup */}
                        {cadastreInfo && (
                            <Popup position={[cadastreInfo.lat, cadastreInfo.lng]} onClose={() => setCadastreInfo(null)}>
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
                                                <span className="font-mono font-bold text-sm">{cadastreInfo.section}</span>
                                            </div>
                                            <div className="flex justify-between items-center bg-white border p-1.5 rounded">
                                                <span className="text-muted-foreground">مجموعة الملكية:</span>
                                                <span className="font-mono font-bold text-sm">{cadastreInfo.group}</span>
                                            </div>
                                        </div>
                                    )}

                                    {canEdit && (
                                        <Button
                                            size="sm"
                                            className="w-full mt-2 h-8 text-xs font-semibold"
                                            onClick={() => setIsAddModalOpen(true)}
                                        >
                                            <Plus className="w-3 h-3 ml-1" />
                                            إضافة عقد جديد هنا
                                        </Button>
                                    )}
                                </div>
                            </Popup>
                        )}

                        {/* Real Contracts Layer: Markers Only (Phase 1) */}
                        {rawContracts?.map((c: any) => {
                            const coords = getCoords(c);
                            const contractType = c.permit_type || c.contract_type;
                            const color = getColorByContractType(contractType);

                            // Render Marker if has coordinates
                            if (coords) {
                                return (
                                    <Marker
                                        key={`marker-${c.id}`}
                                        position={coords}
                                        icon={createCustomMarkerIcon(contractType)}
                                        eventHandlers={{
                                            click: (e) => {
                                                L.DomEvent.stopPropagation(e);
                                                if (onContractSelect) onContractSelect(c.id);
                                            }
                                        }}
                                    >
                                        <Popup>
                                            <ContractPopupContent contract={c} color={color} />
                                        </Popup>
                                    </Marker>
                                );
                            }
                            return null;
                        })}

                    </MapContainer>
                </div>

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white/95 p-3 rounded-lg shadow-lg z-[1000] text-xs text-right rtl border border-slate-200 backdrop-blur-sm" dir="rtl">
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

            {/* Add Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>إضافة موقع العقد</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="text-xs bg-slate-100 p-2 rounded font-mono text-left opacity-70" dir="ltr">
                            Lat: {tempCoords?.lat.toFixed(6)}, Lng: {tempCoords?.lng.toFixed(6)}
                        </div>
                        <div className="space-y-2">
                            <Label>الاسم الكامل</Label>
                            <Input
                                value={contractForm.full_name}
                                onChange={(e) => setContractForm(p => ({ ...p, full_name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>رقم الملف</Label>
                            <Input
                                value={contractForm.file_number}
                                onChange={(e) => setContractForm(p => ({ ...p, file_number: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>إلغاء</Button>
                        <Button
                            onClick={() => tempCoords && createMutation.mutate(tempCoords)}
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? "جاري الحفظ..." : "حفظ الموقع"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
                    <span className="font-mono font-bold text-slate-900">{contract.file_number}</span>
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
                                <span className="font-mono font-bold text-slate-900">{contract.section}</span>
                            </div>
                        )}
                        {contract.property_group && (
                            <div className="flex justify-between">
                                <span>مجموعة الملكية:</span>
                                <span className="font-mono font-bold text-slate-900">{contract.property_group}</span>
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
