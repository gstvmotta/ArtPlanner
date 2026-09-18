import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'wall-frame-planner-db';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Zustand `StateStorage` backed by IndexedDB instead of localStorage, so
 * persisted state (which can include large base64 artwork images) isn't
 * capped at localStorage's ~5-10MB quota.
 */
export const indexedDbStorage: StateStorage = {
  getItem: async (name: string) => {
    const value = await withStore('readonly', (store) => store.get(name));
    return (value as string | undefined) ?? null;
  },
  setItem: async (name: string, value: string) => {
    await withStore('readwrite', (store) => store.put(value, name));
  },
  removeItem: async (name: string) => {
    await withStore('readwrite', (store) => store.delete(name));
  },
};
