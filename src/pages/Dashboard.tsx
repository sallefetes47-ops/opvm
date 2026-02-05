import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
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
} from "recharts";

interface FileRecord {
  id: string;
  full_name: string;
  municipality: string;
  file_number: string;
  committee_opinion: string | null;
  created_at: string;
}

export default function Dashboard() {
  const { data: files, isLoading } = useQuery({
    queryKey: ["dashboard-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as FileRecord[];
    },
  });

  const stats = {
    total: files?.length || 0,
    positive: files?.filter((f) => f.committee_opinion === "رأي إيجابي").length || 0,
    reserved: files?.filter((f) => f.committee_opinion === "تحفظ").length || 0,
    rejected: files?.filter((f) => f.committee_opinion === "مرفوض").length || 0,
  };

  const pieData = [
    { name: "رأي إيجابي", value: stats.positive, color: "hsl(142, 70%, 45%)" },
    { name: "تحفظ", value: stats.reserved, color: "hsl(35, 90%, 55%)" },
    { name: "مرفوض", value: stats.rejected, color: "hsl(0, 70%, 50%)" },
  ].filter((d) => d.value > 0);

  const municipalityData = files
    ? [
        { name: "غرداية", count: files.filter((f) => f.municipality === "غرداية").length },
        { name: "العطف", count: files.filter((f) => f.municipality === "العطف").length },
        { name: "بونورة", count: files.filter((f) => f.municipality === "بونورة").length },
      ]
    : [];

  const recentFiles = files?.slice(0, 5) || [];

  const getOpinionBadge = (opinion: string | null) => {
    switch (opinion) {
      case "رأي إيجابي":
        return <Badge className="bg-success hover:bg-success/90">رأي إيجابي</Badge>;
      case "تحفظ":
        return <Badge className="bg-warning hover:bg-warning/90 text-warning-foreground">تحفظ</Badge>;
      case "مرفوض":
        return <Badge className="bg-destructive hover:bg-destructive/90">مرفوض</Badge>;
      default:
        return <Badge variant="secondary">قيد الانتظار</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">لوحة التحكم</h1>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الملفات</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">رأي إيجابي</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.positive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تحفظات</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.reserved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مرفوض</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>توزيع الملفات حسب رأي اللجنة</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                لا توجد بيانات لعرضها
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>توزيع الملفات حسب البلدية</CardTitle>
          </CardHeader>
          <CardContent>
            {files && files.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={municipalityData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(35, 50%, 58%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                لا توجد بيانات لعرضها
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Files */}
      <Card>
        <CardHeader>
          <CardTitle>آخر الملفات المسجلة</CardTitle>
        </CardHeader>
        <CardContent>
          {recentFiles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الملف</TableHead>
                  <TableHead>الاسم الكامل</TableHead>
                  <TableHead>البلدية</TableHead>
                  <TableHead>رأي اللجنة</TableHead>
                  <TableHead>تاريخ التسجيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFiles.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">{file.file_number}</TableCell>
                    <TableCell>{file.full_name}</TableCell>
                    <TableCell>{file.municipality}</TableCell>
                    <TableCell>{getOpinionBadge(file.committee_opinion)}</TableCell>
                    <TableCell>
                      {format(new Date(file.created_at), "d MMMM yyyy", { locale: ar })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد ملفات مسجلة بعد.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
