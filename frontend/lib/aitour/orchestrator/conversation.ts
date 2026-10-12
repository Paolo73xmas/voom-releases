import type { QuestionView, ServerSnapshot, TranscriptMessage } from './contract';

/** Link by response identity, never by matching texts across the transcript. */
export function questionMessageId(q: QuestionView, messages: TranscriptMessage[]): string | undefined {
  if (q.messageId) return messages.some(m => m.role === 'assistant' && m.id === q.messageId) ? q.messageId : undefined;
  // Compatibility with previously persisted presentation caches: only the CURRENT last assistant turn.
  const last = messages[messages.length - 1];
  return last?.role === 'assistant' && !!q.text && last.text.includes(q.text) ? last.id : undefined;
}

/** Replace only the known question span of THIS message. No global string deduplication. */
export function splitQuestionMessage(text: string, question: string): { before: string; after: string } {
  const index = question ? text.indexOf(question) : -1;
  return index < 0 ? { before: text, after: '' } : { before: text.slice(0, index).trim(), after: text.slice(index + question.length).trim() };
}

export function conversationTurns(snapshot: ServerSnapshot) {
  const linked = new Map(snapshot.questions.map(q => [q.id, questionMessageId(q, snapshot.messages)]));
  return {
    messages: snapshot.messages.map(message => ({ message, questions: snapshot.questions.filter(q => linked.get(q.id) === message.id) })),
    standalone: snapshot.questions.filter(q => !linked.get(q.id)),
  };
}

/** get_plan has a new requestId but is a read, not a new conversational turn.
 * Reuse a cached question link ONLY at the same confirmed revision and exact question identity/content.
 * This also migrates pre-link caches without matching/removing arbitrary historical messages. */
export function recoveredQuestionLinks(snapshot: ServerSnapshot, cache: Pick<ServerSnapshot, 'revision' | 'questions'> | undefined, history: TranscriptMessage[]): QuestionView[] {
  if (!cache || cache.revision !== snapshot.revision) return snapshot.questions;
  return snapshot.questions.map(q => {
    const previous = cache.questions.find(old => old.id === q.id && old.text === q.text);
    const messageId = previous && questionMessageId(previous, history);
    return messageId ? { ...q, messageId } : q;
  });
}

/** Follow-up bullet rows are shown once, in their selectable rows; never guess a text/id pairing. */
export function questionLines(q: QuestionView): ({ text: string; followUpId?: string })[] {
  const rows = q.text.split('\n');
  const bullets = rows.filter(row => row.trim().startsWith('•')).map(row => row.replace(/^\s*•\s*/, ''));
  if (!q.followUps?.length || bullets.length !== q.followUps.length || bullets.some((text, i) => text !== q.followUps![i].text)) return [{ text: q.text }];
  let index = 0;
  return rows.map(text => text.trim().startsWith('•') ? { text: q.followUps![index].text, followUpId: q.followUps![index++].id } : { text });
}