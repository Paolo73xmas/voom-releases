import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Sei sicuro di voler uscire?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Esci',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const getRoleName = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Amministratore',
      admincustom: 'Admin Personalizzato',
      supervisor: 'Supervisore',
      agent: 'Agente',
      agentcustom: 'Agente Personalizzato',
      branch_admin: 'Admin Filiale',
      warehouse: 'Magazzino',
      supplier: 'Fornitore',
    };
    return roles[role] || role;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.name}>{profile?.full_name || 'Utente'}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{getRoleName(user?.role || '')}</Text>
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Modifica Profilo', 'Per modificare il profilo contatta l\'amministratore')}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="person-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.menuLabel}>Modifica Profilo</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Notifiche', 'Le notifiche push saranno disponibili nella prossima versione')}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="notifications-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.menuLabel}>Notifiche</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Cambia Password', 'Per cambiare la password contatta l\'amministratore o usa la funzione "Password dimenticata" dal login')}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.menuLabel}>Cambia Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Supporto</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('mailto:supporto@voomweb.it?subject=Assistenza App VOOM')}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="help-circle-outline" size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.menuLabel}>Centro Assistenza</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/privacy-terms?readOnly=true')}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#1E40AF" />
            </View>
            <Text style={styles.menuLabel}>Privacy e Termini</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('VOOM Sales', `Versione: 1.0.0\nPiattaforma: ${Platform.OS}\n\nSviluppato da Jivea S.r.l.\n© ${new Date().getFullYear()} Tutti i diritti riservati`)}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
            </View>
            <Text style={styles.menuLabel}>Info App</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>Esci</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={styles.version}>VOOM Sales v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 64,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 24,
  },
});
