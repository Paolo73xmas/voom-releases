import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  loadSavedCredentials,
  saveCredentials,
  clearCredentials,
  migrateLegacyCredentialsIfAny,
  isBiometricEnabled,
  setBiometricEnabled,
} from '../lib/secure-credentials';
import { COLORS } from '../lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, justLoggedOut } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Biometrics state
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'iris' | 'generic'>('generic');
  const [biometricEnabled, setBiometricEnabledLocal] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  // 1) Load saved credentials (with one-time migration from legacy AsyncStorage)
  useEffect(() => {
    (async () => {
      try {
        await migrateLegacyCredentialsIfAny();
        const creds = await loadSavedCredentials();
        if (creds) {
          setEmail(creds.email);
          setPassword(creds.password);
          setRememberMe(true);
          setSavedEmail(creds.email);
        }

        // Check biometric capability (native only)
        if (Platform.OS !== 'web') {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            setBiometricSupported(true);
            const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
            if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
              setBiometricType('face');
            } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
              setBiometricType('fingerprint');
            } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
              setBiometricType('iris');
            }
            const enabled = await isBiometricEnabled();
            setBiometricEnabledLocal(enabled);

            // Auto-prompt biometric login SOLO se l'utente NON ha appena fatto logout volontario.
            // Se justLoggedOut=true, l'utente vuole rimanere fuori: deve essere lui a premere
            // esplicitamente il pulsante biometrico per rientrare.
            if (enabled && creds && !justLoggedOut) {
              promptBiometricLogin(creds.email, creds.password);
            } else if (justLoggedOut) {
              console.log('[Login] Skipping auto-biometric: user just logged out');
            }
          }
        }
      } catch (e) {
        console.log('[Login] init error:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const promptBiometricLogin = async (storedEmail: string, storedPassword: string) => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sblocca VOOM Crm',
        fallbackLabel: 'Usa password',
        cancelLabel: 'Annulla',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setLoading(true);
        try {
          await login(storedEmail, storedPassword);
          router.replace('/(tabs)');
        } catch (e: any) {
          Alert.alert('Errore di Login', e?.message || 'Credenziali non valide. Inseriscile manualmente.');
        } finally {
          setLoading(false);
        }
      }
    } catch (e) {
      console.log('[Login] biometric error:', e);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Errore', 'Inserisci email e password');
      return;
    }

    setLoading(true);
    try {
      // Trim BOTH email and password (iOS autofill può aggiungere spazi invisibili)
      await login(email.trim(), password.trim());

      // Persist credentials securely if "Ricordami" is checked
      if (rememberMe) {
        await saveCredentials(email.trim(), password);
      } else {
        await clearCredentials();
      }

      // Offer biometric enable on first successful login (native only)
      if (biometricSupported && rememberMe && !biometricEnabled && Platform.OS !== 'web') {
        const typeName = biometricType === 'face' ? 'Face ID'
          : biometricType === 'fingerprint' ? 'l\'impronta digitale'
          : biometricType === 'iris' ? 'l\'iride'
          : 'la biometria';
        Alert.alert(
          'Login rapido',
          `Vuoi abilitare ${typeName} per i prossimi accessi?`,
          [
            { text: 'No, grazie', style: 'cancel', onPress: () => router.replace('/(tabs)') },
            {
              text: 'Abilita',
              onPress: async () => {
                await setBiometricEnabled(true);
                router.replace('/(tabs)');
              },
            },
          ]
        );
      } else {
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Errore di Login', error.message || 'Errore durante il login');
    } finally {
      setLoading(false);
    }
  };

  const biometricIcon =
    biometricType === 'face' ? 'scan-outline' :
    biometricType === 'fingerprint' ? 'finger-print-outline' :
    biometricType === 'iris' ? 'eye-outline' :
    'lock-open-outline';
  const biometricLabel =
    biometricType === 'face' ? 'Accedi con Face ID' :
    biometricType === 'fingerprint' ? 'Accedi con impronta' :
    biometricType === 'iris' ? 'Accedi con iride' :
    'Accedi con biometria';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image source={require('../assets/voom-logo.jpg')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.subtitle}>Crm</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Accedi</Text>
          <Text style={styles.description}>Inserisci le tue credenziali per continuare</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.textLight}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              spellCheck={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              spellCheck={false}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          {/* Ricordami toggle */}
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.7}
          >
            <View style={[styles.rememberCheckbox, rememberMe && styles.rememberCheckboxChecked]}>
              {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
            <Text style={styles.rememberLabel}>Ricordami</Text>
            <View style={{ flex: 1 }} />
            {rememberMe && (
              <View style={styles.secureBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#059669" />
                <Text style={styles.secureBadgeText}>Cifrato</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, (loading || isLoading) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading || isLoading}
          >
            {(loading || isLoading) ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Accedi</Text>
            )}
          </TouchableOpacity>

          {/* Biometric quick-login (only if enabled & saved credentials) */}
          {biometricSupported && biometricEnabled && savedEmail && Platform.OS !== 'web' && (
            <TouchableOpacity
              style={styles.bioButton}
              onPress={async () => {
                const creds = await loadSavedCredentials();
                if (creds) promptBiometricLogin(creds.email, creds.password);
              }}
              disabled={loading || isLoading}
            >
              <Ionicons name={biometricIcon as any} size={22} color="#7C3AED" />
              <Text style={styles.bioButtonText}>{biometricLabel}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.footer}>VOOM Crm v1.0</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5B21B6',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 200,
    height: 100,
    marginBottom: 12,
    borderRadius: 16,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#C4B5FD',
    marginTop: 4,
  },
  form: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: COLORS.text,
  },
  eyeButton: {
    padding: 8,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: -4,
    gap: 10,
    minHeight: 44,
  },
  rememberCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  rememberCheckboxChecked: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  rememberLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  secureBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  button: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#C4B5FD',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 12,
    height: 48,
    marginTop: 12,
  },
  bioButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7C3AED',
  },
  footer: {
    textAlign: 'center',
    color: '#C4B5FD',
    marginTop: 32,
    fontSize: 12,
  },
});
