import { useEffect } from "react";
import { runAutoBackupIfDue } from "@/lib/auto-backup";

// Triggers an auto-backup once on mount (if due), then every hour while open.
export function useAutoBackupScheduler(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const tick = async () => {
      const snap = await runAutoBackupIfDue();
      if (!cancelled && snap) {
        window.dispatchEvent(new CustomEvent("opvm:auto-backup-complete", { detail: snap }));
      }
    };

    // First tick after a small delay so the app finishes loading.
    const initial = window.setTimeout(tick, 30_000);
    const interval = window.setInterval(tick, 60 * 60 * 1000); // hourly check

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [active]);
}
