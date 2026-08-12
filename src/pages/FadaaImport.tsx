import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Download, RefreshCw, Globe, AlertTriangle, Upload, Wifi, WifiOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  fetchWfsLayers,
  fetchLayerGeoJson,
  mergeCollections,
  downloadCollection,
  classifyError,
  LOCAL_CADASTRE_LAYER,
  type WfsLayer,
  type GeoJsonCollection,
  type ExportFormat,
  type FetchDiagnostic,
} from "@/lib/fadaa-geojson-export";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MANUAL_STORAGE_KEY = "fadaa_manual_geojson_v1";
const OFFLINE_ONLY_KEY = "fadaa_offline_only_v1";

export default function FadaaImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [layers, setLayers] = useState<WfsLayer[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<FetchDiagnostic[]>([]);
  const [result, setResult] = useState<GeoJsonCollection | null>(null);
  const [format, setFormat] = useState<ExportFormat>("geojson");
  const [offlineOnly, setOfflineOnly] = useState<boolean>(
    () => localStorage.getItem(OFFLINE_ONLY_KEY) === "1"
  );

  const toggleOfflineOnly = (value: boolean) => {
    setOfflineOnly(value);
    localStorage.setItem(OFFLINE_ONLY_KEY, value ? "1" : "0");
    if (value) {
      setError(null);
      setDiagnostics([]);
      setLayers((prev) => prev.filter((l) => l.name === LOCAL_CADASTRE_LAYER));
      setSelected((prev) => prev.filter((n) => n === LOCAL_CADASTRE_LAYER));
    }
  };

  const resetErrors = () => {
    setError(null);
    setDiagnostics([]);
  };


  const handleManualImport = async (file: File) => {
    resetErrors();
    try {
      const parsed = JSON.parse(await file.text()) as GeoJsonCollection;
      if (parsed?.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
        throw new Error("الملف ليس FeatureCollection صالحاً");
      }
      try {
        localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // ملف كبير جداً للتخزين المحلي — نكتفي بالمعاينة
      }
      setResult(parsed);
      toast({
        title: "تم استيراد الملف",
        description: `عدد المعالم: ${parsed.features.length}`,
      });
    } catch (e) {
      setError(`فشل استيراد الملف: ${(e as Error).message}`);
      setDiagnostics([
        {
          kind: "invalid_response",
          reason: "الملف المحدد ليس ملف GeoJSON صالحاً.",
          steps: [
            "تأكد من أن الملف بامتداد .geojson أو .json.",
            "تأكد من أن محتواه من النوع FeatureCollection ويحوي مصفوفة features.",
            "أعد تنزيل الملف من الموقع الرسمي ثم أعد المحاولة.",
          ],
          detail: (e as Error).message,
        },
      ]);
    }
  };


  const loadLayers = async () => {
    setLoadingLayers(true);
    resetErrors();
    const diags: FetchDiagnostic[] = [];
    try {
      const found = await fetchWfsLayers(diags, offlineOnly);
      setLayers(found);
      setSelected(found.length === 1 ? [found[0].name] : []);
      if (!found.length) setError("لم يتم العثور على أي طبقة منشورة في الخدمة.");
      else if (diags.length) {
        setError("تعذّر جلب الطبقات الحيّة من موقع فضاء الجزائر — تم الاكتفاء بالطبقة المحلية.");
        setDiagnostics(diags);
      }
    } catch (e) {
      setError("تعذّر الاتصال بخدمة فضاء الجزائر.");
      setDiagnostics(diags.length ? diags : [classifyError(e)]);
    } finally {
      setLoadingLayers(false);
    }
  };

  const toggle = (name: string) =>
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );

  const handleExport = async () => {
    if (!selected.length) {
      toast({ title: "اختر طبقة واحدة على الأقل", variant: "destructive" });
      return;
    }
    setExporting(true);
    resetErrors();
    const parts: { layer: string; collection: GeoJsonCollection }[] = [];
    const failed: string[] = [];
    const diags: FetchDiagnostic[] = [];

    for (const layer of selected) {
      try {
        const collection = await fetchLayerGeoJson(layer, 5000, diags, offlineOnly);
        parts.push({ layer, collection });
      } catch (e) {
        failed.push(layer);
        if (!diags.length) diags.push(classifyError(e));
      }
    }

    if (!parts.length) {
      setError(`فشل جلب جميع الطبقات المحددة (${failed.length}).`);
      setDiagnostics(diags);
      setExporting(false);
      return;
    }

    if (failed.length) {
      setError(`نجح التصدير جزئياً — فشلت ${failed.length} طبقة: ${failed.join(", ")}`);
      setDiagnostics(diags);
    }

    const merged = mergeCollections(parts);
    setResult(merged);
    downloadCollection(merged, "fadaa_eldjazair_47", format);
    toast({
      title: format === "csv" ? "تم إنشاء ملف CSV" : "تم إنشاء ملف GeoJSON",
      description: `عدد المعالم: ${merged.features.length}${
        failed.length ? ` — طبقات فشلت: ${failed.length}` : ""
      }`,
    });
    setExporting(false);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">استيراد بيانات فضاء الجزائر</h1>
          <p className="text-muted-foreground text-sm">
            جلب طبقات المسح العقاري لولاية غرداية (47) وتحويلها إلى ملف GeoJSON.
          </p>
        </div>
        {offlineOnly && (
          <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/30" variant="outline">
            <WifiOff className="w-3.5 h-3.5" />
            الوضع دون اتصال مُفعّل
          </Badge>
        )}
        <Button
          onClick={loadLayers}
          disabled={loadingLayers}
          variant="outline"
          className="ms-auto gap-2"
        >
          {loadingLayers ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {offlineOnly ? "تحميل البيانات المحلية" : "استعراض الطبقات المتوفرة"}
        </Button>
      </div>

      <Card className={offlineOnly ? "border-amber-500/40 bg-amber-500/5" : undefined}>
        <CardContent className="flex items-center justify-between gap-4 py-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              {offlineOnly ? (
                <WifiOff className="w-4 h-4 text-amber-600" />
              ) : (
                <Wifi className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">استخدام البيانات المحلية فقط</p>
              <p className="text-xs text-muted-foreground">
                يمنع أي طلب للشبكة أو لموقع فضاء الجزائر، ويعتمد على نسخة المسح العقاري المحفوظة.
              </p>
            </div>
          </div>
          <Switch
            checked={offlineOnly}
            onCheckedChange={toggleOfflineOnly}
            aria-label="استخدام البيانات المحلية فقط"
          />
        </CardContent>
      </Card>

      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertTitle>{offlineOnly ? "أنت في الوضع دون اتصال" : "كيف يعمل الجلب الآن"}</AlertTitle>
        <AlertDescription className="text-sm leading-relaxed">
          {offlineOnly
            ? "كل الطلبات الخارجية معطّلة. تُستعمل فقط بيانات المسح العقاري المحفوظة داخل المنصة، ويمكنك المعاينة والتصدير والاستيراد اليدوي دون أي اتصال."
            : "تمر الطلبات عبر وسيط الخادم ثم من المتصفح. وعند تعذّر الوصول إلى الموقع الرسمي تُستخدم تلقائياً نسخة بيانات المسح العقاري المحفوظة في المنصة، ويمكن تصديرها دون اتصال."}
        </AlertDescription>
      </Alert>


      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">استيراد ملف GeoJSON يدوياً</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleManualImport(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" />
            اختيار ملف GeoJSON
          </Button>
          <span className="text-xs text-muted-foreground">
            يُحفظ الملف محلياً في هذا الحاسوب لاستخدامه في الخريطة.
          </span>
        </CardContent>
      </Card>


      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>{error}</AlertTitle>
          <AlertDescription className="text-sm leading-relaxed space-y-3">
            {diagnostics.map((diag, i) => (
              <div key={`${diag.kind}-${i}`} className="space-y-1">
                <p className="font-medium">السبب: {diag.reason}</p>
                <ol className="list-decimal ms-5 space-y-0.5">
                  {diag.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {diag.detail && (
                  <p className="text-xs font-mono opacity-80" dir="ltr">
                    {diag.detail}
                  </p>
                )}
              </div>
            ))}
            {diagnostics.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={loadLayers} disabled={loadingLayers}>
                  <RefreshCw className="w-3.5 h-3.5 me-1" />
                  إعادة المحاولة
                </Button>
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 me-1" />
                  استيراد ملف محلياً
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}


      {layers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>الطبقات المتوفرة ({layers.length})</span>
              <Badge variant="outline">محدد: {selected.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
            {layers.map((layer) => (
              <label
                key={layer.name}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={selected.includes(layer.name)}
                  onCheckedChange={() => toggle(layer.name)}
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{layer.title}</span>
                  {layer.name === LOCAL_CADASTRE_LAYER && (
                    <Badge variant="secondary" className="mt-1 w-fit">متاحة دون اتصال</Badge>
                  )}
                  <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                    {layer.name}
                  </span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="geojson">GeoJSON (.geojson)</SelectItem>
            <SelectItem value="csv">CSV (.csv) — جدول</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleExport} disabled={exporting || !selected.length} className="gap-2">
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {format === "csv" ? "تصدير CSV" : "تصدير GeoJSON"}
        </Button>
        {result && (
          <span className="text-sm text-muted-foreground">
            آخر تصدير: {result.features.length} معلم من {selected.length} طبقة.
          </span>
        )}
      </div>
    </div>
  );
}
