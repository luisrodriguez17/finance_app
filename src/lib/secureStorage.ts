import type { AppState } from '../types';
import { decryptJson, encryptJson, getOrCreateDataKey, isEnvelope } from './crypto';

const LEGACY_KEY = 'finance-app-state-v1';
const STORAGE_KEY = 'finance-app-state-v2';

let dataKey: CryptoKey | null = null;

export const getDataKey = (): CryptoKey => {
  if (!dataKey) throw new Error('Storage not initialized');
  return dataKey;
};

/** Swap the device data key (used when adopting the cloud key on a new device). */
export const setDataKey = (key: CryptoKey): void => {
  dataKey = key;
};

/**
 * Load persisted state, migrating any legacy plaintext JSON to the encrypted
 * v2 envelope. Returns null when nothing is stored yet.
 */
export async function initSecureStorage(): Promise<Record<string, unknown> | null> {
  dataKey = await getOrCreateDataKey();

  const encrypted = localStorage.getItem(STORAGE_KEY);
  if (encrypted && isEnvelope(encrypted)) {
    try {
      return await decryptJson<Record<string, unknown>>(dataKey, encrypted);
    } catch {
      // Key mismatch (e.g. IndexedDB cleared but localStorage kept) — treat as empty.
      return null;
    }
  }

  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as Record<string, unknown>;
      localStorage.setItem(STORAGE_KEY, await encryptJson(dataKey, parsed));
      localStorage.removeItem(LEGACY_KEY);
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

/** Encrypt and persist state, debounced so rapid edits don't thrash crypto. */
export function persistState(state: AppState): void {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    if (!dataKey) return;
    try {
      localStorage.setItem(STORAGE_KEY, await encryptJson(dataKey, state));
    } catch (e) {
      console.error('Failed to persist encrypted state', e);
    }
  }, 300);
}

/** Immediately encrypt current state (used before upload / on page hide). */
export async function encryptState(state: AppState): Promise<string> {
  return encryptJson(getDataKey(), state);
}
