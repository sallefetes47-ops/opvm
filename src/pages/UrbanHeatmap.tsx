import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flame, MapPin, TrendingUp, Building2 } from "lucide-react";

// Approximate centers of supported municipalities
const MUNICIPALITY_CENTERS: Record<string, { lat: number; lng: number; label: string }> = {
  "غرداية": { lat: 32.4843, lng: 3.6731, label: "غرداية" },
  "العطف": { lat: 32.5247, lng: 3.7350, label: "العطف" },
  "بنورة": { lat: 32.4631, lng: 3.6852, label: "بنورة" },
  "متليلي": { lat: 32.2667, lng: 3.6333, label: "متليلي" },
  "الضاية": { lat: 32.6167, lng: 3.5333, label: "الضاية بن ضحوة" },
  "ضاية بن ضحوة": { lat: 32.6167, lng: 3.5333, label: "الضاية بن ضحوة" },
};

type FileRow = {
  id: string;
  municipality: string;
  committee_opinion: string | null;
  permit_type: string | null;
  year: number | null;
  submission_date: string | null;
};

function HeatLayer({ points, radius, blur }: { points: [number, number, number][]; radius: number; blur: number }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }
    if (points.length === 0) return;
    // @ts-ignore
    layerRef.current = (L as any).heatLayer(points, {
      radius,
      blur,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.2: "#1e3a8a",
        0.4: "#0ea5e9",
        0.6: "#facc15",
        0.8: "#f97316",
        1.0: "#dc2626",
      },
    }).addTo(map);

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [map, points, radius, blur]);

  return null;
}

export default function UrbanHeatmap() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [permitFilter, setPermitFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("files")
        .select("id, municipality, committee_opinion, permit_type, year, submission_date")
        .limit(5000);
      if (!error && data) setFiles(data as FileRow[]);
      setLoading(false);
    })();
  }, []);

  const years = useMemo(() => {
    const set = new Set<number>();
    files.forEach((f) => f.year && set.add(f.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [files]);

  const permitTypes = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => f.permit_type && set.add(f.permit_type));
    return Array.from(set);
  }, [files]);

  const filtered = useMemo(() => {
    return files.filter((f) => {
      if (yearFilter !== "all" && String(f.year) !== yearFilter) return false;
      if (permitFilter !== "all" && f.permit_type !== permitFilter) return false;
      return true;
    });
  }, [files, yearFilter, permitFilter]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((f) => {
      const key = f.municipality;
      m[key] = (m[key] || 0) + 1;
    });
    return m;
  }, [filtered]);

  const maxCount = Math.max(1, ...Object.values(counts));

  // Build heat points: spread N small jittered points around each municipality center
  const heatPoints = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    Object.entries(counts).forEach(([muni, count]) => {
      const c = MUNICIPALITY_CENTERS[muni];
      if (!c) return;
      const intensity = Math.min(1, count / maxCount);
      // Distribute proportional weighted points to make heatmap density visible
      const dots = Math.min(80, Math.max(8, Math.round(count / Math.max(1, maxCount / 60))));
      for (let i = 0; i < dots; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.018; // ~2km
        pts.push([
          c.lat + Math.cos(angle) * r,
          c.lng + Math.sin(angle) * r,
          intensity,
        ]);
      }
    });
    return pts;
  }, [counts, maxCount]);

  const totals = {
    total: filtered.length,
    accepted: filtered.filter((f) => f.committee_opinion === "مقبول").length,
    rejected: filtered.filter((f) => f.committee_opinion === "مرفوض").length,
    municipalities: Object.keys(counts).length,
  };

  const center: [number, number] = [32.45, 3.65];

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <div className="flex items-center gap-3">
        <Flame className="h-7 w-7 text-orange-500" />
        <div>
          <h1 className="text-2xl font-bold">الخريطة الحرارية للتعمير</h1>
          <p className="text-sm text-muted-foreground">
            تصور كثافة ملفات التعمير حسب البلدية
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Building2 className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الملفات</p>
              <p className="text-xl font-bold">{totals.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2"><TrendingUp className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">مقبولة</p>
              <p className="text-xl font-bold">{totals.accepted}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-500/10 p-2"><TrendingUp className="h-5 w-5 text-red-600 rotate-180" /></div>
            <div>
              <p className="text-xs text-muted-foreground">مرفوضة</p>
              <p className="text-xl font-bold">{totals.rejected}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2"><MapPin className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">البلديات النشطة</p>
              <p className="text-xl font-bold">{totals.municipalities}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground mb-1 block">السنة</label>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل السنوات</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground mb-1 block">نوع الرخصة</label>
            <Select value={permitFilter} onValueChange={setPermitFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {permitTypes.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">خريطة الكثافة الحرارية</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div style={{ height: 520 }}>
              {!loading && (
                <MapContainer
                  center={center}
                  zoom={10}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
                  />
                  <HeatLayer points={heatPoints} radius={35} blur={25} />
                </MapContainer>
              )}
            </div>
            <div className="p-3 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">سلم الكثافة:</span>
              <div className="flex-1 h-3 rounded-full" style={{
                background: "linear-gradient(to right, #1e3a8a, #0ea5e9, #facc15, #f97316, #dc2626)"
              }} />
              <span className="text-muted-foreground">منخفضة → عالية</span>
            </div>
          </CardContent>
        </Card>

        {/* Density bars */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">الكثافة حسب البلدية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .map(([muni, count]) => {
                const pct = (count / maxCount) * 100;
                return (
                  <div key={muni}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{MUNICIPALITY_CENTERS[muni]?.label || muni}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(to left, #dc2626, #f97316, #facc15)`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            {Object.keys(counts).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                لا توجد بيانات لعرضها
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
