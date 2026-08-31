// Dialog per dare un nome al tour (o al blocco di tour) da salvare — parità web.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA } from '../../lib/theme';

interface Props {
  visible: boolean;
  title: string;
  description: string;
  saving: boolean;
  progress?: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

export function TourNameDialog({ visible, title, description, saving, progress, onClose, onConfirm }: Props) {
  const [name, setName] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!saving) onClose(); }}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.desc}>{description}</Text>
          <Text style={styles.label}>Nome del tour (facoltativo)</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Es. Giro Voghera settimana 37"
            placeholderTextColor={DS.inkMuted}
            maxLength={80}
            editable={!saving}
          />
          {saving && progress ? (
            <View style={styles.progressRow}>
              <ActivityIndicator size="small" color={DS.ink2} />
              <Text style={styles.progressText}>{progress}</Text>
            </View>
          ) : null}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={() => onConfirm(name.trim())} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="save-outline" size={15} color="#FFF" />}
              <Text style={styles.saveText}>Salva</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: DS.surface, borderRadius: 16, padding: 20, gap: 8 },
  title: { fontFamily: JAKARTA.bold, fontSize: 16, color: DS.ink },
  desc: { fontFamily: JAKARTA.regular, fontSize: 13, color: DS.ink2, lineHeight: 18 },
  label: { fontFamily: JAKARTA.semibold, fontSize: 11, color: DS.ink2, marginTop: 6 },
  input: {
    backgroundColor: DS.surface2, borderWidth: 1, borderColor: DS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: JAKARTA.regular, fontSize: 14, color: DS.ink,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  progressText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: { paddingVertical: 11, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  cancelText: { fontFamily: JAKARTA.medium, fontSize: 14, color: DS.inkMuted },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#059669',
    borderRadius: 11, paddingVertical: 11, paddingHorizontal: 18, minHeight: 44, justifyContent: 'center',
  },
  saveText: { fontFamily: JAKARTA.bold, fontSize: 14, color: '#FFF' },
});
