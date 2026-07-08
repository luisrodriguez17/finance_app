/**
 * Assistant chatbot client: sends the user's question plus a compact,
 * locally computed snapshot (see ./snapshot.ts) to the `assistantChat`
 * Cloud Function, which proxies the LLM call server-side. Replies may
 * carry proposed actions (see ./assistantActions.ts) that the user can
 * apply with a tap.
 */
import type { AppState } from '../types';
import { buildSnapshot } from './snapshot';
import { callAssistantChat } from './firebase';
import { parseActions, type ProposedAction } from './assistantActions';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantReply {
  reply: string;
  actions: ProposedAction[];
  remaining: number;
}

export async function askAssistant(
  message: string,
  history: ChatMessage[],
  state: AppState
): Promise<AssistantReply> {
  const res = await callAssistantChat({
    message,
    history,
    snapshot: buildSnapshot(state),
    language: state.language,
  });
  return { reply: res.reply, actions: parseActions(res.actions), remaining: res.remaining };
}
