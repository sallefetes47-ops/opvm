import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import MapSelector from "@/components/MapSelector";
import PermitLocationPicker from "@/components/PermitLocationPicker";
import DocumentAnalyzer, { AnalysisResult } from "@/components/DocumentAnalyzer";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Archive, Search, Trash2, Edit, Eye, Loader2, History,
  Map as MapIcon, List, Upload, Save, X, FileText
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Database } from "@/integrations/supabase/types";

type FileRecord = Database["public"]["Tables"]["files"]["Row"];

interface FileStudy {
  id: string;
  file_id: string;
  study_date: string;
  permit_type: string | null;
  committee_opinion: string;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
}

export default function ArchivePage() {
  const { role, isViewer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canEdit = !isViewer && role !== "viewer";

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [municipalityFilter, setMunicipalityFilter] = useState<string>("all");
  const [opinionFilter, setOpinionFilter] = useState<string>("all");

  // Sync State (Map <-> List)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number; lng: number, zoom?: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "map">("list"); // Mobile toggling

  // Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [fileStudies, setFileStudies] = useState<FileStudy[]>([]);
  const [loadingStudies, setLoadingStudies] = useState(false);

  // Edit Form State
  const [editFormData, setEditFormData] = useState<Partial<FileRecord>>({});
  const [isReplacingFile, setIsReplacingFile] = useState(false);

  /* ── Fetch Files ── */
  const { data: files, isLoading } = useQuery({
    queryKey: ["archive-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as FileRecord[];
    },
  });

  /* ── Filter Logic ── */
  const filteredFiles = files?.filter((file) => {
    const matchesSearch =
      file.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.file_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.address.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMunicipality =
      municipalityFilter === "all" || file.municipality === municipalityFilter;

    const matchesOpinion =
      opinionFilter === "all" ||
      (opinionFilter === "pending" && !file.committee_opinion) ||
      file.committee_opinion === opinionFilter;

    return matchesSearch && matchesMunicipality && matchesOpinion;
  });

  /* ── Sync Handlers ── */

  // 1. List Row Click -> Fly on Map
  const handleRowClick = (file: FileRecord) => {
    setSelectedContractId(file.id);
    if (file.location_lat && file.location_lng) {
      setFlyToLocation({ lat: file.location_lat, lng: file.location_lng });
      // On mobile, switch to map tab
      if (window.matchMedia("(max-width: 768px)").matches) {
        setActiveTab("map");
      }
    }
  };

  // 2. Map Marker Click -> Scroll/Highlight in List
  const handleMapSelect = (id: string) => {
    setSelectedContractId(id);
    setActiveTab("list"); // Switch back to list on mobile

    // Scroll into view
    setTimeout(() => {
      const el = document.getElementById(`row-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("bg-muted/50"); // Flash highlight
        setTimeout(() => el.classList.remove("bg-muted/50"), 2000);
      }
    }, 100);
  };

  /* ── Mutations ── */

  const softDeleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from("files")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archive-files"] });
      toast({ title: "✅ تم النقل إلى سلة المحذوفات" });
      setDeleteDialogOpen(false);
      setSelectedFile(null);
    },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateFileMutation = useMutation({
    mutationFn: async (data: Partial<FileRecord> & { id: string }) => {
      const { error } = await supabase.from("files").update(data).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archive-files"] });
      toast({ title: "✅ تم تحديث الملف بنجاح" });
      setEditDialogOpen(false);
      setIsReplacingFile(false);
    },
    onError: (e) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  /* ── Action Handlers ── */

  const handleEdit = (file: FileRecord) => {
    setSelectedFile(file);
    setEditFormData({ ...file });
    setEditDialogOpen(true);
    setIsReplacingFile(false);
  };

  const handleView = async (file: FileRecord) => {
    setSelectedFile(file);
    setViewDialogOpen(true);
    setLoadingStudies(true);

    // Fetch history
    try {
      const { data } = await supabase
        .from("file_studies")
        .select("*")
        .eq("file_id", file.id)
        .order("study_date", { ascending: false });
      setFileStudies(data || []);
    } catch {
      setFileStudies([]);
    } finally {
      setLoadingStudies(false);
    }
  };

  const handleAnalysisComplete = (result: AnalysisResult, file: File) => {
    // Auto-populate form with new analysis
    setEditFormData(prev => ({
      ...prev,
      // Map analysis fields to DB fields
      submission_date: result.date ? new Date(result.date).toISOString() : prev.submission_date,
      // We might map other fields if they existed in DB, e.g. reference_number
    }));
    toast({
      title: "تم تحليل الملف الجديد",
      description: "تم تحديث البيانات في النموذج. اضغط 'حفظ' لتأكيد التغييرات."
    });
    setIsReplacingFile(false); // Return to form view
  };

  /* ── Helpers ── */
  const getOpinionBadge = (opinion: string | null) => {
    switch (opinion) {
      case "رأي إيجابي": return <Badge className="bg-green-600 hover:bg-green-700">رأي إيجابي</Badge>;
      case "تحفظ": return <Badge className="bg-yellow-600 hover:bg-yellow-700">تحفظ</Badge>;
      case "مرفوض": return <Badge className="bg-red-600 hover:bg-red-700">مرفوض</Badge>;
      default: return <Badge variant="secondary">قيد الانتظار</Badge>;
    }
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-12 w-48" /><Skeleton className="h-[500px]" /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] gap-4">
      {/* ── HEADER ── */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <Archive className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">الأرشيف الرقمي</h1>
          <p className="text-muted-foreground text-sm">تصفح الخريطة والملفات في آن واحد</p>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <Card className="shrink-0">
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9 h-9 text-sm"
              />
            </div>
            <Select value={municipalityFilter} onValueChange={setMunicipalityFilter}>
              <SelectTrigger className="w-full md:w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="غرداية">غرداية</SelectItem>
                <SelectItem value="العطف">العطف</SelectItem>
                <SelectItem value="بونورة">بونورة</SelectItem>
              </SelectContent>
            </Select>
            <Select value={opinionFilter} onValueChange={setOpinionFilter}>
              <SelectTrigger className="w-full md:w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="رأي إيجابي">رأي إيجابي</SelectItem>
                <SelectItem value="تحفظ">تحفظ</SelectItem>
                <SelectItem value="مرفوض">مرفوض</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── MAIN CONTENT (SPLIT VIEW) ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4">

        {/* LIST VIEW (Left on Desktop) */}
        <div className={`md:col-span-5 lg:col-span-4 flex flex-col min-h-0 ${activeTab === 'map' ? 'hidden md:flex' : 'flex'}`}>
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-t-4 border-t-primary/20">
            <CardHeader className="p-3 pb-2 border-b bg-muted/20 shrink-0">
              <CardTitle className="text-sm flex justify-between">
                <span>قائمة الملفات ({filteredFiles?.length})</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 md:hidden" onClick={() => setActiveTab('map')}>
                  <MapIcon className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto w-full">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[80px]">رقم الملف</TableHead>
                    <TableHead>صاحب الملف</TableHead>
                    <TableHead className="w-[80px]">الوضعية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles?.map((file) => (
                    <TableRow
                      key={file.id}
                      id={`row-${file.id}`}
                      className={`cursor-pointer transition-colors ${selectedContractId === file.id ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-muted/50'}`}
                      onClick={() => handleRowClick(file)}
                    >
                      <TableCell className="font-mono text-xs font-bold">{file.file_number}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{file.full_name}</span>
                          <span className="text-[10px] text-muted-foreground flex gap-1">
                            <span>{file.municipality}</span>
                            {file.permit_type && <span>• {file.permit_type}</span>}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-col gap-1 items-center">
                          {getOpinionBadge(file.committee_opinion)}
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleView(file); }}>
                              <Eye className="w-3 h-3 text-muted-foreground" />
                            </Button>
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleEdit(file); }}>
                                <Edit className="w-3 h-3 text-blue-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* MAP VIEW (Right on Desktop) */}
        <div className={`md:col-span-7 lg:col-span-8 flex flex-col min-h-0 ${activeTab === 'list' ? 'hidden md:flex' : 'flex'}`}>
          <div className="md:hidden p-2 flex justify-end bg-background">
            <Button variant="outline" size="sm" onClick={() => setActiveTab('list')}>
              <List className="w-4 h-4 mr-2" /> العودة للقائمة
            </Button>
          </div>
          <div className="flex-1 rounded-xl overflow-hidden border shadow-sm h-full">
            <MapSelector
              selectedContractId={selectedContractId}
              flyToLocation={flyToLocation}
              onContractSelect={handleMapSelect}
            />
          </div>
        </div>
      </div>

      {/* ── EDIT DIALOG ── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الملف</DialogTitle>
            <DialogDescription>
              {selectedFile?.full_name} - {selectedFile?.file_number}
            </DialogDescription>
          </DialogHeader>

          {isReplacingFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-700 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  قم برفع الملف الجديد ليتم تحليله واستخراج البيانات تلقائياً
                </p>
                <Button variant="ghost" size="sm" onClick={() => setIsReplacingFile(false)}>
                  إلغاء
                </Button>
              </div>
              <div className="h-[500px] border rounded-lg">
                <DocumentAnalyzer onAnalysisComplete={handleAnalysisComplete} />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* METADATA FORM */}
              {/* STRICT GRID LAYOUT */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* RIGHT COLUMN: FORM INPUTS */}
                  <div className="space-y-4 order-2 lg:order-1">
                    <div className="space-y-2">
                      <Label className="text-right block">رقم الملف / السنة</Label>
                      <Input
                        value={editFormData.file_number && editFormData.year ? `${editFormData.file_number} / ${editFormData.year}` : editFormData.file_number || ''}
                        onChange={e => {
                          // Simple parser to allow editing
                          const val = e.target.value;
                          const parts = val.split('/').map(s => s.trim());
                          setEditFormData({
                            ...editFormData,
                            file_number: parts[0] || '',
                            year: parts[1] ? parseInt(parts[1]) : editFormData.year
                          });
                        }}
                        className="text-right font-mono font-bold text-lg"
                        dir="ltr"
                        placeholder="رقم / سنة"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-right block">الاسم الكامل</Label>
                      <Input
                        value={editFormData.full_name || ''}
                        onChange={e => setEditFormData({ ...editFormData, full_name: e.target.value })}
                        className="text-right"
                        dir="rtl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-right block">العنوان</Label>
                      <Input
                        value={editFormData.address || ''}
                        onChange={e => setEditFormData({ ...editFormData, address: e.target.value })}
                        className="text-right"
                        dir="rtl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-right block">البلدية</Label>
                      <Select
                        value={editFormData.municipality || 'غرداية'}
                        onValueChange={v => setEditFormData({ ...editFormData, municipality: v as "غرداية" | "العطف" | "بونورة" })}
                        dir="rtl"
                      >
                        <SelectTrigger className="text-right flex flex-row-reverse items-center justify-between">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="غرداية" className="text-right justify-end">غرداية</SelectItem>
                          <SelectItem value="العطف" className="text-right justify-end">العطف</SelectItem>
                          <SelectItem value="بونورة" className="text-right justify-end">بونورة</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* LEFT COLUMN: MAP */}
                  <div className="space-y-2 order-1 lg:order-2">
                    <Label className="text-right block">تحديد الموقع الجغرافي</Label>
                    {/* STRICT CAGE FOR MAP */}
                    <div className="relative w-full h-[350px] overflow-hidden rounded-xl border border-gray-300 z-0 bg-slate-100">
                      <PermitLocationPicker
                        value={
                          editFormData.location_lat !== undefined && editFormData.location_lng !== undefined &&
                            editFormData.location_lat !== null && editFormData.location_lng !== null
                            ? { lat: editFormData.location_lat, lng: editFormData.location_lng }
                            : null
                        }
                        onChange={(loc) => setEditFormData({
                          ...editFormData,
                          location_lat: loc?.lat ?? null,
                          location_lng: loc?.lng ?? null
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">الوثيقة الممسوحة ضوئياً</p>
                    <p className="text-xs text-muted-foreground">ملف PDF الحالي</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setIsReplacingFile(true)}>
                  <Upload className="w-4 h-4 ml-2" />
                  استبدال الملف
                </Button>
              </div>
            </div>
          )}

          {!isReplacingFile && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
              <Button
                onClick={() => selectedFile && updateFileMutation.mutate({ ...editFormData, id: selectedFile.id })}
                disabled={updateFileMutation.isPending}
              >
                {updateFileMutation.isPending ? <Loader2 className="animate-spin w-4 h-4 ml-2" /> : <Save className="w-4 h-4 ml-2" />}
                حفظ التعديلات
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DELETE DIALOG ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من نقل هذا الملف إلى سلة المحذوفات؟</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => selectedFile && softDeleteMutation.mutate(selectedFile.id)}>
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── VIEW DIALOG (Read Only) ── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تفاصيل الملف</DialogTitle></DialogHeader>
          {selectedFile && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><Label className="text-muted-foreground">الاسم:</Label> <p>{selectedFile.full_name}</p></div>
                <div><Label className="text-muted-foreground">الرقم:</Label> <p className="font-mono">{selectedFile.file_number}</p></div>
                <div><Label className="text-muted-foreground">البلدية:</Label> <p>{selectedFile.municipality}</p></div>
                <div><Label className="text-muted-foreground">العنوان:</Label> <p>{selectedFile.address}</p></div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">رأي اللجنة:</Label>
                  <div className="mt-1">{getOpinionBadge(selectedFile.committee_opinion)}</div>
                </div>
              </div>
              {fileStudies.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <h4 className="font-semibold mb-2">سجل الدراسات</h4>
                  <div className="max-h-40 overflow-y-auto border rounded">
                    <Table>
                      <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>الرأي</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {fileStudies.map(s => (
                          <TableRow key={s.id}>
                            <TableCell>{format(new Date(s.study_date), "yyyy-MM-dd")}</TableCell>
                            <TableCell>{s.committee_opinion}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div >
  );
}
