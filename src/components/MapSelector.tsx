import React, { useState, useMemo, useEffect } from 'react';
import {
    MapContainer, TileLayer, Marker, Popup, Polygon, Polyline,
    useMap, useMapEvents,
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
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    Map as MapIcon,
    Layers,
    MapPin,
    TreePine,
    Grid3X3,
    Expand,
    Info,
    ChevronDown,
    ChevronUp,
    Plus,
    Loader2,
    X,
} from 'lucide-react';

/* ─────────────────── FIX LEAFLET DEFAULT ICONS ─────────────────── */

// Fix the default marker icon issue with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ─────────────────── CUSTOM ICONS ─────────────────── */

const contractIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const tempIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

/* ─────────────────── CONFIG ─────────────────── */

const MAP_HEIGHT = '600px';
const center: [number, number] = [32.4810, 3.6900];

/* ─── MAP BOUNDS: restrict view to M'zab Valley / Ghardaia region ─── */
const MAX_BOUNDS: L.LatLngBoundsExpression = [
    [32.42, 3.58],   // SouthWest corner
    [32.55, 3.80],   // NorthEast corner
];
const MIN_ZOOM = 12;

/* ─────────────────── OVERLAY DATA ─────────────────── */

interface KsarDef {
    name: string;
    nameAr: string;
    lat: number;
    lng: number;
    r: [number, number, number];
}

const KSOUR: KsarDef[] = [
    { name: 'Ghardaïa', nameAr: 'غرداية', lat: 32.4909, lng: 3.6738, r: [0.0025, 0.0045, 0.0072] },
    { name: 'Beni Isguen', nameAr: 'بني يزقن', lat: 32.4727, lng: 3.6852, r: [0.0018, 0.0032, 0.0050] },
    { name: 'Melika', nameAr: 'مليكة', lat: 32.4890, lng: 3.6810, r: [0.0015, 0.0028, 0.0042] },
    { name: 'Bounoura', nameAr: 'بونورة', lat: 32.4810, lng: 3.6920, r: [0.0016, 0.0030, 0.0048] },
    { name: 'El Atteuf', nameAr: 'العاطف', lat: 32.4740, lng: 3.7480, r: [0.0014, 0.0026, 0.0040] },
];

function circlePolygon(cLat: number, cLng: number, radiusDeg: number, segments = 48): [number, number][] {
    const pts: [number, number][] = [];
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * 2 * Math.PI;
        pts.push([
            cLat + radiusDeg * Math.cos(angle),
            cLng + radiusDeg * Math.sin(angle) / Math.cos((cLat * Math.PI) / 180),
        ]);
    }
    return pts;
}

const RING_STYLES = [
    { fill: '#A0784C', fillOp: 0.40, stroke: '#7A5A30', strokeW: 2 },
    { fill: '#C4A265', fillOp: 0.28, stroke: '#A0784C', strokeW: 1.5 },
    { fill: '#E8D5B7', fillOp: 0.18, stroke: '#C4A265', strokeW: 1 },
];

const palmGroves: { paths: [number, number][] }[] = [
    { paths: [[32.4870, 3.6690], [32.4890, 3.6710], [32.4895, 3.6760], [32.4880, 3.6780], [32.4860, 3.6750], [32.4855, 3.6710]] },
    { paths: [[32.4700, 3.6830], [32.4715, 3.6860], [32.4720, 3.6900], [32.4705, 3.6910], [32.4690, 3.6880], [32.4685, 3.6845]] },
    { paths: [[32.4865, 3.6790], [32.4878, 3.6810], [32.4882, 3.6845], [32.4870, 3.6850], [32.4858, 3.6825]] },
    { paths: [[32.4785, 3.6890], [32.4800, 3.6910], [32.4805, 3.6955], [32.4790, 3.6960], [32.4778, 3.6930]] },
    { paths: [[32.4720, 3.7450], [32.4738, 3.7470], [32.4742, 3.7510], [32.4728, 3.7520], [32.4715, 3.7490]] },
];

const wadiPath: [number, number][] = [
    [32.4920, 3.6550], [32.4900, 3.6650], [32.4880, 3.6720],
    [32.4850, 3.6780], [32.4830, 3.6830], [32.4810, 3.6880],
    [32.4790, 3.6930], [32.4770, 3.6980], [32.4755, 3.7100],
    [32.4745, 3.7250], [32.4738, 3.7400], [32.4730, 3.7520],
];

const expansionZones: { paths: [number, number][] }[] = [
    { paths: [[32.4940, 3.6660], [32.4970, 3.6700], [32.4960, 3.6810], [32.4920, 3.6820], [32.4900, 3.6690]] },
    { paths: [[32.4840, 3.6870], [32.4860, 3.6920], [32.4850, 3.6990], [32.4820, 3.6985], [32.4815, 3.6880]] },
    { paths: [[32.4770, 3.7440], [32.4790, 3.7490], [32.4780, 3.7560], [32.4755, 3.7555], [32.4740, 3.7480]] },
];

function generateGridLines(bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }, step: number) {
    const lines: { path: [number, number][] }[] = [];
    for (let lat = Math.ceil(bounds.minLat / step) * step; lat <= bounds.maxLat; lat += step) {
        lines.push({ path: [[lat, bounds.minLng], [lat, bounds.maxLng]] });
    }
    for (let lng = Math.ceil(bounds.minLng / step) * step; lng <= bounds.maxLng; lng += step) {
        lines.push({ path: [[bounds.minLat, lng], [bounds.maxLat, lng]] });
    }
    return lines;
}

const gridLines = generateGridLines({ minLat: 32.460, maxLat: 32.505, minLng: 3.640, maxLng: 3.770 }, 0.005);

/* ═══════ MapUpdater — dynamic centering ═══════ */

function MapUpdater({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo([lat, lng], zoom, { duration: 1.2 });
    }, [map, lat, lng, zoom]);
    return null;
}

/* ═══════ ClickHandler — captures map clicks ═══════ */

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

/* ═══════ PERMIT TYPE COLORS ═══════ */

const permitColors: Record<string, string> = {
    'رخصة بناء': '#2563eb',
    'رخصة تجزئة': '#16a34a',
    'رخصة هدم': '#dc2626',
    'شهادة تقسيم': '#9333ea',
};

function getPermitIcon(permitType: string | null) {
    const color = permitColors[permitType || ''] || '#D4AF37';
    return new L.DivIcon({
        className: 'custom-contract-marker',
        html: `<div style="
            width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
            background: ${color}; border: 2px solid white;
            transform: rotate(-45deg);
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
        "><div style="
            width: 10px; height: 10px; border-radius: 50%;
            background: white; transform: rotate(45deg);
        "></div></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
    });
}

/* ══════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════ */

export interface MapSelectorProps {
    focusLat?: number | null;
    focusLng?: number | null;
    focusZoom?: number;
}

interface ContractFile {
    id: string;
    full_name: string;
    file_number: string;
    address: string;
    municipality: string;
    permit_type: string | null;
    committee_opinion: string | null;
    location_lat: number | null;
    location_lng: number | null;
    year: number;
    submission_date: string | null;
}

export default function MapSelector({ focusLat, focusLng, focusZoom = 17 }: MapSelectorProps = {}) {
    const isFocusMode = focusLat != null && focusLng != null;
    const effectiveCenter: [number, number] = isFocusMode ? [focusLat!, focusLng!] : center;
    const effectiveZoom = isFocusMode ? focusZoom : 13;

    const { user, role, isViewer } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const canEdit = !isViewer && role !== 'viewer';

    // Layer toggles — all OFF by default
    const [showTopography, setShowTopography] = useState(false);
    const [showExpansion, setShowExpansion] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [showKsarRings, setShowKsarRings] = useState(false);
    const [showLegend, setShowLegend] = useState(true);

    // Click-to-add state
    const [tempMarker, setTempMarker] = useState<{ lat: number; lng: number } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // New contract form state
    const [formData, setFormData] = useState({
        full_name: '',
        file_number: '',
        address: '',
        municipality: 'غرداية' as string,
        permit_type: 'رخصة بناء' as string,
        ownership_type: 'عقد ملكية' as string,
        year: new Date().getFullYear(),
    });

    /* ── Fetch contracts from DB ── */
    const { data: contracts, isLoading } = useQuery({
        queryKey: ['map-contracts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('files')
                .select('id, full_name, file_number, address, municipality, permit_type, committee_opinion, location_lat, location_lng, year, submission_date')
                .not('location_lat', 'is', null)
                .not('location_lng', 'is', null)
                .or('is_deleted.is.null,is_deleted.eq.false')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as ContractFile[];
        },
    });

    /* ── Create contract mutation ── */
    const createMutation = useMutation({
        mutationFn: async (data: typeof formData & { location_lat: number; location_lng: number }) => {
            const { error } = await supabase.from('files').insert({
                full_name: data.full_name,
                file_number: data.file_number,
                address: data.address,
                municipality: data.municipality as any,
                permit_type: data.permit_type as any,
                ownership_type: data.ownership_type as any,
                year: data.year,
                location_lat: data.location_lat,
                location_lng: data.location_lng,
                created_by: user?.id,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['map-contracts'] });
            toast({ title: 'تم الحفظ', description: 'تم إضافة العقد بنجاح على الخريطة' });
            closeModal();
        },
        onError: (error: any) => {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        },
    });

    /* ── Handlers ── */

    const handleMapClick = (lat: number, lng: number) => {
        if (!canEdit) return;
        setTempMarker({ lat, lng });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTempMarker(null);
        setFormData({
            full_name: '',
            file_number: '',
            address: '',
            municipality: 'غرداية',
            permit_type: 'رخصة بناء',
            ownership_type: 'عقد ملكية',
            year: new Date().getFullYear(),
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempMarker) return;
        if (!formData.full_name || !formData.file_number || !formData.address) {
            toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });
            return;
        }
        createMutation.mutate({
            ...formData,
            location_lat: tempMarker.lat,
            location_lng: tempMarker.lng,
        });
    };

    const contractCount = contracts?.length || 0;

    /* ══════════════════ RENDER ══════════════════ */

    return (
        <>
            <Card className="w-full mx-auto shadow-xl overflow-hidden border-0">
                {/* ─── HEADER ─── */}
                <CardHeader className="bg-gradient-to-r from-amber-900/90 to-amber-800/80 text-white py-3 px-4 border-b border-amber-700/50">
                    <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <MapIcon className="w-5 h-5 text-amber-300" />
                            <span className="text-sm font-semibold tracking-wide">
                                الخريطة العمرانية — وادي ميزاب │ M'zab Valley
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full">
                                {isLoading ? '...' : `${contractCount} عقد`}
                            </span>
                            {KSOUR.map((k) => (
                                <KsarButton key={k.name} ksar={k} />
                            ))}
                        </div>
                    </CardTitle>
                </CardHeader>

                <CardContent className="p-0 relative">
                    {/* ─── TOOLBAR ─── */}
                    <div className="p-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm flex flex-wrap gap-2 items-center sticky top-0 z-[1000] border-b shadow-sm">
                        <LayerToggle active={showKsarRings} onClick={() => setShowKsarRings(!showKsarRings)} icon={<Layers className="h-3.5 w-3.5" />} label="حدود القصور" />
                        <LayerToggle active={showTopography} onClick={() => setShowTopography(!showTopography)} icon={<TreePine className="h-3.5 w-3.5" />} label="الطبوغرافيا" />
                        <LayerToggle active={showExpansion} onClick={() => setShowExpansion(!showExpansion)} icon={<Expand className="h-3.5 w-3.5" />} label="التوسع العمراني" />
                        <LayerToggle active={showGrid} onClick={() => setShowGrid(!showGrid)} icon={<Grid3X3 className="h-3.5 w-3.5" />} label="الشبكة" />

                        {canEdit && (
                            <span className="text-[10px] text-muted-foreground mr-auto flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                انقر على الخريطة لإضافة عقد جديد
                            </span>
                        )}
                    </div>

                    {/* ─── MAP ─── */}
                    <div className="relative" style={{ height: MAP_HEIGHT }}>
                        <MapContainer
                            center={effectiveCenter}
                            zoom={effectiveZoom}
                            scrollWheelZoom={true}
                            style={{ width: '100%', height: '100%' }}
                            zoomControl={true}
                            maxBounds={MAX_BOUNDS}
                            maxBoundsViscosity={1.0}
                            minZoom={MIN_ZOOM}
                        >
                            {/* Clean OSM Base Layer */}
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />

                            {/* Dynamic centering */}
                            {isFocusMode && (
                                <MapUpdater lat={focusLat!} lng={focusLng!} zoom={focusZoom} />
                            )}

                            {/* Click handler for adding contracts */}
                            {canEdit && <ClickHandler onMapClick={handleMapClick} />}

                            {/* Ksar quick-nav listener */}
                            <MapFlyToListener />

                            {/* ── Contracts from DB ── */}
                            {contracts?.map((c) => (
                                <Marker
                                    key={c.id}
                                    position={[c.location_lat!, c.location_lng!]}
                                    icon={getPermitIcon(c.permit_type)}
                                >
                                    <Popup>
                                        <div className="text-right min-w-[200px]" dir="rtl">
                                            <p className="font-bold text-sm mb-1">{c.full_name}</p>
                                            <p className="text-xs text-gray-600 mb-1">📁 {c.file_number}</p>
                                            <p className="text-xs text-gray-600 mb-1">📍 {c.address}</p>
                                            <p className="text-xs text-gray-600 mb-1">🏘️ {c.municipality}</p>
                                            {c.permit_type && (
                                                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1"
                                                    style={{
                                                        backgroundColor: (permitColors[c.permit_type] || '#D4AF37') + '20',
                                                        color: permitColors[c.permit_type] || '#D4AF37',
                                                    }}
                                                >
                                                    {c.permit_type}
                                                </span>
                                            )}
                                            {c.committee_opinion && (
                                                <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1 mr-1 ${c.committee_opinion === 'رأي إيجابي'
                                                    ? 'bg-green-100 text-green-700'
                                                    : c.committee_opinion === 'مرفوض'
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {c.committee_opinion}
                                                </span>
                                            )}
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}

                            {/* ── Temporary pin for new contract ── */}
                            {tempMarker && (
                                <Marker position={[tempMarker.lat, tempMarker.lng]} icon={tempIcon} />
                            )}

                            {/* ── Ksar concentric rings ── */}
                            {showKsarRings && KSOUR.map((k) =>
                                RING_STYLES.map((style, ri) => (
                                    <Polygon
                                        key={`${k.name}-ring-${ri}`}
                                        positions={circlePolygon(k.lat, k.lng, k.r[ri])}
                                        pathOptions={{
                                            fillColor: style.fill,
                                            fillOpacity: style.fillOp,
                                            color: style.stroke,
                                            weight: style.strokeW,
                                            opacity: 0.7,
                                        }}
                                    />
                                )),
                            )}

                            {/* ── Palm groves ── */}
                            {showTopography && palmGroves.map((grove, idx) => (
                                <Polygon
                                    key={`grove-${idx}`}
                                    positions={grove.paths}
                                    pathOptions={{ fillColor: '#228B22', fillOpacity: 0.35, color: '#006400', weight: 1.5, opacity: 0.8 }}
                                />
                            ))}

                            {/* ── Wadi M'zab ── */}
                            {showTopography && (
                                <>
                                    <Polyline positions={wadiPath} pathOptions={{ color: '#C2956B', opacity: 0.25, weight: 18 }} />
                                    <Polyline positions={wadiPath} pathOptions={{ color: '#A0784C', opacity: 0.75, weight: 3, dashArray: '6 8' }} />
                                </>
                            )}

                            {/* ── Expansion zones ── */}
                            {showExpansion && expansionZones.map((zone, idx) => (
                                <Polygon
                                    key={`exp-${idx}`}
                                    positions={zone.paths}
                                    pathOptions={{ fillColor: '#FF6B35', fillOpacity: 0.15, color: '#FF6B35', weight: 2, opacity: 0.6 }}
                                />
                            ))}

                            {/* ── Grid ── */}
                            {showGrid && gridLines.map((line, idx) => (
                                <Polyline key={`grid-${idx}`} positions={line.path} pathOptions={{ color: '#00CED1', opacity: 0.25, weight: 0.8 }} />
                            ))}
                        </MapContainer>

                        {/* ─── FLOATING LEGEND ─── */}
                        {showLegend && <MapLegend onClose={() => setShowLegend(false)} />}
                        {!showLegend && (
                            <button
                                onClick={() => setShowLegend(true)}
                                className="absolute bottom-3 left-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded shadow hover:bg-black/80 transition-colors flex items-center gap-1 z-[1000]"
                            >
                                <Info className="h-3 w-3" /> Legend
                            </button>
                        )}
                    </div>

                    {/* ─── COORDINATES BAR ─── */}
                    <div className="p-3 grid grid-cols-2 md:grid-cols-5 gap-3 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-800 border-t text-xs">
                        <CoordCell label="خط العرض (Lat)" value={`${(isFocusMode ? focusLat! : effectiveCenter[0]).toFixed(6)}°N`} />
                        <CoordCell label="خط الطول (Lng)" value={`${(isFocusMode ? focusLng! : effectiveCenter[1]).toFixed(6)}°E`} />
                        <CoordCell label="Datum" value="WGS 84" />
                        <CoordCell label="CRS" value="EPSG:4326" />
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground italic col-span-2 md:col-span-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{isFocusMode ? 'موقع العقد │ Contract Location' : 'وادي ميزاب — M\'zab Valley'}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ════════ NEW CONTRACT MODAL ════════ */}
            <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
                <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" />
                            إضافة عقد تعمير جديد
                        </DialogTitle>
                    </DialogHeader>

                    {tempMarker && (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg text-xs">
                            <MapPin className="h-4 w-4 text-red-500 shrink-0" />
                            <span className="font-mono">
                                {tempMarker.lat.toFixed(6)}°N, {tempMarker.lng.toFixed(6)}°E
                            </span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>الاسم الكامل *</Label>
                                <Input
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="اسم صاحب العقد"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>رقم الملف *</Label>
                                <Input
                                    value={formData.file_number}
                                    onChange={(e) => setFormData({ ...formData, file_number: e.target.value })}
                                    placeholder="مثال: 2024/001"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>العنوان *</Label>
                            <Input
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="عنوان العقار"
                                required
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label>البلدية</Label>
                                <Select value={formData.municipality} onValueChange={(v) => setFormData({ ...formData, municipality: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="غرداية">غرداية</SelectItem>
                                        <SelectItem value="العطف">العطف</SelectItem>
                                        <SelectItem value="بونورة">بونورة</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>نوع الرخصة</Label>
                                <Select value={formData.permit_type} onValueChange={(v) => setFormData({ ...formData, permit_type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="رخصة بناء">رخصة بناء</SelectItem>
                                        <SelectItem value="رخصة تجزئة">رخصة تجزئة</SelectItem>
                                        <SelectItem value="رخصة هدم">رخصة هدم</SelectItem>
                                        <SelectItem value="شهادة تقسيم">شهادة تقسيم</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>نوع الملكية</Label>
                                <Select value={formData.ownership_type} onValueChange={(v) => setFormData({ ...formData, ownership_type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="عقد ملكية">عقد ملكية</SelectItem>
                                        <SelectItem value="دفتر عقاري">دفتر عقاري</SelectItem>
                                        <SelectItem value="شهادة إستفادة">شهادة إستفادة</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>السنة</Label>
                            <Input
                                type="number"
                                value={formData.year}
                                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                                min={2000}
                                max={2099}
                            />
                        </div>

                        <DialogFooter className="flex gap-2 justify-end">
                            <Button type="button" variant="outline" onClick={closeModal}>
                                <X className="w-4 h-4 ml-1" /> إلغاء
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending} style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                                {createMutation.isPending ? (
                                    <><Loader2 className="w-4 h-4 ml-1 animate-spin" /> جاري الحفظ...</>
                                ) : (
                                    <><Plus className="w-4 h-4 ml-1" /> إضافة العقد</>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

/* ══════════════════ SUB-COMPONENTS ══════════════════ */

function KsarButton({ ksar }: { ksar: KsarDef }) {
    const ParentMapRef = React.createContext<L.Map | null>(null);
    // This is a standalone button — we use it purely for styling.
    // The actual flyTo happens through MapUpdater via navTarget pattern, but
    // since we simplified, we wrap the buttons and use a context-free approach:
    // The button just triggers a custom event via window. The map listens.
    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => {
                window.dispatchEvent(new CustomEvent('map-fly-to', { detail: { lat: ksar.lat, lng: ksar.lng, zoom: 15 } }));
            }}
            className="px-2 py-0.5 h-auto text-[10px] text-amber-100 hover:bg-amber-700/50 rounded"
        >
            {ksar.nameAr}
        </Button>
    );
}

function MapFlyToListener() {
    const map = useMap();
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.lat && detail?.lng) {
                map.flyTo([detail.lat, detail.lng], detail.zoom || 15, { duration: 0.8 });
            }
        };
        window.addEventListener('map-fly-to', handler);
        return () => window.removeEventListener('map-fly-to', handler);
    }, [map]);
    return null;
}

function LayerToggle({ active, onClick, icon, label }: {
    active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
    return (
        <Button
            variant={active ? 'default' : 'outline'}
            size="sm"
            onClick={onClick}
            className={`h-7 px-2 text-[10px] gap-1 transition-all ${active ? 'shadow-md ring-1 ring-primary/30' : ''}`}
        >
            {icon}
            {label}
        </Button>
    );
}

function CoordCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="font-mono text-sm font-bold text-primary">{value}</p>
        </div>
    );
}

function MapLegend({ onClose }: { onClose: () => void }) {
    const [collapsed, setCollapsed] = useState(false);

    const items = [
        { color: '#2563eb', label: 'رخصة بناء │ Building Permit' },
        { color: '#16a34a', label: 'رخصة تجزئة │ Subdivision Permit' },
        { color: '#dc2626', label: 'رخصة هدم │ Demolition Permit' },
        { color: '#9333ea', label: 'شهادة تقسيم │ Division Certificate' },
        { color: '#A0784C', label: 'حدود القصور │ Ksar Boundaries' },
        { color: '#228B22', label: 'واحات النخيل │ Palm Groves' },
        { color: '#A0784C', label: 'الوادي │ Wadi M\'zab', dashed: true },
        { color: '#FF6B35', label: 'منطقة التوسع │ Expansion Zone' },
        { color: '#00CED1', label: 'شبكة المخطط │ Grid', dashed: true },
    ];

    return (
        <div className="absolute bottom-3 left-3 z-[1000] w-64 bg-black/80 backdrop-blur-md text-white rounded-lg shadow-2xl overflow-hidden border border-white/10">
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold tracking-wide hover:bg-white/5 transition-colors"
            >
                <span>📐 Legend / مفتاح الخريطة</span>
                {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {!collapsed && (
                <div className="px-3 pb-3 space-y-1.5">
                    {items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                            {item.dashed ? (
                                <div className="w-4 h-0 shrink-0" style={{ borderTop: `2px dashed ${item.color}` }} />
                            ) : (
                                <div className="w-4 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.color, opacity: 0.8 }} />
                            )}
                            <span className="opacity-90 leading-tight">{item.label}</span>
                        </div>
                    ))}
                    <div className="border-t border-white/10 pt-1.5 mt-1.5 text-[9px] text-white/50 space-y-0.5">
                        <p>📍 WGS 84 / EPSG:4326</p>
                        <p>🗺️ OpenStreetMap</p>
                    </div>
                </div>
            )}
        </div>
    );
}
