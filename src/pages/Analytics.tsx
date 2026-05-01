import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart3, TrendingUp, AlertTriangle, Clock, CheckCircle2,
  XCircle, AlertCircle, Calendar, MapPin, Activity, Timer,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import { differenceInDays, format, parseISO, startOfMonth } from "date-fns";
import { ar } from "date-fns/locale";
import { formatFileNumberWithYear } from "@/lib/file-number";

interface FileRecord {
  id: string;
  full_name: string;
  municipality: string;
  file_number: string;
  year: number;
  permit_type: string | null;
  committee_opinion: string | null;
  submission_date: string | null;
  session_date: string | null;
  created_at: string;
  is_deleted: boolean | null;
}

const OPINION_COLORS: Record<string, string> = {
  "رأي إيجابي": "#10b981",
  "تحفظ": "#f59e0b",
  "مرفوض": "#ef4444",
};

const OVERDUE_THRESHOLD_DAYS = 30;

export default function Analytics() {
  const navigate = useNavigate();

  const { data: files, isLoading } = useQuery({
    queryKey: ["analytics-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FileRecord[];
    },
  });

  /* ─── KPIs ─── */
  const kpis = useMemo(() => {
    if (!files) return { total: 0, accepted: 0, rejected: 0, reserved: 0, pending: 0, acceptanceRate: 0, avgProcessingDays: 0 };
    const total = files.length;
    const accepted = files.filter((f) => f.committee_opinion === "رأي إيجابي").length;
    const rejected = files.filter((f) => f.committee_opinion === "مرفوض").length;
    const reserved = files.filter((f) => f.committee_opinion === "تحفظ").length;
    const pending = files.filter((f) => !f.committee_opinion).length;
    const acceptanceRate = total > 0 ? (accepted / total) * 100 : 0;

    const processed = files.filter((f) => f.submission_date && f.session_date);
    const totalDays = processed.reduce((sum, f) => {
      return sum + Math.max(0, differenceInDays(parseISO(f.session_date!), parseISO(f.submission_date!)));
    }, 0);
    const avgProcessingDays = processed.length > 0 ? Math.round(totalDays / processed.length) : 0;

    return { total, accepted, rejected, reserved, pending, acceptanceRate, avgProcessingDays };
  }, [files]);

  /* ─── Overdue files (no decision after 30 days) ─── */
  const overdueFiles = useMemo(() => {
    if (!files) return [];
    const now = new Date();
    return files
      .filter((f) => !f.committee_opinion && f.submission_date)
      .map((f) => ({
        ...f,
        daysSinceSubmission: differenceInDays(now, parseISO(f.submission_date!)),
      }))
      .filter((f) => f.daysSinceSubmission >= OVERDUE_THRESHOLD_DAYS)
      .sort((a, b) => b.daysSinceSubmission - a.daysSinceSubmission);
  }, [files]);

  /* ─── Acceptance rate per municipality ─── */
  const municipalityRates = useMemo(() => {
    if (!files) return [];
    const map: Record<string, { total: number; accepted: number; rejected: number; reserved: number }> = {};
    files.forEach((f) => {
      const m = f.municipality || "غير محدد";
      if (!map[m]) map[m] = { total: 0, accepted: 0, rejected: 0, reserved: 0 };
      map[m].total++;
      if (f.committee_opinion === "رأي إيجابي") map[m].accepted++;
      else if (f.committee_opinion === "مرفوض") map[m].rejected++;
      else if (f.committee_opinion === "تحفظ") map[m].reserved++;
    });
    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        ...v,
        rate: v.total > 0 ? Math.round((v.accepted / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [files]);

  /* ─── Monthly trend (last 12 months) ─── */
  const monthlyTrend = useMemo(() => {
    if (!files) return [];
    const map: Record<string, { month: string; total: number; accepted: number; rejected: number }> = {};
    const now = new Date();
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = format(d, "yyyy-MM");
      map[key] = {
        month: format(d, "MMM yy", { locale: ar }),
        total: 0,
        accepted: 0,
        rejected: 0,
      };
    }
    files.forEach((f) => {
      const d = parseISO(f.created_at);
      const key = format(startOfMonth(d), "yyyy-MM");
      if (map[key]) {
        map[key].total++;
        if (f.committee_opinion === "رأي إيجابي") map[key].accepted++;
        else if (f.committee_opinion === "مرفوض") map[key].rejected++;
      }
    });
    return Object.values(map);
  }, [files]);

  /* ─── Opinion distribution ─── */
  const opinionData = useMemo(() => {
    return [
      { name: "رأي إيجابي", value: kpis.accepted, color: OPINION_COLORS["رأي إيجابي"] },
      { name: "تحفظ", value: kpis.reserved, color: OPINION_COLORS["تحفظ"] },
      { name: "مرفوض", value: kpis.rejected, color: OPINION_COLORS["مرفوض"] },
      { name: "قيد الانتظار", value: kpis.pending, color: "#94a3b8" },
    ].filter((d) => d.value > 0);
  }, [kpis]);

  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-l from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
              التحليلات والإحصائيات
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              مؤشرات الأداء، الاتجاهات، وتنبيهات الملفات المتأخرة
            </p>
          </div>
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {overdueFiles.length > 0 && (
        <Card className="border-0 shadow-lg bg-gradient-to-l from-red-500/10 via-orange-500/10 to-amber-500/10 border-r-4 border-r-red-500">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-bold text-foreground">
                  يوجد {overdueFiles.length} ملف متأخر بدون قرار
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  أكثر من {OVERDUE_THRESHOLD_DAYS} يوم منذ الإيداع
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("overdue-section")?.scrollIntoView({ behavior: "smooth" })}
            >
              عرض القائمة
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="معدل القبول" value={`${kpis.acceptanceRate.toFixed(1)}%`}
          subtitle={`${kpis.accepted} من ${kpis.total} ملف`}
          icon={<CheckCircle2 className="h-5 w-5 text-white" />}
          gradient="bg-gradient-to-br from-emerald-500 to-green-700" />
        <KpiCard title="معدل الرفض" value={`${kpis.total > 0 ? ((kpis.rejected / kpis.total) * 100).toFixed(1) : 0}%`}
          subtitle={`${kpis.rejected} ملف مرفوض`}
          icon={<XCircle className="h-5 w-5 text-white" />}
          gradient="bg-gradient-to-br from-red-500 to-rose-700" />
        <KpiCard title="متوسط مدة المعالجة" value={`${kpis.avgProcessingDays} يوم`}
          subtitle="من الإيداع إلى الجلسة"
          icon={<Timer className="h-5 w-5 text-white" />}
          gradient="bg-gradient-to-br from-blue-500 to-indigo-700" />
        <KpiCard title="ملفات متأخرة" value={overdueFiles.length}
          subtitle={`> ${OVERDUE_THRESHOLD_DAYS} يوم بدون قرار`}
          icon={<AlertCircle className="h-5 w-5 text-white" />}
          gradient="bg-gradient-to-br from-amber-500 to-orange-700" />
      </div>

      {/* Charts Row 1: Monthly Trend + Opinion Distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-0 shadow-lg lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-purple-500" />
              <TrendingUp className="w-4 h-4 text-purple-500" />
              الاتجاه الشهري (آخر 12 شهراً)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    direction: "rtl",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2.5} name="الإجمالي" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="accepted" stroke="#10b981" strokeWidth={2} name="مقبول" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={2} name="مرفوض" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-emerald-500" />
              <Activity className="w-4 h-4 text-emerald-500" />
              توزيع القرارات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {opinionData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={opinionData} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                      paddingAngle={3} dataKey="value">
                      {opinionData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        direction: "rtl",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1.5 mt-2">
                  {opinionData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                        <span>{d.name}</span>
                      </div>
                      <span className="font-bold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                لا توجد بيانات
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Acceptance rate per municipality */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-blue-500" />
            <MapPin className="w-4 h-4 text-blue-500" />
            معدل القبول حسب البلدية
          </CardTitle>
        </CardHeader>
        <CardContent>
          {municipalityRates.length > 0 ? (
            <div className="space-y-3">
              {municipalityRates.map((m) => (
                <div key={m.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold">{m.name}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400">✓ {m.accepted}</span>
                      <span className="text-amber-600 dark:text-amber-400">⚠ {m.reserved}</span>
                      <span className="text-red-600 dark:text-red-400">✗ {m.rejected}</span>
                      <Badge variant="outline" className="ml-2">{m.rate}%</Badge>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                    {m.total > 0 && (
                      <>
                        <div className="bg-emerald-500" style={{ width: `${(m.accepted / m.total) * 100}%` }} />
                        <div className="bg-amber-500" style={{ width: `${(m.reserved / m.total) * 100}%` }} />
                        <div className="bg-red-500" style={{ width: `${(m.rejected / m.total) * 100}%` }} />
                        <div className="bg-slate-400/40" style={{ width: `${((m.total - m.accepted - m.reserved - m.rejected) / m.total) * 100}%` }} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>
          )}
        </CardContent>
      </Card>

      {/* Overdue files list */}
      <Card id="overdue-section" className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-red-500" />
            <Clock className="w-4 h-4 text-red-500" />
            الملفات المتأخرة (بدون قرار {`>`} {OVERDUE_THRESHOLD_DAYS} يوم)
            {overdueFiles.length > 0 && (
              <Badge className="bg-red-500 text-white border-0 mr-2">{overdueFiles.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overdueFiles.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم الكامل</TableHead>
                    <TableHead className="text-right">رقم الملف</TableHead>
                    <TableHead className="text-right">البلدية</TableHead>
                    <TableHead className="text-right">تاريخ الإيداع</TableHead>
                    <TableHead className="text-right">عدد الأيام</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueFiles.slice(0, 20).map((f) => (
                    <TableRow key={f.id} className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/archive?search=${encodeURIComponent(f.file_number)}`)}>
                      <TableCell className="font-medium">{f.full_name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded">
                          {formatFileNumberWithYear(f.file_number, f.year)}
                        </code>
                      </TableCell>
                      <TableCell>{f.municipality}</TableCell>
                      <TableCell className="text-xs">
                        <Calendar className="w-3 h-3 inline ml-1" />
                        {format(parseISO(f.submission_date!), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          f.daysSinceSubmission >= 90
                            ? "bg-red-500 text-white border-0"
                            : f.daysSinceSubmission >= 60
                            ? "bg-orange-500 text-white border-0"
                            : "bg-amber-500 text-white border-0"
                        }>
                          {f.daysSinceSubmission} يوم
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">عرض</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {overdueFiles.length > 20 && (
                <p className="text-xs text-center text-muted-foreground mt-3">
                  عرض 20 من أصل {overdueFiles.length} ملف
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-medium">ممتاز! لا توجد ملفات متأخرة</p>
              <p className="text-xs text-muted-foreground mt-1">
                جميع الملفات المعلّقة ضمن المدة المسموحة
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── KPI Card ─── */
interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
}

function KpiCard({ title, value, subtitle, icon, gradient }: KpiCardProps) {
  return (
    <Card className={`relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${gradient}`}>
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-white/90">{title}</CardTitle>
        <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">{icon}</div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-2xl font-black text-white tracking-tight">{value}</div>
        <p className="text-xs text-white/70 mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
