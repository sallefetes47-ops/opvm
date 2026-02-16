import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Plus, Eye, Trash, Search, Trash2, RefreshCcw, ExternalLink, FileText } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FileImport } from "@/components/FileImport";
import { useDocumentManager } from "@/hooks/useDocumentManager";
import { FileDropZone } from "@/components/FileDropZone";

interface SummonsFormData {
  summons_date: Date | undefined;
  summons_number: string;
  committee_members: string;
  venue: string;
  attendance_status: string;
  notes: string;
}

const STORAGE_KEY = "opvm_summons";

export default function Summons() {
  const { user, role, isViewer } = useAuth();
  const { toast } = useToast();

  // Use shared document manager hook
  const {
    activeDocuments,
    trashedDocuments,
    addDocument,
    softDeleteDocument,
    restoreDocument,
    permanentDeleteDocument,
    viewOriginalDocument
  } = useDocumentManager({ storageKey: STORAGE_KEY });

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewSummons, setViewSummons] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<SummonsFormData>({
    summons_date: undefined,
    summons_number: "",
    committee_members: "",
    venue: "",
    attendance_status: "",
    notes: "",
  });

  const canEdit = !isViewer && role !== "viewer";

  const handleDataExtracted = (data: Record<string, any>) => {
    setFormData({
      summons_date: data.summons_date ? new Date(data.summons_date) : undefined,
      summons_number: data.summons_number || "",
      committee_members: Array.isArray(data.committee_members) ? data.committee_members.join(", ") : (data.committee_members || ""),
      venue: data.venue || "",
      attendance_status: data.attendance_status || "",
      notes: data.notes || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!newFile) {
      toast({ title: "خطأ", description: "يرجى إرفاق ملف الاستدعاء (PDF/Image)", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDocument(formData, newFile);
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled in hook (toast)
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      summons_date: undefined,
      summons_number: "",
      committee_members: "",
      venue: "",
      attendance_status: "",
      notes: "",
    });
    setNewFile(null);
  };

  // Switch between Active and Trashed based on Recycle Bin toggle
  const displayedDocs = showRecycleBin ? trashedDocuments : activeDocuments;

  const filteredSummons = displayedDocs.filter(s =>
    s.summons_number?.includes(searchTerm) ||
    s.venue?.includes(searchTerm) ||
    (s.committee_members || "").includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">استدعاءات الشباك الواحد</h1>
            <p className="text-muted-foreground">إدارة استدعاءات أعضاء اللجنة</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            {!showRecycleBin && (
              <>
                <FileImport
                  documentType="summons"
                  onDataExtracted={handleDataExtracted}
                  buttonLabel="استيراد من ملف"
                />
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة استدعاء
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>إضافة استدعاء جديد</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>تاريخ الاستدعاء</Label>
                          <DateInput
                            value={formData.summons_date}
                            onChange={(date) => setFormData({ ...formData, summons_date: date })}
                            placeholder="DD/MM/YYYY"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>رقم الاستدعاء</Label>
                          <Input
                            value={formData.summons_number}
                            onChange={(e) => setFormData({ ...formData, summons_number: e.target.value })}
                            placeholder="مثال: 2026/001"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>أعضاء اللجنة (مفصولين بفاصلة)</Label>
                        <Input
                          value={formData.committee_members}
                          onChange={(e) => setFormData({ ...formData, committee_members: e.target.value })}
                          placeholder="العضو الأول، العضو الثاني، ..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>مكان الاجتماع</Label>
                        <Input
                          value={formData.venue}
                          onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                          placeholder="أدخل مكان الاجتماع"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>حالة الحضور</Label>
                        <Select
                          value={formData.attendance_status}
                          onValueChange={(value) => setFormData({ ...formData, attendance_status: value })}
                        >
                          <SelectTrigger className="text-right flex flex-row-reverse items-center justify-between">
                            <SelectValue placeholder="اختر الحالة" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="مكتمل">مكتمل</SelectItem>
                            <SelectItem value="جزئي">جزئي</SelectItem>
                            <SelectItem value="لم ينعقد">لم ينعقد</SelectItem>
                            <SelectItem value="معلق">معلق</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>ملاحظات</Label>
                        <Textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="ملاحظات إضافية"
                          rows={2}
                        />
                      </div>

                      {/* File Drop Zone */}
                      <div className="col-span-2 space-y-2">
                        <Label className="block text-sm font-medium mb-2">ملف الاستدعاء (PDF/صورة) *</Label>
                        <FileDropZone
                          onFileSelect={setNewFile}
                          selectedFile={newFile}
                          onClear={() => setNewFile(null)}
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                          إلغاء
                        </Button>
                        <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {/* Recycle Bin Toggle */}
            <Button
              variant={showRecycleBin ? "destructive" : "outline"}
              onClick={() => setShowRecycleBin(!showRecycleBin)}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {showRecycleBin ? "العودة للقائمة" : "سلة المحذوفات"}
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث في الاستدعاءات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {showRecycleBin ? "سلة المحذوفات (الاستدعاءات)" : "قائمة الاستدعاءات"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSummons.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {showRecycleBin ? "سلة المحذوفات فارغة" : "لا توجد استدعاءات"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرقم</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المكان</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummons.map((summons) => (
                  <TableRow key={summons.id}>
                    <TableCell className="font-medium">{summons.summons_number || "-"}</TableCell>
                    <TableCell>
                      {summons.summons_date ? format(new Date(summons.summons_date), "d MMMM yyyy", { locale: ar }) : "-"}
                    </TableCell>
                    <TableCell>{summons.venue || "-"}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs",
                        summons.attendance_status === "مكتمل" && "bg-green-100 text-green-800",
                        summons.attendance_status === "جزئي" && "bg-yellow-100 text-yellow-800",
                        summons.attendance_status === "لم ينعقد" && "bg-red-100 text-red-800",
                        summons.attendance_status === "معلق" && "bg-gray-100 text-gray-800",
                      )}>
                        {summons.attendance_status || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {/* View Original (File) */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          onClick={(e) => viewOriginalDocument(e, summons)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>

                        <Button size="icon" variant="ghost" onClick={() => setViewSummons(summons)}>
                          <Eye className="w-4 h-4" />
                        </Button>

                        {showRecycleBin ? (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-green-600 hover:text-green-800 hover:bg-green-50"
                              onClick={() => restoreDocument(summons.id)}
                            >
                              <RefreshCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              onClick={() => permanentDeleteDocument(summons.id)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => softDeleteDocument(summons.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Dialog (Details) */}
      <Dialog open={!!viewSummons} onOpenChange={() => setViewSummons(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل الاستدعاء</DialogTitle>
          </DialogHeader>
          {viewSummons && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">رقم الاستدعاء</Label>
                  <p className="font-medium">{viewSummons.summons_number || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">التاريخ</Label>
                  <p className="font-medium">
                    {viewSummons.summons_date ? format(new Date(viewSummons.summons_date), "d MMMM yyyy", { locale: ar }) : "-"}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">أعضاء اللجنة</Label>
                <p className="font-medium">{viewSummons.committee_members || "-"}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">المكان</Label>
                  <p className="font-medium">{viewSummons.venue || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">الحالة</Label>
                  <p className="font-medium">{viewSummons.attendance_status || "-"}</p>
                </div>
              </div>
              {viewSummons.notes && (
                <div>
                  <Label className="text-muted-foreground">ملاحظات</Label>
                  <p className="font-medium whitespace-pre-wrap">{viewSummons.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
