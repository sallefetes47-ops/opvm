export type FileScanRecord = {
  fileId: string;
  blob: Blob;
  name: string;
  type: string;
  updatedAt: string;
};

const DB_NAME = "opvm";
const DB_VERSION = 1;
const STORE = "file_scans";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "fileId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const request = fn(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      })
  );
}

export async function getFileScan(fileId: string): Promise<FileScanRecord | null> {
  const result = await withStore<FileScanRecord | undefined>("readonly", (store) => store.get(fileId));
  return result ?? null;
}

export async function saveFileScan(fileId: string, file: File): Promise<void> {
  const record: FileScanRecord = {
    fileId,
    blob: file,
    name: file.name,
    type: file.type || "application/octet-stream",
    updatedAt: new Date().toISOString(),
  };
  await withStore<IDBValidKey>("readwrite", (store) => store.put(record));
}

export async function deleteFileScan(fileId: string): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.delete(fileId));
}

