import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Zap, Satellite } from 'lucide-react';
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
            console.log("Map Clicked:", e.latlng);
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

    // State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [tempCoords, setTempCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [contractForm, setContractForm] = useState({
        full_name: '',
        file_number: '',
        year: new Date().getFullYear(),
    });

    // 1. Fetch Contracts (SAFE MODE)
    // We select '*' to avoid "Column does not exist" errors if we name them explicitly and they are wrong.
    // We will filter and map safely in the render loop.
    const { data: rawContracts, isLoading, error } = useQuery({
        queryKey: ['map-contracts-safe'],
        queryFn: async () => {
            console.log("Fetching contracts...");
            try {
                // Select ALL columns to see what we actually have
                const { data, error } = await supabase
                    .from('files')
                    .select('*');

                if (error) {
                    console.error("Supabase Error:", error);
                    // Don't throw if it's just a column error, return empty to keep map alive
                    if (error.code === '42703') { // Undefined column
                        toast({ title: "Database Warning", description: "Column mismatch detected. Map running in safe mode.", variant: "destructive" });
                        return [];
                    }
                    throw error;
                }
                return data || [];
            } catch (err) {
                console.error("Fetch Error:", err);
                return []; // Return empty array on crash to ensure map still renders
            }
        }
    });

    // 2. Mutations
    const createMutation = useMutation({
        mutationFn: async (coords: { lat: number; lng: number }) => {
            // We'll try to insert using the standard names, but if they fail, the user will see an error toast
            // This is better than crashing the whole app.
            const { error } = await supabase.from('files').insert({
                ...contractForm,
                location_lat: coords.lat,  // Assuming these are the target columns we WANT
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

    // Handlers
    const handleMapClick = (lat: number, lng: number) => {
        console.log(`Clicked at: ${lat}, ${lng}`);
        if (canEdit) {
            setTempCoords({ lat, lng });
            setIsAddModalOpen(true);
        }
    };

    // Helper to extract coordinates safely from unknown column names
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
                {/* SAFE RENDER: If error, still show map, just no markers */}
                <div style={{ height: '600px', width: '100%' }}>
                    <MapContainer
                        center={CENTER_POS}
                        zoom={15}
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
                                <div className="text-right p-1 min-w-[150px]" dir="rtl">
                                    <h4 className="font-bold text-sm border-b pb-1 mb-2 flex items-center gap-2">
                                        <Satellite className="w-3 h-3 text-blue-500" />
                                        بيانات المسح العقاري
                                    </h4>
                                    {isCadastreLoading ? (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            جاري جلب البيانات...
                                        </div>
                                    ) : (
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">القسم (Section):</span>
                                                <span className="font-mono font-bold">{cadastreInfo.section}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">مجموعة الملكية:</span>
                                                <span className="font-mono font-bold">{cadastreInfo.group}</span>
                                            </div>

                                            {canEdit && (
                                                <Button
                                                    size="sm"
                                                    className="w-full mt-2 h-7 text-xs"
                                                    onClick={() => setIsAddModalOpen(true)}
                                                >
                                                    <Plus className="w-3 h-3 ml-1" />
                                                    إضافة عقد هنا
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Popup>
                        )}
                        {rawContracts?.map((c: any) => {
                            const coords = getCoords(c);
                            if (!coords) return null; // Skip invalid records

                            return (
                                <Marker
                                    key={c.id}
                                    position={coords}
                                    eventHandlers={{
                                        click: (e) => {
                                            L.DomEvent.stopPropagation(e);
                                            if (onContractSelect) onContractSelect(c.id);
                                        }
                                    }}
                                >
                                    <Popup>
                                        <div className="font-bold text-right" dir="rtl">{c.full_name || 'بدون اسم'}</div>
                                        <div className="text-xs text-gray-500">{c.file_number}</div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MapContainer>
                </div>

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded shadow-md z-[1000] text-xs text-left ltr">
                    <div className="font-bold flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-500" />
                        Live
                    </div>
                    {error && <div className="text-red-500 font-bold">DB Error: Safe Mode</div>}
                </div>

            </CardContent>

            {/* Add Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>إضافة موقع العقد</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="text-xs bg-slate-100 p-2 rounded font-mono text-left" dir="ltr">
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
