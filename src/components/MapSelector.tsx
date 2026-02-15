import React, { useState, useEffect } from 'react';
import {
    MapContainer, TileLayer, Marker, Popup,
    useMap, useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
    MapPin,
    Info,
    ChevronDown,
    ChevronUp,
    Plus,
    Loader2,
    X,
    Satellite,
    LandPlot,
} from 'lucide-react';

/* ─────────────────── FIX LEAFLET ICONS ─────────────────── */

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const tempIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});
const CENTER: [number, number] = [32.4810, 3.6900];

/* ─────────────────── COMPONENTS ─────────────────── */

function MapUpdater({ flyToLocation }: { flyToLocation: { lat: number; lng: number; zoom?: number } | null }) {
    const map = useMap();
    useEffect(() => {
        if (flyToLocation) {
            map.flyTo([flyToLocation.lat, flyToLocation.lng], flyToLocation.zoom || 19, { duration: 1.5 });
        }
    }, [map, flyToLocation]);
    return null;
}

interface ClickHandlerProps {
    onMapClick: (lat: number, lng: number) => void;
    onFetchCadastre: (lat: number, lng: number) => void;
    isEditMode: boolean;
}

function ClickHandler({ onMapClick, onFetchCadastre, isEditMode }: ClickHandlerProps) {
    useMapEvents({
        click(e) {
            if (isEditMode) {
                onMapClick(e.latlng.lat, e.latlng.lng);
            }
            onFetchCadastre(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

/* ─────────────────── MAIN COMPONENT ─────────────────── */

export interface MapSelectorProps {
    flyToLocation?: { lat: number; lng: number; zoom?: number } | null;
    selectedContractId?: string | null;
    onContractSelect?: (contractId: string) => void;
}

interface ContractFile {
    id: string;
    full_name: string;
    file_number: string;
    address: string;
    municipality: string;
    permit_type: string | null;
    location_lat: number | null;
    location_lng: number | null;
    year: number;
}

export default function MapSelector({ flyToLocation, selectedContractId, onContractSelect }: MapSelectorProps) {
    const { user, role, isViewer } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const canEdit = !isViewer && role !== 'viewer';

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [tempMarker, setTempMarker] = useState<{ lat: number; lng: number } | null>(null);
    const [showLegend, setShowLegend] = useState(true);

    // Cadastre
    const [cadastreData, setCadastreData] = useState<{ section: string; propertyGroup: string } | null>(null);
    const [isCadastreLoading, setIsCadastreLoading] = useState(false);
    const [cadastreModalOpen, setCadastreModalOpen] = useState(false);

    // Form
    const [formData, setFormData] = useState({
        full_name: '',
        file_number: '',
        address: '',
        municipality: 'غرداية',
        permit_type: 'رخصة بناء',
        ownership_type: 'عقد ملكية',
        year: new Date().getFullYear(),
    });

    const { data: contracts } = useQuery({
        queryKey: ['map-contracts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('files')
                .select('id, full_name, file_number, address, municipality, permit_type, location_lat, location_lng, year')
                .not('location_lat', 'is', null)
                .not('location_lng', 'is', null)
                .or('is_deleted.is.null,is_deleted.eq.false');
            if (error) throw error;
            return data as ContractFile[];
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const { error } = await supabase.from('files').insert({ ...data, created_by: user?.id });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['map-contracts'] });
            toast({ title: 'تم الحفظ بنجاح' });
            closeAddModal();
        },
        onError: (e: any) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
    });

    const fetchCadastreInfo = async (lat: number, lng: number) => {
        setIsCadastreLoading(true);
        setCadastreModalOpen(true);
        setCadastreData(null);
        try {
            await new Promise(r => setTimeout(r, 800)); // Simulate API
            setCadastreData({
                section: Math.floor(Math.random() * 50 + 1).toString(),
                propertyGroup: Math.floor(Math.random() * 200 + 100).toString(),
            });
        } catch (e) {
            setCadastreModalOpen(false);
        } finally {
            setIsCadastreLoading(false);
        }
    };

    const handleAddClick = (lat: number, lng: number) => {
        setTempMarker({ lat, lng });
        setIsAddModalOpen(true);
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setTempMarker(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (tempMarker) {
            createMutation.mutate({ ...formData, location_lat: tempMarker.lat, location_lng: tempMarker.lng });
        }
    };

    return (
        <Card className="w-full h-full flex flex-col overflow-hidden border-0">
            <CardHeader className="bg-slate-900 text-white py-3 px-4 shrink-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <Satellite className="w-4 h-4 text-blue-400" />
                    GIS Satellite + Cadastre
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 relative flex-1 min-h-0 bg-slate-100">
                {/* EXPLICIT HEIGHT CONTAINER */}
                <div style={{ height: '100%', width: '100%', minHeight: '500px' }}>
                    <MapContainer center={CENTER} zoom={16} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                            maxZoom={20}
                            attribution="Google Satellite"
                        />
                        <ClickHandler
                            onMapClick={handleAddClick}
                            onFetchCadastre={fetchCadastreInfo}
                            isEditMode={canEdit}
                        />
                        <MapUpdater flyToLocation={flyToLocation || null} />

                        {contracts?.map(c => {
                            const isSelected = selectedContractId === c.id;
                            return (
                                <Marker
                                    key={c.id}
                                    position={[c.location_lat!, c.location_lng!]}
                                    icon={getPermitIcon(c.permit_type, isSelected)}
                                    eventHandlers={{
                                        click: (e) => {
                                            L.DomEvent.stopPropagation(e);
                                            if (onContractSelect) onContractSelect(c.id);
                                        }
                                    }}
                                    zIndexOffset={isSelected ? 1000 : 0}
                                >
                                    <Popup>
                                        <div className="text-right" dir="rtl">
                                            <p className="font-bold">{c.full_name}</p>
                                            <p>{c.file_number}</p>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                        {tempMarker && <Marker position={[tempMarker.lat, tempMarker.lng]} icon={tempIcon} />}
                    </MapContainer>

                    {/* OVERLAYS */}
                    {isCadastreLoading && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-4 py-2 rounded-full flex gap-2 z-[9999]">
                            <Loader2 className="animate-spin" /> جاري التحميل...
                        </div>
                    )}
                    {showLegend && (
                        <div className="absolute bottom-4 left-4 bg-black/80 text-white p-2 rounded text-xs z-[9999]">
                            <p>انقر لجلب بيانات المسح</p>
                            <Button variant="link" className="text-white h-auto p-0 text-[10px]" onClick={() => setShowLegend(false)}>إخفاء</Button>
                        </div>
                    )}
                </div>
            </CardContent>

            {/* MODALS */}
            <Dialog open={cadastreModalOpen} onOpenChange={setCadastreModalOpen}>
                <DialogContent className="max-w-xs text-center">
                    <DialogHeader><DialogTitle>بيانات المسح</DialogTitle></DialogHeader>
                    {cadastreData ? (
                        <div className="space-y-2">
                            <p>القسم: <span className="font-bold">{cadastreData.section}</span></p>
                            <p>مجموعة الملكية: <span className="font-bold">{cadastreData.propertyGroup}</span></p>
                        </div>
                    ) : <p>جاري التحميل...</p>}
                </DialogContent>
            </Dialog>

            <Dialog open={isAddModalOpen} onOpenChange={(v) => { if (!v) closeAddModal(); }}>
                <DialogContent dir="rtl">
                    <DialogHeader><DialogTitle>إضافة عقد</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input placeholder="الاسم" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} required />
                        <Input placeholder="رقم الملف" value={formData.file_number} onChange={e => setFormData({ ...formData, file_number: e.target.value })} required />
                        <Input placeholder="العنوان" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} required />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeAddModal}>إلغاء</Button>
                            <Button type="submit">حفظ</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

const permitColors: Record<string, string> = {
    'رخصة بناء': '#3b82f6',
    'رخصة تجزئة': '#22c55e',
    'رخصة هدم': '#ef4444',
    'شهادة تقسيم': '#a855f7',
};

function getPermitIcon(permitType: string | null, isSelected: boolean = false) {
    const color = permitColors[permitType || ''] || '#f59e0b';
    const size = isSelected ? 40 : 30;

    return new L.DivIcon({
        className: 'custom-conn-marker',
        html: `<div style="background:${color}; width:${size}px; height:${size}px; border-radius:50%; border:2px solid white; box-shadow: 0 0 10px ${color}"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}
