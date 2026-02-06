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
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Plus, Eye, Trash, Search } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FileImport } from "@/components/FileImport";

interface SummonsFormData {
  summons_date: Date | undefined;
  summons_number: string;
  committee_members: string;
  venue: string;
  attendance_status: string;
  notes: string;
}

export default function Summons() {
  const { user, role, isViewer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewSummons, setViewSummons] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
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

  const { data: summonsList, isLoading } = useQuery({
    queryKey: ["summons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("summons")
        .select("*")
        .order("summons_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SummonsFormData) => {
      const { error } = await supabase.from("summons").insert({
        summons_date: data.summons_date ? format(data.summons_date, "yyyy-MM-dd") : null,
        summons_number: data.summons_number,
        committee_members: data.committee_members.split(",").map(m => m.trim()).filter(Boolean),
        venue: data.venue,
        attendance_status: data.attendance_status,
        notes: data.notes,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["summons"] });
      toast({ title: "تم الحفظ", description: "تم حفظ الاستدعاء بنجاح" });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("summons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["summons"] });
      toast({ title: "تم الحذف", description: "تم حذف الاستدعاء بنجاح" });
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      summons_date: undefined,
      summons_number: "",
      committee_members: "",
      venue: "",
      attendance_status: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const filteredSummons = summonsList?.filter(s => 
    s.summons_number?.includes(searchTerm) || 
    s.venue?.includes(searchTerm)
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
                    <SelectTrigger>
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
          <CardTitle>قائمة الاستدعاءات</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredSummons?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد استدعاءات</p>
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
                {filteredSummons?.map((summons) => (
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
                        <Button size="icon" variant="ghost" onClick={() => setViewSummons(summons)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canEdit && role === "admin" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(summons.id)}
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
                <p className="font-medium">{viewSummons.committee_members?.join("، ") || "-"}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">المكان</Label>
                  <p className="font-medium">{viewSummons.venue || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">حالة الحضور</Label>
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
