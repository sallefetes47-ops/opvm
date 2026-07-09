import { useState } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, FilePlus, Archive, Users, LogOut, RefreshCw,
  FileText, Users2, Scale, Trash2, Database as DatabaseIcon, MapPin,
  ShieldCheck, Settings, Search, Landmark, BarChart3, CalendarDays, Flame, Sparkles, GitCompare, Target, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminLoginModal } from "@/components/AdminLoginModal";
import { ViewerSettingsPanel } from "@/components/ViewerSettingsPanel";

interface SidebarItem {
  title: string;
  url: string;
  icon: React.ElementType;
  requiresEdit?: boolean;
}

interface AdminSidebarItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

const mainMenuItems: SidebarItem[] = [
  { title: "لوحة التحكم", url: "/", icon: LayoutDashboard },
  { title: "التحليلات", url: "/analytics", icon: BarChart3 },
  { title: "تقويم الجلسات", url: "/sessions-calendar", icon: CalendarDays },
  { title: "ملف جديد", url: "/new-file", icon: FilePlus, requiresEdit: true },
  { title: "إعادة الدراسة", url: "/restudy", icon: RefreshCw, requiresEdit: true },
  { title: "الأرشيف", url: "/archive", icon: Archive },
  { title: "الخريطة العمرانية", url: "/urban-map", icon: MapPin },
  
  { title: "المساعد الذكي", url: "/ai-assistant", icon: Sparkles },
  { title: "الملفات المتشابهة", url: "/similar-files", icon: GitCompare },
  { title: "مؤشرات الأداء", url: "/kpi", icon: Target },
];

// These modules are hidden from viewers (requires edit permissions)
const newModulesItems: SidebarItem[] = [
  { title: "محاضر الجلسات", url: "/minutes", icon: FileText },
  { title: "الاستدعاءات", url: "/summons", icon: Users2 },
];

// Legal archive is visible to all
const publicModulesItems: SidebarItem[] = [
  { title: "المراسيم والتعليمات", url: "/legal-archive", icon: Scale },
  { title: "البحث الحكومي", url: "/gov-search", icon: Search },
  { title: "تراث وادي مزاب", url: "/mzab-heritage", icon: Landmark },
];

// Data Management - hidden from viewers
const dataManagementItems: SidebarItem[] = [
  { title: "النسخة الاحتياطية", url: "/backup", icon: DatabaseIcon },
  { title: "سلة المحذوفات", url: "/recycle-bin", icon: Trash2 },
  { title: "سجل التحديثات", url: "/changelog", icon: History },
];

const adminMenuItems = [
  { title: "إدارة المستخدمين", url: "/users", icon: Users },
];

export function AppSidebar() {
  const location = useLocation();
  const { role, signOut, user, isViewer } = useAuth();
  const { isAdminMode } = useAdmin();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const canEdit = !isViewer && role !== "viewer";

  return (
    <>
      <Sidebar className="border-l-0 border-r border-sidebar-border" side="right">
        <SidebarHeader className="border-b border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-[42px] w-[42px] border-2 border-slate-200 transition-all hover:scale-110">
              <AvatarImage
                src="/images/opvm-logo.png"
                alt="شعار ديوان حماية وادي ميزاب - Bureau Logo"
                className="object-contain"
              />
              <AvatarFallback className="bg-[rgba(212,175,55,0.2)]">
                <span className="text-lg font-bold" style={{ color: '#D4AF37' }}>م</span>
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-sidebar-foreground text-sm leading-tight">
                ديوان حماية وادي ميزاب وترقيته
              </h2>
              <p className="text-xs text-sidebar-foreground/70 mt-0.5">
                OPVM
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {isViewer ? "مشاهد" : user?.email}
              </p>
              <p className="text-xs text-sidebar-foreground/70">
                {role === "admin" ? "مدير" : role === "viewer" || isViewer ? "مشاهد" : "موظف"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (isAdminMode) {
                    setShowSettings(true);
                  } else {
                    setShowLoginModal(true);
                  }
                }}
                className={cn("text-sidebar-foreground hover:bg-sidebar-accent", isAdminMode && "text-[#D4AF37]")}
                title={isAdminMode ? "إعدادات المسؤول" : "وضع المسؤول"}
              >
                <ShieldCheck className="h-5 w-5" />
              </Button>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="text-sidebar-foreground hover:bg-sidebar-accent"
                title="تسجيل الخروج"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70">
              القائمة الرئيسية
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainMenuItems
                  .filter(item => !item.requiresEdit || canEdit)
                  .map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                            isActive(item.url)
                              ? "text-[#2D2926]"
                              : "text-sidebar-foreground hover:bg-sidebar-accent"
                          )}
                          style={isActive(item.url) ? { backgroundColor: '#D4AF37' } : undefined}
                        >
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70">
              الوحدات
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Modules hidden from viewers */}
                {canEdit && newModulesItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                          isActive(item.url)
                            ? "text-[#2D2926]"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                        style={isActive(item.url) ? { backgroundColor: '#D4AF37' } : undefined}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {/* Legal archive visible to all */}
                {publicModulesItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                          isActive(item.url)
                            ? "text-[#2D2926]"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                        style={isActive(item.url) ? { backgroundColor: '#D4AF37' } : undefined}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {/* Data Management - hidden from viewers */}
                {canEdit && dataManagementItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                          isActive(item.url)
                            ? "text-[#2D2926]"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                        style={isActive(item.url) ? { backgroundColor: '#D4AF37' } : undefined}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {role === "admin" && (
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/70">
                الإدارة
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                            isActive(item.url)
                              ? "text-[#2D2926]"
                              : "text-sidebar-foreground hover:bg-sidebar-accent"
                          )}
                          style={isActive(item.url) ? { backgroundColor: '#D4AF37' } : undefined}
                        >
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Admin Settings button - visible only when admin mode is active */}
          {isAdminMode && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <button
                        onClick={() => setShowSettings(true)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                      >
                        <Settings className="h-5 w-5 text-[#D4AF37]" />
                        <span>الإعدادات</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

      </Sidebar>

      {/* Modals */}
      <AdminLoginModal open={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <ViewerSettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}




