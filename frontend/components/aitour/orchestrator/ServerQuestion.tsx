import React from 'react';
import { Text, View } from 'react-native';
import type { Command, QuestionView } from '../../../lib/aitour/orchestrator/contract';
import { questionLines } from '../../../lib/aitour/orchestrator/conversation';
import { OButton, ServerOptions } from './controls';
import { styles as s } from './styles';
export function ServerQuestion({ question: q, disabled, act, embedded = false }: { question: QuestionView; disabled: boolean; act: (c: Command) => void; embedded?: boolean }) {
  return <View testID={`orchestrator-question-${q.id}`} style={embedded ? s.stop : s.card}>
    <View testID={`orchestrator-question-text-${q.id}`} style={s.stop}>
    {questionLines(q).map((line, i) => line.followUpId ? <View key={line.followUpId} testID={`orchestrator-follow-up-${line.followUpId}`} style={s.followUp}>
      <Text testID={`orchestrator-follow-up-text-${line.followUpId}`} style={s.text}>{line.text}</Text>
      {(['include', 'exclude', 'propose_reschedule'] as const).map((decision, i) => <OButton key={decision}
        id={`orchestrator-follow-up-${line.followUpId}-${decision}`} label={['Includi', 'Escludi', 'Proponi riprogrammazione'][i]} disabled={disabled}
        onPress={() => act({ name: 'follow_up_decision', input: { followUpId: line.followUpId!, decision } })} />)}
    </View> : !!line.text && <Text key={`line-${i}`} testID={`orchestrator-question-line-${q.id}-${i}`} style={s.text}>{line.text}</Text>)}
    </View>
    <ServerOptions id={`orchestrator-answer-${q.id}`} options={q.options} disabled={disabled} act={act} />
  </View>;
}