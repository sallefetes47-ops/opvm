import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
} from "date-fns";
import { ar } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Download,
  FileText,
  Users2,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FileItem = {
  id: string;
  file_number: string;
  full_name: string;
  municipality: string;
  session_date: string | null;
  committee_opinion: string | null;
  permit_type: string | null;
};

type MinuteItem = {
  id: string;
  session_number: string | null;
  session_date: string;
  agenda: string | null;
  decisions: string | null;
  attendees: string[] | null;
};

type ViewMode = "month" | "week" | "agenda";

const opinionColor = (opinion: string | null) => {
  if (!opinion) return "bg-muted text-muted-foreground";
  const o = opinion.toLowerCase();
  if (o.includes("قبول") || o.includes("موافق")) return "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30";
  if (o.includes("رفض")) return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
  if (o.includes("تحفظ")) return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
};

// Build standards-compliant ICS content
const buildICS = (
  events: { uid: string; date: string; title: string; description: string }[]
) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OPVM//Sessions Calendar//AR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const e of events) {
    const start = new Date(`${e.date}T09:00:00Z`);
    const end = new Date(`${e.date}T11:00:00Z`);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@opvm.lovable.app`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${escape(e.title)}`,
      `DESCRIPTION:${escape(e.description)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
};

const downloadICS = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function SessionsCalendar() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [minutes, setMinutes] = useState<MinuteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: f, error: fe }, { data: m, error: me }] = await Promise.all([
        supabase
          .from("files")
          .select("id,file_number,full_name,municipality,session_date,committee_opinion,permit_type")
          .not("session_date", "is", null),
        supabase
          .from("meeting_minutes")
          .select("id,session_number,session_date,agenda,decisions,attendees"),
      ]);
      if (fe || me) toast.error("تعذر تحميل بيانات الجلسات");
      setFiles((f as FileItem[]) || []);
      setMinutes((m as MinuteItem[]) || []);
      setLoading(false);
    })();
  }, []);

  // Group by YYYY-MM-DD
  const byDate = useMemo(() => {
    const map = new Map<string, { files: FileItem[]; minutes: MinuteItem[] }>();
    for (const f of files) {
      if (!f.session_date) continue;
      const k = f.session_date;
      if (!map.has(k)) map.set(k, { files: [], minutes: [] });
      map.get(k)!.files.push(f);
    }
    for (const m of minutes) {
      const k = m.session_date;
      if (!map.has(k)) map.set(k, { files: [], minutes: [] });
      map.get(k)!.minutes.push(m);
    }
    return map;
  }, [files, minutes]);

  const exportAll = () => {
    const events = Array.from(byDate.entries()).map(([date, data]) => ({
      uid: `session-${date}`,
      date,
      title: `جلسة لجنة التعمير — ${data.files.length} ملف`,
      description: data.files
        .map((f) => `• ${f.file_number} — ${f.full_name} (${f.municipality})`)
        .join("\n"),
    }));
    if (events.length === 0) {
      toast.info("لا توجد جلسات للتصدير");
      return;
    }
    downloadICS(buildICS(events), `opvm-sessions-${format(new Date(), "yyyyMMdd")}.ics`);
    toast.success(`تم تصدير ${events.length} جلسة`);
  };

  const exportDay = (date: Date) => {
    const k = format(date, "yyyy-MM-dd");
    const data = byDate.get(k);
    if (!data) return;
    const events = [
      {
        uid: `session-${k}`,
        date: k,
        title: `جلسة لجنة التعمير — ${data.files.length} ملف`,
        description: data.files
          .map((f) => `• ${f.file_number} — ${f.full_name} (${f.municipality})`)
          .join("\n"),
      },
    ];
    downloadICS(buildICS(events), `opvm-session-${k}.ics`);
    toast.success("تم تصدير الجلسة");
  };

  // ------- Month View -------
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 6 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 6 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  // ------- Week View -------
  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 6 });
    const end = endOfWeek(cursor, { weekStartsOn: 6 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weekDayLabels = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

  // ------- Agenda View -------
  const agendaItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from(byDate.entries())
      .map(([k, v]) => ({ date: parseISO(k), key: k, ...v }))
      .filter((x) => x.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 30);
  }, [byDate]);

  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedData = selectedKey ? byDate.get(selectedKey) : null;

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground md:text-3xl">
            <CalendarIcon className="h-7 w-7" style={{ color: "#D4AF37" }} />
            تقويم الجلسات
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            عرض شهري وأسبوعي لجلسات لجنة التعمير مع الملفات المدروسة
          </p>
        </div>
        <Button onClick={exportAll} className="gap-2" style={{ backgroundColor: "#D4AF37", color: "#2D2926" }}>
          <Download className="h-4 w-4" />
          تصدير إلى التقويم (ICS)
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (view === "week") setCursor(subWeeks(cursor, 1));
                else setCursor(subMonths(cursor, 1));
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setCursor(new Date())}>
              اليوم
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (view === "week") setCursor(addWeeks(cursor, 1));
                else setCursor(addMonths(cursor, 1));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="mr-3 text-lg md:text-xl">
              {view === "week"
                ? `أسبوع ${format(weekDays[0], "d MMM", { locale: ar })} - ${format(weekDays[6], "d MMM yyyy", { locale: ar })}`
                : format(cursor, "MMMM yyyy", { locale: ar })}
            </CardTitle>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="month">شهري</TabsTrigger>
              <TabsTrigger value="week">أسبوعي</TabsTrigger>
              <TabsTrigger value="agenda">القادمة</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-20 text-center text-muted-foreground">جاري التحميل...</div>
          ) : view === "month" ? (
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-7 border-b bg-muted/40">
                {weekDayLabels.map((d) => (
                  <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground md:text-sm">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((d) => {
                  const k = format(d, "yyyy-MM-dd");
                  const data = byDate.get(k);
                  const inMonth = isSameMonth(d, cursor);
                  const today = isToday(d);
                  return (
                    <button
                      key={k}
                      onClick={() => data && setSelectedDate(d)}
                      className={cn(
                        "min-h-[88px] border-b border-l p-1.5 text-right transition-colors",
                        !inMonth && "bg-muted/20 text-muted-foreground/50",
                        data && "cursor-pointer hover:bg-accent/30",
                        !data && "cursor-default"
                      )}
                    >
                      <div
                        className={cn(
                          "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                          today && "font-bold text-[#2D2926]"
                        )}
                        style={today ? { backgroundColor: "#D4AF37" } : undefined}
                      >
                        {format(d, "d")}
                      </div>
                      {data && (
                        <div className="space-y-0.5">
                          {data.files.length > 0 && (
                            <div className="truncate rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary md:text-xs">
                              {data.files.length} ملف
                            </div>
                          )}
                          {data.minutes.length > 0 && (
                            <div className="truncate rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 md:text-xs">
                              محضر
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : view === "week" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
              {weekDays.map((d, i) => {
                const k = format(d, "yyyy-MM-dd");
                const data = byDate.get(k);
                const today = isToday(d);
                return (
                  <Card
                    key={k}
                    className={cn(
                      "min-h-[180px] cursor-pointer transition-all hover:shadow-md",
                      today && "ring-2",
                      data && "border-primary/40"
                    )}
                    style={today ? { boxShadow: "0 0 0 2px #D4AF37" } : undefined}
                    onClick={() => data && setSelectedDate(d)}
                  >
                    <CardHeader className="pb-2">
                      <div className="text-xs text-muted-foreground">{weekDayLabels[i]}</div>
                      <div className="text-2xl font-bold">{format(d, "d MMM", { locale: ar })}</div>
                    </CardHeader>
                    <CardContent>
                      {!data ? (
                        <div className="text-center text-xs text-muted-foreground">لا توجد جلسات</div>
                      ) : (
                        <div className="space-y-2">
                          {data.files.length > 0 && (
                            <Badge variant="secondary" className="gap-1">
                              <FileText className="h-3 w-3" /> {data.files.length} ملف
                            </Badge>
                          )}
                          {data.minutes.length > 0 && (
                            <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
                              <Users2 className="h-3 w-3" /> محضر جلسة
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            // Agenda
            <div className="space-y-3">
              {agendaItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">لا توجد جلسات قادمة مجدولة</div>
              ) : (
                agendaItems.map((item) => (
                  <Card
                    key={item.key}
                    className="cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
                    onClick={() => setSelectedDate(item.date)}
                  >
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-14 w-14 flex-col items-center justify-center rounded-lg text-[#2D2926]"
                          style={{ backgroundColor: "#D4AF37" }}
                        >
                          <span className="text-xs">{format(item.date, "MMM", { locale: ar })}</span>
                          <span className="text-xl font-bold leading-none">{format(item.date, "d")}</span>
                        </div>
                        <div>
                          <div className="font-semibold">
                            {format(item.date, "EEEE d MMMM yyyy", { locale: ar })}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {item.files.length > 0 && (
                              <Badge variant="secondary" className="gap-1">
                                <FileText className="h-3 w-3" /> {item.files.length} ملف
                              </Badge>
                            )}
                            {item.minutes.length > 0 && (
                              <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
                                <Users2 className="h-3 w-3" /> محضر
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportDay(item.date);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={(o) => !o && setSelectedDate(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" style={{ color: "#D4AF37" }} />
              {selectedDate && format(selectedDate, "EEEE d MMMM yyyy", { locale: ar })}
            </DialogTitle>
            <DialogDescription>
              تفاصيل الجلسة والملفات المدروسة
            </DialogDescription>
          </DialogHeader>

          {selectedData && (
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-4">
                {selectedData.minutes.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">محاضر الجلسة</h3>
                    {selectedData.minutes.map((m) => (
                      <Card key={m.id} className="mb-2">
                        <CardContent className="space-y-2 p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">جلسة رقم {m.session_number || "—"}</span>
                            {m.attendees && m.attendees.length > 0 && (
                              <Badge variant="secondary">{m.attendees.length} حاضر</Badge>
                            )}
                          </div>
                          {m.agenda && <p className="text-sm text-muted-foreground">{m.agenda}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedData.files.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                      الملفات المدروسة ({selectedData.files.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedData.files.map((f) => (
                        <Card
                          key={f.id}
                          className="cursor-pointer transition-colors hover:border-primary/40"
                          onClick={() => navigate(`/archive?search=${encodeURIComponent(f.file_number)}`)}
                        >
                          <CardContent className="flex items-center justify-between gap-3 p-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {f.file_number}
                                </span>
                                <span className="truncate font-medium">{f.full_name}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {f.municipality}
                                </span>
                                {f.permit_type && <span>• {f.permit_type}</span>}
                              </div>
                            </div>
                            <Badge className={cn("border", opinionColor(f.committee_opinion))}>
                              {f.committee_opinion || "بدون قرار"}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => selectedDate && exportDay(selectedDate)}>
                    <Download className="ml-2 h-4 w-4" />
                    تصدير هذا اليوم (ICS)
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
