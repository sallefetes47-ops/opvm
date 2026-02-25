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
  { title: "ظ„ظˆط­ط© ط§ظ„طھط­ظƒظ…", url: "/", icon: LayoutDashboard },
  { title: "ظ…ظ„ظپ ط¬ط¯ظٹط¯", url: "/new-file", icon: FilePlus, requiresEdit: true },
  { title: "ط¥ط¹ط§ط¯ط© ط§ظ„ط¯ط±ط§ط³ط©", url: "/restudy", icon: RefreshCw, requiresEdit: true },
  { title: "ط§ظ„ط£ط±ط´ظٹظپ", url: "/archive", icon: Archive },
  { title: "ط§ظ„ط®ط±ظٹط·ط© ط§ظ„ط¹ظ…ط±ط§ظ†ظٹط©", url: "/urban-map", icon: MapPin },
];

// These modules are hidden from viewers (requires edit permissions)
const newModulesItems = [
  { title: "ظ…ط­ط§ط¶ط± ط§ظ„ط¬ظ„ط³ط§طھ", url: "/minutes", icon: FileText },
  { title: "ط§ظ„ط§ط³طھط¯ط¹ط§ط،ط§طھ", url: "/summons", icon: Users2 },
];

// Legal archive is visible to all
const publicModulesItems = [
  { title: "ط§ظ„ظ…ط±ط§ط³ظٹظ… ظˆط§ظ„طھط¹ظ„ظٹظ…ط§طھ", url: "/legal-archive", icon: Scale },
];

// Data Management - hidden from viewers
const dataManagementItems = [
  { title: "ط§ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط©", url: "/backup", icon: DatabaseIcon },
  { title: "ط³ظ„ط© ط§ظ„ظ…ط­ط°ظˆظپط§طھ", url: "/recycle-bin", icon: Trash2 },
];

const adminMenuItems = [
  { title: "ط¥ط¯ط§ط±ط© ط§ظ„ظ…ط³طھط®ط¯ظ…ظٹظ†", url: "/users", icon: Users },
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
                ط¯ظٹظˆط§ظ† ط­ظ…ط§ظٹط© ظˆط§ط¯ظٹ ظ…ظٹط²ط§ط¨ ظˆطھط±ظ‚ظٹطھظ‡
              </h2>
              <p className="text-xs text-sidebar-foreground/70 mt-0.5">
                OPVM
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {isViewer ? "ظ…ط´ط§ظ‡ط¯" : user?.email}
              </p>
              <p className="text-xs text-sidebar-foreground/70">
                {role === "admin" ? "ظ…ط¯ظٹط±" : role === "viewer" || isViewer ? "ظ…ط´ط§ظ‡ط¯" : "ظ…ظˆط¸ظپ"}
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
                title={isAdminMode ? "ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ظ…ط³ط¤ظˆظ„" : "ظˆط¶ط¹ ط§ظ„ظ…ط³ط¤ظˆظ„"}
              >
                <ShieldCheck className="h-5 w-5" />
              </Button>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="text-sidebar-foreground hover:bg-sidebar-accent"
                title="طھط³ط¬ظٹظ„ ط§ظ„ط®ط±ظˆط¬"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70">
              ط§ظ„ظ‚ط§ط¦ظ…ط© ط§ظ„ط±ط¦ظٹط³ظٹط©
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
              ط§ظ„ظˆط­ط¯ط§طھ
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
                ط§ظ„ط¥ط¯ط§ط±ط©
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
                        <span>ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ</span>
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


