import { describe, expect, it } from 'vitest';
import type { QuestionView, ServerSnapshot, TranscriptMessage } from '../lib/aitour/orchestrator/contract';
import { conversationTurns, questionLines, questionMessageId, recoveredQuestionLinks, splitQuestionMessage } from '../lib/aitour/orchestrator/conversation';

const assistant = (id: string, text: string, question?: { id: string; text: string }): TranscriptMessage => ({ id, role: 'assistant', text, ...(question ? { question } : {}) });
const user = (id: string, text: string): TranscriptMessage => ({ id, role: 'user', text });

function snapshot(messages: TranscriptMessage[], questions: QuestionView[]): ServerSnapshot {
  return {
    sessionId: 'sess-1',
    revision: 1,
    status: 'needs_clarification',
    messages,
    questions,
    warnings: [],
    plan: null,
  };
}

describe('orchestrator conversation rendering helpers', () => {
  it('relinks a recovery read only to the same confirmed question/turn; old caches work without global text matching', () => {
    const messages = [assistant('old-a', 'Scegli'), user('new-u', 'ancora'), assistant('new-a', 'Scegli')];
    const oldQuestion: QuestionView = { id: 'q', text: 'Scegli', options: [] };
    const read = snapshot(messages, [{ ...oldQuestion, messageId: 'get-plan-a' }]);
    read.questions = recoveredQuestionLinks(read, { revision: 1, questions: [oldQuestion] }, messages);
    const turns = conversationTurns(read);
    expect(turns.messages[0].questions).toEqual([]);
    expect(turns.messages[2].questions).toHaveLength(1);
    expect(turns.standalone).toEqual([]);
    expect(turns.messages).toHaveLength(3);
  });
  it('does not relink a newer server revision or changed question to an older equal-text turn', () => {
    const messages = [assistant('old-a', 'Scegli')];
    const q: QuestionView = { id: 'q', text: 'Scegli', messageId: 'old-a', options: [] };
    const read = snapshot(messages, [{ ...q, messageId: 'read-a' }]);
    expect(recoveredQuestionLinks({ ...read, revision: 2 }, { revision: 1, questions: [q] }, messages)).toEqual(read.questions);
    expect(recoveredQuestionLinks(read, { revision: 1, questions: [{ ...q, id: 'different' }] }, messages)).toEqual(read.questions);
  });
  it('keeps duplicate assistant texts across turns (no global text dedup)', () => {
    const turns = conversationTurns(snapshot([
      assistant('r1-a', 'Stessa risposta.'),
      user('r2-u', 'Confermi?'),
      assistant('r2-a', 'Stessa risposta.'),
    ], []));

    expect(turns.messages.map(m => m.message.id)).toEqual(['r1-a', 'r2-u', 'r2-a']);
    expect(turns.messages.filter(m => m.message.text === 'Stessa risposta.')).toHaveLength(2);
  });

  it('links by messageId and leaves invalid links as standalone without swallowing transcript history', () => {
    const q1: QuestionView = { id: 'q-1', text: 'Scegli', options: [], messageId: 'r2-a' };
    const qInvalid: QuestionView = { id: 'q-2', text: 'Non legata', options: [], messageId: 'missing-id' };
    const turns = conversationTurns(snapshot([
      assistant('r1-a', 'Storico 1', { id: 'hq-1', text: 'Domanda storica 1' }),
      assistant('r2-a', 'Storico 2', { id: 'hq-2', text: 'Domanda storica 2' }),
    ], [q1, qInvalid]));

    expect(turns.messages.find(m => m.message.id === 'r2-a')?.questions.map(q => q.id)).toEqual(['q-1']);
    expect(turns.standalone.map(q => q.id)).toEqual(['q-2']);
    expect(turns.messages).toHaveLength(2);
  });

  it('compatibility fallback links only to current last assistant message when messageId is absent', () => {
    const q: QuestionView = { id: 'q-x', text: 'scegli opzione', options: [] };
    const old = [assistant('a-1', 'Prima risposta: scegli opzione')];
    expect(questionMessageId(q, old)).toBe('a-1');

    const notLast = [assistant('a-1', 'scegli opzione'), user('u-1', 'ok'), assistant('a-2', 'testo diverso')];
    expect(questionMessageId(q, notLast)).toBeUndefined();
  });

  it('splits message/question span without creating duplicate text', () => {
    expect(splitQuestionMessage('Quale opzione?', 'Quale opzione?')).toEqual({ before: '', after: '' });
    expect(splitQuestionMessage('Piano pronto. Quale opzione? Grazie', 'Quale opzione?')).toEqual({ before: 'Piano pronto.', after: 'Grazie' });
  });

  it('renders follow-up bullets once with stable row mapping; mismatch falls back to raw text', () => {
    const exact = questionLines({
      id: 'q-follow',
      text: 'Decidi:\n• Cliente A\n• Cliente B',
      options: [],
      followUps: [{ id: 'fu-1', text: 'Cliente A' }, { id: 'fu-2', text: 'Cliente B' }],
    });
    expect(exact.filter(r => r.followUpId).map(r => r.followUpId)).toEqual(['fu-1', 'fu-2']);
    expect(exact.filter(r => r.followUpId).map(r => r.text)).toEqual(['Cliente A', 'Cliente B']);

    const mismatch = questionLines({
      id: 'q-mismatch',
      text: 'Decidi:\n• Cliente A\n• Cliente C',
      options: [],
      followUps: [{ id: 'fu-1', text: 'Cliente A' }, { id: 'fu-2', text: 'Cliente B' }],
    });
    expect(mismatch).toEqual([{ text: 'Decidi:\n• Cliente A\n• Cliente C' }]);
  });
});
