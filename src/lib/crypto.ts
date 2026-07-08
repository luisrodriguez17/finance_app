/**
 * Encryption primitives for the app's data at rest and in the cloud.
 *
 * Model:
 * - A random AES-256-GCM "data key" encrypts the whole AppState blob.
 * - The data key lives in IndexedDB on each device (never in localStorage).
 * - For cloud sync the data key is wrapped with a key derived from the user's
 *   sync passphrase (PBKDF2), so Firestore only ever sees ciphertext.
 */

const PBKDF2_ITERATIONS = 310_000;

const te = new TextEncoder();
const td = new TextDecoder();

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

const fromB64 = (b64: string): Uint8Array => {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

export interface Envelope {
  v: 2;
  iv: string;
  data: string;
}

export interface WrappedKey {
  wrapped: string;
  salt: string;
  iv: string;
}

export const generateDataKey = (): Promise<CryptoKey> =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

export async function encryptJson(key: CryptoKey, obj: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    te.encode(JSON.stringify(obj))
  );
  const envelope: Envelope = { v: 2, iv: toB64(iv), data: toB64(data) };
  return JSON.stringify(envelope);
}

export async function decryptJson<T>(key: CryptoKey, envelopeStr: string): Promise<T> {
  const envelope = JSON.parse(envelopeStr) as Envelope;
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(envelope.iv) as BufferSource },
    key,
    fromB64(envelope.data) as BufferSource
  );
  return JSON.parse(td.decode(plain)) as T;
}

export const isEnvelope = (raw: string): boolean => {
  try {
    const p = JSON.parse(raw);
    return p && typeof p === 'object' && p.v === 2 && typeof p.data === 'string';
  } catch {
    return false;
  }
};

async function deriveWrappingKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

export async function wrapDataKey(dataKey: CryptoKey, passphrase: string): Promise<WrappedKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await deriveWrappingKey(passphrase, salt);
  const wrapped = await crypto.subtle.wrapKey('raw', dataKey, wrappingKey, {
    name: 'AES-GCM',
    iv,
  });
  return { wrapped: toB64(wrapped), salt: toB64(salt), iv: toB64(iv) };
}

export async function unwrapDataKey(wk: WrappedKey, passphrase: string): Promise<CryptoKey> {
  const wrappingKey = await deriveWrappingKey(passphrase, fromB64(wk.salt));
  return crypto.subtle.unwrapKey(
    'raw',
    fromB64(wk.wrapped) as BufferSource,
    wrappingKey,
    { name: 'AES-GCM', iv: fromB64(wk.iv) as BufferSource },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// ---- Data-key persistence (IndexedDB — CryptoKey objects are structured-cloneable) ----

const DB_NAME = 'finance-app-keys';
const DB_STORE = 'keys';
const DATA_KEY_ID = 'data-key-v1';

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadStoredDataKey(): Promise<CryptoKey | null> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(DATA_KEY_ID);
    req.onsuccess = () => resolve((req.result as CryptoKey) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function storeDataKey(key: CryptoKey): Promise<void> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(key, DATA_KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get the device's data key, creating and persisting one on first run. */
export async function getOrCreateDataKey(): Promise<CryptoKey> {
  const existing = await loadStoredDataKey();
  if (existing) return existing;
  const key = await generateDataKey();
  await storeDataKey(key);
  return key;
}
