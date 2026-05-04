import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, Clock, TrendingUp,
  Building2, Calendar as CalendarIcon, Target, Award,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";

interface FileRow {
  id: string;
  municipality: string;
  committee_opinion: string | null;
  submission_date: string | null;
  session_date: string | null;
  created_at: string;
}

const MUNICIPALITIES = ["غرداية", "العطف", "بنورة", "متليلي", "ضاية بن ضحوة"];
const GOLD = "#D4AF37";

const monthNames = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return d >= 0 ? d : null;
}

export default function KPIDashboard() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("files")
        .select("id,municipality,committee_opinion,submission_date,session_date,created_at")
        .eq("is_deleted", false);
      setFiles((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const total = files.length;
    const accepted = files.filter(f => f.committee_opinion === "مقبول").length;
    const rejected = files.filter(f => f.committee_opinion === "مرفوض").length;
    const reserved = files.filter(f => f.committee_opinion === "تحفظ").length;
    const pending = total - accepted - rejected - reserved;
    const acceptanceRate = total ? Math.round((accepted / total) * 100) : 0;
    const rejectionRate = total ? Math.round((rejected / total) * 100) : 0;

    // Avg study duration (submission -> session)
    const durations = files
      .map(f => daysBetween(f.submission_date, f.session_date))
      .filter((d): d is number => d !== null);
    const avgDuration = durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : 0;

    return { total, accepted, rejected, reserved, pending, acceptanceRate, rejectionRate, avgDuration };
  }, [files]);

  // Monthly acceptance trend (last 12 months)
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: { month: string; total: number; accepted: number; rate: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const inMonth = files.filter(f => {
        const ref = f.session_date || f.created_at;
        if (!ref) return false;
        const fd = new Date(ref);
        return `${fd.getFullYear()}-${fd.getMonth()}` === key;
      });
      const accepted = inMonth.filter(f => f.committee_opinion === "مقبول").length;
      months.push({
        month: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        total: inMonth.length,
        accepted,
        rate: inMonth.length ? Math.round((accepted / inMonth.length) * 100) : 0,
      });
    }
    return months;
  }, [files]);

  // Per-municipality performance
  const muniStats = useMemo(() => {
    return MUNICIPALITIES.map(m => {
      const list = files.filter(f => f.municipality === m);
      const accepted = list.filter(f => f.committee_opinion === "مقبول").length;
      const rejected = list.filter(f => f.committee_opinion === "مرفوض").length;
      const total = list.length;
      const durations = list
        .map(f => daysBetween(f.submission_date, f.session_date))
        .filter((d): d is number => d !== null);
      const avg = durations.length
        ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
        : 0;
      const rate = total ? Math.round((accepted / total) * 100) : 0;
      return { municipality: m, total, accepted, rejected, rate, avgDuration: avg };
    }).sort((a, b) => b.total - a.total);
  }, [files]);

  const opinionPie = [
    { name: "مقبول", value: stats.accepted, color: "#22c55e" },
    { name: "مرفوض", value: stats.rejected, color: "#ef4444" },
    { name: "تحفظ", value: stats.reserved, color: "#f59e0b" },
    { name: "قيد الدراسة", value: stats.pending, color: "#64748b" },
  ].filter(p => p.value > 0);

  const topMuni = muniStats[0];
  const bestRateMuni = [...muniStats].filter(m => m.total > 0).sort((a, b) => b.rate - a.rate)[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        جارٍ تحميل المؤشرات...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: GOLD }}>
            <Target className="w-8 h-8" />
            لوحة مؤشرات الأداء
          </h1>
          <p className="text-muted-foreground mt-1">
            نظرة تنفيذية شاملة على أداء لجنة التعمير
          </p>
        </div>
        <Badge variant="outline" className="text-sm" style={{ borderColor: GOLD, color: GOLD }}>
          {stats.total} ملف إجمالي
        </Badge>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="نسبة القبول"
          value={`${stats.acceptanceRate}%`}
          sub={`${stats.accepted} ملف مقبول`}
          color="#22c55e"
        />
        <KpiCard
          icon={<XCircle className="w-5 h-5" />}
          label="نسبة الرفض"
          value={`${stats.rejectionRate}%`}
          sub={`${stats.rejected} ملف مرفوض`}
          color="#ef4444"
        />
        <KpiCard
          icon={<Clock className="w-5 h-5" />}
          label="متوسط زمن الدراسة"
          value={`${stats.avgDuration} يوم`}
          sub="من الإيداع إلى الجلسة"
          color="#3b82f6"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="ملفات قيد الدراسة"
          value={stats.pending.toString()}
          sub="بانتظار القرار"
          color="#f59e0b"
        />
      </div>

      {/* Awards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topMuni && topMuni.total > 0 && (
          <Card className="border-2" style={{ borderColor: GOLD }}>
            <CardContent className="p-5 flex items-center gap-4">
              <Award className="w-12 h-12" style={{ color: GOLD }} />
              <div>
                <p className="text-sm text-muted-foreground">البلدية الأكثر نشاطاً</p>
                <p className="text-2xl font-bold">{topMuni.municipality}</p>
                <p className="text-xs text-muted-foreground">{topMuni.total} ملف معالج</p>
              </div>
            </CardContent>
          </Card>
        )}
        {bestRateMuni && (
          <Card className="border-2 border-green-500/40">
            <CardContent className="p-5 flex items-center gap-4">
              <TrendingUp className="w-12 h-12 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">الأعلى في نسبة القبول</p>
                <p className="text-2xl font-bold">{bestRateMuni.municipality}</p>
                <p className="text-xs text-muted-foreground">{bestRateMuni.rate}% نسبة قبول</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: GOLD }} />
              تطور نسبة القبول الشهرية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} reversed />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: number, name: string) =>
                    name === "rate" ? [`${v}%`, "نسبة القبول"] : [v, name === "total" ? "إجمالي" : "مقبول"]
                  }
                />
                <Legend formatter={(v) => v === "rate" ? "نسبة القبول %" : v === "total" ? "إجمالي" : "مقبول"} />
                <Line type="monotone" dataKey="total" stroke="#64748b" strokeWidth={2} />
                <Line type="monotone" dataKey="accepted" stroke="#22c55e" strokeWidth={2} />
                <Line type="monotone" dataKey="rate" stroke={GOLD} strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: GOLD }} />
              توزيع القرارات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={opinionPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(e) => `${e.name}: ${e.value}`}
                >
                  {opinionPie.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Per-municipality performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" style={{ color: GOLD }} />
            أداء البلديات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={muniStats}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="municipality" tick={{ fontSize: 12 }} reversed />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
              />
              <Legend formatter={(v) => v === "accepted" ? "مقبول" : v === "rejected" ? "مرفوض" : "إجمالي"} />
              <Bar dataKey="total" fill="#64748b" />
              <Bar dataKey="accepted" fill="#22c55e" />
              <Bar dataKey="rejected" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 space-y-3">
            {muniStats.map(m => (
              <div key={m.municipality} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{m.municipality}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" /> {m.avgDuration} يوم
                    </span>
                    <Badge variant="outline">{m.total} ملف</Badge>
                  </div>
                </div>
                <Progress value={m.rate} className="h-2" />
                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                  <span>نسبة القبول: <strong style={{ color: GOLD }}>{m.rate}%</strong></span>
                  <span className="text-green-600">{m.accepted} مقبول</span>
                  <span className="text-red-500">{m.rejected} مرفوض</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, color,
}: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {icon}
          </div>
        </div>
        <p className="text-3xl font-bold" style={{ color }}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
