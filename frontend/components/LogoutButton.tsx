import React, { useState } from 'react';
import { StyleProp, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { ConfirmActionModal } from './ConfirmActionModal';

export function LogoutButton({ testID, style, textStyle, color, label }: {
  testID: string; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>; color: string; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const logout = useAuthStore(state => state.logout);
  const router = useRouter();
  return <>
    <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel="Esci dall'account" style={style} onPress={() => setOpen(true)}>
      <Ionicons name="log-out-outline" size={20} color={color} />
      {!!label && <Text style={textStyle}>{label}</Text>}
    </TouchableOpacity>
    <ConfirmActionModal testID={`${testID}-dialog`} visible={open} title="Esci da questo dispositivo" message="Le sessioni sugli altri dispositivi resteranno attive. Le bozze ordine e GPTour classico salvate su questo dispositivo non verranno eliminate." confirmLabel="Esci" onCancel={() => setOpen(false)} onConfirm={async () => {
      await logout(); setOpen(false); router.replace('/login');
    }} />
  </>;
}