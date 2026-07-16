import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, RefreshCw, Clock, Shield, Loader2 } from "lucide-react";
import {
  listSnapshots,
  deleteSnapshot,
  createBackup,
  downloadSnapshot,
  isAutoBackupEnabled,
  setAutoBackupEnabled,
  getLastAutoBackup,
  type BackupSnapshot,
} from "@/lib/auto-backup";

function formatBytes(n: number) {
  if (n < 1024) return `${n} ب`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} كب`;
  return `${(n / (1024 * 1024)).toFixed(2)} مب`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("ar-DZ")} ${d.toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}`;
}

interface Props {
  canEdit: boolean;
}

export function AutoBackupPanel({ canEdit }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [enabled, setEnabledState] = useState<boolean>(isAutoBackupEnabled());
  const [creating, setCreating] = useState(false);
  const [lastAuto, setLastAuto] = useState<string | null>(getLastAutoBackup());

  const { data: snapshots = [], refetch, isLoading } = useQuery({
    queryKey: ["local-backup-snapshots"],
    queryFn: listSnapshots,
  });

  useEffect(() => {
    const handler = () => {
      setLastAuto(getLastAutoBackup());
      refetch();
    };
    window.addEventListener("opvm:auto-backup-complete", handler);
    return () => window.removeEventListener("opvm:auto-backup-complete", handler);
  }, [refetch]);

  const handleToggle = (v: boolean) => {
    setAutoBackupEnabled(v);
    setEnabledState(v);
    toast({
      title: v ? "✅ تم تفعيل النسخ التلقائي" : "⏸️ تم إيقاف النسخ التلقائي",
      description: v ? "سيتم إنشاء نسخة كل 24 ساعة." : "لن تُنشأ نسخ تلقائية.",
    });
  };

  const handleCreateNow = useCallback(async () => {
    if (!canEdit) return;
    setCreating(true);
    try {
      const snap = await createBackup("manual");
      setLastAuto(snap.created_at);
      await qc.invalidateQueries({ queryKey: ["local-backup-snapshots"] });
      toast({
        title: "✅ تم إنشاء نسخة احتياطية",
        description: `${snap.record_count} سجل · ${formatBytes(snap.size_bytes)}`,
      });
    } catch (err: any) {
      toast({ title: "❌ فشل", description: err?.message ?? "تعذر إنشاء النسخة", variant: "destructive" });
    }
    setCreating(false);
  }, [canEdit, qc, toast]);

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    await deleteSnapshot(id);
    await qc.invalidateQueries({ queryKey: ["local-backup-snapshots"] });
    toast({ title: "تم الحذف" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" style={{ color: "#D4AF37" }} />
              النسخ الاحتياطي التلقائي
            </CardTitle>
            <CardDescription>
              نسخة يومية محلية محفوظة داخل المتصفح. يحتفظ النظام بآخر 7 نسخ.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-backup-toggle" className="text-sm">
              {enabled ? "مفعّل" : "متوقف"}
            </Label>
            <Switch
              id="auto-backup-toggle"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={!canEdit}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>آخر نسخة: {lastAuto ? formatDate(lastAuto) : "لا توجد"}</span>
          </div>
          <Button
            size="sm"
            onClick={handleCreateNow}
            disabled={!canEdit || creating}
            style={{ background: "#D4AF37", color: "#0F172A" }}
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جاري الإنشاء...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 ml-2" />
                إنشاء نسخة الآن
              </>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</div>
          ) : snapshots.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6 border rounded-md">
              لا توجد نسخ احتياطية محفوظة بعد.
            </div>
          ) : (
            snapshots.map((s: BackupSnapshot) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {formatDate(s.created_at)}
                    <Badge
                      variant={s.trigger === "auto" ? "secondary" : "default"}
                      className="text-[10px]"
                    >
                      {s.trigger === "auto" ? "تلقائي" : "يدوي"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.record_count} سجل · {formatBytes(s.size_bytes)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadSnapshot(s)}
                    title="تحميل"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(s.id)}
                    disabled={!canEdit}
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
