import React from 'react';
import { Text, View } from 'react-native';
import type { Command, ServerSnapshot } from '../../../lib/aitour/orchestrator/contract';
import { conversationTurns, splitQuestionMessage } from '../../../lib/aitour/orchestrator/conversation';
import { ServerQuestion } from './ServerQuestion';
import { styles as s } from './styles';

export function ServerConversation({ snapshot, disabled, act }: { snapshot: ServerSnapshot; disabled: boolean; act: (c: Command) => void }) {
  const turns = conversationTurns(snapshot);
  return <View testID="orchestrator-transcript" style={s.transcript}>
    {turns.messages.map(({ message: m, questions }) => {
      const q = questions[0];
      const prompt = q ?? m.question;
      const parts = prompt ? splitQuestionMessage(m.text, prompt.text) : { before: m.text, after: '' };
      return <View key={m.id} testID={`orchestrator-message-${m.id}`} style={[s.message, m.role === 'user' && s.userMessage]}>
        {!!parts.before && <Text testID={`orchestrator-message-text-${m.id}`} style={s.text}>{parts.before}</Text>}
        {q ? <ServerQuestion question={q} disabled={disabled} act={act} embedded />
          : prompt && <Text testID={`orchestrator-historic-question-${m.id}`} style={s.text}>{prompt.text}</Text>}
        {!!parts.after && <Text testID={`orchestrator-message-suffix-${m.id}`} style={s.text}>{parts.after}</Text>}
        {questions.slice(1).map(question => <ServerQuestion key={question.id} question={question} disabled={disabled} act={act} embedded />)}
      </View>;
    })}
    {turns.standalone.map(q => <ServerQuestion key={q.id} question={q} disabled={disabled} act={act} />)}
  </View>;
}