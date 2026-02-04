import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Download, Upload, Database, FileJson, FileSpreadsheet, FileCode, Loader2, AlertTriangle, FileText } from "lucide-react";
import * as XLSX from 'xlsx';

export default function Backup() {
  const { role, isViewer } = useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const canEdit = !isViewer && role === "admin";

  // Fetch all data for export
  const { data: allData, refetch } = useQuery({
    queryKey: ["backup-data"],
    queryFn: async () => {
      const [files, fileStudies, minutes, summons, legalDocs] = await Promise.all([
        supabase.from("files").select("*"),
        supabase.from("file_studies").select("*"),
        supabase.from("meeting_minutes").select("*"),
        supabase.from("summons").select("*"),
        supabase.from("legal_documents").select("*"),
      ]);

      return {
        files: files.data || [],
        file_studies: fileStudies.data || [],
        meeting_minutes: minutes.data || [],
        summons: summons.data || [],
        legal_documents: legalDocs.data || [],
        exported_at: new Date().toISOString(),
      };
    },
    enabled: false,
  });

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToJSON = async () => {
    setIsExporting(true);
    try {
      const result = await refetch();
      if (result.data) {
        const json = JSON.stringify(result.data, null, 2);
        downloadFile(json, `opvm_backup_${new Date().toISOString().split("T")[0]}.json`, "application/json");
        toast({ title: "تم التصدير", description: "تم تصدير البيانات بصيغة JSON" });
      }
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في تصدير البيانات", variant: "destructive" });
    }
    setIsExporting(false);
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      const result = await refetch();
      if (result.data) {
        // Export files table as CSV
        const files = result.data.files;
        if (files.length > 0) {
          const headers = Object.keys(files[0]).join(",");
          const rows = files.map(row => 
            Object.values(row).map(v => 
              typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v
            ).join(",")
          );
          const csv = "\uFEFF" + [headers, ...rows].join("\n");
          downloadFile(csv, `opvm_files_${new Date().toISOString().split("T")[0]}.csv`, "text/csv;charset=utf-8");
        }
        toast({ title: "تم التصدير", description: "تم تصدير الملفات بصيغة CSV" });
      }
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في تصدير البيانات", variant: "destructive" });
    }
    setIsExporting(false);
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const result = await refetch();
      if (result.data) {
        const workbook = XLSX.utils.book_new();
        
        // Files sheet
        if (result.data.files.length > 0) {
          const filesSheet = XLSX.utils.json_to_sheet(result.data.files);
          XLSX.utils.book_append_sheet(workbook, filesSheet, "الملفات");
        }
        
        // File studies sheet
        if (result.data.file_studies.length > 0) {
          const studiesSheet = XLSX.utils.json_to_sheet(result.data.file_studies);
          XLSX.utils.book_append_sheet(workbook, studiesSheet, "سجل الدراسات");
        }
        
        // Meeting minutes sheet
        if (result.data.meeting_minutes.length > 0) {
          const minutesSheet = XLSX.utils.json_to_sheet(result.data.meeting_minutes);
          XLSX.utils.book_append_sheet(workbook, minutesSheet, "محاضر الجلسات");
        }
        
        // Summons sheet
        if (result.data.summons.length > 0) {
          const summonsSheet = XLSX.utils.json_to_sheet(result.data.summons);
          XLSX.utils.book_append_sheet(workbook, summonsSheet, "الاستدعاءات");
        }
        
        // Legal documents sheet
        if (result.data.legal_documents.length > 0) {
          const legalSheet = XLSX.utils.json_to_sheet(result.data.legal_documents);
          XLSX.utils.book_append_sheet(workbook, legalSheet, "المراسيم والتعليمات");
        }
        
        XLSX.writeFile(workbook, `opvm_backup_${new Date().toISOString().split("T")[0]}.xlsx`);
        toast({ title: "تم التصدير", description: "تم تصدير البيانات بصيغة Excel" });
      }
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في تصدير البيانات", variant: "destructive" });
    }
    setIsExporting(false);
  };

  const exportToSQL = async () => {
    setIsExporting(true);
    try {
      const result = await refetch();
      if (result.data) {
        let sql = "-- OPVM Database Backup\n";
        sql += `-- Exported at: ${result.data.exported_at}\n\n`;

        // Generate INSERT statements for files
        result.data.files.forEach(file => {
          const columns = Object.keys(file).join(", ");
          const values = Object.values(file).map(v => {
            if (v === null) return "NULL";
            if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
            return v;
          }).join(", ");
          sql += `INSERT INTO files (${columns}) VALUES (${values});\n`;
        });

        downloadFile(sql, `opvm_backup_${new Date().toISOString().split("T")[0]}.sql`, "text/plain");
        toast({ title: "تم التصدير", description: "تم تصدير البيانات بصيغة SQL" });
      }
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في تصدير البيانات", variant: "destructive" });
    }
    setIsExporting(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/json") {
      setImportFile(file);
    } else {
      toast({ title: "خطأ", description: "يرجى اختيار ملف JSON صالح", variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);

      // Validate structure
      if (!data.files || !Array.isArray(data.files)) {
        throw new Error("Invalid backup file structure");
      }

      // Import files (skip existing by id)
      for (const file of data.files) {
        const { error } = await supabase.from("files").upsert(file, { onConflict: "id" });
        if (error) console.error("Error importing file:", error);
      }

      // Import file_studies
      if (data.file_studies) {
        for (const study of data.file_studies) {
          await supabase.from("file_studies").upsert(study, { onConflict: "id" });
        }
      }

      // Import meeting_minutes
      if (data.meeting_minutes) {
        for (const minute of data.meeting_minutes) {
          await supabase.from("meeting_minutes").upsert(minute, { onConflict: "id" });
        }
      }

      // Import summons
      if (data.summons) {
        for (const summon of data.summons) {
          await supabase.from("summons").upsert(summon, { onConflict: "id" });
        }
      }

      // Import legal_documents
      if (data.legal_documents) {
        for (const doc of data.legal_documents) {
          await supabase.from("legal_documents").upsert(doc, { onConflict: "id" });
        }
      }

      toast({ title: "تم الاستيراد", description: "تم استيراد البيانات بنجاح" });
      setImportDialogOpen(false);
      setImportFile(null);
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "خطأ", description: "فشل في استيراد البيانات. تأكد من صحة الملف", variant: "destructive" });
    }
    setIsImporting(false);
  };

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">غير مصرح</h2>
            <p className="text-muted-foreground">هذه الصفحة متاحة للمدير فقط</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <Database className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">النسخ الاحتياطي</h1>
          <p className="text-muted-foreground">تصدير واستيراد بيانات النظام</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              تصدير البيانات
            </CardTitle>
            <CardDescription>قم بتنزيل نسخة احتياطية من جميع البيانات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={exportToJSON}
              disabled={isExporting}
              className="w-full justify-start"
              variant="outline"
            >
              <FileJson className="w-4 h-4 ml-2" />
              تصدير JSON (كامل)
              {isExporting && <Loader2 className="w-4 h-4 mr-auto animate-spin" />}
            </Button>
            <Button
              onClick={exportToCSV}
              disabled={isExporting}
              className="w-full justify-start"
              variant="outline"
            >
              <FileSpreadsheet className="w-4 h-4 ml-2" />
              تصدير CSV (الملفات فقط)
              {isExporting && <Loader2 className="w-4 h-4 mr-auto animate-spin" />}
            </Button>
            <Button
              onClick={exportToExcel}
              disabled={isExporting}
              className="w-full justify-start"
              variant="outline"
            >
              <FileText className="w-4 h-4 ml-2" />
              تصدير Excel (.xlsx)
              {isExporting && <Loader2 className="w-4 h-4 mr-auto animate-spin" />}
            </Button>
            <Button
              onClick={exportToSQL}
              disabled={isExporting}
              className="w-full justify-start"
              variant="outline"
            >
              <FileCode className="w-4 h-4 ml-2" />
              تصدير SQL
              {isExporting && <Loader2 className="w-4 h-4 mr-auto animate-spin" />}
            </Button>
          </CardContent>
        </Card>

        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              استيراد البيانات
            </CardTitle>
            <CardDescription>استعادة البيانات من نسخة احتياطية JSON</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setImportDialogOpen(true)}
              className="w-full"
              style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}
            >
              <Upload className="w-4 h-4 ml-2" />
              رفع ملف النسخة الاحتياطية
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              ⚠️ سيتم دمج البيانات المستوردة مع البيانات الحالية. السجلات الموجودة بنفس المعرف سيتم تحديثها.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>استيراد النسخة الاحتياطية</DialogTitle>
            <DialogDescription>
              اختر ملف JSON للنسخة الاحتياطية لاستيراده
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ملف النسخة الاحتياطية (JSON)</Label>
              <Input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
              />
            </div>
            {importFile && (
              <p className="text-sm text-muted-foreground">
                الملف المحدد: {importFile.name}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importFile || isImporting}
              style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : "استيراد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
