import { useEffect, useRef, useState } from "react";

// Inactivity-triggered lock. After `timeoutMs` of no user input,
// `onLock` is invoked. Activity on mouse/keyboard/touch resets the timer.
export function useIdleLock(timeoutMs: number, onLock: () => void, enabled = true) {
  const timerRef = useRef<number | null>(null);
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => onLockRef.current(), timeoutMs);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeoutMs, enabled]);
}

const STORAGE_KEY = "opvm_idle_timeout_minutes";

export function getIdleTimeoutMinutes(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 15;
}

export function setIdleTimeoutMinutes(minutes: number) {
  localStorage.setItem(STORAGE_KEY, String(minutes));
}

export function useIdleTimeoutSetting() {
  const [minutes, setMinutes] = useState<number>(() => getIdleTimeoutMinutes());
  const update = (m: number) => {
    setIdleTimeoutMinutes(m);
    setMinutes(m);
  };
  return [minutes, update] as const;
}
