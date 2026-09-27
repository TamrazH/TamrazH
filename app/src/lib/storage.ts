import { get, set, del, keys } from 'idb-keyval';
import type { PersistedState } from '../types';

// IMPORTANT: this key must never change again. It changed once before (v1 -> v2)
// as an intentional clean-slate wipe; any future schema change must instead bump
// `STATE_VERSION` in useAppStore.ts and be handled by the migration path in
// hydrate(), which backs up the pre-migration snapshot before touching anything.
const STORAGE_KEY = 'oxford-vocab-app-state-v2';
const LOCALSTORAGE_FALLBACK_KEY = 'oxford-vocab-app-state-fallback-v2';
const BACKUP_KEY_PREFIX = 'oxford-vocab-app-state-backup';
const MIGRATION_STATUS_KEY = 'oxford-vocab-migration-status';
const LAST_SAVED_KEY = 'oxford-vocab-last-saved-at';

export interface MigrationStatus {
  fromVersion: number;
  toVersion: number;
  migratedAt: string;
}

/**
 * IndexedDB is the primary store (via idb-keyval); localStorage is a synchronous
 * fallback for browsers/contexts where IndexedDB is unavailable (e.g. some private
 * browsing modes). Both keep the app usable after a refresh with no backend.
 */
export async function loadState(): Promise<PersistedState | undefined> {
  try {
    const fromIdb = await get<PersistedState>(STORAGE_KEY);
    if (fromIdb) return fromIdb;
  } catch {
    // fall through to localStorage
  }
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_FALLBACK_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch {
    // ignore corrupt fallback data
  }
  return undefined;
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await set(STORAGE_KEY, state);
  } catch {
    // ignore, fallback below still runs
  }
  try {
    localStorage.setItem(LOCALSTORAGE_FALLBACK_KEY, JSON.stringify(state));
    localStorage.setItem(LAST_SAVED_KEY, new Date().toISOString());
  } catch {
    // storage full or unavailable; nothing more we can do here
  }
}

export async function clearState(): Promise<void> {
  try {
    await del(STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(LOCALSTORAGE_FALLBACK_KEY);
  } catch {
    // ignore
  }
}

/** Snapshots a pre-migration state under a distinct, never-overwritten key so it can be recovered manually even if the migration logic itself has a bug. */
export async function backupState(state: PersistedState, fromVersion: number): Promise<void> {
  const key = `${BACKUP_KEY_PREFIX}-v${fromVersion}-${Date.now()}`;
  try {
    await set(key, state);
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export async function recordMigrationStatus(status: MigrationStatus): Promise<void> {
  try {
    localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(status));
  } catch {
    // ignore
  }
}

export function getMigrationStatus(): MigrationStatus | null {
  try {
    const raw = localStorage.getItem(MIGRATION_STATUS_KEY);
    return raw ? (JSON.parse(raw) as MigrationStatus) : null;
  } catch {
    return null;
  }
}

export function getLastSavedAt(): string | null {
  try {
    return localStorage.getItem(LAST_SAVED_KEY);
  } catch {
    return null;
  }
}

/** Best-effort probe of which backend is actually serving reads/writes, for the diagnostics screen. */
export async function detectStorageBackend(): Promise<'indexeddb' | 'localstorage' | 'none'> {
  try {
    await keys();
    return 'indexeddb';
  } catch {
    // fall through
  }
  try {
    const probeKey = '__oxford_vocab_storage_probe__';
    localStorage.setItem(probeKey, '1');
    localStorage.removeItem(probeKey);
    return 'localstorage';
  } catch {
    return 'none';
  }
}

export function countBackups(): number {
  let count = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(BACKUP_KEY_PREFIX)) count++;
    }
  } catch {
    // ignore
  }
  return count;
}
