﻿import { useState } from "react";
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
import { Loader2, FileText, Plus, Eye, Trash, Search, Trash2, RefreshCcw, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FileImport } from "@/components/FileImport";
import { useDocumentManager } from "@/hooks/useDocumentManager";
import { FileDropZone } from "@/components/FileDropZone";

interface MinuteFormData {
  session_date: Date | undefined;
  session_number: string;
  attendees: string;
  agenda: string;
  decisions: string;
  notes: string;
}

const STORAGE_KEY = "opvm_minutes";

export default function Minutes() {
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
  const [viewMinute, setViewMinute] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<MinuteFormData>({
    session_date: undefined,
    session_number: "",
    attendees: "",
    agenda: "",
    decisions: "",
    notes: "",
  });

  const canEdit = !isViewer && role !== "viewer";

  const handleDataExtracted = (data: Record<string, any>) => {
    setFormData({
      session_date: data.session_date ? new Date(data.session_date) : undefined,
      session_number: data.session_number || "",
      attendees: Array.isArray(data.attendees) ? data.attendees.join(", ") : (data.attendees || ""),
      agenda: data.agenda || "",
      decisions: data.decisions || "",
      notes: data.notes || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!newFile) {
      toast({ title: "خطأ", description: "يرجى إرفاق ملف المحضر (PDF/Image)", variant: "destructive" });
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
      session_date: undefined,
      session_number: "",
      attendees: "",
      agenda: "",
      decisions: "",
      notes: "",
    });
    setNewFile(null);
  };

  // Switch between Active and Trashed based on Recycle Bin toggle
  const displayedDocs = showRecycleBin ? trashedDocuments : activeDocuments;

  const filteredMinutes = displayedDocs.filter(m =>
    m.session_number?.includes(searchTerm) ||
    m.agenda?.includes(searchTerm) ||
    m.decisions?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">محاضر الجلسات</h1>
            <p className="text-muted-foreground">إدارة محاضر اجتماعات اللجنة</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            {!showRecycleBin && (
              <>
                <FileImport
                  documentType="meeting_minutes"
                  onDataExtracted={handleDataExtracted}
                  buttonLabel="استيراد من ملف"
                />
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة محضر
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>إضافة محضر جلسة جديد</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>تاريخ الجلسة</Label>
                          <DateInput
                            value={formData.session_date}
                            onChange={(date) => setFormData({ ...formData, session_date: date })}
                            placeholder="YYYY/MM/DD"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>رقم الجلسة</Label>
                          <Input
                            value={formData.session_number}
                            onChange={(e) => setFormData({ ...formData, session_number: e.target.value })}
                            placeholder="مثال: 2026/01"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>الحاضرون (مفصولين بفاصلة)</Label>
                        <Input
                          value={formData.attendees}
                          onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                          placeholder="الاسم الأول، الاسم الثاني، ..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>جدول الأعمال</Label>
                        <Textarea
                          value={formData.agenda}
                          onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                          placeholder="أدخل جدول الأعمال"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>القرارات</Label>
                        <Textarea
                          value={formData.decisions}
                          onChange={(e) => setFormData({ ...formData, decisions: e.target.value })}
                          placeholder="أدخل القرارات المتخذة"
                          rows={3}
                        />
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
                        <Label className="block text-sm font-medium mb-2">ملف المحضر (PDF/صورة) *</Label>
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
              placeholder="بحث في المحاضر..."
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
            {showRecycleBin ? "سلة المحذوفات (المحاضر)" : "قائمة المحاضر"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMinutes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {showRecycleBin ? "سلة المحذوفات فارغة" : "لا توجد محاضر"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[15%] text-right py-4 px-6">رقم الجلسة</TableHead>
                  <TableHead className="w-[20%] text-right py-4 px-6">التاريخ</TableHead>
                  <TableHead className="w-[35%] text-center py-4 px-6">عدد الحاضرين</TableHead>
                  <TableHead className="w-[30%] text-left py-4 px-6">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMinutes.map((minute) => (
                  <TableRow key={minute.id}>
                    <TableCell className="text-right py-4 px-6 font-medium">{minute.session_number || "-"}</TableCell>
                    <TableCell className="text-right py-4 px-6">
                      {minute.session_date ? format(new Date(minute.session_date), "d MMMM yyyy", { locale: ar }) : "-"}
                    </TableCell>
                    <TableCell className="text-center py-4 px-6">{minute.attendees?.split(',').length || 0}</TableCell>
                    <TableCell className="text-left py-4 px-6">
                      <div className="flex items-center justify-end gap-3">
                        {/* View Original (File) */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          onClick={(e) => viewOriginalDocument(e, minute)}
                          title="معاينة الملف"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>

                        <Button size="icon" variant="ghost" onClick={() => setViewMinute(minute)} title="عرض التفاصيل">
                          <Eye className="w-4 h-4" />
                        </Button>

                        {showRecycleBin ? (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-green-600 hover:text-green-800 hover:bg-green-50"
                              onClick={() => restoreDocument(minute.id)}
                              title="استرجاع"
                            >
                              <RefreshCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              onClick={() => permanentDeleteDocument(minute.id)}
                              title="حذف نهائي"
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
                              onClick={() => softDeleteDocument(minute.id)}
                              title="نقل للسلة"
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

      {/* View Dialog */}
      <Dialog open={!!viewMinute} onOpenChange={() => setViewMinute(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل المحضر</DialogTitle>
          </DialogHeader>
          {viewMinute && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">رقم الجلسة</Label>
                  <p className="font-medium">{viewMinute.session_number || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">التاريخ</Label>
                  <p className="font-medium">
                    {viewMinute.session_date ? format(new Date(viewMinute.session_date), "d MMMM yyyy", { locale: ar }) : "-"}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">الحاضرون</Label>
                <p className="font-medium">{viewMinute.attendees || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">جدول الأعمال</Label>
                <p className="font-medium whitespace-pre-wrap">{viewMinute.agenda || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">القرارات</Label>
                <p className="font-medium whitespace-pre-wrap">{viewMinute.decisions || "-"}</p>
              </div>
              {viewMinute.notes && (
                <div>
                  <Label className="text-muted-foreground">ملاحظات</Label>
                  <p className="font-medium whitespace-pre-wrap">{viewMinute.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
