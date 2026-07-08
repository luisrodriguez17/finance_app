/**
 * Minimal Firebase bootstrap for the assistant chatbot.
 *
 * Configuration comes from VITE_FIREBASE_* env vars (see .env.example).
 * When unconfigured, the app runs fully offline and the Assistant tab says so.
 *
 * The assistant needs an authenticated user only so the Cloud Function can
 * rate-limit per user — we use anonymous auth, invisible to the user. When
 * the account/sign-in feature branch lands, real sign-in supersedes this.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth, type User } from 'firebase/auth';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';

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
let fns: Functions | null = null;

function ensureApp(): { auth: Auth; fns: Functions } {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  if (!app) {
    app = initializeApp(config as Record<string, string>);
    auth = getAuth(app);
    fns = getFunctions(app);
  }
  return { auth: auth!, fns: fns! };
}

/** Sign in anonymously if there is no current user (requires the Anonymous
 *  provider to be enabled in the Firebase console). */
export async function ensureSignedIn(): Promise<User> {
  const { auth } = ensureApp();
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

// ---- Assistant chatbot ----

export interface AssistantChatPayload {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  snapshot: object;
  language: string;
}

export interface ProposedActionWire {
  type: string;
  [key: string]: unknown;
}

export interface AssistantChatResult {
  reply: string;
  actions?: ProposedActionWire[];
  remaining: number;
}

/** Call the `assistantChat` Cloud Function (signs in anonymously if needed). */
export async function callAssistantChat(
  payload: AssistantChatPayload
): Promise<AssistantChatResult> {
  await ensureSignedIn();
  const call = httpsCallable<AssistantChatPayload, AssistantChatResult>(
    ensureApp().fns,
    'assistantChat'
  );
  const res = await call(payload);
  return res.data;
}
