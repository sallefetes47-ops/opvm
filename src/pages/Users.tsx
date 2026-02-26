import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Users, Loader2, Shield, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role: "admin" | "employee";
}

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-management"],
    queryFn: async () => {
      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*");

      if (profilesError) throw profilesError;

      // Get roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles: UserWithRole[] = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.user_id);
        return {
          id: profile.user_id,
          email: "",
          full_name: profile.full_name,
          created_at: profile.created_at,
          role: (userRole?.role as "admin" | "employee") || "employee",
        };
      });

      return usersWithRoles;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: "admin" | "employee" }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast({
        title: "تم التحديث",
        description: "تم تحديث صلاحية المستخدم بنجاح",
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-8 w-40" />
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
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
          <p className="text-muted-foreground">إدارة صلاحيات مستخدمي النظام</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>المستخدمون ({users?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {users && users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الصلاحية الحالية</TableHead>
                  <TableHead>تاريخ التسجيل</TableHead>
                  <TableHead>تغيير الصلاحية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name || "غير محدد"}
                    </TableCell>
                    <TableCell>
                      {user.role === "admin" ? (
                        <Badge className="bg-primary">
                          <Shield className="w-3 h-3 ml-1" />
                          مدير
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <UserCheck className="w-3 h-3 ml-1" />
                          موظف
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), "d MMMM yyyy", { locale: ar })}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value: "admin" | "employee") =>
                          updateRoleMutation.mutate({ userId: user.id, newRole: value })
                        }
                        disabled={updateRoleMutation.isPending}
                      >
                        <SelectTrigger className="w-32 text-right flex flex-row-reverse items-center justify-between">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">مدير</SelectItem>
                          <SelectItem value="employee">موظف</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              لا يوجد مستخدمون مسجلون
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
