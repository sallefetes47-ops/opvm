import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
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
            <div className="flex items-center gap-3 mr-4">
              <img
                src="/Capture.PNG"
                alt="OPVM Header - شعار ديوان حماية وادي ميزاب"
                className="h-20 w-auto object-contain max-h-20 min-h-20"
                loading="eager"
                decoding="async"
                style={{ 
                  imageRendering: 'crisp-edges',
                  WebkitFontSmoothing: 'antialiased',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
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
