import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState } from '../types';
import { normalizeState } from '../store';
import { decryptJson, storeDataKey, unwrapDataKey, wrapDataKey, type WrappedKey } from './crypto';
import { encryptState, getDataKey, setDataKey } from './secureStorage';
import {
  deleteInboundEmail,
  fetchCloudState,
  isFirebaseConfigured,
  pushCloudState,
  registerEmailToken,
  signInWithGoogle,
  signInWithMicrosoft,
  signOut,
  watchAuth,
  watchCloudState,
  watchInboundEmails,
  type CloudStateDoc,
  type User,
} from './firebase';
import { toPendingBill } from './billParser';

export type SyncStatus =
  | 'unconfigured' // no Firebase env vars
  | 'signed-out'
  | 'checking'
  | 'needs-setup' // signed in, no cloud data yet — needs a sync passphrase to start
  | 'needs-passphrase' // cloud data exists but this device can't decrypt it yet
  | 'active'
  | 'error';

const DEVICE_ID_KEY = 'finance-app-device-id';

const getDeviceId = (): string => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

export interface CloudSync {
  user: User | null;
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
  signInGoogle: () => Promise<void>;
  signInMicrosoft: () => Promise<void>;
  signOutUser: () => Promise<void>;
  /** First-time setup: choose a sync passphrase and upload the encrypted state. */
  enableSync: (passphrase: string) => Promise<void>;
  /** New device: unlock the cloud data with the sync passphrase (cloud state wins). */
  unlockWithPassphrase: (passphrase: string) => Promise<void>;
  /** Create + register an email-forwarding token for automatic bill ingestion. */
  createEmailToken: () => Promise<string>;
}

export function useCloudSync(
  state: AppState | null,
  setState: (s: AppState | null | ((p: AppState | null) => AppState | null)) => void
): CloudSync {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SyncStatus>(
    isFirebaseConfigured() ? 'signed-out' : 'unconfigured'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wrappedKeyRef = useRef<WrappedKey | null>(null);
  const pendingRemoteRef = useRef<CloudStateDoc | null>(null);
  const lastSeenUpdateRef = useRef(0);
  const suppressPushRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stateRef = useRef(state);
  const statusRef = useRef(status);
  useEffect(() => {
    stateRef.current = state;
    statusRef.current = status;
  });

  // --- auth ---
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return watchAuth((u) => {
      setUser(u);
      if (u) {
        setStatus('checking');
      } else {
        setStatus('signed-out');
        wrappedKeyRef.current = null;
        lastSeenUpdateRef.current = 0;
      }
    });
  }, []);

  const applyRemote = useCallback(
    async (docData: CloudStateDoc) => {
      const remote = await decryptJson<Record<string, unknown>>(getDataKey(), docData.envelope);
      wrappedKeyRef.current = docData.wrappedKey;
      lastSeenUpdateRef.current = docData.updatedAt;
      suppressPushRef.current = true;
      setState(normalizeState(remote));
      setLastSyncedAt(docData.updatedAt);
      setStatus('active');
    },
    [setState]
  );

  // --- cloud state subscription ---
  const loaded = state !== null;
  useEffect(() => {
    if (!user || !loaded) return;
    const unsub = watchCloudState(user.uid, async (docData) => {
      try {
        if (!docData) {
          setStatus((s) => (s === 'active' ? s : 'needs-setup'));
          return;
        }
        if (docData.deviceId === getDeviceId() || docData.updatedAt <= lastSeenUpdateRef.current) {
          // Our own write echoing back.
          wrappedKeyRef.current = docData.wrappedKey;
          lastSeenUpdateRef.current = Math.max(lastSeenUpdateRef.current, docData.updatedAt);
          setLastSyncedAt(docData.updatedAt);
          setStatus('active');
          return;
        }
        await applyRemote(docData);
      } catch {
        // This device's key can't decrypt the cloud envelope.
        pendingRemoteRef.current = docData;
        setStatus('needs-passphrase');
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loaded]);

  // --- push local changes when sync is active ---
  useEffect(() => {
    if (!state || !user || statusRef.current !== 'active' || !wrappedKeyRef.current) return;
    if (suppressPushRef.current) {
      suppressPushRef.current = false;
      return;
    }
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      try {
        const envelope = await encryptState(state);
        const updatedAt = Date.now();
        lastSeenUpdateRef.current = updatedAt;
        await pushCloudState(user.uid, {
          envelope,
          wrappedKey: wrappedKeyRef.current!,
          updatedAt,
          deviceId: getDeviceId(),
        });
        setLastSyncedAt(updatedAt);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sync failed');
      }
    }, 1500);
    return () => clearTimeout(pushTimerRef.current);
  }, [state, user]);

  // --- inbound email bills → pendingBills ---
  useEffect(() => {
    if (!user) return;
    return watchInboundEmails(user.uid, (docs) => {
      for (const d of docs) {
        const text = [d.subject, d.text].filter(Boolean).join('\n');
        const pending = toPendingBill(text, 'email', d.receivedAt);
        if (pending) {
          setState((prev) =>
            prev && !prev.pendingBills.some((p) => p.raw === pending.raw)
              ? { ...prev, pendingBills: [...prev.pendingBills, pending] }
              : prev
          );
        }
        deleteInboundEmail(user.uid, d.id).catch(() => {});
      }
    });
  }, [user, setState]);

  const enableSync = useCallback(
    async (passphrase: string) => {
      if (!user || !stateRef.current) return;
      const wrappedKey = await wrapDataKey(getDataKey(), passphrase);
      const envelope = await encryptState(stateRef.current);
      const updatedAt = Date.now();
      wrappedKeyRef.current = wrappedKey;
      lastSeenUpdateRef.current = updatedAt;
      await pushCloudState(user.uid, {
        envelope,
        wrappedKey,
        updatedAt,
        deviceId: getDeviceId(),
      });
      setLastSyncedAt(updatedAt);
      setStatus('active');
    },
    [user]
  );

  const unlockWithPassphrase = useCallback(
    async (passphrase: string) => {
      const docData = pendingRemoteRef.current ?? (user ? await fetchCloudState(user.uid) : null);
      if (!docData) throw new Error('No cloud data found');
      const key = await unwrapDataKey(docData.wrappedKey, passphrase);
      setDataKey(key);
      await storeDataKey(key);
      await applyRemote(docData);
      pendingRemoteRef.current = null;
    },
    [user, applyRemote]
  );

  const createEmailToken = useCallback(async () => {
    if (!user) throw new Error('Not signed in');
    const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    await registerEmailToken(user.uid, token);
    setState((prev) =>
      prev ? { ...prev, autoBills: { ...prev.autoBills, emailToken: token } } : prev
    );
    return token;
  }, [user, setState]);

  return {
    user,
    status,
    lastSyncedAt,
    error,
    signInGoogle: signInWithGoogle,
    signInMicrosoft: signInWithMicrosoft,
    signOutUser: signOut,
    enableSync,
    unlockWithPassphrase,
    createEmailToken,
  };
}
