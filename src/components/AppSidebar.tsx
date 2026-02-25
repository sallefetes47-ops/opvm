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
  ShieldCheck, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminLoginModal } from "@/components/AdminLoginModal";
import { ViewerSettingsPanel } from "@/components/ViewerSettingsPanel";

const mainMenuItems = [
  { title: "لوحة التحكم", url: "/", icon: LayoutDashboard },
  { title: "ملف جديد", url: "/new-file", icon: FilePlus, requiresEdit: true },
  { title: "إعادة الدراسة", url: "/restudy", icon: RefreshCw, requiresEdit: true },
  { title: "الأرشيف", url: "/archive", icon: Archive },
  { title: "الخريطة العمرانية", url: "/urban-map", icon: MapPin },
];

// These modules are hidden from viewers (requires edit permissions)
const newModulesItems = [
  { title: "محاضر الجلسات", url: "/minutes", icon: FileText },
  { title: "الاستدعاءات", url: "/summons", icon: Users2 },
];

// Legal archive is visible to all
const publicModulesItems = [
  { title: "المراسيم والتعليمات", url: "/legal-archive", icon: Scale },
];

// Data Management - hidden from viewers
const dataManagementItems = [
  { title: "النسخة الاحتياطية", url: "/backup", icon: DatabaseIcon },
  { title: "سلة المحذوفات", url: "/recycle-bin", icon: Trash2 },
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
            <img
              src="/images/opvm-logo.png"
              alt="OPVM Logo"
              className="w-12 h-12 object-contain"
              onError={(e) => {
                // Fallback if logo not loaded yet
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="w-10 h-10 rounded-lg items-center justify-center hidden" style={{ backgroundColor: 'rgba(212, 175, 55, 0.2)' }}>
              <span className="text-lg font-bold" style={{ color: '#D4AF37' }}>ظ…</span>
            </div>
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
                {/* Data Management - hidden from viewers, some items admin only */}
                {canEdit && dataManagementItems
                  .filter(item => !item.adminOnly || role === "admin")
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




