import React, { useState, useEffect, useMemo } from 'react';
import {
    MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MapPin, X, ChevronDown, ChevronUp } from 'lucide-react';

/* ─── Fix Leaflet default icons ─── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ─── Custom Icons ─── */

/** Red icon for the selected / active position */
const activeIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

/** Color-coded icon per permit type for existing contracts */
const permitColors: Record<string, string> = {
    'رخصة بناء': '#2563eb',
    'رخصة تجزئة': '#16a34a',
    'رخصة هدم': '#dc2626',
    'شهادة تقسيم': '#9333ea',
};

function getContractIcon(permitType: string | null) {
    const color = permitColors[permitType || ''] || '#6b7280';
    return new L.DivIcon({
        className: 'plp-contract-marker',
        html: `<div style="
            width: 18px; height: 18px; border-radius: 50%;
            background: ${color}; border: 2px solid white;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -12],
    });
}

/* ─── Constants ─── */

const DEFAULT_CENTER: [number, number] = [32.4810, 3.6900];
const MAX_BOUNDS: L.LatLngBoundsExpression = [[32.42, 3.58], [32.55, 3.80]];

/* ─── Map child: click to select location ─── */

function ClickCapture({ onCapture }: { onCapture: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onCapture(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

/* ─── Map child: flyTo on value change ─── */

function FlyToValue({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo([lat, lng], 17, { duration: 0.8 });
    }, [map, lat, lng]);
    return null;
}

/* ─── Contract type for the list ─── */

interface ContractMarker {
    id: string;
    full_name: string;
    file_number: string;
    address: string;
    permit_type: string | null;
    location_lat: number;
    location_lng: number;
}

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */

export interface PermitLocationPickerProps {
    value: { lat: number; lng: number } | null;
    onChange: (location: { lat: number; lng: number } | null) => void;
}

export default function PermitLocationPicker({ value, onChange }: PermitLocationPickerProps) {
    const [isOpen, setIsOpen] = useState(false);

    /* ── Fetch existing contracts with locations ── */
    const { data: contracts } = useQuery({
        queryKey: ['picker-contracts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('files')
                .select('id, full_name, file_number, address, permit_type, location_lat, location_lng')
                .not('location_lat', 'is', null)
                .not('location_lng', 'is', null)
                .or('is_deleted.is.null,is_deleted.eq.false')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []) as ContractMarker[];
        },
        enabled: isOpen, // only fetch when map is open
    });

    /* ── Handlers ── */

    const handleMapClick = (lat: number, lng: number) => {
        onChange({ lat, lng });
    };

    const handleRemoveLocation = () => {
        onChange(null);
    };

    const mapCenter: [number, number] = value
        ? [value.lat, value.lng]
        : DEFAULT_CENTER;

    const mapZoom = value ? 16 : 13;

    return (
        <div className="space-y-3">
            {/* ── Header label ── */}
            <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    تركيز مكان الرخصة في الخريطة
                    <span className="text-xs text-muted-foreground font-normal">(اختياري)</span>
                </Label>
                {value && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveLocation}
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    >
                        <X className="w-3 h-3 ml-1" />
                        إزالة الموقع
                    </Button>
                )}
            </div>

            {/* ── Current coordinates display ── */}
            {value && (
                <div className="flex items-center gap-3 p-2 bg-primary/5 rounded-lg border border-primary/20 text-sm">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex gap-4 font-mono text-xs">
                        <span>Lat: <strong>{value.lat.toFixed(6)}</strong></span>
                        <span>Lng: <strong>{value.lng.toFixed(6)}</strong></span>
                    </div>
                </div>
            )}

            {/* ── Toggle button ── */}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full justify-between gap-2 text-sm"
            >
                <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {value ? 'تعديل الموقع على الخريطة' : 'تحديد الموقع على الخريطة'}
                </span>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            {/* ── Map panel ── */}
            {isOpen && (
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                        انقر على الخريطة لتحديد الموقع │ النقاط الملونة = عقود موجودة
                    </p>

                    <div style={{ height: '300px', borderRadius: '8px', overflow: 'hidden' }}>
                        <MapContainer
                            center={mapCenter}
                            zoom={mapZoom}
                            scrollWheelZoom={true}
                            style={{ width: '100%', height: '100%' }}
                            zoomControl={true}
                            maxBounds={MAX_BOUNDS}
                            maxBoundsViscosity={1.0}
                            minZoom={12}
                        >
                            {/* Clean OSM base layer — no API key required */}
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />

                            {/* Click to capture coordinates */}
                            <ClickCapture onCapture={handleMapClick} />

                            {/* FlyTo on value change */}
                            {value && <FlyToValue lat={value.lat} lng={value.lng} />}

                            {/* Active selected position marker (red) */}
                            {value && (
                                <Marker position={[value.lat, value.lng]} icon={activeIcon}>
                                    <Popup>
                                        <div className="text-right text-xs" dir="rtl">
                                            <p className="font-bold">📍 الموقع المحدد</p>
                                            <p className="font-mono mt-1">{value.lat.toFixed(6)}°N, {value.lng.toFixed(6)}°E</p>
                                        </div>
                                    </Popup>
                                </Marker>
                            )}

                            {/* Existing contracts from DB (small colored dots) */}
                            {contracts?.map((c) => (
                                <Marker
                                    key={c.id}
                                    position={[c.location_lat, c.location_lng]}
                                    icon={getContractIcon(c.permit_type)}
                                >
                                    <Popup>
                                        <div className="text-right text-xs min-w-[160px]" dir="rtl">
                                            <p className="font-bold">{c.full_name}</p>
                                            <p className="text-gray-500">📁 {c.file_number}</p>
                                            <p className="text-gray-500">📍 {c.address}</p>
                                            {c.permit_type && (
                                                <span
                                                    className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[10px] text-white"
                                                    style={{ backgroundColor: permitColors[c.permit_type] || '#6b7280' }}
                                                >
                                                    {c.permit_type}
                                                </span>
                                            )}
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>

                    {/* Mini legend */}
                    <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground pt-1">
                        {Object.entries(permitColors).map(([label, color]) => (
                            <span key={label} className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                                {label}
                            </span>
                        ))}
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full inline-block bg-red-500" />
                            الموقع المحدد
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
