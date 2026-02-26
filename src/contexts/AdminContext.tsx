import { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface ViewerPermissions {
  allowSearch: boolean;
  showCadastralInfo: boolean;
  showRawArea: boolean;
  showOfficialArea: boolean;
}

interface AdminContextType {
  isAdminMode: boolean;
  viewerPermissions: ViewerPermissions;
  loginAdmin: (password: string) => boolean;
  logoutAdmin: () => void;
  updatePermission: <K extends keyof ViewerPermissions>(key: K, value: ViewerPermissions[K]) => void;
}

const ADMIN_SESSION_KEY = "opvm_admin_session";
const VIEWER_PERMISSIONS_KEY = "opvm_viewer_permissions";

const defaultPermissions: ViewerPermissions = {
  allowSearch: true,
  showCadastralInfo: true,
  showRawArea: true,
  showOfficialArea: true,
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdminMode, setIsAdminMode] = useState(() => {
    return localStorage.getItem(ADMIN_SESSION_KEY) === "active";
  });

  const [viewerPermissions, setViewerPermissions] = useState<ViewerPermissions>(() => {
    try {
      const stored = localStorage.getItem(VIEWER_PERMISSIONS_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return defaultPermissions;
  });

  // Persist permissions to localStorage
  useEffect(() => {
    localStorage.setItem(VIEWER_PERMISSIONS_KEY, JSON.stringify(viewerPermissions));
  }, [viewerPermissions]);

  const loginAdmin = useCallback((password: string): boolean => {
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || "MZAB_ADMIN_2026";
    if (password === adminPassword) {
      setIsAdminMode(true);
      localStorage.setItem(ADMIN_SESSION_KEY, "active");
      return true;
    }
    return false;
  }, []);

  const logoutAdmin = useCallback(() => {
    setIsAdminMode(false);
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }, []);

  const updatePermission = useCallback(<K extends keyof ViewerPermissions>(key: K, value: ViewerPermissions[K]) => {
    setViewerPermissions((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <AdminContext.Provider
      value={{
        isAdminMode,
        viewerPermissions,
        loginAdmin,
        logoutAdmin,
        updatePermission,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
