# Account, Sync, Encryption & Auto-Bills Setup

## 1. Encryption (works out of the box)

All app data is now encrypted at rest with **AES-256-GCM** (`src/lib/crypto.ts`):

- A random data key is generated on first run and kept in IndexedDB (not in localStorage).
- The whole `AppState` is stored as a ciphertext envelope under `finance-app-state-v2`; any
  legacy plaintext `finance-app-state-v1` blob is migrated automatically and deleted.
- The cloud only ever receives ciphertext. For sync, the data key is wrapped with a key derived
  from the user's **sync passphrase** (PBKDF2, 310k iterations), so the server cannot read the data.
  **If the user forgets the passphrase, cloud data cannot be recovered** — that's the trade-off of
  end-to-end encryption.

## 2. Sign-in with Google / Outlook + cross-device sync (Firebase)

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method**: enable **Google** and **Microsoft** providers
   (Microsoft needs an Azure app registration — the console walks you through it).
3. **Firestore Database**: create it, then deploy the rules in `firestore.rules`
   (`firebase deploy --only firestore:rules`).
4. **Project settings → Your apps → Web app**: copy the config into `.env`
   (see `.env.example`, keys `VITE_FIREBASE_*`). Rebuild.

Flow: the user signs in on the Account tab → chooses a sync passphrase → the encrypted state is
pushed to `users/{uid}`. On a second device: sign in → enter the same passphrase → cloud state is
downloaded, decrypted, and adopted. Afterwards changes sync automatically (last write wins,
debounced 1.5 s).

## 3. Automatic bills — Android notification capture

The repo now contains a Capacitor Android project (`android/`) with a
`NotificationListenerService` (`BillNotificationListenerService.java`) that captures notifications
matching a currency amount **and** a transaction keyword (compra/purchase/spent/pago/…), queues
them in SharedPreferences, and exposes them to the web app via the `NotificationBills` plugin.
Parsing (amount, currency, merchant) happens in `src/lib/billParser.ts`; results appear as
**Captured transactions** on the Account tab for one-tap accept/dismiss.

Build & run:

```sh
npm run build && npx cap sync android
npx cap open android   # build/run from Android Studio
```

In the app: Account tab → **Grant notification access** (opens the system settings screen).

## 4. Automatic bills — email forwarding

1. Deploy the ingestion function: `firebase deploy --only functions` (code in `functions/`).
2. Set up inbound email on a domain you own (SendGrid Inbound Parse, Mailgun Routes, or a
   Cloudflare Email Worker) and point its webhook at the `inboundEmail` function URL.
   Optionally set `INBOUND_WEBHOOK_SECRET` (function env) and send it as `x-webhook-secret`.
3. Put the domain in `.env` as `VITE_INBOUND_EMAIL_DOMAIN`.
4. In the app: Account tab → **Generate forwarding address** → user forwards bank emails to
   `bills+<token>@<domain>`; parsed transactions appear under Captured transactions.

Note: forwarded email text is stored briefly (plaintext) in `users/{uid}/pendingBills` until the
app picks it up, parses it locally, and deletes the doc.
