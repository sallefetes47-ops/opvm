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
import { CalendarIcon, Loader2, FileText, Plus, Eye, Trash, Search } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MinuteFormData {
  session_date: Date | undefined;
  session_number: string;
  attendees: string;
  agenda: string;
  decisions: string;
  notes: string;
}

export default function Minutes() {
  const { user, role, isViewer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewMinute, setViewMinute] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState<MinuteFormData>({
    session_date: undefined,
    session_number: "",
    attendees: "",
    agenda: "",
    decisions: "",
    notes: "",
  });

  const canEdit = !isViewer && role !== "viewer";

  const { data: minutes, isLoading } = useQuery({
    queryKey: ["meeting-minutes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_minutes")
        .select("*")
        .order("session_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MinuteFormData) => {
      const { error } = await supabase.from("meeting_minutes").insert({
        session_date: data.session_date ? format(data.session_date, "yyyy-MM-dd") : null,
        session_number: data.session_number,
        attendees: data.attendees.split(",").map(a => a.trim()).filter(Boolean),
        agenda: data.agenda,
        decisions: data.decisions,
        notes: data.notes,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes"] });
      toast({ title: "تم الحفظ", description: "تم حفظ محضر الجلسة بنجاح" });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meeting_minutes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes"] });
      toast({ title: "تم الحذف", description: "تم حذف المحضر بنجاح" });
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      session_date: undefined,
      session_number: "",
      attendees: "",
      agenda: "",
      decisions: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const filteredMinutes = minutes?.filter(m => 
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-right", !formData.session_date && "text-muted-foreground")}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {formData.session_date ? format(formData.session_date, "d MMMM yyyy", { locale: ar }) : "اختر التاريخ"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.session_date}
                          onSelect={(date) => setFormData({ ...formData, session_date: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
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
          <CardTitle>قائمة المحاضر</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredMinutes?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد محاضر</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الجلسة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>عدد الحاضرين</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMinutes?.map((minute) => (
                  <TableRow key={minute.id}>
                    <TableCell className="font-medium">{minute.session_number || "-"}</TableCell>
                    <TableCell>
                      {minute.session_date ? format(new Date(minute.session_date), "d MMMM yyyy", { locale: ar }) : "-"}
                    </TableCell>
                    <TableCell>{minute.attendees?.length || 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => setViewMinute(minute)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canEdit && role === "admin" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(minute.id)}
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
                <p className="font-medium">{viewMinute.attendees?.join("، ") || "-"}</p>
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
