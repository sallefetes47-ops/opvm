import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2, Scale, Plus, Eye, Trash, Search } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FileImport } from "@/components/FileImport";

interface DocumentFormData {
  title_ar: string;
  title_fr: string;
  document_type: string;
  document_number: string;
  document_date: Date | undefined;
  description: string;
  content_text: string;
  keywords: string;
  language: string;
}

export default function LegalArchive() {
  const { user, role, isViewer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewDocument, setViewDocument] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState<DocumentFormData>({
    title_ar: "",
    title_fr: "",
    document_type: "",
    document_number: "",
    document_date: undefined,
    description: "",
    content_text: "",
    keywords: "",
    language: "ar",
  });

  const canEdit = !isViewer && role !== "viewer";

  const handleDataExtracted = (data: Record<string, any>) => {
    setFormData({
      title_ar: data.title_ar || "",
      title_fr: data.title_fr || "",
      document_type: data.document_type || "",
      document_number: data.document_number || "",
      document_date: data.document_date ? new Date(data.document_date) : undefined,
      description: data.description || "",
      content_text: data.content_text || "",
      keywords: Array.isArray(data.keywords) ? data.keywords.join(", ") : (data.keywords || ""),
      language: data.language || "ar",
    });
    setIsAddDialogOpen(true);
  };

  const { data: documents, isLoading } = useQuery({
    queryKey: ["legal-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_documents")
        .select("*")
        .order("document_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      const { error } = await supabase.from("legal_documents").insert({
        title_ar: data.title_ar,
        title_fr: data.title_fr || null,
        document_type: data.document_type,
        document_number: data.document_number,
        document_date: data.document_date ? format(data.document_date, "yyyy-MM-dd") : null,
        description: data.description,
        content_text: data.content_text,
        keywords: data.keywords.split(",").map(k => k.trim()).filter(Boolean),
        language: data.language,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
      toast({ title: "تم الحفظ", description: "تم حفظ الوثيقة بنجاح" });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("legal_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
      toast({ title: "تم الحذف", description: "تم حذف الوثيقة بنجاح" });
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title_ar: "",
      title_fr: "",
      document_type: "",
      document_number: "",
      document_date: undefined,
      description: "",
      content_text: "",
      keywords: "",
      language: "ar",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title_ar || !formData.document_type) {
      toast({ title: "خطأ", description: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const filteredDocuments = documents?.filter(d => 
    d.title_ar?.includes(searchTerm) || 
    d.title_fr?.includes(searchTerm) ||
    d.document_number?.includes(searchTerm) ||
    d.keywords?.some((k: string) => k.includes(searchTerm)) ||
    d.content_text?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Scale className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">المراسيم والتعليمات</h1>
            <p className="text-muted-foreground">أرشيف الوثائق القانونية والتنظيمية</p>
          </div>
        </div>
        
        {canEdit && (
          <div className="flex gap-2">
            <FileImport
              documentType="legal_document"
              onDataExtracted={handleDataExtracted}
              buttonLabel="استيراد من ملف"
            />
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة وثيقة
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إضافة وثيقة قانونية</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>العنوان بالعربية *</Label>
                    <Input
                      value={formData.title_ar}
                      onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                      placeholder="أدخل العنوان بالعربية"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>العنوان بالفرنسية</Label>
                    <Input
                      value={formData.title_fr}
                      onChange={(e) => setFormData({ ...formData, title_fr: e.target.value })}
                      placeholder="Titre en français"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>نوع الوثيقة *</Label>
                    <Select
                      value={formData.document_type}
                      onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر النوع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="مرسوم">مرسوم</SelectItem>
                        <SelectItem value="قرار">قرار</SelectItem>
                        <SelectItem value="تعليمة">تعليمة</SelectItem>
                        <SelectItem value="منشور">منشور</SelectItem>
                        <SelectItem value="قانون">قانون</SelectItem>
                        <SelectItem value="أمر">أمر</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>رقم الوثيقة</Label>
                    <Input
                      value={formData.document_number}
                      onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                      placeholder="مثال: 15-19"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ الوثيقة</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-right", !formData.document_date && "text-muted-foreground")}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {formData.document_date ? format(formData.document_date, "d MMMM yyyy", { locale: ar }) : "اختر التاريخ"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.document_date}
                          onSelect={(date) => setFormData({ ...formData, document_date: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="وصف مختصر للوثيقة"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>محتوى الوثيقة (للبحث)</Label>
                  <Textarea
                    value={formData.content_text}
                    onChange={(e) => setFormData({ ...formData, content_text: e.target.value })}
                    placeholder="أدخل نص الوثيقة أو جزء منه للبحث"
                    rows={4}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>الكلمات المفتاحية (مفصولة بفاصلة)</Label>
                    <Input
                      value={formData.keywords}
                      onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                      placeholder="تعمير، بناء، رخصة، ..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>اللغة</Label>
                    <Select
                      value={formData.language}
                      onValueChange={(value) => setFormData({ ...formData, language: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="fr">الفرنسية</SelectItem>
                        <SelectItem value="both">ثنائي اللغة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>
      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث في الوثائق (العنوان، الرقم، الكلمات المفتاحية، المحتوى)..."
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
          <CardTitle>قائمة الوثائق القانونية</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredDocuments?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد وثائق</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>النوع</TableHead>
                  <TableHead>الرقم</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>اللغة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments?.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                        {doc.document_type}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{doc.document_number || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{doc.title_ar}</TableCell>
                    <TableCell>
                      {doc.document_date ? format(new Date(doc.document_date), "d MMMM yyyy", { locale: ar }) : "-"}
                    </TableCell>
                    <TableCell>
                      {doc.language === "ar" ? "عربي" : doc.language === "fr" ? "فرنسي" : "ثنائي"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => setViewDocument(doc)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canEdit && role === "admin" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(doc.id)}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
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
      <Dialog open={!!viewDocument} onOpenChange={() => setViewDocument(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الوثيقة</DialogTitle>
          </DialogHeader>
          {viewDocument && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">العنوان بالعربية</Label>
                  <p className="font-medium">{viewDocument.title_ar}</p>
                </div>
                {viewDocument.title_fr && (
                  <div>
                    <Label className="text-muted-foreground">العنوان بالفرنسية</Label>
                    <p className="font-medium" dir="ltr">{viewDocument.title_fr}</p>
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-muted-foreground">النوع</Label>
                  <p className="font-medium">{viewDocument.document_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">الرقم</Label>
                  <p className="font-medium">{viewDocument.document_number || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">التاريخ</Label>
                  <p className="font-medium">
                    {viewDocument.document_date ? format(new Date(viewDocument.document_date), "d MMMM yyyy", { locale: ar }) : "-"}
                  </p>
                </div>
              </div>
              {viewDocument.description && (
                <div>
                  <Label className="text-muted-foreground">الوصف</Label>
                  <p className="font-medium whitespace-pre-wrap">{viewDocument.description}</p>
                </div>
              )}
              {viewDocument.content_text && (
                <div>
                  <Label className="text-muted-foreground">المحتوى</Label>
                  <p className="font-medium whitespace-pre-wrap bg-muted p-3 rounded-lg max-h-60 overflow-y-auto">
                    {viewDocument.content_text}
                  </p>
                </div>
              )}
              {viewDocument.keywords?.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">الكلمات المفتاحية</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {viewDocument.keywords.map((keyword: string, index: number) => (
                      <span key={index} className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
