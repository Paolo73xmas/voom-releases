import React from 'react';
import { Text, View } from 'react-native';
import type { Command, QuestionView } from '../../../lib/aitour/orchestrator/contract';
import { OButton, ServerOptions } from './controls';
import { styles as s } from './styles';
export function ServerQuestion({ question: q, disabled, act }: { question: QuestionView; disabled: boolean; act: (c: Command) => void }) {
  return <View testID={`orchestrator-question-${q.id}`} style={s.card}>
    <Text testID={`orchestrator-question-text-${q.id}`} style={s.heading}>{q.text}</Text>
    <ServerOptions id={`orchestrator-answer-${q.id}`} options={q.options} disabled={disabled} act={act} />
    {q.followUps?.map(f => <View key={f.id} testID={`orchestrator-follow-up-${f.id}`} style={s.stop}>
      <Text testID={`orchestrator-follow-up-text-${f.id}`} style={s.text}>{f.text}</Text>
      {(['include', 'exclude', 'propose_reschedule'] as const).map((decision, i) => <OButton key={decision}
        id={`orchestrator-follow-up-${f.id}-${decision}`} label={['Includi', 'Escludi', 'Proponi riprogrammazione'][i]} disabled={disabled}
        onPress={() => act({ name: 'follow_up_decision', input: { followUpId: f.id, decision } })} />)}
    </View>)}
  </View>;
}