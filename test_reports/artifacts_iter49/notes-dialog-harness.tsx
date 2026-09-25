// Monta il componente REALE con dati SOLO LOCALI. Non fa parte delle route Expo.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Pressable, Text, View } from 'react-native';
import { InspectionNotesDialog } from '../../frontend/components/aitour/InspectionNotesDialog';

function Harness() {
  const [visible, setVisible] = useState(false);
  return <View style={{ padding: 24 }}>
    <Pressable testID="notes-test-open" onPress={() => setVisible(true)} style={{ minHeight: 44 }}><Text>Apri note di prova</Text></Pressable>
    <Text testID="notes-test-state">{visible ? 'aperto' : 'chiuso'}</Text>
    {visible && <InspectionNotesDialog agentId="isolated-agent" customerId="isolated-customer" name="Cliente di prova isolata" onClose={() => setVisible(false)} />}
  </View>;
}

createRoot(document.getElementById('root')!).render(<Harness />);