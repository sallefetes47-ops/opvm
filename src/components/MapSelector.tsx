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
import { Loader2, Zap, Satellite, MapPin, Plus, X } from 'lucide-react';
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

// Programmatic navigation
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

// Click handling
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

    // 1. Fetch Contracts
    const { data: contracts, isLoading, error } = useQuery({
        queryKey: ['map-contracts-stable'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('files')
                .select('id, full_name, file_number, location_lat, location_lng, permit_type')
                .not('location_lat', 'is', null)
                .not('location_lng', 'is', null);
            if (error) throw error;
            return data || [];
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

    // Handlers
    const handleMapClick = (lat: number, lng: number) => {
        // Simple console check first
        console.log(`Clicked at: ${lat}, ${lng}`);

        // If user can edit, open modal
        if (canEdit) {
            setTempCoords({ lat, lng });
            setIsAddModalOpen(true);
        }
    };

    if (error) {
        return <div className="p-4 text-red-500 bg-red-50 border border-red-200 rounded">Error loading map data: {(error as any).message}</div>;
    }

    return (
        <Card className="w-full h-full flex flex-col border-0 rounded-none shadow-none">
            <CardHeader className="bg-slate-900 text-white p-3 shrink-0">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Satellite className="w-4 h-4 text-blue-400" />
                    Satellite GIS (Stable)
                    {isLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                </CardTitle>
            </CardHeader>

            <CardContent className="p-0 flex-1 relative bg-slate-100">
                {/* 
                    CRITICAL: Explicit height wrapper. 
                    Using min-height 600px to guarantee visibility even if flex parent fails.
                */}
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

                        {/* Events and Control */}
                        <MapEvents onMapClick={handleMapClick} />
                        <MapController flyToLocation={flyToLocation} />

                        {/* Markers */}
                        {contracts?.map((c) => (
                            <Marker
                                key={c.id}
                                position={[c.location_lat!, c.location_lng!]}
                                eventHandlers={{
                                    click: (e) => {
                                        L.DomEvent.stopPropagation(e);
                                        if (onContractSelect) onContractSelect(c.id);
                                    }
                                }}
                            >
                                <Popup>
                                    <div className="font-bold">{c.full_name}</div>
                                    <div className="text-xs text-gray-500">{c.file_number}</div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>

                {/* Legend / Overlay Info */}
                <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded shadow-md z-[1000] text-xs">
                    <div className="font-bold flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-500" />
                        Live Mode
                    </div>
                    <div className="text-gray-600">Click map to add contract</div>
                </div>

            </CardContent>

            {/* Add Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Contract Location</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="text-xs bg-slate-100 p-2 rounded font-mono">
                            Lat: {tempCoords?.lat.toFixed(6)}, Lng: {tempCoords?.lng.toFixed(6)}
                        </div>
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input
                                value={contractForm.full_name}
                                onChange={(e) => setContractForm(p => ({ ...p, full_name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>File Number</Label>
                            <Input
                                value={contractForm.file_number}
                                onChange={(e) => setContractForm(p => ({ ...p, file_number: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => tempCoords && createMutation.mutate(tempCoords)}
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? "Saving..." : "Save Location"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
