import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useOverpassBuildings } from '@/hooks/useOverpassBuildings';
import {
    GoogleMap,
    useJsApiLoader,
    Marker,
    Autocomplete,
    Polygon,
    Polyline,
    HeatmapLayer,
    OverlayView,
} from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Map as MapIcon,
    Layers,
    Search,
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

const mapContainerStyle = {
    width: '100%',
    height: '600px',
    borderRadius: '8px',
};

const center = { lat: 32.4810, lng: 3.6900 };

const libraries: ('places' | 'drawing' | 'geometry' | 'visualization')[] = [
    'places',
    'visualization',
];

/* ─────────────── 5 KSOUR DEFINITIONS ─────────────── */

interface KsarDef {
    name: string;
    nameAr: string;
    lat: number;
    lng: number;
    /** radii in degrees for inner / middle / outer rings */
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
): google.maps.LatLngLiteral[] {
    const pts: google.maps.LatLngLiteral[] = [];
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * 2 * Math.PI;
        pts.push({
            lat: cLat + radiusDeg * Math.cos(angle),
            lng: cLng + radiusDeg * Math.sin(angle) / Math.cos((cLat * Math.PI) / 180),
        });
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

const palmGroves = [
    {
        name: 'Palm Grove – Ghardaïa',
        paths: [
            { lat: 32.4870, lng: 3.6690 },
            { lat: 32.4890, lng: 3.6710 },
            { lat: 32.4895, lng: 3.6760 },
            { lat: 32.4880, lng: 3.6780 },
            { lat: 32.4860, lng: 3.6750 },
            { lat: 32.4855, lng: 3.6710 },
        ],
    },
    {
        name: 'Palm Grove – Beni Isguen',
        paths: [
            { lat: 32.4700, lng: 3.6830 },
            { lat: 32.4715, lng: 3.6860 },
            { lat: 32.4720, lng: 3.6900 },
            { lat: 32.4705, lng: 3.6910 },
            { lat: 32.4690, lng: 3.6880 },
            { lat: 32.4685, lng: 3.6845 },
        ],
    },
    {
        name: 'Palm Grove – Melika',
        paths: [
            { lat: 32.4865, lng: 3.6790 },
            { lat: 32.4878, lng: 3.6810 },
            { lat: 32.4882, lng: 3.6845 },
            { lat: 32.4870, lng: 3.6850 },
            { lat: 32.4858, lng: 3.6825 },
        ],
    },
    {
        name: 'Palm Grove – Bounoura',
        paths: [
            { lat: 32.4785, lng: 3.6890 },
            { lat: 32.4800, lng: 3.6910 },
            { lat: 32.4805, lng: 3.6955 },
            { lat: 32.4790, lng: 3.6960 },
            { lat: 32.4778, lng: 3.6930 },
        ],
    },
    {
        name: 'Palm Grove – El Atteuf',
        paths: [
            { lat: 32.4720, lng: 3.7450 },
            { lat: 32.4738, lng: 3.7470 },
            { lat: 32.4742, lng: 3.7510 },
            { lat: 32.4728, lng: 3.7520 },
            { lat: 32.4715, lng: 3.7490 },
        ],
    },
];

/* ──────────── WADI M'ZAB RIVERBED ──────────── */

const wadiPathCenter = [
    { lat: 32.4920, lng: 3.6550 },
    { lat: 32.4900, lng: 3.6650 },
    { lat: 32.4880, lng: 3.6720 },
    { lat: 32.4850, lng: 3.6780 },
    { lat: 32.4830, lng: 3.6830 },
    { lat: 32.4810, lng: 3.6880 },
    { lat: 32.4790, lng: 3.6930 },
    { lat: 32.4770, lng: 3.6980 },
    { lat: 32.4755, lng: 3.7100 },
    { lat: 32.4745, lng: 3.7250 },
    { lat: 32.4738, lng: 3.7400 },
    { lat: 32.4730, lng: 3.7520 },
];

/* ──────────── CADASTRAL SECTIONS ──────────── */

const cadastralSections = [
    {
        name: 'S1-Ghardaia',
        color: '#FFD700',
        paths: [
            { lat: 32.4890, lng: 3.6700 },
            { lat: 32.4930, lng: 3.6700 },
            { lat: 32.4930, lng: 3.6775 },
            { lat: 32.4890, lng: 3.6775 },
        ],
    },
    {
        name: 'S2-Beni Isguen',
        color: '#FFA500',
        paths: [
            { lat: 32.4700, lng: 3.6820 },
            { lat: 32.4755, lng: 3.6820 },
            { lat: 32.4755, lng: 3.6890 },
            { lat: 32.4700, lng: 3.6890 },
        ],
    },
    {
        name: 'S3-Melika',
        color: '#DAA520',
        paths: [
            { lat: 32.4870, lng: 3.6780 },
            { lat: 32.4910, lng: 3.6780 },
            { lat: 32.4910, lng: 3.6845 },
            { lat: 32.4870, lng: 3.6845 },
        ],
    },
    {
        name: 'S4-Bounoura',
        color: '#E8A317',
        paths: [
            { lat: 32.4785, lng: 3.6885 },
            { lat: 32.4835, lng: 3.6885 },
            { lat: 32.4835, lng: 3.6960 },
            { lat: 32.4785, lng: 3.6960 },
        ],
    },
    {
        name: 'S5-El Atteuf',
        color: '#CD950C',
        paths: [
            { lat: 32.4710, lng: 3.7440 },
            { lat: 32.4770, lng: 3.7440 },
            { lat: 32.4770, lng: 3.7525 },
            { lat: 32.4710, lng: 3.7525 },
        ],
    },
];

/* ──────────── URBAN EXPANSION ZONES ──────────── */

const expansionZones = [
    {
        name: 'Ghardaïa Expansion',
        paths: [
            { lat: 32.4940, lng: 3.6660 },
            { lat: 32.4970, lng: 3.6700 },
            { lat: 32.4960, lng: 3.6810 },
            { lat: 32.4920, lng: 3.6820 },
            { lat: 32.4900, lng: 3.6690 },
        ],
    },
    {
        name: 'Bounoura Expansion',
        paths: [
            { lat: 32.4840, lng: 3.6870 },
            { lat: 32.4860, lng: 3.6920 },
            { lat: 32.4850, lng: 3.6990 },
            { lat: 32.4820, lng: 3.6985 },
            { lat: 32.4815, lng: 3.6880 },
        ],
    },
    {
        name: 'El Atteuf Expansion',
        paths: [
            { lat: 32.4770, lng: 3.7440 },
            { lat: 32.4790, lng: 3.7490 },
            { lat: 32.4780, lng: 3.7560 },
            { lat: 32.4755, lng: 3.7555 },
            { lat: 32.4740, lng: 3.7480 },
        ],
    },
];

/* ──────────── HEATMAP DATA GENERATOR ──────────── */

function generateHeatmapPoints(): google.maps.LatLngLiteral[] {
    const pts: google.maps.LatLngLiteral[] = [];
    KSOUR.forEach((k) => {
        // Dense core
        for (let i = 0; i < 180; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const dist = Math.random() * k.r[0];
            pts.push({
                lat: k.lat + dist * Math.cos(angle),
                lng: k.lng + dist * Math.sin(angle) / Math.cos((k.lat * Math.PI) / 180),
            });
        }
        // Medium ring
        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const dist = k.r[0] + Math.random() * (k.r[1] - k.r[0]);
            pts.push({
                lat: k.lat + dist * Math.cos(angle),
                lng: k.lng + dist * Math.sin(angle) / Math.cos((k.lat * Math.PI) / 180),
            });
        }
        // Sparse outer
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

const heatmapGradient = [
    'rgba(255, 200, 50, 0)',
    'rgba(255, 180, 0, 0.25)',
    'rgba(255, 165, 0, 0.40)',
    'rgba(255, 140, 0, 0.50)',
    'rgba(255, 120, 0, 0.55)',
    'rgba(255, 90, 0, 0.60)',
    'rgba(255, 69, 0, 0.70)',
    'rgba(255, 40, 0, 0.75)',
    'rgba(230, 20, 0, 0.80)',
    'rgba(210, 0, 0, 0.85)',
    'rgba(180, 0, 0, 0.90)',
];

/* ──────────── BLUEPRINT GRID GENERATOR ──────────── */

function generateGridLines(
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    step: number,
) {
    const lines: { path: google.maps.LatLngLiteral[]; label?: string }[] = [];
    // Horizontal (latitude) lines
    for (let lat = Math.ceil(bounds.minLat / step) * step; lat <= bounds.maxLat; lat += step) {
        lines.push({
            path: [
                { lat, lng: bounds.minLng },
                { lat, lng: bounds.maxLng },
            ],
            label: `${lat.toFixed(3)}°N`,
        });
    }
    // Vertical (longitude) lines
    for (let lng = Math.ceil(bounds.minLng / step) * step; lng <= bounds.maxLng; lng += step) {
        lines.push({
            path: [
                { lat: bounds.minLat, lng },
                { lat: bounds.maxLat, lng },
            ],
            label: `${lng.toFixed(3)}°E`,
        });
    }
    return lines;
}

const gridBounds = { minLat: 32.460, maxLat: 32.505, minLng: 3.640, maxLng: 3.770 };
const gridLines = generateGridLines(gridBounds, 0.005);

/* ──────────── CUSTOM MAP STYLES ──────────── */

const mapStyles: google.maps.MapTypeStyle[] = [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

/* ══════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════ */

export default function MapSelector() {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries,
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [mapType, setMapType] = useState<string>('satellite');
    const [markerPos, setMarkerPos] = useState(center);
    const [address, setAddress] = useState('');

    // Layer toggles
    const [showCadastre, setShowCadastre] = useState(false);
    const [showTopography, setShowTopography] = useState(true);
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showExpansion, setShowExpansion] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [showLegend, setShowLegend] = useState(true);

    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

    // Real building data from Overpass API (with fallback to mock)
    const { buildings: realBuildings, isLoading: buildingsLoading, isRealData, count: buildingCount } = useOverpassBuildings();
    const mockData = useMemo(() => generateHeatmapPoints(), []);
    const heatmapData = isRealData && realBuildings.length > 0 ? realBuildings : mockData;

    /* ── callbacks ── */

    const onLoad = useCallback((mapInstance: google.maps.Map) => {
        setMap(mapInstance);
    }, []);

    const onUnmount = useCallback(() => {
        setMap(null);
    }, []);

    const toggleMapType = () => {
        const newType = mapType === 'roadmap' ? 'satellite' : 'roadmap';
        setMapType(newType);
        if (map) map.setMapTypeId(newType);
    };

    const onMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
        if (e.latLng) setMarkerPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    };

    const onPlaceChanged = () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.geometry?.location) {
            const newPos = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
            setMarkerPos(newPos);
            setAddress(place.formatted_address || '');
            if (map) { map.panTo(newPos); map.setZoom(15); }
        }
    };

    const goToCity = (pos: { lat: number; lng: number }) => {
        if (map) { map.panTo(pos); map.setZoom(15); setMarkerPos(pos); }
    };

    /* ── guards ── */

    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-red-50 border-2 border-dashed border-red-200 rounded-xl text-red-600 gap-4">
                <MapPin className="w-12 h-12 animate-bounce" />
                <h3 className="text-xl font-bold">خطأ في تحميل الخريطة</h3>
                <p className="text-sm text-center">يرجى التحقق من مفتاح الـ API (VITE_GOOGLE_MAPS_API_KEY) في ملف .env</p>
                <code className="bg-white p-2 text-xs rounded border">{loadError.message}</code>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-muted border-2 border-dashed rounded-xl gap-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p>جاري تحميل خريطة وادي ميزاب…</p>
            </div>
        );
    }

    const apiKeyMissing = !import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (apiKeyMissing) {
        return (
            <div className="p-10 border-2 border-yellow-400 bg-yellow-50 rounded-lg text-center shadow-lg">
                <h2 className="text-2xl font-bold text-yellow-800 mb-4">يجب إضافة مفتاح Google Maps API</h2>
                <p className="text-yellow-700 mb-6">
                    يرجى فتح ملف <code className="bg-yellow-200 px-1 rounded">.env</code> وإضافة السطر التالي:
                </p>
                <div className="bg-white p-4 font-mono text-sm border rounded mb-6 text-left">
                    VITE_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
                </div>
                <p className="text-xs text-yellow-600">هذه الخريطة مصممة خصيصاً لسهل وادي ميزاب والتخطيط العمراني.</p>
            </div>
        );
    }

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
                <div className="p-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm flex flex-wrap gap-2 items-center sticky top-0 z-20 border-b shadow-sm">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[220px]">
                        <Autocomplete
                            onLoad={(ac) => (autocompleteRef.current = ac)}
                            onPlaceChanged={onPlaceChanged}
                        >
                            <Input
                                placeholder="بحث في غرداية..."
                                className="pl-9 text-sm h-8"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            />
                        </Autocomplete>
                        <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                    </div>

                    {/* Layer toggles */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <LayerToggle active={showHeatmap} onClick={() => setShowHeatmap(!showHeatmap)} icon={<Flame className="h-3.5 w-3.5" />} label="كثافة البناء" />
                        <LayerToggle active={showCadastre} onClick={() => setShowCadastre(!showCadastre)} icon={<Layers className="h-3.5 w-3.5" />} label="المسح العقاري" />
                        <LayerToggle active={showTopography} onClick={() => setShowTopography(!showTopography)} icon={<TreePine className="h-3.5 w-3.5" />} label="الطبوغرافيا" />
                        <LayerToggle active={showExpansion} onClick={() => setShowExpansion(!showExpansion)} icon={<Expand className="h-3.5 w-3.5" />} label="التوسع العمراني" />
                        <LayerToggle active={showGrid} onClick={() => setShowGrid(!showGrid)} icon={<Grid3X3 className="h-3.5 w-3.5" />} label="الشبكة" />
                        <Button variant="outline" size="sm" onClick={toggleMapType} className="h-7 px-2 text-[10px] gap-1">
                            <Layers className="h-3.5 w-3.5" />
                            {mapType === 'roadmap' ? 'قمر صناعي' : 'خريطة'}
                        </Button>

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
                <div className="relative">
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={center}
                        zoom={13}
                        onLoad={onLoad}
                        onUnmount={onUnmount}
                        options={{
                            mapTypeId: mapType as google.maps.MapTypeId,
                            mapTypeControl: false,
                            fullscreenControl: true,
                            streetViewControl: false,
                            scaleControl: true,
                            tilt: 0,
                            rotateControl: false,
                            styles: mapType === 'roadmap' ? mapStyles : undefined,
                        }}
                    >
                        {/* Draggable position marker */}
                        <Marker
                            position={markerPos}
                            draggable
                            onDragEnd={onMarkerDragEnd}
                            icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/red-pushpin.png' }}
                        />

                        {/* ── Ksar city labels ── */}
                        {KSOUR.map((k) => (
                            <Marker
                                key={k.name}
                                position={{ lat: k.lat, lng: k.lng }}
                                label={{
                                    text: k.nameAr,
                                    color: '#fff',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    className: 'map-ksar-label',
                                }}
                                icon={{
                                    path: google.maps.SymbolPath.CIRCLE,
                                    scale: 6,
                                    fillColor: '#C4A265',
                                    fillOpacity: 0.9,
                                    strokeWeight: 2,
                                    strokeColor: '#fff',
                                }}
                            />
                        ))}

                        {/* ── Concentric Ksar rings ── */}
                        {KSOUR.map((k) =>
                            RING_STYLES.map((style, ri) => (
                                <Polygon
                                    key={`${k.name}-ring-${ri}`}
                                    paths={circlePolygon(k.lat, k.lng, k.r[ri])}
                                    options={{
                                        fillColor: style.fill,
                                        fillOpacity: style.fillOp,
                                        strokeColor: style.stroke,
                                        strokeWeight: style.strokeW,
                                        strokeOpacity: 0.7,
                                        clickable: false,
                                    }}
                                />
                            )),
                        )}

                        {/* ── Palm groves (always visible when topography on) ── */}
                        {showTopography &&
                            palmGroves.map((grove, idx) => (
                                <Polygon
                                    key={`grove-${idx}`}
                                    paths={grove.paths}
                                    options={{
                                        fillColor: '#228B22',
                                        fillOpacity: 0.35,
                                        strokeColor: '#006400',
                                        strokeWeight: 1.5,
                                        strokeOpacity: 0.8,
                                    }}
                                />
                            ))}

                        {/* ── Wadi M'zab riverbed ── */}
                        {showTopography && (
                            <>
                                {/* Wide translucent bed */}
                                <Polyline
                                    path={wadiPathCenter}
                                    options={{
                                        strokeColor: '#C2956B',
                                        strokeOpacity: 0.25,
                                        strokeWeight: 18,
                                    }}
                                />
                                {/* Center line with dashes */}
                                <Polyline
                                    path={wadiPathCenter}
                                    options={{
                                        strokeColor: '#A0784C',
                                        strokeOpacity: 0.75,
                                        strokeWeight: 3,
                                        icons: [
                                            {
                                                icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, scale: 3 },
                                                offset: '0',
                                                repeat: '14px',
                                            },
                                        ],
                                    }}
                                />
                            </>
                        )}

                        {/* ── Cadastral sections ── */}
                        {showCadastre &&
                            cadastralSections.map((section, idx) => (
                                <Polygon
                                    key={`cad-${idx}`}
                                    paths={section.paths}
                                    options={{
                                        fillColor: section.color,
                                        fillOpacity: 0.30,
                                        strokeColor: section.color,
                                        strokeWeight: 2,
                                        strokeOpacity: 0.9,
                                    }}
                                />
                            ))}

                        {/* ── Urban expansion zones ── */}
                        {showExpansion &&
                            expansionZones.map((zone, idx) => (
                                <Polygon
                                    key={`exp-${idx}`}
                                    paths={zone.paths}
                                    options={{
                                        fillColor: '#FF6B35',
                                        fillOpacity: 0.15,
                                        strokeColor: '#FF6B35',
                                        strokeWeight: 2,
                                        strokeOpacity: 0.6,
                                        strokePosition: google.maps.StrokePosition.INSIDE,
                                    }}
                                />
                            ))}

                        {/* ── Heatmap layer ── */}
                        {showHeatmap && (
                            <HeatmapLayer
                                data={heatmapData.map((p) => new google.maps.LatLng(p.lat, p.lng))}
                                options={{
                                    radius: 22,
                                    opacity: 0.55,
                                    gradient: heatmapGradient,
                                    maxIntensity: 12,
                                }}
                            />
                        )}

                        {/* ── Blueprint grid ── */}
                        {showGrid &&
                            gridLines.map((line, idx) => (
                                <Polyline
                                    key={`grid-${idx}`}
                                    path={line.path}
                                    options={{
                                        strokeColor: '#00CED1',
                                        strokeOpacity: 0.25,
                                        strokeWeight: 0.8,
                                    }}
                                />
                            ))}
                    </GoogleMap>

                    {/* ─── FLOATING LEGEND ─── */}
                    {showLegend && <MapLegend onClose={() => setShowLegend(false)} />}
                    {!showLegend && (
                        <button
                            onClick={() => setShowLegend(true)}
                            className="absolute bottom-3 left-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded shadow hover:bg-black/80 transition-colors flex items-center gap-1 z-10"
                        >
                            <Info className="h-3 w-3" /> Legend
                        </button>
                    )}
                </div>

                {/* ─── COORDINATES BAR ─── */}
                <div className="p-3 grid grid-cols-2 md:grid-cols-5 gap-3 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-800 border-t text-xs">
                    <CoordCell label="خط العرض (Lat)" value={`${markerPos.lat.toFixed(6)}°N`} />
                    <CoordCell label="خط الطول (Lng)" value={`${markerPos.lng.toFixed(6)}°E`} />
                    <CoordCell label="Datum" value="WGS 84" />
                    <CoordCell label="CRS" value="EPSG:4326" />
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground italic col-span-2 md:col-span-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>وادي ميزاب — M'zab Valley</span>
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
        { color: '#FF4500', label: 'كثافة البناء (حرارية) │ Building Density', gradient: true },
        { color: '#FFD700', label: 'أقسام المسح العقاري │ Cadastral Sections' },
        { color: '#00CED1', label: 'شبكة المخطط │ Blueprint Grid', dashed: true },
    ];

    return (
        <div className="absolute bottom-3 left-3 z-10 w-64 bg-black/80 backdrop-blur-md text-white rounded-lg shadow-2xl overflow-hidden border border-white/10 transition-all">
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
                    </div>
                </div>
            )}
        </div>
    );
}
