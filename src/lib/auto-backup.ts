// Local automatic backup system. Stores periodic JSON snapshots of the
// database in IndexedDB so users always have a recent recovery point —
// works in both web and Electron builds.
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "opvm_backups";
const STORE = "snapshots";
const DB_VERSION = 1;
const MAX_SNAPSHOTS = 7;
const LAST_RUN_KEY = "opvm_last_auto_backup";
const ENABLED_KEY = "opvm_auto_backup_enabled";
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

export interface BackupSnapshot {
  id: string;
  created_at: string;
  size_bytes: number;
  record_count: number;
  trigger: "auto" | "manual";
  data: any;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("created_at", "created_at");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    Promise.resolve(fn(store)).then((result) => {
      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };
      transaction.onerror = () => reject(transaction.error);
    }, reject);
  });
}

export async function listSnapshots(): Promise<BackupSnapshot[]> {
  return tx("readonly", (store) => {
    return new Promise<BackupSnapshot[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const arr = (req.result as BackupSnapshot[]) || [];
        arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
        resolve(arr);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function deleteSnapshot(id: string): Promise<void> {
  await tx("readwrite", (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

async function saveSnapshot(snap: BackupSnapshot): Promise<void> {
  await tx("readwrite", (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.put(snap);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

async function pruneOld(): Promise<void> {
  const all = await listSnapshots();
  if (all.length <= MAX_SNAPSHOTS) return;
  const toDelete = all.slice(MAX_SNAPSHOTS);
  for (const s of toDelete) await deleteSnapshot(s.id);
}

async function collectAllData() {
  const [files, fileStudies, minutes, summons, legalDocs] = await Promise.all([
    supabase.from("files").select("*"),
    supabase.from("file_studies").select("*"),
    supabase.from("meeting_minutes").select("*"),
    supabase.from("summons").select("*"),
    supabase.from("legal_documents").select("*"),
  ]);
  const data = {
    files: files.data || [],
    file_studies: fileStudies.data || [],
    meeting_minutes: minutes.data || [],
    summons: summons.data || [],
    legal_documents: legalDocs.data || [],
    exported_at: new Date().toISOString(),
  };
  const count =
    data.files.length +
    data.file_studies.length +
    data.meeting_minutes.length +
    data.summons.length +
    data.legal_documents.length;
  return { data, count };
}

export async function createBackup(trigger: "auto" | "manual" = "manual"): Promise<BackupSnapshot> {
  const { data, count } = await collectAllData();
  const json = JSON.stringify(data);
  const snap: BackupSnapshot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    size_bytes: new Blob([json]).size,
    record_count: count,
    trigger,
    data,
  };
  await saveSnapshot(snap);
  await pruneOld();
  localStorage.setItem(LAST_RUN_KEY, snap.created_at);
  return snap;
}

export function isAutoBackupEnabled(): boolean {
  const v = localStorage.getItem(ENABLED_KEY);
  return v === null ? true : v === "1";
}

export function setAutoBackupEnabled(enabled: boolean) {
  localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
}

export function getLastAutoBackup(): string | null {
  return localStorage.getItem(LAST_RUN_KEY);
}

export async function runAutoBackupIfDue(): Promise<BackupSnapshot | null> {
  if (!isAutoBackupEnabled()) return null;
  const last = getLastAutoBackup();
  if (last) {
    const diff = Date.now() - new Date(last).getTime();
    if (diff < INTERVAL_MS) return null;
  }
  try {
    return await createBackup("auto");
  } catch (err) {
    console.error("Auto-backup failed:", err);
    return null;
  }
}

export function downloadSnapshot(snap: BackupSnapshot) {
  const blob = new Blob([JSON.stringify(snap.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = snap.created_at.split("T")[0];
  a.href = url;
  a.download = `opvm_backup_${dateStr}_${snap.trigger}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
