import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Command, OptionView } from '../../../lib/aitour/orchestrator/contract';
import { styles as s } from './styles';
export function OButton({ id, label, onPress, disabled, primary }: { id: string; label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [s.button, primary && s.primary, disabled && s.disabled, pressed && s.pressed]}>
    <Text style={[s.buttonText, primary && s.primaryText]}>{label}</Text>
  </Pressable>;
}
/** Options are ONLY those returned by the binding. No preselected/default answer. */
export function ServerOptions({ id, options, disabled, act }: { id: string; options: OptionView[]; disabled: boolean; act: (c: Command) => void }) {
  return <View style={s.row}>{options.map(option => <OButton key={option.id} id={`${id}-${option.id}`} label={option.label}
    disabled={disabled} onPress={() => act(option.command)} />)}</View>;
}