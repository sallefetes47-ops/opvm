import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Download, RefreshCw, Globe, AlertTriangle, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchWfsLayers,
  fetchLayerGeoJson,
  mergeCollections,
  downloadGeoJson,
  LOCAL_CADASTRE_LAYER,
  type WfsLayer,
  type GeoJsonCollection,
} from "@/lib/fadaa-geojson-export";

const MANUAL_STORAGE_KEY = "fadaa_manual_geojson_v1";

export default function FadaaImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [layers, setLayers] = useState<WfsLayer[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeoJsonCollection | null>(null);

  const handleManualImport = async (file: File) => {
    setError(null);
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
    }
  };


  const loadLayers = async () => {
    setLoadingLayers(true);
    setError(null);
    try {
      const found = await fetchWfsLayers();
      setLayers(found);
      setSelected(found.length === 1 ? [found[0].name] : []);
      if (!found.length) setError("لم يتم العثور على أي طبقة منشورة في الخدمة.");
    } catch (e) {
      setError(
        `تعذّر الاتصال بخدمة فضاء الجزائر: ${(e as Error).message}. الخدمة متاحة فقط من الشبكات الجزائرية وقد تمنع المتصفح (CORS).`
      );
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
    setError(null);
    const parts: { layer: string; collection: GeoJsonCollection }[] = [];
    const failed: string[] = [];

    for (const layer of selected) {
      try {
        const collection = await fetchLayerGeoJson(layer);
        parts.push({ layer, collection });
      } catch {
        failed.push(layer);
      }
    }

    if (!parts.length) {
      setError("فشل جلب جميع الطبقات المحددة. تحقق من الاتصال بشبكة جزائرية.");
      setExporting(false);
      return;
    }

    const merged = mergeCollections(parts);
    setResult(merged);
    downloadGeoJson(merged, "fadaa_eldjazair_47");
    toast({
      title: "تم إنشاء ملف GeoJSON",
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
          استعراض الطبقات المتوفرة
        </Button>
      </div>

      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertTitle>كيف يعمل الجلب الآن</AlertTitle>
        <AlertDescription className="text-sm leading-relaxed">
          تمر الطلبات عبر وسيط الخادم ثم من المتصفح. وعند تعذّر الوصول إلى الموقع الرسمي
          تُستخدم تلقائياً نسخة بيانات المسح العقاري المحفوظة في المنصة، ويمكن تصديرها دون اتصال.
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
          <AlertDescription className="text-sm leading-relaxed">{error}</AlertDescription>
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
        <Button onClick={handleExport} disabled={exporting || !selected.length} className="gap-2">
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          تصدير GeoJSON
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
