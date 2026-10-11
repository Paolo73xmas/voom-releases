import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { OButton } from './controls';
import { styles as s } from './styles';
/** Admin input is only a target hint; the server alone authorizes it. No local allowlist or CRM query. */
export function TargetAgentControl({ disabled, targetId, onSelect }: { disabled: boolean; targetId?: string; onSelect: (id?: string) => void }) {
  const [value, setValue] = useState(targetId || '');
  const selected = targetId || '';
  const valid = !value.trim() || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
  return <View style={s.card} testID="orchestrator-target-control">
    <Text testID="orchestrator-target-label" style={s.text}>Agente destinatario (UUID, vuoto per il proprio giro). L’autorizzazione è verificata dal server.</Text>
    <TextInput testID="orchestrator-target-input" accessibilityLabel="UUID agente destinatario" style={s.input} value={value} onChangeText={setValue} autoCapitalize="none" editable={!disabled} />
    <OButton id="orchestrator-target-apply" label="Cambia agente e conversazione" disabled={disabled || !valid || value.trim() === selected}
      onPress={() => { const id = value.trim(); onSelect(id || undefined); }} />
    <Text testID="orchestrator-target-current" style={s.muted}>Destinatario: {selected || 'Il proprio giro'}</Text>
  </View>;
}