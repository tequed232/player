/**
 * Persistence: IndexedDB for records / settings / draft.
 * Falls back to localStorage when IndexedDB is unavailable (private mode, old browsers)
 * so user created data still survives a reload.
 */
import type { AppSettings, Draft, NoteRecord } from './types';

const DB_NAME = 'm3-expressive-notes';
const DB_VERSION = 1;
const STORE_RECORDS = 'records';
const STORE_SETTINGS = 'settings';
const STORE_KV = 'kv';

const LS_PREFIX = 'm3-notes:';

let dbPromise: Promise<IDBDatabase> | null = null;
let idbFailed = false;

function hasIdb(): boolean {
  return typeof indexedDB !== 'undefined' && !idbFailed;
}

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_RECORDS)) {
          const store = db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS);
        }
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onblocked = () => reject(new Error('IndexedDB blocked'));
    }).catch((error) => {
      idbFailed = true;
      throw error;
    });
  }
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      }),
  );
}

/* ------------------------------------------------------------------ records */

export async function getAllRecords(): Promise<NoteRecord[]> {
  if (!hasIdb()) {
    const raw = localStorage.getItem(`${LS_PREFIX}records`);
    const list = raw ? (JSON.parse(raw) as NoteRecord[]) : [];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }
  try {
    const all = await tx<NoteRecord[]>(STORE_RECORDS, 'readonly', (s) => s.getAll());
    return (all ?? []).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function putRecord(record: NoteRecord): Promise<void> {
  if (!hasIdb()) {
    const all = await getAllRecords();
    const next = [record, ...all.filter((r) => r.id !== record.id)];
    localStorage.setItem(`${LS_PREFIX}records`, JSON.stringify(next));
    return;
  }
  try {
    await tx(STORE_RECORDS, 'readwrite', (s) => s.put(record));
  } catch {
    /* quota or private mode: keep the in-memory copy the UI already holds */
  }
}

export async function deleteRecord(id: string): Promise<void> {
  if (!hasIdb()) {
    const all = await getAllRecords();
    localStorage.setItem(`${LS_PREFIX}records`, JSON.stringify(all.filter((r) => r.id !== id)));
    return;
  }
  try {
    await tx(STORE_RECORDS, 'readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

export async function clearRecords(): Promise<void> {
  if (!hasIdb()) {
    localStorage.setItem(`${LS_PREFIX}records`, JSON.stringify([]));
    return;
  }
  try {
    await tx(STORE_RECORDS, 'readwrite', (s) => s.clear());
  } catch {
    /* ignore */
  }
}

/* ----------------------------------------------------------------- settings */

export async function readSettings(): Promise<Partial<AppSettings>> {
  if (!hasIdb()) {
    const raw = localStorage.getItem(`${LS_PREFIX}settings`);
    return raw ? (JSON.parse(raw) as Partial<AppSettings>) : {};
  }
  try {
    const value = await tx<Partial<AppSettings> | undefined>(STORE_SETTINGS, 'readonly', (s) => s.get('settings'));
    return value ?? {};
  } catch {
    return {};
  }
}

export async function writeSettings(settings: AppSettings): Promise<void> {
  if (!hasIdb()) {
    localStorage.setItem(`${LS_PREFIX}settings`, JSON.stringify(settings));
    return;
  }
  try {
    await tx(STORE_SETTINGS, 'readwrite', (s) => s.put(settings, 'settings'));
  } catch {
    /* ignore */
  }
}

/* --------------------------------------------------------------- key/value */

export async function readKv<T>(key: string): Promise<T | undefined> {
  if (!hasIdb()) {
    const raw = localStorage.getItem(`${LS_PREFIX}kv:${key}`);
    return raw ? (JSON.parse(raw) as T) : undefined;
  }
  try {
    return await tx<T | undefined>(STORE_KV, 'readonly', (s) => s.get(key));
  } catch {
    return undefined;
  }
}

export async function writeKv<T>(key: string, value: T): Promise<void> {
  if (!hasIdb()) {
    localStorage.setItem(`${LS_PREFIX}kv:${key}`, JSON.stringify(value));
    return;
  }
  try {
    await tx(STORE_KV, 'readwrite', (s) => s.put(value, key));
  } catch {
    /* ignore */
  }
}

export async function removeKv(key: string): Promise<void> {
  if (!hasIdb()) {
    localStorage.removeItem(`${LS_PREFIX}kv:${key}`);
    return;
  }
  try {
    await tx(STORE_KV, 'readwrite', (s) => s.delete(key));
  } catch {
    /* ignore */
  }
}

export const DRAFT_KEY = 'draft';
export const SCHEDULE_KEY = 'schedule';
