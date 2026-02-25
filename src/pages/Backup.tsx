import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Download, Upload, FolderSync, FileJson, FileSpreadsheet, FileCode, Loader2, AlertTriangle, FileText, Database as DatabaseIcon, CheckCircle, AlertCircle, FileImage, ChevronDown } from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format as formatDate } from "date-fns";
import { AMIRI_FONT_BASE64 } from "@/lib/fonts";
import { fixArabicText } from "@/lib/pdf-utils";

interface ExportStats {
  files: number;
  file_studies: number;
  meeting_minutes: number;
  summons: number;
  legal_documents: number;
  total: number;
}

export default function Backup() {
  const { role, isViewer } = useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileType, setImportFileType] = useState<'json' | 'csv' | null>(null);
  const [importTargetTable, setImportTargetTable] = useState<string>('files');
  const dropRef = useRef<HTMLDivElement | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [exportStats, setExportStats] = useState<ExportStats | null>(null);

  const canEdit = !isViewer && !!role; // allow any non-viewer authenticated user (admin or employee)

  // Fetch all data for export
  const { data: allData, refetch } = useQuery({
    queryKey: ["backup-data"],
    queryFn: async () => {
      setExportProgress(0);
      const [files, fileStudies, minutes, summons, legalDocs] = await Promise.all([
        supabase.from("files").select("*"),
        supabase.from("file_studies").select("*"),
        supabase.from("meeting_minutes").select("*"),
        supabase.from("summons").select("*"),
        supabase.from("legal_documents").select("*"),
      ]);

      const stats: ExportStats = {
        files: files.data?.length || 0,
        file_studies: fileStudies.data?.length || 0,
        meeting_minutes: minutes.data?.length || 0,
        summons: summons.data?.length || 0,
        legal_documents: legalDocs.data?.length || 0,
        total: (files.data?.length || 0) + (fileStudies.data?.length || 0) + (minutes.data?.length || 0) + (summons.data?.length || 0) + (legalDocs.data?.length || 0),
      };
      setExportStats(stats);

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

  const validateJsonStructure = (data: any): boolean => {
    if (typeof data !== 'object' || data === null) return false;
    const requiredFields = ['files', 'file_studies', 'meeting_minutes', 'summons', 'legal_documents'];
    return requiredFields.every(field => Array.isArray(data[field]));
  };

  const parseCSV = (text: string) => {
    // Simple CSV parser that handles quoted fields
    const rows: string[][] = [];
    const re = /(?:\s*\"((?:\\\"|[^"])*?)\"\s*|([^,]+)|)(?:,|$)/g;
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    for (const line of lines) {
      const row: string[] = [];
      let match: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((match = re.exec(line)) && match[0] !== '') {
        const val = match[1] ?? match[2] ?? '';
        row.push(val.replace(/\\\"/g, '"'));
      }
      // If regex fails to parse, fallback to naive split
      if (row.length === 0) {
        rows.push(line.split(',').map(c => c.trim()));
      } else {
        rows.push(row);
      }
    }
    const headers = rows[0] || [];
    const records = rows.slice(1).map(r => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
      return obj;
    });
    return { headers, records };
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.json')) {
      setImportFileType('json');
      setImportFile(file);
    } else if (file.name.endsWith('.csv')) {
      setImportFileType('csv');
      setImportFile(file);
    } else {
      toast({ title: '❌ خطأ', description: 'الملف يجب أن يكون JSON أو CSV', variant: 'destructive' });
    }
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const exportToJSON = async () => {
    setIsExporting(true);
    setExportProgress(0);
    try {
      setExportProgress(30);
      const result = await refetch();

      if (result.data) {
        setExportProgress(70);
        const json = JSON.stringify(result.data, null, 2);
        setExportProgress(90);

        downloadFile(json, `opvm_backup_${new Date().toISOString().split("T")[0]}.json`, "application/json");
        setExportProgress(100);

        toast({
          title: "✅ تم التصدير",
          description: `تم تصدير ${exportStats?.total || 0} سجل بصيغة JSON`
        });
      }
    } catch (error) {
      toast({ title: "❌ خطأ", description: "فشل في تصدير البيانات", variant: "destructive" });
    }
    setTimeout(() => setExportProgress(0), 1000);
    setIsExporting(false);
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    setExportProgress(0);
    try {
      setExportProgress(20);
      const result = await refetch();

      if (result.data) {
        const workbook = XLSX.utils.book_new();
        let sheetCount = 0;

        // Summary sheet
        const summarySheet = XLSX.utils.json_to_sheet([{
          'البيان': 'عدد الملفات',
          'القيمة': result.data.files.length,
          'التاريخ': formatDate(new Date(), "dd/MM/yyyy"),
        }, {
          'البيان': 'سجلات الدراسات',
          'القيمة': result.data.file_studies.length,
        }, {
          'البيان': 'محاضر الجلسات',
          'القيمة': result.data.meeting_minutes.length,
        }, {
          'البيان': 'الاستدعاءات',
          'القيمة': result.data.summons.length,
        }, {
          'البيان': 'المراسيم والتعليمات',
          'القيمة': result.data.legal_documents.length,
        }, {
          'البيان': 'المجموع',
          'القيمة': exportStats?.total || 0,
        }]);
        XLSX.utils.book_append_sheet(workbook, summarySheet, "ملخص");
        sheetCount++;

        setExportProgress(40);

        // Files sheet
        if (result.data.files.length > 0) {
          const filesSheet = XLSX.utils.json_to_sheet(result.data.files);
          XLSX.utils.book_append_sheet(workbook, filesSheet, "الملفات");
          sheetCount++;
        }

        setExportProgress(55);

        // File studies sheet
        if (result.data.file_studies.length > 0) {
          const studiesSheet = XLSX.utils.json_to_sheet(result.data.file_studies);
          XLSX.utils.book_append_sheet(workbook, studiesSheet, "سجل الدراسات");
          sheetCount++;
        }

        setExportProgress(70);

        // Meeting minutes sheet
        if (result.data.meeting_minutes.length > 0) {
          const minutesSheet = XLSX.utils.json_to_sheet(result.data.meeting_minutes);
          XLSX.utils.book_append_sheet(workbook, minutesSheet, "محاضر الجلسات");
          sheetCount++;
        }

        // Summons sheet
        if (result.data.summons.length > 0) {
          const summonsSheet = XLSX.utils.json_to_sheet(result.data.summons);
          XLSX.utils.book_append_sheet(workbook, summonsSheet, "الاستدعاءات");
          sheetCount++;
        }

        setExportProgress(85);

        // Legal documents sheet
        if (result.data.legal_documents.length > 0) {
          const legalSheet = XLSX.utils.json_to_sheet(result.data.legal_documents);
          XLSX.utils.book_append_sheet(workbook, legalSheet, "المراسيم والتعليمات");
          sheetCount++;
        }

        setExportProgress(95);
        XLSX.writeFile(workbook, `opvm_backup_${new Date().toISOString().split("T")[0]}.xlsx`);
        setExportProgress(100);

        toast({
          title: "✅ تم التصدير",
          description: `تم تصدير ${sheetCount} ورقة عمل بصيغة Excel`
        });
      }
    } catch (error) {
      toast({ title: "❌ خطأ", description: "فشل في تصدير البيانات", variant: "destructive" });
    }
    setTimeout(() => setExportProgress(0), 1000);
    setIsExporting(false);
  };

  const generatePDFReport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    try {
      setExportProgress(20);
      const result = await refetch();

      if (result.data) {
        const doc = new jsPDF('p', 'mm', 'a4');
        const timestamp = formatDate(new Date(), "dd/MM/yyyy");
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 15;

        // Set RTL mode for Arabic text
        doc.addFileToVFS('Amiri-Regular.ttf', AMIRI_FONT_BASE64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');
        doc.setR2L(true);

        // Add Bureau Logo at top center (graceful fallback to text if missing)
        setExportProgress(30);
        let logoLoaded = false;
        try {
          const logoUrl = '/Capture.PNG';
          const logoWidth = 40;
          const logoHeight = 30;
          const logoX = (pageWidth - logoWidth) / 2;

          const resp = await fetch(logoUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            // Validate it's actually an image
            if (blob.type.startsWith('image/')) {
              const dataUrl: string = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              doc.addImage(dataUrl, 'PNG', logoX, yPosition, logoWidth, logoHeight);
              yPosition += 35;
              logoLoaded = true;
            }
          }
        } catch (logoErr) {
          console.warn('Logo could not be loaded into PDF, continuing with text header only.', logoErr);
        }

        // Fallback: render text header if logo failed
        if (!logoLoaded) {
          doc.setFontSize(14);
          doc.setFont('Amiri', 'normal');
          doc.text(fixArabicText('ديوان حماية وادي ميزاب وترقيته'), pageWidth / 2, yPosition + 10, { align: 'center' });
          yPosition += 20;
        }

        // Title
        doc.setFontSize(16);
        doc.setFont('Amiri', 'normal');
        doc.text(fixArabicText('تقرير النسخة الاحتياطية'), pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;

        // Subtitle
        doc.setFontSize(12);
        doc.setFont('Amiri', 'normal');
        doc.text(fixArabicText('نظام إدارة ملفات التعمير'), pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 12;

        // Report metadata
        doc.setFontSize(10);
        doc.text(`${fixArabicText('التاريخ')}: ${timestamp}`, pageWidth - 15, yPosition, { align: 'right' });
        yPosition += 6;
        doc.text(`${fixArabicText('الوقت')}: ${new Date().toLocaleTimeString('en-GB')}`, pageWidth - 15, yPosition, { align: 'right' });
        yPosition += 10;

        // Summary table
        setExportProgress(50);
        const summaryData = [
          [fixArabicText('البيان'), fixArabicText('العدد')],
          [fixArabicText('الملفات'), String(result.data.files.length)],
          [fixArabicText('سجلات الدراسات'), String(result.data.file_studies.length)],
          [fixArabicText('محاضر الجلسات'), String(result.data.meeting_minutes.length)],
          [fixArabicText('الاستدعاءات'), String(result.data.summons.length)],
          [fixArabicText('المراسيم والتعليمات'), String(result.data.legal_documents.length)],
          [fixArabicText('المجموع'), String(exportStats?.total || 0)],
        ];

        autoTable(doc, {
          head: [summaryData[0]],
          body: summaryData.slice(1),
          startY: yPosition,
          theme: 'grid',
          styles: {
            font: 'Amiri',
            fontSize: 10,
            textColor: [0, 0, 0],
            fillColor: [212, 175, 55], // Gold color
            lineColor: [212, 175, 55],
            halign: 'right',
            valign: 'middle',
            cellPadding: 4,
          },
          headStyles: {
            fillColor: [212, 175, 55],
            textColor: [255, 255, 255],
            fontStyle: 'normal', // Use normal as we only embedded regular
            font: 'Amiri',
            halign: 'right',
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245],
          },
          margin: { left: 15, right: 15 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        // Files sheet (if records exist)
        setExportProgress(60);
        if (result.data.files.length > 0) {
          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = 15;
          }
          doc.setFontSize(12);
          doc.setFont('Amiri', 'normal');
          doc.text(fixArabicText('قائمة الملفات'), pageWidth / 2, yPosition, { align: 'center' });
          yPosition += 8;

          const filesHeaders = Object.keys(result.data.files[0] || {}).slice(0, 5).map(h => fixArabicText(h));
          const filesData = result.data.files.slice(0, 20).map(f => filesHeaders.map((_, i) => {
            const keys = Object.keys(result.data.files[0] || {}).slice(0, 5);
            return fixArabicText(String(f[keys[i] as keyof typeof f] || ''));
          }));

          autoTable(doc, {
            head: [filesHeaders],
            body: filesData,
            startY: yPosition,
            theme: 'striped',
            styles: { font: 'Amiri', fontSize: 8, halign: 'right' },
            headStyles: { fontStyle: 'normal', font: 'Amiri' },
            margin: { left: 15, right: 15 },
          });

          yPosition = (doc as any).lastAutoTable.finalY + 8;
        }

        // Meeting minutes (if records exist)
        setExportProgress(75);
        if (result.data.meeting_minutes.length > 0) {
          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = 15;
          }
          doc.setFontSize(12);
          doc.setFont('Amiri', 'normal');
          doc.text(fixArabicText('محاضر الجلسات'), pageWidth / 2, yPosition, { align: 'center' });
          yPosition += 8;

          const minutesHeaders = Object.keys(result.data.meeting_minutes[0] || {}).slice(0, 5).map(h => fixArabicText(h));
          const minutesData = result.data.meeting_minutes.slice(0, 15).map(m => minutesHeaders.map((_, i) => {
            const keys = Object.keys(result.data.meeting_minutes[0] || {}).slice(0, 5);
            return fixArabicText(String(m[keys[i] as keyof typeof m] || ''));
          }));

          autoTable(doc, {
            head: [minutesHeaders],
            body: minutesData,
            startY: yPosition,
            theme: 'striped',
            styles: { font: 'Amiri', fontSize: 8, halign: 'right' },
            headStyles: { fontStyle: 'normal', font: 'Amiri' },
            margin: { left: 15, right: 15 },
          });
        }

        // Footer with timestamp
        setExportProgress(85);
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(
            fixArabicText(`الصفحة ${i} من ${pageCount}`),
            pageWidth / 2,
            pageHeight - 8,
            { align: 'center' }
          );
        }

        setExportProgress(95);
        doc.save(`opvm_backup_${new Date().toISOString().split('T')[0]}.pdf`);
        setExportProgress(100);

        toast({
          title: "✅ تم الإنشاء",
          description: "تم إنشاء تقرير PDF بنجاح مع شعار المكتب بدقة عالية"
        });
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: "❌ خطأ", description: `فشل في إنشاء التقرير: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`, variant: "destructive" });
    }
    setTimeout(() => setExportProgress(0), 1000);
    setIsExporting(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.json')) {
        setImportFileType('json');
        setImportFile(file);
      } else if (file.name.endsWith('.csv')) {
        setImportFileType('csv');
        setImportFile(file);
      } else {
        toast({ title: "❌ خطأ", description: "يرجى اختيار ملف JSON أو CSV صالح", variant: "destructive" });
      }
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setImportProgress(0);
    try {
      setImportProgress(10);
      const text = await importFile.text();

      if (importFileType === 'json') {
        const data = JSON.parse(text);
        setImportProgress(20);

        // Validate structure
        if (!validateJsonStructure(data)) {
          throw new Error("صيغة الملف غير صحيحة. تأكد من أن الملف يحتوي على جميع الجداول المطلوبة");
        }

        let importedRecords = 0;
        const totalRecords = (data.files?.length || 0) + (data.file_studies?.length || 0) + (data.meeting_minutes?.length || 0) + (data.summons?.length || 0) + (data.legal_documents?.length || 0) || 1;

        // Import each table by upserting on id
        const tables = ['files', 'file_studies', 'meeting_minutes', 'summons', 'legal_documents'];
        for (const table of tables) {
          const rows = data[table];
          if (Array.isArray(rows) && rows.length > 0) {
            for (const row of rows) {
              await supabase.from(table as any).upsert(row, { onConflict: 'id' });
              importedRecords++;
              setImportProgress(20 + (importedRecords / totalRecords) * 60);
            }
          }
        }

        setImportProgress(95);
        toast({ title: "✅ تم الاستيراد", description: `تم استيراد ${importedRecords} سجل بنجاح` });
        setImportProgress(100);
        setTimeout(() => {
          setImportDialogOpen(false);
          setImportFile(null);
          setImportFileType(null);
          setImportProgress(0);
        }, 1000);
      } else if (importFileType === 'csv') {
        // CSV import - requires the user to select the target table
        const parsed = parseCSV(text);
        if (!parsed.headers || parsed.headers.length === 0) throw new Error('CSV بدون رؤوس أعمدة صحيحة');
        setImportProgress(30);
        const total = parsed.records.length || 1;
        let count = 0;
        for (const rec of parsed.records) {
          await supabase.from(importTargetTable as any).upsert(rec, { onConflict: 'id' });
          count++;
          setImportProgress(30 + (count / total) * 60);
        }
        setImportProgress(95);
        toast({ title: "✅ تم الاستيراد", description: `تم استيراد ${count} سجل إلى جدول ${importTargetTable}` });
        setImportProgress(100);
        setTimeout(() => {
          setImportDialogOpen(false);
          setImportFile(null);
          setImportFileType(null);
          setImportProgress(0);
        }, 1000);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "❌ خطأ في الاستيراد", description: error instanceof Error ? error.message : "فشل في استيراد البيانات. تأكد من صحة الملف", variant: "destructive" });
      setImportProgress(0);
    }
    setIsImporting(false);
  };

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">🔒 غير مصرح</h2>
            <p className="text-muted-foreground">هذه الصفحة متاحة للمدير فقط</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
          <DatabaseIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">📊 إدارة النسخ الاحتياطية</h1>
          <p className="text-muted-foreground">تصدير واستيراد بيانات النظام بأمان</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Export Section */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-500" />
              📥 تصدير البيانات
            </CardTitle>
            <CardDescription>تحميل نسخة احتياطية من جميع بيانات النظام</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {exportProgress > 0 && (
              <div className="space-y-2 mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">جاري التصدير...</span>
                  <span className="text-blue-600 font-bold">{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} className="h-2" />
              </div>
            )}

            <Button
              onClick={exportToJSON}
              disabled={isExporting}
              className="w-full justify-start hover:bg-blue-50"
              variant="outline"
            >
              <FileJson className="w-4 h-4 ml-2 text-blue-600" />
              تصدير JSON (كامل)
              {isExporting && <Loader2 className="w-4 h-4 mr-auto animate-spin" />}
            </Button>

            <Button
              onClick={exportToExcel}
              disabled={isExporting}
              className="w-full justify-start hover:bg-green-50"
              variant="outline"
            >
              <FileSpreadsheet className="w-4 h-4 ml-2 text-green-600" />
              تصدير Excel (.xlsx)
              {isExporting && <Loader2 className="w-4 h-4 mr-auto animate-spin" />}
            </Button>

            <Button
              onClick={generatePDFReport}
              disabled={isExporting}
              className="w-full justify-start hover:bg-red-50"
              variant="outline"
            >
              <FileImage className="w-4 h-4 ml-2 text-red-600" />
              تقرير PDF عالي الدقة 📊
              {isExporting && <Loader2 className="w-4 h-4 mr-auto animate-spin" />}
            </Button>

            {exportStats && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm space-y-1 border border-gray-200">
                <div className="font-semibold text-gray-700">📈 ملخص البيانات:</div>
                <div className="text-gray-600">
                  • الملفات: <span className="font-bold">{exportStats.files}</span><br />
                  • الدراسات: <span className="font-bold">{exportStats.file_studies}</span><br />
                  • الجلسات: <span className="font-bold">{exportStats.meeting_minutes}</span><br />
                  • الاستدعاءات: <span className="font-bold">{exportStats.summons}</span><br />
                  • المراسيم: <span className="font-bold">{exportStats.legal_documents}</span><br />
                  <span className="text-lg font-bold text-primary">المجموع: {exportStats.total}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Import Section */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-green-500" />
              📤 استيراد البيانات
            </CardTitle>
            <CardDescription>استعادة البيانات من نسخة احتياطية صالحة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {importProgress > 0 && (
              <div className="space-y-2 p-3 bg-green-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">جاري الاستيراد...</span>
                  <span className="text-green-600 font-bold">{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}

            <Button
              onClick={() => setImportDialogOpen(true)}
              className="w-full"
              style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}
            >
              <Upload className="w-4 h-4 ml-2" />
              📂 اختر ملف النسخة الاحتياطية
            </Button>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-yellow-800">
                  <div className="font-semibold mb-1">⚠️ تنبيهات مهمة:</div>
                  <ul className="space-y-1 text-xs">
                    <li>• سيتم دمج البيانات مع السجلات الموجودة</li>
                    <li>• السجلات بنفس المعرف سيتم تحديثها</li>
                    <li>• تأكد من ملف JSON قبل الاستيراد</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              استيراد النسخة الاحتياطية
            </DialogTitle>
            <DialogDescription>
              اسحب وأفلت ملف JSON أو CSV أو اختره يدوياً لاستعادته إلى النظام
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer"
            >
              <div className="flex items-center justify-center gap-2">
                <FileCode className="w-5 h-5 text-muted-foreground" />
                <div className="text-sm">
                  اسحب وأفلت ملف JSON أو CSV هنا، أو استخدم الزر لاختياره.
                </div>
              </div>
              <div className="mt-3">
                <Input
                  id="backup-file"
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileSelect}
                  disabled={isImporting}
                  className="mx-auto cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">الملفات المدعومة: JSON, CSV</p>
              </div>
            </div>

            {importFile && (
              <div className="p-3 bg-green-50 rounded-lg flex items-start gap-2 border border-green-200">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm flex-1">
                  <div className="font-semibold text-green-900">تم تحديد الملف:</div>
                  <div className="text-green-800 break-all">{importFile.name}</div>
                  {importFileType === 'csv' && (
                    <div className="mt-2">
                      <Label className="text-xs">استيراد CSV إلى جدول:</Label>
                      <div className="relative">
                        <select
                          value={importTargetTable}
                          onChange={(e) => setImportTargetTable(e.target.value)}
                          className="mt-1 w-full border rounded px-3 py-2 text-sm !text-right !bg-white !appearance-none !pl-10 !pr-3 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          dir="rtl"
                        >
                          <option value="files">الملفات</option>
                          <option value="file_studies">سجل الدراسات</option>
                          <option value="meeting_minutes">محاضر الجلسات</option>
                          <option value="summons">الاستدعاءات</option>
                          <option value="legal_documents">المراسيم والتعليمات</option>
                        </select>
                        <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">تأكد أن رؤوس CSV تطابق أسماء الحقول في الجدول المستهدف</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={isImporting}>
              إلغاء
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importFile || isImporting}
              style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الاستيراد...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 ml-2" />
                  ابدأ الاستيراد
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
