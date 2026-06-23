import { useState } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { Outlet } from "react-router-dom";
import { Menu, Keyboard } from "lucide-react";
import { useIdleLock, useIdleTimeoutSetting } from "@/hooks/useIdleLock";
import { useAutoBackupScheduler } from "@/hooks/useAutoBackupScheduler";
import { useAuth } from "@/contexts/AuthContext";
import { IdleLockScreen } from "@/components/IdleLockScreen";
import {
  KeyboardShortcutsProvider,
  useKeyboardShortcuts,
} from "@/components/KeyboardShortcutsProvider";

function HeaderShortcutsButton() {
  const { open } = useKeyboardShortcuts();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={open}
      title="اختصارات لوحة المفاتيح (Shift + ?)"
      aria-label="اختصارات لوحة المفاتيح"
    >
      <Keyboard className="h-5 w-5" />
    </Button>
  );
}

function DashboardInner() {
  const [locked, setLocked] = useState(false);
  const [timeoutMin] = useIdleTimeoutSetting();
  const { isViewer } = useAuth();

  useIdleLock(timeoutMin * 60 * 1000, () => setLocked(true), !locked);
  useAutoBackupScheduler(!isViewer);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          <header className="h-20 border-b bg-card flex items-center px-4 sticky top-0 z-10">
            <SidebarTrigger className="md:hidden">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <div className="flex items-center gap-4 mr-4">
              <Avatar className="h-[42px] w-[42px] border-2 border-slate-200 transition-all hover:scale-110">
                <AvatarImage
                  src="/Capture.PNG"
                  alt="شعار ديوان حماية وادي ميزاب - Bureau Logo"
                  className="object-contain"
                />
                <AvatarFallback className="bg-[rgba(212,175,55,0.2)]">
                  <span className="text-lg font-bold" style={{ color: '#D4AF37' }}>م</span>
                </AvatarFallback>
              </Avatar>
              <span className="font-bold text-foreground hidden md:block">
                ديوان حماية وادي ميزاب وترقيته
              </span>
            </div>
            <div className="flex-1" />
            <HeaderShortcutsButton />
            <NotificationBell />
          </header>
          <div className="flex-1 p-6 overflow-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
      {locked && <IdleLockScreen onUnlock={() => setLocked(false)} />}
    </SidebarProvider>
  );
}

export function DashboardLayout() {
  return (
    <KeyboardShortcutsProvider>
      <DashboardInner />
    </KeyboardShortcutsProvider>
  );
}
