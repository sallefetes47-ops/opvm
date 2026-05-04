import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell, CalendarClock, FilePlus2, AlertCircle, CheckCheck, Inbox,
} from "lucide-react";
import { formatDateDDMMYYYY } from "@/lib/date";

type Severity = "info" | "warning" | "danger";
interface Notification {
  id: string;
  type: "session" | "new-file" | "pending";
  title: string;
  description: string;
  date?: string;
  severity: Severity;
  url: string;
}

const READ_KEY = "opvm.notifications.read";
const READ_ALL_KEY = "opvm.notifications.readAt";

function loadReadIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveReadIds(s: Set<string>) {
  localStorage.setItem(READ_KEY, JSON.stringify([...s]));
}

const GOLD = "#D4AF37";

export function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const [open, setOpen] = useState(false);
  const [readAt, setReadAt] = useState<number>(() =>
    Number(localStorage.getItem(READ_ALL_KEY) || 0)
  );

  const fetchAll = async () => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in14 = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
    const last7 = new Date(today.getTime() - 7 * 86400000).toISOString();

    const [summonsRes, newFilesRes, pendingRes] = await Promise.all([
      supabase
        .from("summons")
        .select("id,summons_date,venue,summons_number")
        .gte("summons_date", todayStr)
        .lte("summons_date", in14)
        .order("summons_date", { ascending: true }),
      supabase
        .from("files")
        .select("id,file_number,full_name,created_at,municipality")
        .eq("is_deleted", false)
        .gte("created_at", last7)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("files")
        .select("id,file_number,full_name,created_at,municipality,committee_opinion")
        .eq("is_deleted", false)
        .is("committee_opinion", null)
        .order("created_at", { ascending: true })
        .limit(20),
    ]);

    const list: Notification[] = [];

    (summonsRes.data || []).forEach((s: any) => {
      const days = Math.ceil(
        (new Date(s.summons_date).getTime() - today.getTime()) / 86400000
      );
      list.push({
        id: `session-${s.id}`,
        type: "session",
        title: `جلسة قادمة${s.summons_number ? ` رقم ${s.summons_number}` : ""}`,
        description:
          days <= 0
            ? `اليوم${s.venue ? ` • ${s.venue}` : ""}`
            : `بعد ${days} يوم${s.venue ? ` • ${s.venue}` : ""}`,
        date: s.summons_date,
        severity: days <= 2 ? "danger" : days <= 5 ? "warning" : "info",
        url: "/sessions-calendar",
      });
    });

    (newFilesRes.data || []).forEach((f: any) => {
      list.push({
        id: `new-${f.id}`,
        type: "new-file",
        title: `ملف جديد: ${f.full_name}`,
        description: `رقم ${f.file_number} • ${f.municipality}`,
        date: f.created_at,
        severity: "info",
        url: "/archive",
      });
    });

    (pendingRes.data || []).forEach((f: any) => {
      const ageDays = Math.floor(
        (today.getTime() - new Date(f.created_at).getTime()) / 86400000
      );
      list.push({
        id: `pending-${f.id}`,
        type: "pending",
        title: `قرار معلق: ${f.full_name}`,
        description: `رقم ${f.file_number} • منذ ${ageDays} يوم`,
        date: f.created_at,
        severity: ageDays > 30 ? "danger" : ageDays > 14 ? "warning" : "info",
        url: "/archive",
      });
    });

    list.sort((a, b) => {
      const sev = { danger: 0, warning: 1, info: 2 };
      if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
      return (b.date || "").localeCompare(a.date || "");
    });

    setItems(list);
  };

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 60_000);
    return () => clearInterval(t);
  }, []);

  const unreadCount = useMemo(
    () => items.filter(i => !readIds.has(i.id)).length,
    [items, readIds]
  );

  const grouped = useMemo(() => {
    return {
      session: items.filter(i => i.type === "session"),
      "new-file": items.filter(i => i.type === "new-file"),
      pending: items.filter(i => i.type === "pending"),
    };
  }, [items]);

  const markAllRead = () => {
    const all = new Set(items.map(i => i.id));
    setReadIds(all);
    saveReadIds(all);
    const now = Date.now();
    setReadAt(now);
    localStorage.setItem(READ_ALL_KEY, String(now));
  };

  const handleClick = (n: Notification) => {
    const next = new Set(readIds);
    next.add(n.id);
    setReadIds(next);
    saveReadIds(next);
    setOpen(false);
    navigate(n.url);
  };

  const sevColor = (s: Severity) =>
    s === "danger" ? "text-red-500" : s === "warning" ? "text-amber-500" : "text-blue-500";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="الإشعارات"
          title="الإشعارات"
        >
          <Bell className="h-5 w-5" style={{ color: GOLD }} />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -left-1 h-5 min-w-5 px-1 rounded-full text-[10px] flex items-center justify-center border-0"
              style={{ backgroundColor: "#ef4444", color: "white" }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" dir="rtl">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" style={{ color: GOLD }} />
            <span className="font-semibold">الإشعارات</span>
            <Badge variant="outline" className="text-xs">{items.length}</Badge>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs">
              <CheckCheck className="h-3 w-3 ml-1" />
              تعليم الكل كمقروء
            </Button>
          )}
        </div>

        <ScrollArea className="h-[420px]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
              <Inbox className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="divide-y">
              <Section
                label="الجلسات القادمة"
                icon={<CalendarClock className="h-4 w-4" />}
                items={grouped.session}
                readIds={readIds}
                onClick={handleClick}
                sevColor={sevColor}
              />
              <Section
                label="ملفات جديدة"
                icon={<FilePlus2 className="h-4 w-4" />}
                items={grouped["new-file"]}
                readIds={readIds}
                onClick={handleClick}
                sevColor={sevColor}
              />
              <Section
                label="قرارات معلقة"
                icon={<AlertCircle className="h-4 w-4" />}
                items={grouped.pending}
                readIds={readIds}
                onClick={handleClick}
                sevColor={sevColor}
              />
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function Section({
  label, icon, items, readIds, onClick, sevColor,
}: {
  label: string;
  icon: React.ReactNode;
  items: Notification[];
  readIds: Set<string>;
  onClick: (n: Notification) => void;
  sevColor: (s: Severity) => string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground">
        {icon}
        <span>{label}</span>
        <Badge variant="secondary" className="text-[10px] h-4">{items.length}</Badge>
      </div>
      {items.map(n => {
        const unread = !readIds.has(n.id);
        return (
          <button
            key={n.id}
            onClick={() => onClick(n)}
            className={`w-full text-right px-3 py-2.5 hover:bg-accent transition-colors flex gap-3 items-start ${
              unread ? "bg-amber-50/40 dark:bg-amber-900/10" : ""
            }`}
          >
            <div className={`mt-0.5 ${sevColor(n.severity)}`}>
              {n.type === "session" ? (
                <CalendarClock className="h-4 w-4" />
              ) : n.type === "new-file" ? (
                <FilePlus2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{n.title}</p>
                {unread && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">{n.description}</p>
              {n.date && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDateDDMMYYYY(n.date)}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
