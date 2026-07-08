/**
 * Firebase bootstrap + auth/Firestore helpers.
 *
 * Configuration comes from VITE_FIREBASE_* env vars (see .env.example).
 * When unconfigured, the app runs fully offline and the Account view says so.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { WrappedKey } from './crypto';

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const isFirebaseConfigured = (): boolean => Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function ensureApp(): { auth: Auth; db: Firestore } {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  if (!app) {
    app = initializeApp(config as Record<string, string>);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { auth: auth!, db: db! };
}

export type { User };

export function watchAuth(cb: (user: User | null) => void): Unsubscribe {
  if (!isFirebaseConfigured()) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(ensureApp().auth, cb);
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(ensureApp().auth, new GoogleAuthProvider());
}

export async function signInWithMicrosoft(): Promise<void> {
  const provider = new OAuthProvider('microsoft.com');
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(ensureApp().auth, provider);
}

export async function signOut(): Promise<void> {
  await fbSignOut(ensureApp().auth);
}

// ---- Cloud state document (users/{uid}) — only ciphertext leaves the device ----

export interface CloudStateDoc {
  /** Encrypted AppState envelope (AES-GCM, see lib/crypto). */
  envelope: string;
  /** Data key wrapped with the user's sync passphrase. */
  wrappedKey: WrappedKey;
  updatedAt: number;
  deviceId: string;
}

const userDoc = (uid: string) => doc(ensureApp().db, 'users', uid);

export async function fetchCloudState(uid: string): Promise<CloudStateDoc | null> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? (snap.data() as CloudStateDoc) : null;
}

export async function pushCloudState(uid: string, data: CloudStateDoc): Promise<void> {
  await setDoc(userDoc(uid), data);
}

export function watchCloudState(
  uid: string,
  cb: (data: CloudStateDoc | null) => void
): Unsubscribe {
  return onSnapshot(userDoc(uid), (snap) =>
    cb(snap.exists() ? (snap.data() as CloudStateDoc) : null)
  );
}

// ---- Inbound email pending bills (users/{uid}/pendingBills) ----

export interface InboundEmailDoc {
  id: string;
  subject?: string;
  text?: string;
  from?: string;
  receivedAt?: number;
}

export function watchInboundEmails(
  uid: string,
  cb: (docs: InboundEmailDoc[]) => void
): Unsubscribe {
  const col = collection(ensureApp().db, 'users', uid, 'pendingBills');
  return onSnapshot(col, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InboundEmailDoc, 'id'>) })))
  );
}

export async function deleteInboundEmail(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(ensureApp().db, 'users', uid, 'pendingBills', id));
}

/** Register the user's email-forwarding token so the ingestion function can route emails. */
export async function registerEmailToken(uid: string, token: string): Promise<void> {
  await setDoc(doc(ensureApp().db, 'emailTokens', token), { uid, createdAt: Date.now() });
}
