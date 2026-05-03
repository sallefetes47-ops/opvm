import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, GitCompare, AlertTriangle, MapPin, User, Hash, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FileRow {
  id: string;
  file_number: string;
  full_name: string;
  address: string;
  municipality: string;
  property_reference: string | null;
  permit_type: string | null;
  committee_opinion: string | null;
  year: number;
  plot_area: number | null;
  built_area: number | null;
}

interface SimilarPair {
  a: FileRow;
  b: FileRow;
  score: number;
  reasons: string[];
}

// Arabic-aware normalization
function normalizeAr(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئ]/g, "ي")
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokens(s: string): Set<string> {
  return new Set(normalizeAr(s).split(" ").filter((t) => t.length >= 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => b.has(t) && inter++);
  const union = a.size + b.size - inter;
  return inter / union;
}

function decisionLabel(op?: string | null) {
  if (!op) return null;
  const map: Record<string, { label: string; color: string }> = {
    accepted: { label: "مقبول", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
    rejected: { label: "مرفوض", color: "bg-rose-500/20 text-rose-400 border-rose-500/40" },
    reservations: { label: "تحفظات", color: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
    pending: { label: "معلق", color: "bg-slate-500/20 text-slate-300 border-slate-500/40" },
  };
  return map[op] || { label: op, color: "bg-slate-500/20 text-slate-300 border-slate-500/40" };
}

export default function SimilarFiles() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(50);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("files")
        .select("id,file_number,full_name,address,municipality,property_reference,permit_type,committee_opinion,year,plot_area,built_area")
        .eq("is_deleted", false)
        .limit(1000);
      if (!error && data) setFiles(data as FileRow[]);
      setLoading(false);
    })();
  }, []);

  const pairs = useMemo<SimilarPair[]>(() => {
    if (files.length === 0) return [];
    // Pre-compute token sets
    const enriched = files.map((f) => ({
      f,
      nameTok: tokens(f.full_name),
      addrTok: tokens(f.address),
      ref: normalizeAr(f.property_reference || ""),
    }));

    const result: SimilarPair[] = [];
    for (let i = 0; i < enriched.length; i++) {
      for (let j = i + 1; j < enriched.length; j++) {
        const A = enriched[i];
        const B = enriched[j];
        const reasons: string[] = [];
        let score = 0;

        const nameSim = jaccard(A.nameTok, B.nameTok);
        if (nameSim >= 0.6) {
          reasons.push(`نفس المالك (${Math.round(nameSim * 100)}%)`);
          score += nameSim * 40;
        }

        const addrSim = jaccard(A.addrTok, B.addrTok);
        if (addrSim >= 0.5) {
          reasons.push(`عنوان متقارب (${Math.round(addrSim * 100)}%)`);
          score += addrSim * 35;
        }

        if (A.ref && B.ref && A.ref === B.ref) {
          reasons.push("نفس المرجع العقاري");
          score += 30;
        }

        if (A.f.municipality === B.f.municipality && (nameSim > 0.4 || addrSim > 0.4)) {
          score += 5;
        }

        // Conflict detection
        if (
          A.f.committee_opinion &&
          B.f.committee_opinion &&
          A.f.committee_opinion !== B.f.committee_opinion &&
          (nameSim > 0.6 || addrSim > 0.6 || (A.ref && A.ref === B.ref))
        ) {
          reasons.push("⚠️ تناقض في القرار");
          score += 10;
        }

        if (score >= threshold) {
          result.push({ a: A.f, b: B.f, score: Math.min(100, Math.round(score)), reasons });
        }
      }
    }
    return result.sort((x, y) => y.score - x.score).slice(0, 200);
  }, [files, threshold]);

  const filteredPairs = useMemo(() => {
    if (!query.trim()) return pairs;
    const q = normalizeAr(query);
    return pairs.filter(
      (p) =>
        normalizeAr(p.a.full_name).includes(q) ||
        normalizeAr(p.b.full_name).includes(q) ||
        normalizeAr(p.a.address).includes(q) ||
        normalizeAr(p.b.address).includes(q) ||
        p.a.file_number.includes(query) ||
        p.b.file_number.includes(query)
    );
  }, [pairs, query]);

  const conflicts = pairs.filter((p) => p.reasons.some((r) => r.includes("تناقض"))).length;

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="rounded-xl p-3" style={{ backgroundColor: "rgba(212,175,55,0.15)" }}>
          <GitCompare className="h-7 w-7" style={{ color: "#D4AF37" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">مقارنة الملفات المتشابهة</h1>
          <p className="text-sm text-muted-foreground">
            كشف الازدواجية والتناقضات بين الملفات اعتماداً على المالك والعنوان والمرجع العقاري
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">إجمالي الملفات</p>
            <p className="text-3xl font-bold mt-1">{files.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">أزواج متشابهة</p>
            <p className="text-3xl font-bold mt-1" style={{ color: "#D4AF37" }}>{pairs.length}</p>
          </CardContent>
        </Card>
        <Card className={cn(conflicts > 0 && "border-rose-500/40")}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              تناقضات في القرار
            </p>
            <p className="text-3xl font-bold mt-1 text-rose-400">{conflicts}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">إعدادات البحث</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث باسم المالك أو رقم الملف أو العنوان..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pr-10"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">حد التشابه: {threshold}%</label>
              <span className="text-xs text-muted-foreground">كلما زاد، قلّت النتائج وارتفعت دقتها</span>
            </div>
            <Slider value={[threshold]} onValueChange={(v) => setThreshold(v[0])} min={20} max={90} step={5} />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : filteredPairs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            لا توجد ملفات متشابهة بهذا الحد. جرب خفض حد التشابه.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPairs.map((p, idx) => {
            const hasConflict = p.reasons.some((r) => r.includes("تناقض"));
            return (
              <Card key={idx} className={cn(hasConflict && "border-rose-500/40")}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.reasons.map((r, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={cn(
                            "text-xs",
                            r.includes("تناقض") && "border-rose-500/50 text-rose-400 bg-rose-500/10"
                          )}
                        >
                          {r}
                        </Badge>
                      ))}
                    </div>
                    <Badge style={{ backgroundColor: "#D4AF37", color: "#2D2926" }}>
                      تطابق {p.score}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[p.a, p.b].map((f) => {
                      const dec = decisionLabel(f.committee_opinion);
                      return (
                        <Link
                          key={f.id}
                          to={`/archive?file=${f.id}`}
                          className="block rounded-lg border border-border bg-card/50 p-4 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-mono text-sm font-bold">{f.file_number}</span>
                              <span className="text-xs text-muted-foreground">/ {f.year}</span>
                            </div>
                            {dec && (
                              <Badge variant="outline" className={cn("text-xs", dec.color)}>
                                {dec.label}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">{f.full_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground truncate">
                                {f.municipality} — {f.address}
                              </span>
                            </div>
                            {f.property_reference && (
                              <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs text-muted-foreground truncate">
                                  مرجع: {f.property_reference}
                                </span>
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
