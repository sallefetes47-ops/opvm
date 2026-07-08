import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "admin" | "employee" | "viewer" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  loading: boolean;
  roleLoading: boolean;
  roleError: string | null;
  isViewer: boolean;
  refreshRole: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signInAsViewer: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Viewer session storage key
const VIEWER_SESSION_KEY = "opvm_viewer_session";

// Single source of truth: fetch role from user_roles table under RLS.
// Never calls the get_user_role RPC (revoked from authenticated).
async function fetchUserRole(
  userId: string,
): Promise<{ role: UserRole; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user role:", error);
      return { role: null, error: error.message };
    }
    return { role: (data?.role as UserRole) ?? null, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Error in fetchUserRole:", e);
    return { role: null, error: msg };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isViewer, setIsViewer] = useState(false);

  const loadRole = async (userId: string) => {
    setRoleLoading(true);
    setRoleError(null);
    const { role: r, error } = await fetchUserRole(userId);
    setRole(r);
    setRoleError(error);
    setRoleLoading(false);
  };

  const refreshRole = async () => {
    if (isViewer) {
      setRole("viewer");
      return;
    }
    if (user?.id) await loadRole(user.id);
  };

  useEffect(() => {
    // Check for viewer session first
    const viewerSession = localStorage.getItem(VIEWER_SESSION_KEY);
    if (viewerSession === "active") {
      setIsViewer(true);
      setRole("viewer");
      setLoading(false);
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          // Defer to avoid potential deadlock with Supabase client
          setTimeout(() => {
            loadRole(nextSession.user.id).finally(() => setLoading(false));
          }, 0);
        } else {
          setRole(null);
          setRoleError(null);
          setLoading(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);

      if (existing?.user) {
        loadRole(existing.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Clear viewer session if active
    if (isViewer) {
      localStorage.removeItem(VIEWER_SESSION_KEY);
      setIsViewer(false);
      setRole(null);
      return;
    }
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  const signInAsViewer = async () => {
    try {
      localStorage.setItem(VIEWER_SESSION_KEY, "active");
      setIsViewer(true);
      setRole("viewer");
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        isViewer,
        signIn,
        signUp,
        signOut,
        signInAsViewer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
