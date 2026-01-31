import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";

export function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-card flex items-center px-4 sticky top-0 z-10">
            <SidebarTrigger className="md:hidden">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <div className="flex-1" />
          </header>
          <div className="flex-1 p-6 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
