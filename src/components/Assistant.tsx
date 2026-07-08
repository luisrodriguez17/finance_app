import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../types';
import type { T } from '../i18n';
import { askAssistant, type ChatMessage } from '../lib/assistant';
import { applyAction, describeAction, type ProposedAction } from '../lib/assistantActions';
import { isFirebaseConfigured } from '../lib/firebase';

const HISTORY_SENT = 10;

interface ActionEntry {
  action: ProposedAction;
  applied: boolean;
  dismissed: boolean;
}

interface Entry extends ChatMessage {
  actions?: ActionEntry[];
}

export default function Assistant({
  state,
  update,
  t,
}: {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setError(null);
    setInput('');
    const history: ChatMessage[] = entries
      .slice(-HISTORY_SENT)
      .map(({ role, content }) => ({ role, content }));
    setEntries((m) => [...m, { role: 'user', content: message }]);
    setBusy(true);
    try {
      const res = await askAssistant(message, history, state);
      setEntries((m) => [
        ...m,
        {
          role: 'assistant',
          content: res.reply,
          actions: res.actions.map((action) => ({ action, applied: false, dismissed: false })),
        },
      ]);
      setRemaining(res.remaining);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code.includes('resource-exhausted')) {
        setRemaining(0);
        setError(t('assistantLimitReached'));
      } else {
        setError(t('assistantError'));
      }
      // Drop the unanswered user message so it can be retried.
      setEntries((m) => m.slice(0, -1));
      setInput(message);
    } finally {
      setBusy(false);
    }
  };

  const setActionState = (entryIdx: number, actionIdx: number, patch: Partial<ActionEntry>) =>
    setEntries((m) =>
      m.map((entry, i) =>
        i === entryIdx && entry.actions
          ? {
              ...entry,
              actions: entry.actions.map((a, j) => (j === actionIdx ? { ...a, ...patch } : a)),
            }
          : entry
      )
    );

  const runAction = (entryIdx: number, actionIdx: number, action: ProposedAction) => {
    update((s) => applyAction(s, action));
    setActionState(entryIdx, actionIdx, { applied: true });
  };

  if (!isFirebaseConfigured()) {
    return (
      <div>
        <h2>{t('assistantTitle')}</h2>
        <p className="muted">{t('assistantNotConfigured')}</p>
      </div>
    );
  }

  return (
    <div className="assistant">
      <h2>{t('assistantTitle')}</h2>
      <p className="muted">{t('assistantIntro')}</p>

      <div className="chat-log">
        <div className="chat-bubble assistant">{t('assistantWelcome')}</div>
        {entries.map((entry, i) => (
          <div key={i} className={`chat-entry ${entry.role}`}>
            <div className={`chat-bubble ${entry.role}`}>{entry.content}</div>
            {entry.actions
              ?.filter((a) => !a.dismissed)
              .map((a, j) => (
                <div key={j} className="chat-action">
                  <span className="chat-action-desc">{describeAction(a.action, t)}</span>
                  {a.applied ? (
                    <span className="chat-action-done">{t('assistantApplied')}</span>
                  ) : (
                    <span className="chat-action-btns">
                      <button type="button" className="primary" onClick={() => runAction(i, j, a.action)}>
                        {t('assistantApply')}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setActionState(i, j, { dismissed: true })}
                      >
                        {t('assistantDismiss')}
                      </button>
                    </span>
                  )}
                </div>
              ))}
          </div>
        ))}
        {busy && <div className="chat-bubble assistant pending">{t('assistantThinking')}</div>}
        {error && <div className="chat-error">{error}</div>}
        <div ref={endRef} />
      </div>

      {entries.length === 0 && !busy && (
        <div className="chat-suggestions">
          {(['assistantSuggest1', 'assistantSuggest2', 'assistantSuggest3'] as const).map(
            (key) => (
              <button key={key} type="button" className="ghost" onClick={() => send(t(key))}>
                {t(key)}
              </button>
            )
          )}
        </div>
      )}

      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('assistantPlaceholder')}
          maxLength={1500}
          disabled={busy || remaining === 0}
        />
        <button type="submit" disabled={busy || remaining === 0 || !input.trim()}>
          {t('assistantSend')}
        </button>
      </form>

      <p className="muted chat-footnote">
        {remaining !== null && <span>{t('assistantRemaining', { n: remaining })} · </span>}
        {t('assistantDisclaimer')}
      </p>
    </div>
  );
}
