import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Archive, Search, FileDown, Trash2, Edit, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import type { Database } from "@/integrations/supabase/types";

type FileRecord = Database["public"]["Tables"]["files"]["Row"];

export default function ArchivePage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [municipalityFilter, setMunicipalityFilter] = useState<string>("all");
  const [opinionFilter, setOpinionFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase.from("files").delete().eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archive-files"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-files"] });
      toast({
        title: "تم الحذف",
        description: "تم حذف الملف بنجاح",
      });
      setDeleteDialogOpen(false);
      setSelectedFile(null);
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  const getOpinionBadge = (opinion: string | null) => {
    switch (opinion) {
      case "رأي إيجابي":
        return <Badge className="bg-success hover:bg-success/90">رأي إيجابي</Badge>;
      case "تحفظ":
        return <Badge className="bg-warning hover:bg-warning/90 text-warning-foreground">تحفظ</Badge>;
      case "مرفوض":
        return <Badge className="bg-destructive hover:bg-destructive/90">مرفوض</Badge>;
      default:
        return <Badge variant="secondary">قيد الانتظار</Badge>;
    }
  };

  const exportToCSV = () => {
    if (!filteredFiles || filteredFiles.length === 0) {
      toast({
        title: "تنبيه",
        description: "لا توجد بيانات للتصدير",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "رقم الملف",
      "الاسم الكامل",
      "البلدية",
      "السنة",
      "نوع السند",
      "العنوان",
      "القسم",
      "مجموعة الملكية",
      "مساحة القطعة",
      "المساحة المبنية",
      "تاريخ الإيداع",
      "تاريخ الجلسة",
      "رأي اللجنة",
    ];

    const rows = filteredFiles.map((file) => [
      file.file_number,
      file.full_name,
      file.municipality,
      file.year,
      file.ownership_type,
      file.address,
      file.section || "",
      file.property_group || "",
      file.plot_area || "",
      file.built_area || "",
      file.submission_date || "",
      file.session_date || "",
      file.committee_opinion || "قيد الانتظار",
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join(
        "\n"
      );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `archive_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();

    toast({
      title: "تم التصدير",
      description: "تم تصدير البيانات بنجاح",
    });
  };

  const handleView = (file: FileRecord) => {
    setSelectedFile(file);
    setViewDialogOpen(true);
  };

  const handleEdit = (file: FileRecord) => {
    toast({
      title: "قريباً",
      description: "خاصية التعديل قيد التطوير",
    });
  };

  const handleDelete = (file: FileRecord) => {
    setSelectedFile(file);
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <Archive className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">الأرشيف</h1>
          <p className="text-muted-foreground">جميع الملفات المسجلة</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم، رقم الملف، أو العنوان..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={municipalityFilter} onValueChange={setMunicipalityFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="البلدية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع البلديات</SelectItem>
                <SelectItem value="غرداية">غرداية</SelectItem>
                <SelectItem value="العطف">العطف</SelectItem>
                <SelectItem value="بونورة">بونورة</SelectItem>
              </SelectContent>
            </Select>
            <Select value={opinionFilter} onValueChange={setOpinionFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="رأي اللجنة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الآراء</SelectItem>
                <SelectItem value="رأي إيجابي">رأي إيجابي</SelectItem>
                <SelectItem value="تحفظ">تحفظ</SelectItem>
                <SelectItem value="مرفوض">مرفوض</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportToCSV}>
              <FileDown className="ml-2 h-4 w-4" />
              تصدير
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            الملفات ({filteredFiles?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFiles && filteredFiles.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الملف</TableHead>
                    <TableHead>الاسم الكامل</TableHead>
                    <TableHead>البلدية</TableHead>
                    <TableHead>نوع السند</TableHead>
                    <TableHead>رأي اللجنة</TableHead>
                    <TableHead>تاريخ التسجيل</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium">{file.file_number}</TableCell>
                      <TableCell>{file.full_name}</TableCell>
                      <TableCell>{file.municipality}</TableCell>
                      <TableCell>{file.ownership_type}</TableCell>
                      <TableCell>{getOpinionBadge(file.committee_opinion)}</TableCell>
                      <TableCell>
                        {format(new Date(file.created_at), "d MMMM yyyy", { locale: ar })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleView(file)}
                            title="مشاهدة"
                          >
                            <Eye className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(file)}
                            title="تعديل"
                          >
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(file)}
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              لا توجد ملفات مطابقة للبحث
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الملف رقم {selectedFile?.file_number}</DialogTitle>
          </DialogHeader>
          {selectedFile && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">الاسم الكامل</Label>
                  <p className="font-medium">{selectedFile.full_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">البلدية</Label>
                  <p className="font-medium">{selectedFile.municipality}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">رقم الملف</Label>
                  <p className="font-medium">{selectedFile.file_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">السنة</Label>
                  <p className="font-medium">{selectedFile.year}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">نوع السند</Label>
                  <p className="font-medium">{selectedFile.ownership_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">العنوان</Label>
                  <p className="font-medium">{selectedFile.address}</p>
                </div>
                {selectedFile.section && (
                  <div>
                    <Label className="text-muted-foreground">القسم</Label>
                    <p className="font-medium">{selectedFile.section}</p>
                  </div>
                )}
                {selectedFile.property_group && (
                  <div>
                    <Label className="text-muted-foreground">مجموعة الملكية</Label>
                    <p className="font-medium">{selectedFile.property_group}</p>
                  </div>
                )}
                {selectedFile.plot_area && (
                  <div>
                    <Label className="text-muted-foreground">مساحة القطعة</Label>
                    <p className="font-medium">{selectedFile.plot_area} م²</p>
                  </div>
                )}
                {selectedFile.built_area && (
                  <div>
                    <Label className="text-muted-foreground">المساحة المبنية</Label>
                    <p className="font-medium">{selectedFile.built_area} م²</p>
                  </div>
                )}
                {selectedFile.submission_date && (
                  <div>
                    <Label className="text-muted-foreground">تاريخ الإيداع</Label>
                    <p className="font-medium">
                      {format(new Date(selectedFile.submission_date), "d MMMM yyyy", { locale: ar })}
                    </p>
                  </div>
                )}
                {selectedFile.session_date && (
                  <div>
                    <Label className="text-muted-foreground">تاريخ الجلسة</Label>
                    <p className="font-medium">
                      {format(new Date(selectedFile.session_date), "d MMMM yyyy", { locale: ar })}
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <Label className="text-muted-foreground">رأي اللجنة</Label>
                  <div className="mt-1">{getOpinionBadge(selectedFile.committee_opinion)}</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف الملف رقم "{selectedFile?.file_number}"؟ لا يمكن التراجع عن هذا
              الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedFile && deleteMutation.mutate(selectedFile.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                "حذف"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
