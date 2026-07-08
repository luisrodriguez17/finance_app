# Assistant Chatbot Setup (WIP)

An in-app assistant (More → Assistant) that helps users navigate the app, analyzes their data,
runs simple money projections, and can create entries for them (accounts, bills, subscriptions,
credit cards, reserves, money owed) — each proposed entry shows an "Add it" button and nothing
is applied without the user's tap.

## Architecture

- The LLM call happens in the `assistantChat` Cloud Function (`functions/assistant.js`) so no
  API key ever ships in the client.
- The client sends only a compact, locally computed snapshot (`src/lib/snapshot.ts`): totals,
  monthly averages, and linear projections — never the raw bill/transaction list.
- Auth is **anonymous Firebase auth** (invisible to the user) purely so the function can
  rate-limit per user. When the account/sign-in branch lands, real sign-in supersedes it.
- Proposed actions are validated twice (function whitelist + client re-validation in
  `src/lib/assistantActions.ts`) and applied client-side only after confirmation.

## Setup

1. Create a Firebase project at <https://console.firebase.google.com>:
   - **Authentication → Sign-in method**: enable the **Anonymous** provider.
   - **Firestore Database**: create it, deploy rules: `firebase deploy --only firestore:rules`.
   - **Project settings → Your apps → Web app**: copy the config into `.env`
     (see `.env.example`, keys `VITE_FIREBASE_*`). Rebuild.
2. Pick an LLM provider and get a key — free options:
   - **Google Gemini** (default): key at <https://aistudio.google.com> (free tier).
   - **Groq**: key at <https://console.groq.com> (free tier, Llama models).
   - **Ollama**: self-hosted; set `OLLAMA_URL` to a server the function can reach
     (a cloud function cannot reach `localhost` on your machine).
   - **Anthropic Claude**: the paid upgrade path once the app generates revenue
     (`ANTHROPIC_MODEL=claude-haiku-4-5` for budget, `claude-opus-4-8` for max quality).
3. Copy `functions/.env.example` to `functions/.env`, set `LLM_PROVIDER` and the key.
4. Deploy: `firebase deploy --only functions,firestore:rules`.

## Abuse / cost controls

- Requires an authenticated (anonymous) user; unauthenticated calls are rejected.
- Per-user daily quota (`CHAT_DAILY_LIMIT`, default 20) tracked in the admin-only
  `chatUsage/{uid}` collection.
- Input length, history length, and snapshot size are capped; output tokens capped at 1024.
- The system prompt pins the model to app help + the user's own finances and instructs it to
  refuse anything else (prompt-injection attempts included). This is best-effort with small
  models — the daily quota is the hard cost backstop.

## Privacy note

The snapshot (account names, balances, aggregate spending) is sent to the chosen LLM provider
when — and only when — the user sends a chat message. Mention this in your privacy policy if you
deploy the assistant publicly.
