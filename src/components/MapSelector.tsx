import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useOverpassBuildings } from '@/hooks/useOverpassBuildings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Map as MapIcon,
    Layers,
    MapPin,
    Flame,
    TreePine,
    Grid3X3,
    ChevronDown,
    ChevronUp,
    Expand,
    Info,
} from 'lucide-react';

/* ─────────────────────── CONFIG ─────────────────────── */

const MAP_HEIGHT = '600px';

const center: [number, number] = [32.4810, 3.6900];

/* ─────────────── 5 KSOUR DEFINITIONS ─────────────── */

interface KsarDef {
    name: string;
    nameAr: string;
    lat: number;
    lng: number;
    r: [number, number, number];
    pop: string;
}

const KSOUR: KsarDef[] = [
    { name: 'Ghardaïa', nameAr: 'غرداية', lat: 32.4909, lng: 3.6738, r: [0.0025, 0.0045, 0.0072], pop: '~93 000' },
    { name: 'Beni Isguen', nameAr: 'بني يزقن', lat: 32.4727, lng: 3.6852, r: [0.0018, 0.0032, 0.0050], pop: '~11 000' },
    { name: 'Melika', nameAr: 'مليكة', lat: 32.4890, lng: 3.6810, r: [0.0015, 0.0028, 0.0042], pop: '~27 000' },
    { name: 'Bounoura', nameAr: 'بونورة', lat: 32.4810, lng: 3.6920, r: [0.0016, 0.0030, 0.0048], pop: '~35 000' },
    { name: 'El Atteuf', nameAr: 'العاطف', lat: 32.4740, lng: 3.7480, r: [0.0014, 0.0026, 0.0040], pop: '~25 000' },
];

/* ─────── helper: generate a circle polygon from center + radius ─────── */

function circlePolygon(
    cLat: number,
    cLng: number,
    radiusDeg: number,
    segments = 48,
): [number, number][] {
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

/* ──────────── CONCENTRIC RING STYLES ──────────── */

const RING_STYLES = [
    { fill: '#A0784C', fillOp: 0.40, stroke: '#7A5A30', strokeW: 2, label: 'Historic Core' },
    { fill: '#C4A265', fillOp: 0.28, stroke: '#A0784C', strokeW: 1.5, label: 'Traditional Residential' },
    { fill: '#E8D5B7', fillOp: 0.18, stroke: '#C4A265', strokeW: 1, label: 'Modern Expansion' },
];

/* ──────────── PALM GROVE / OASIS AREAS ──────────── */

const palmGroves: { name: string; paths: [number, number][] }[] = [
    {
        name: 'Palm Grove – Ghardaïa',
        paths: [
            [32.4870, 3.6690], [32.4890, 3.6710], [32.4895, 3.6760],
            [32.4880, 3.6780], [32.4860, 3.6750], [32.4855, 3.6710],
        ],
    },
    {
        name: 'Palm Grove – Beni Isguen',
        paths: [
            [32.4700, 3.6830], [32.4715, 3.6860], [32.4720, 3.6900],
            [32.4705, 3.6910], [32.4690, 3.6880], [32.4685, 3.6845],
        ],
    },
    {
        name: 'Palm Grove – Melika',
        paths: [
            [32.4865, 3.6790], [32.4878, 3.6810], [32.4882, 3.6845],
            [32.4870, 3.6850], [32.4858, 3.6825],
        ],
    },
    {
        name: 'Palm Grove – Bounoura',
        paths: [
            [32.4785, 3.6890], [32.4800, 3.6910], [32.4805, 3.6955],
            [32.4790, 3.6960], [32.4778, 3.6930],
        ],
    },
    {
        name: 'Palm Grove – El Atteuf',
        paths: [
            [32.4720, 3.7450], [32.4738, 3.7470], [32.4742, 3.7510],
            [32.4728, 3.7520], [32.4715, 3.7490],
        ],
    },
];

/* ──────────── WADI M'ZAB RIVERBED ──────────── */

const wadiPath: [number, number][] = [
    [32.4920, 3.6550], [32.4900, 3.6650], [32.4880, 3.6720],
    [32.4850, 3.6780], [32.4830, 3.6830], [32.4810, 3.6880],
    [32.4790, 3.6930], [32.4770, 3.6980], [32.4755, 3.7100],
    [32.4745, 3.7250], [32.4738, 3.7400], [32.4730, 3.7520],
];

/* ──────────── CADASTRAL SECTIONS ──────────── */

const cadastralSections: { name: string; color: string; paths: [number, number][] }[] = [
    {
        name: 'S1-Ghardaia', color: '#FFD700',
        paths: [[32.4890, 3.6700], [32.4930, 3.6700], [32.4930, 3.6775], [32.4890, 3.6775]],
    },
    {
        name: 'S2-Beni Isguen', color: '#FFA500',
        paths: [[32.4700, 3.6820], [32.4755, 3.6820], [32.4755, 3.6890], [32.4700, 3.6890]],
    },
    {
        name: 'S3-Melika', color: '#DAA520',
        paths: [[32.4870, 3.6780], [32.4910, 3.6780], [32.4910, 3.6845], [32.4870, 3.6845]],
    },
    {
        name: 'S4-Bounoura', color: '#E8A317',
        paths: [[32.4785, 3.6885], [32.4835, 3.6885], [32.4835, 3.6960], [32.4785, 3.6960]],
    },
    {
        name: 'S5-El Atteuf', color: '#CD950C',
        paths: [[32.4710, 3.7440], [32.4770, 3.7440], [32.4770, 3.7525], [32.4710, 3.7525]],
    },
];

/* ──────────── URBAN EXPANSION ZONES ──────────── */

const expansionZones: { name: string; paths: [number, number][] }[] = [
    {
        name: 'Ghardaïa Expansion',
        paths: [[32.4940, 3.6660], [32.4970, 3.6700], [32.4960, 3.6810], [32.4920, 3.6820], [32.4900, 3.6690]],
    },
    {
        name: 'Bounoura Expansion',
        paths: [[32.4840, 3.6870], [32.4860, 3.6920], [32.4850, 3.6990], [32.4820, 3.6985], [32.4815, 3.6880]],
    },
    {
        name: 'El Atteuf Expansion',
        paths: [[32.4770, 3.7440], [32.4790, 3.7490], [32.4780, 3.7560], [32.4755, 3.7555], [32.4740, 3.7480]],
    },
];

/* ──────────── HEATMAP DATA GENERATOR (MOCK) ──────────── */

function generateHeatmapPoints(): { lat: number; lng: number }[] {
    const pts: { lat: number; lng: number }[] = [];
    KSOUR.forEach((k) => {
        for (let i = 0; i < 180; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const dist = Math.random() * k.r[0];
            pts.push({
                lat: k.lat + dist * Math.cos(angle),
                lng: k.lng + dist * Math.sin(angle) / Math.cos((k.lat * Math.PI) / 180),
            });
        }
        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const dist = k.r[0] + Math.random() * (k.r[1] - k.r[0]);
            pts.push({
                lat: k.lat + dist * Math.cos(angle),
                lng: k.lng + dist * Math.sin(angle) / Math.cos((k.lat * Math.PI) / 180),
            });
        }
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const dist = k.r[1] + Math.random() * (k.r[2] - k.r[1]);
            pts.push({
                lat: k.lat + dist * Math.cos(angle),
                lng: k.lng + dist * Math.sin(angle) / Math.cos((k.lat * Math.PI) / 180),
            });
        }
    });
    return pts;
}

/* ──────────── BLUEPRINT GRID ──────────── */

function generateGridLines(
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    step: number,
) {
    const lines: { path: [number, number][] }[] = [];
    for (let lat = Math.ceil(bounds.minLat / step) * step; lat <= bounds.maxLat; lat += step) {
        lines.push({ path: [[lat, bounds.minLng], [lat, bounds.maxLng]] });
    }
    for (let lng = Math.ceil(bounds.minLng / step) * step; lng <= bounds.maxLng; lng += step) {
        lines.push({ path: [[bounds.minLat, lng], [bounds.maxLat, lng]] });
    }
    return lines;
}

const gridBounds = { minLat: 32.460, maxLat: 32.505, minLng: 3.640, maxLng: 3.770 };
const gridLines = generateGridLines(gridBounds, 0.005);

/* ══════════════════════════════════════════════════════
   MapUpdater — child component that uses useMap() for dynamic centering
   ══════════════════════════════════════════════════════ */

function MapUpdater({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
    const map = useMap();

    useEffect(() => {
        map.flyTo([lat, lng], zoom, { duration: 1.2 });
    }, [map, lat, lng, zoom]);

    return null;
}

/* ══════════════════════════════════════════════════════
   QuickNavHandler — lets the Ksar buttons programmatically pan the map
   ══════════════════════════════════════════════════════ */

function QuickNavHandler({ target }: { target: { lat: number; lng: number } | null }) {
    const map = useMap();

    useEffect(() => {
        if (target) {
            map.flyTo([target.lat, target.lng], 15, { duration: 0.8 });
        }
    }, [map, target]);

    return null;
}

/* ══════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════ */

export interface MapSelectorProps {
    /** When set, the map auto-centers on this latitude */
    focusLat?: number | null;
    /** When set, the map auto-centers on this longitude */
    focusLng?: number | null;
    /** Zoom level when focusing on a contract location (default: 17) */
    focusZoom?: number;
}

export default function MapSelector({ focusLat, focusLng, focusZoom = 17 }: MapSelectorProps = {}) {
    const isFocusMode = focusLat != null && focusLng != null;

    const effectiveCenter: [number, number] = isFocusMode
        ? [focusLat!, focusLng!]
        : center;
    const effectiveZoom = isFocusMode ? focusZoom : 13;

    // Layer toggles
    const [showCadastre, setShowCadastre] = useState(false);
    const [showTopography, setShowTopography] = useState(true);
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showExpansion, setShowExpansion] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [showLegend, setShowLegend] = useState(true);

    // Quick-nav target for Ksar buttons
    const [navTarget, setNavTarget] = useState<{ lat: number; lng: number } | null>(null);

    // Real building data from Overpass API (with fallback to mock)
    const { buildings: realBuildings, isLoading: buildingsLoading, isRealData, count: buildingCount } = useOverpassBuildings();
    const mockData = useMemo(() => generateHeatmapPoints(), []);
    const heatmapData = isRealData && realBuildings.length > 0 ? realBuildings : mockData;

    const goToCity = (pos: { lat: number; lng: number }) => {
        setNavTarget({ ...pos });
    };

    /* ══════════════════ RENDER ══════════════════ */

    return (
        <Card className="w-full mx-auto shadow-xl overflow-hidden border-0">
            {/* ─── HEADER ─── */}
            <CardHeader className="bg-gradient-to-r from-amber-900/90 to-amber-800/80 text-white py-3 px-4 border-b border-amber-700/50">
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-amber-300" />
                        <span className="text-sm font-semibold tracking-wide">
                            الخريطة العمرانية — وادي ميزاب │ M'zab Valley GIS
                        </span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                        {KSOUR.map((k) => (
                            <Button
                                key={k.name}
                                variant="ghost"
                                size="sm"
                                onClick={() => goToCity({ lat: k.lat, lng: k.lng })}
                                className="px-2 py-0.5 h-auto text-[10px] text-amber-100 hover:bg-amber-700/50 rounded"
                            >
                                {k.nameAr}
                            </Button>
                        ))}
                    </div>
                </CardTitle>
            </CardHeader>

            <CardContent className="p-0 relative">
                {/* ─── TOOLBAR ─── */}
                <div className="p-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm flex flex-wrap gap-2 items-center sticky top-0 z-[1000] border-b shadow-sm">
                    {/* Layer toggles */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <LayerToggle active={showHeatmap} onClick={() => setShowHeatmap(!showHeatmap)} icon={<Flame className="h-3.5 w-3.5" />} label="كثافة البناء" />
                        <LayerToggle active={showCadastre} onClick={() => setShowCadastre(!showCadastre)} icon={<Layers className="h-3.5 w-3.5" />} label="المسح العقاري" />
                        <LayerToggle active={showTopography} onClick={() => setShowTopography(!showTopography)} icon={<TreePine className="h-3.5 w-3.5" />} label="الطبوغرافيا" />
                        <LayerToggle active={showExpansion} onClick={() => setShowExpansion(!showExpansion)} icon={<Expand className="h-3.5 w-3.5" />} label="التوسع العمراني" />
                        <LayerToggle active={showGrid} onClick={() => setShowGrid(!showGrid)} icon={<Grid3X3 className="h-3.5 w-3.5" />} label="الشبكة" />

                        {/* Building data status badge */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium ${buildingsLoading
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : isRealData
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}>
                            {buildingsLoading ? (
                                <><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" /> جاري التحميل…</>
                            ) : isRealData ? (
                                <><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {buildingCount.toLocaleString()} مبنى OSM</>
                            ) : (
                                <><span className="w-1.5 h-1.5 rounded-full bg-zinc-400" /> بيانات تقريبية</>
                            )}
                        </span>
                    </div>
                </div>

                {/* ─── MAP ─── */}
                <div className="relative" style={{ height: MAP_HEIGHT }}>
                    <MapContainer
                        center={effectiveCenter}
                        zoom={effectiveZoom}
                        scrollWheelZoom={true}
                        style={{ width: '100%', height: '100%', borderRadius: '0 0 8px 8px' }}
                        zoomControl={true}
                    >
                        {/* OSM Tile Layer */}
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {/* Dynamic centering: pans/zooms when focus coordinates change */}
                        {isFocusMode && (
                            <MapUpdater lat={focusLat!} lng={focusLng!} zoom={focusZoom} />
                        )}

                        {/* Quick nav handler for Ksar buttons */}
                        <QuickNavHandler target={navTarget} />

                        {/* ── Concentric Ksar rings ── */}
                        {KSOUR.map((k) =>
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
                        {showTopography &&
                            palmGroves.map((grove, idx) => (
                                <Polygon
                                    key={`grove-${idx}`}
                                    positions={grove.paths}
                                    pathOptions={{
                                        fillColor: '#228B22',
                                        fillOpacity: 0.35,
                                        color: '#006400',
                                        weight: 1.5,
                                        opacity: 0.8,
                                    }}
                                />
                            ))}

                        {/* ── Wadi M'zab riverbed ── */}
                        {showTopography && (
                            <>
                                <Polyline
                                    positions={wadiPath}
                                    pathOptions={{
                                        color: '#C2956B',
                                        opacity: 0.25,
                                        weight: 18,
                                    }}
                                />
                                <Polyline
                                    positions={wadiPath}
                                    pathOptions={{
                                        color: '#A0784C',
                                        opacity: 0.75,
                                        weight: 3,
                                        dashArray: '6 8',
                                    }}
                                />
                            </>
                        )}

                        {/* ── Cadastral sections ── */}
                        {showCadastre &&
                            cadastralSections.map((section, idx) => (
                                <Polygon
                                    key={`cad-${idx}`}
                                    positions={section.paths}
                                    pathOptions={{
                                        fillColor: section.color,
                                        fillOpacity: 0.30,
                                        color: section.color,
                                        weight: 2,
                                        opacity: 0.9,
                                    }}
                                />
                            ))}

                        {/* ── Urban expansion zones ── */}
                        {showExpansion &&
                            expansionZones.map((zone, idx) => (
                                <Polygon
                                    key={`exp-${idx}`}
                                    positions={zone.paths}
                                    pathOptions={{
                                        fillColor: '#FF6B35',
                                        fillOpacity: 0.15,
                                        color: '#FF6B35',
                                        weight: 2,
                                        opacity: 0.6,
                                    }}
                                />
                            ))}

                        {/* ── Heatmap layer (CircleMarker-based) ── */}
                        {showHeatmap &&
                            heatmapData.map((pt, idx) => (
                                <CircleMarker
                                    key={`heat-${idx}`}
                                    center={[pt.lat, pt.lng]}
                                    radius={3}
                                    pathOptions={{
                                        fillColor: '#FF4500',
                                        fillOpacity: 0.25,
                                        color: '#FF4500',
                                        weight: 0,
                                        opacity: 0,
                                    }}
                                />
                            ))}

                        {/* ── Blueprint grid ── */}
                        {showGrid &&
                            gridLines.map((line, idx) => (
                                <Polyline
                                    key={`grid-${idx}`}
                                    positions={line.path}
                                    pathOptions={{
                                        color: '#00CED1',
                                        opacity: 0.25,
                                        weight: 0.8,
                                    }}
                                />
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
    );
}

/* ══════════════════ SUB-COMPONENTS ══════════════════ */

function LayerToggle({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
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
        { color: '#A0784C', label: 'النواة التاريخية │ Historic Core' },
        { color: '#C4A265', label: 'السكن التقليدي │ Traditional Residential' },
        { color: '#E8D5B7', label: 'التوسع الحديث │ Modern Expansion' },
        { color: '#228B22', label: 'واحات النخيل │ Palm Groves' },
        { color: '#A0784C', label: 'الوادي │ Wadi M\'zab', dashed: true },
        { color: '#FF6B35', label: 'منطقة التوسع العمراني │ Urban Expansion' },
        { color: '#FF4500', label: 'كثافة البناء │ Building Density', gradient: true },
        { color: '#FFD700', label: 'أقسام المسح العقاري │ Cadastral Sections' },
        { color: '#00CED1', label: 'شبكة المخطط │ Blueprint Grid', dashed: true },
    ];

    return (
        <div className="absolute bottom-3 left-3 z-[1000] w-64 bg-black/80 backdrop-blur-md text-white rounded-lg shadow-2xl overflow-hidden border border-white/10 transition-all">
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
                            {item.gradient ? (
                                <div
                                    className="w-4 h-3 rounded-sm shrink-0"
                                    style={{
                                        background: 'linear-gradient(90deg, rgba(255,165,0,0.6), rgba(255,69,0,0.8), rgba(255,0,0,0.9))',
                                    }}
                                />
                            ) : item.dashed ? (
                                <div
                                    className="w-4 h-0 shrink-0"
                                    style={{
                                        borderTop: `2px dashed ${item.color}`,
                                    }}
                                />
                            ) : (
                                <div
                                    className="w-4 h-3 rounded-sm shrink-0"
                                    style={{ backgroundColor: item.color, opacity: 0.8 }}
                                />
                            )}
                            <span className="opacity-90 leading-tight">{item.label}</span>
                        </div>
                    ))}
                    <div className="border-t border-white/10 pt-1.5 mt-1.5 text-[9px] text-white/50 space-y-0.5">
                        <p>📍 WGS 84 / EPSG:4326</p>
                        <p>Scale ≈ 1:25 000 @ zoom 13</p>
                        <p>🗺️ OpenStreetMap</p>
                    </div>
                </div>
            )}
        </div>
    );
}
