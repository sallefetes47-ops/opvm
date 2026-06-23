import { useEffect } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface IdleLockScreenProps {
  onUnlock: () => void;
}

export function IdleLockScreen({ onUnlock }: IdleLockScreenProps) {
  const { signOut, user, isViewer } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    onUnlock();
    navigate("/login");
  };

  const handleReturn = async () => {
    // Force re-authentication by signing out and redirecting to login
    await signOut();
    onUnlock();
    navigate("/login");
  };

  const displayName = isViewer ? "مستخدم العرض" : user?.email ?? "المستخدم";

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center backdrop-blur-xl bg-background/95"
    >
      <div className="flex flex-col items-center gap-6 max-w-md text-center px-6">
        <div
          className="h-24 w-24 rounded-full flex items-center justify-center"
          style={{ background: "rgba(212,175,55,0.15)", border: "2px solid #D4AF37" }}
        >
          <Lock className="h-12 w-12" style={{ color: "#D4AF37" }} />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">الجلسة مقفلة</h1>
          <p className="text-muted-foreground">
            تم قفل الجلسة تلقائياً بسبب عدم النشاط للحفاظ على أمان البيانات.
          </p>
          <p className="text-sm text-muted-foreground">{displayName}</p>
        </div>
        <div className="flex gap-3 w-full">
          <Button
            onClick={handleReturn}
            className="flex-1"
            style={{ background: "#D4AF37", color: "#0F172A" }}
          >
            إعادة تسجيل الدخول
          </Button>
          <Button onClick={handleLogout} variant="outline" className="flex-1">
            خروج
          </Button>
        </div>
      </div>
    </div>
  );
}
