import React, { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { COLORS } from '../lib/theme';

/** Non monta query protette prima che l'auth esistente sia pronta. */
export function RequireSession({ children }: PropsWithChildren) {
  const userId = useAuthStore(state => state.user?.id);
  const loading = useAuthStore(state => state.isLoading);
  const router = useRouter();
  if (!userId) return <View testID="session-required" style={styles.container}>
    {loading ? <ActivityIndicator testID="session-loading" color={COLORS.primary} /> : <>
      <Text testID="session-required-message" style={styles.message}>Accedi per visualizzare questa sezione.</Text>
      <TouchableOpacity testID="session-login" style={styles.button} onPress={() => router.replace('/login')}><Text style={styles.buttonText}>Accedi</Text></TouchableOpacity>
    </>}
  </View>;
  return <React.Fragment key={userId}>{children}</React.Fragment>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
  message: { color: COLORS.text, fontSize: 16, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, minHeight: 48, justifyContent: 'center', paddingHorizontal: 28 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});