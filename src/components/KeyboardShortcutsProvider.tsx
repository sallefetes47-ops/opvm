import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ShortcutItem {
  keys: string;
  label: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: "Ctrl + N", label: "إضافة ملف جديد" },
  { keys: "Ctrl + F", label: "الانتقال إلى الأرشيف (بحث)" },
  { keys: "Ctrl + H", label: "الرئيسية (لوحة التحكم)" },
  { keys: "Ctrl + B", label: "النسخ الاحتياطي" },
  { keys: "Ctrl + M", label: "محاضر الاجتماعات" },
  { keys: "Ctrl + L", label: "الأرشيف القانوني" },
  { keys: "Ctrl + K", label: "البحث الحكومي" },
  { keys: "Shift + ?", label: "عرض اختصارات لوحة المفاتيح" },
];

const KeyboardShortcutsContext = createContext<{ open: () => void } | null>(null);

export function useKeyboardShortcuts() {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) throw new Error("useKeyboardShortcuts must be inside provider");
  return ctx;
}

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  const open = useCallback(() => setHelpOpen(true), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas/contenteditable
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        // Allow Shift+? help even from inputs? Skip to avoid surprises.
        return;
      }

      // Shift + ? (US layout)
      if (e.shiftKey && (e.key === "?" || e.key === "/")) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (!(e.ctrlKey || e.metaKey)) return;

      const k = e.key.toLowerCase();
      const map: Record<string, string> = {
        n: "/new-file",
        f: "/archive",
        h: "/",
        b: "/backup",
        m: "/minutes",
        l: "/legal-archive",
        k: "/gov-search",
      };
      const route = map[k];
      if (route) {
        e.preventDefault();
        navigate(route);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <KeyboardShortcutsContext.Provider value={{ open }}>
      {children}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>اختصارات لوحة المفاتيح</DialogTitle>
            <DialogDescription>
              استخدم هذه الاختصارات للتنقل السريع داخل التطبيق.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {SHORTCUTS.map((s) => (
              <div
                key={s.keys}
                className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
              >
                <span className="text-sm">{s.label}</span>
                <kbd
                  className="px-2 py-1 rounded text-xs font-mono border"
                  style={{ background: "rgba(212,175,55,0.1)", borderColor: "#D4AF37" }}
                >
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </KeyboardShortcutsContext.Provider>
  );
}
