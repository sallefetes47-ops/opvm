import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Restudy() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">إعادة الدراسة</h1>
          <p className="text-muted-foreground">الملفات المُعادة للدراسة</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الملفات قيد إعادة الدراسة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            لا توجد ملفات معادة للدراسة حالياً
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
