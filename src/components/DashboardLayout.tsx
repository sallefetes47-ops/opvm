import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";

export function DashboardLayout() {
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
          </header>
          <div className="flex-1 p-6 overflow-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
