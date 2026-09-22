import { get, set, del } from 'idb-keyval';
import type { PersistedState } from '../types';

const STORAGE_KEY = 'oxford-vocab-app-state';
const LOCALSTORAGE_FALLBACK_KEY = 'oxford-vocab-app-state-fallback';

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
