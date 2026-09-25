// SOLO TEST: monta il componente reale senza aprire un Tour Live o contattare il CRM.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppState, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InspectionReminder } from '../../frontend/components/aitour/InspectionReminder';
import { inspectionReminderKey, loadInspectionReminderCollapsed } from '../../frontend/lib/aitour/inspection-reminder-preference';

const w = window as any;
const listeners = new Set<(state: string) => void>();
const originalAdd = AppState.addEventListener.bind(AppState);
(AppState as any).addEventListener = (event: any, listener: any) => {
  const subscription = originalAdd(event, listener);
  if (event === 'change') listeners.add(listener);
  return { remove: () => { listeners.delete(listener); subscription.remove(); } };
};
const get = AsyncStorage.getItem.bind(AsyncStorage);
const set = AsyncStorage.setItem.bind(AsyncStorage);
w.reminderTest = { failRead: false, failSave: false,
  background: () => { listeners.forEach(f => f('background')); listeners.forEach(f => f('active')); },
  readA: () => loadInspectionReminderCollapsed('isolated-reminder-50-a'),
};
AsyncStorage.getItem = async key => {
  if (w.reminderTest.failRead && key.startsWith('@voom:aitour:inspection-reminder:')) throw new Error('Test read failure');
  return get(key);
};
AsyncStorage.setItem = async (key, value) => {
  if (w.reminderTest.failSave && key.startsWith('@voom:aitour:inspection-reminder:')) throw new Error('Test disk full');
  return set(key, value);
};

function Harness() {
  const [agent, setAgent] = useState('isolated-reminder-50-a');
  const [visit, setVisit] = useState(0);
  return <ScrollView contentContainerStyle={{ padding: 18, backgroundColor: '#171221', minHeight: '100%' }}>
    <Text style={{ color: '#FFFFFF', marginBottom: 20 }} testID="reminder-test-agent">{agent}</Text>
    <View style={{ padding: 12, backgroundColor: '#FFFFFF', borderRadius: 14 }}>
      <Text style={{ fontSize: 18, marginBottom: 12 }}>Prossima visita · prova isolata</Text>
      <InspectionReminder key={`${agent}:${visit}`} agentId={agent} />
    </View>
    <Pressable testID="reminder-test-remount" onPress={() => setVisit(v => v + 1)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: '#FFFFFF' }}>Simula nuovo accesso / nuova visita</Text></Pressable>
    <Pressable testID="reminder-test-agent-a" onPress={() => setAgent('isolated-reminder-50-a')} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: '#FFFFFF' }}>Agente A</Text></Pressable>
    <Pressable testID="reminder-test-agent-b" onPress={() => setAgent('isolated-reminder-50-b')} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: '#FFFFFF' }}>Agente B</Text></Pressable>
    <Pressable testID="reminder-test-reset" onPress={async () => {
      await AsyncStorage.multiRemove([inspectionReminderKey('isolated-reminder-50-a'), inspectionReminderKey('isolated-reminder-50-b')]);
      setVisit(v => v + 1);
    }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: '#FFFFFF' }}>Azzera solo preferenze di prova</Text></Pressable>
  </ScrollView>;
}
createRoot(document.getElementById('root')!).render(<Harness />);