﻿﻿import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Hammer,
  LayoutGrid,
  Trash2,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { formatFileNumberWithYear } from "@/lib/file-number";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */

interface FileRecord {
  id: string;
  full_name: string;
  municipality: string;
  file_number: string;
  permit_type: string | null;
  committee_opinion: string | null;
  is_deleted: boolean | null;
  created_at: string;
}

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */

const PERMIT_COLORS: Record<string, string> = {
  "رخصة بناء": "#3b82f6",
  "رخصة تجزئة": "#10b981",
  "رخصة هدم": "#ef4444",
  "شهادة تقسيم": "#f97316",
};

const BAR_GRADIENT_ID = "barGradient";

/* ═══════════════════════════════════════════
   CUSTOM TOOLTIP
   ═══════════════════════════════════════════ */

function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg px-4 py-3 text-right" dir="rtl">
      <p className="font-bold text-sm text-slate-800 dark:text-white">{label}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        عدد العقود: <span className="font-bold text-blue-600 dark:text-blue-400">{payload[0].value}</span>
      </p>
    </div>
  );
}

function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg px-4 py-3 text-right" dir="rtl">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ background: payload[0].payload.color }} />
        <span className="font-bold text-sm text-slate-800 dark:text-white">{payload[0].name}</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        العدد: <span className="font-bold">{payload[0].value}</span>
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════
   HELPER: Pie chart custom label
   ═══════════════════════════════════════════ */

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontWeight="bold" fontSize={13}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

/* ═══════════════════════════════════════════
   KPI CARD COMPONENT
   ═══════════════════════════════════════════ */

interface KpiCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  trendIcon?: React.ReactNode;
}

function KpiCard({ title, value, subtitle, icon, gradient, trendIcon }: KpiCardProps) {
  return (
    <Card className={`relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${gradient}`}>
      {/* Decorative circles */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-white/90">{title}</CardTitle>
        <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-3xl font-black text-white tracking-tight">{value}</div>
        <div className="flex items-center gap-1 mt-1">
          {trendIcon}
          <p className="text-xs text-white/70">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ═══════════════════════════════════════════ */

export default function Dashboard() {
  /* ── Fetch ALL files (including deleted) ── */
  const { data: allFiles, isLoading } = useQuery({
    queryKey: ["dashboard-executive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FileRecord[];
    },
  });

  /* ── Computed aggregations ── */
  const stats = useMemo(() => {
    if (!allFiles) return { active: 0, demolitions: 0, subdivisions: 0, trash: 0 };
    const active = allFiles.filter((f) => !f.is_deleted);
    return {
      active: active.length,
      demolitions: active.filter((f) => f.permit_type === "رخصة هدم").length,
      subdivisions: active.filter((f) => f.permit_type === "رخصة تجزئة").length,
      trash: allFiles.filter((f) => f.is_deleted).length,
    };
  }, [allFiles]);

  const activeFiles = useMemo(() => allFiles?.filter((f) => !f.is_deleted) || [], [allFiles]);

  /* ── Municipality bar data (dynamic) ── */
  const municipalityData = useMemo(() => {
    if (!activeFiles.length) return [];
    const counts: Record<string, number> = {};
    activeFiles.forEach((f) => {
      const m = f.municipality || "غير محدد";
      counts[m] = (counts[m] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [activeFiles]);

  /* ── Permit type pie data (dynamic) ── */
  const permitTypeData = useMemo(() => {
    if (!activeFiles.length) return [];
    const counts: Record<string, number> = {};
    activeFiles.forEach((f) => {
      const t = f.permit_type || "غير محدد";
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        color: PERMIT_COLORS[name] || "#64748b",
      }))
      .sort((a, b) => b.value - a.value);
  }, [activeFiles]);

  /* ── Recent files ── */
  const recentFiles = useMemo(() => activeFiles.slice(0, 7), [activeFiles]);

  /* ── Opinion badge ── */
  const getOpinionBadge = (opinion: string | null) => {
    switch (opinion) {
      case "رأي إيجابي":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm">رأي إيجابي</Badge>;
      case "تحفظ":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm">تحفظ</Badge>;
      case "مرفوض":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 shadow-sm">مرفوض</Badge>;
      default:
        return <Badge variant="secondary" className="shadow-sm">قيد الانتظار</Badge>;
    }
  };

  /* ═══════════════ LOADING STATE ═══════════════ */
  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-500 animate-pulse" />
          <h1 className="text-2xl font-black bg-gradient-to-l from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            لوحة القيادة التنفيذية
          </h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-0 shadow-lg">
              <CardContent className="p-6">
                <Skeleton className="h-24 rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-0 shadow-lg"><CardContent className="p-6"><Skeleton className="h-[320px] rounded-xl" /></CardContent></Card>
          <Card className="border-0 shadow-lg"><CardContent className="p-6"><Skeleton className="h-[320px] rounded-xl" /></CardContent></Card>
        </div>
      </div>
    );
  }

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="space-y-6" dir="rtl">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-l from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              لوحة القيادة التنفيذية
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              نظرة شاملة على نشاط عقود التعمير
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-4 py-2 border">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>بيانات مباشرة</span>
        </div>
      </div>

      {/* ══════════ KPI SUMMARY CARDS ══════════ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="إجمالي الرخص النشطة"
          value={stats.active}
          subtitle="جميع العقود الفعّالة"
          icon={<FileText className="h-5 w-5 text-white" />}
          gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          trendIcon={<TrendingUp className="w-3 h-3 text-white/70" />}
        />
        <KpiCard
          title="رخص الهدم"
          value={stats.demolitions}
          subtitle={stats.active > 0 ? `${((stats.demolitions / stats.active) * 100).toFixed(1)}% من الإجمالي` : "0%"}
          icon={<Hammer className="h-5 w-5 text-white" />}
          gradient="bg-gradient-to-br from-red-500 to-rose-700"
          trendIcon={<TrendingDown className="w-3 h-3 text-white/70" />}
        />
        <KpiCard
          title="رخص التجزئة"
          value={stats.subdivisions}
          subtitle={stats.active > 0 ? `${((stats.subdivisions / stats.active) * 100).toFixed(1)}% من الإجمالي` : "0%"}
          icon={<LayoutGrid className="h-5 w-5 text-white" />}
          gradient="bg-gradient-to-br from-emerald-500 to-green-700"
          trendIcon={<TrendingUp className="w-3 h-3 text-white/70" />}
        />
        <KpiCard
          title="المحذوفات"
          value={stats.trash}
          subtitle="في سلة المحذوفات"
          icon={<Trash2 className="h-5 w-5 text-white" />}
          gradient="bg-gradient-to-br from-amber-500 to-orange-700"
          trendIcon={<Trash2 className="w-3 h-3 text-white/70" />}
        />
      </div>

      {/* ══════════ CHARTS ROW ══════════ */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* ── BAR CHART: Contracts by Municipality ── */}
        <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-blue-500" />
                العقود حسب البلدية
              </CardTitle>
              <span className="text-[10px] px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                {municipalityData.length} بلديات
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {municipalityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={municipalityData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id={BAR_GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={75} tick={{ fontSize: 12, fill: "hsl(var(--foreground))", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                  <Bar dataKey="count" fill={`url(#${BAR_GRADIENT_ID})`} radius={[0, 6, 6, 0]} barSize={28} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                لا توجد بيانات لعرضها
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── PIE CHART: Permit Type Distribution ── */}
        <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-emerald-500" />
                توزيع أنواع الرخص
              </CardTitle>
              <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium">
                {activeFiles.length} عقد
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {permitTypeData.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={permitTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      labelLine={false}
                      label={renderCustomLabel}
                      animationDuration={800}
                      animationBegin={200}
                    >
                      {permitTypeData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke="transparent"
                          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Custom Legend */}
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                  {permitTypeData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                      <div className="w-3 h-3 rounded-sm shadow-sm" style={{ background: entry.color }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-bold text-foreground">({entry.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                لا توجد بيانات لعرضها
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ══════════ RECENT FILES TABLE ══════════ */}
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-violet-500" />
              آخر الملفات المسجلة
            </CardTitle>
            <span className="text-[10px] px-2 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-medium">
              آخر {recentFiles.length} ملفات
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {recentFiles.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-bold text-xs">رقم الملف</TableHead>
                    <TableHead className="font-bold text-xs">الاسم الكامل</TableHead>
                    <TableHead className="font-bold text-xs">البلدية</TableHead>
                    <TableHead className="font-bold text-xs">نوع الرخصة</TableHead>
                    <TableHead className="font-bold text-xs">رأي اللجنة</TableHead>
                    <TableHead className="font-bold text-xs">تاريخ التسجيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentFiles.map((file) => (
                    <TableRow key={file.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="font-mono font-bold text-sm">{formatFileNumberWithYear(file.file_number, file.year)}</TableCell>
                      <TableCell className="font-medium">{file.full_name}</TableCell>
                      <TableCell>{file.municipality}</TableCell>
                      <TableCell>
                        {file.permit_type ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[10px] text-white font-medium shadow-sm"
                            style={{ backgroundColor: PERMIT_COLORS[file.permit_type] || "#64748b" }}
                          >
                            {file.permit_type}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getOpinionBadge(file.committee_opinion)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(file.created_at), "d MMMM yyyy", { locale: ar })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد ملفات مسجلة بعد</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
