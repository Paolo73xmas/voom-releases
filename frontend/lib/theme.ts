/**
 * Design Tokens — VOOM Crm
 * Centralized colors, spacing, typography for consistency
 *
 * Palette "AI Tour" (ago 2026): viola primario + arancio accento + teal live,
 * con doppio tema Chiaro/Scuro selezionabile dal Profilo.
 * NOTA: i PDF (lib/pdf, preventivi, manuali) NON usano questi token e restano invariati.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';
export const THEME_MODE_KEY = '@voom_theme_mode';

// ─────────────────────────────────────────────────────────────────
// Palette CHIARA (default) — sfondi iOS chiari, accenti splash AI Tour
// ─────────────────────────────────────────────────────────────────
const COLORS_LIGHT = {
  // Brand — Viola AI Tour
  primary: '#7C3AED',
  primaryDark: '#5B21B6',
  primaryLight: '#8B5CF6',
  primarySoft: '#F5F3FF',

  // Semantic
  success: '#10B981',
  successSoft: '#D1FAE5',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#0EA5E9',
  infoSoft: '#E0F2FE',

  // Accents
  purple: '#8B5CF6',
  purpleSoft: '#F3E8FF',
  pink: '#EC4899',
  pinkSoft: '#FCE7F3',
  teal: '#14B8A6',
  tealSoft: '#CCFBF1',
  amber: '#F59E0B',
  orange: '#F97316',
  orangeSoft: '#FFF7ED',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  bg: '#F3F4F6',
  bgAlt: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  text: '#1F2937',
  textSecondary: '#4B5563',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
  textPlaceholder: '#D1D5DB',
};

// ─────────────────────────────────────────────────────────────────
// Palette SCURA — stile splash AI Tour (#0B0714 + viola/arancio/teal)
// ─────────────────────────────────────────────────────────────────
const COLORS_DARK: typeof COLORS_LIGHT = {
  primary: '#8B5CF6',
  primaryDark: '#7C3AED',
  primaryLight: '#A78BFA',
  primarySoft: '#2A2044',

  success: '#34D399',
  successSoft: '#0E3A2C',
  warning: '#FBBF24',
  warningSoft: '#3D2E0A',
  danger: '#F87171',
  dangerSoft: '#431418',
  info: '#38BDF8',
  infoSoft: '#0B2C3D',

  purple: '#A78BFA',
  purpleSoft: '#2A2044',
  pink: '#F472B6',
  pinkSoft: '#3D1230',
  teal: '#2DD4BF',
  tealSoft: '#0B322E',
  amber: '#FBBF24',
  orange: '#FB923C',
  orangeSoft: '#3A2410',

  white: '#FFFFFF',
  black: '#000000',
  bg: '#0B0714',
  bgAlt: '#110C1D',
  surface: '#171221',
  border: '#2A2440',
  borderLight: '#231C36',

  text: '#F5F3F9',
  textSecondary: '#D6D1E0',
  textMuted: '#A29BB3',
  textLight: '#7A7390',
  textPlaceholder: '#554E6B',
};

/** Token colore correnti (mutati da applyThemeMode all'avvio/toggle) */
export const COLORS = { ...COLORS_LIGHT };

export const GRADIENTS: Record<string, [string, string]> = {
  primary: ['#8B5CF6', '#6D28D9'],
  success: ['#10B981', '#059669'],
  warning: ['#F59E0B', '#D97706'],
  danger: ['#EF4444', '#DC2626'],
  purple: ['#A78BFA', '#7C3AED'],
  pink: ['#F472B6', '#EC4899'],
  teal: ['#2DD4BF', '#0D9488'],
  sunset: ['#FB923C', '#EA580C'],
  ocean: ['#60A5FA', '#2563EB'],
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const FONTS = {
  regular: 'Jakarta_400',
  medium: 'Jakarta_500',
  semibold: 'Jakarta_600',
  bold: 'Jakarta_700',
};

export const FONT_SIZE = {
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  display: 24,
  large: 28,
  hero: 36,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const ANIM_DURATION = {
  fast: 150,
  base: 250,
  slow: 400,
};

/**
 * DS — Design system "iOS-Native Clean" con palette AI Tour (ago 2026)
 * Brand: Viola #7C3AED — tema Chiaro/Scuro via applyThemeMode
 */
const DS_LIGHT = {
  // Brand
  brand: '#7C3AED',
  brandDark: '#5B21B6',
  brandSoft: '#EDE9FE',
  brandTint: '#F5F3FF',
  // Accento arancio (dal poster AI Tour)
  accent: '#F97316',
  accentSoft: '#FFF7ED',
  // Teal live
  live: '#0D9488',
  liveSoft: '#CCFBF1',
  // Superfici (scala iOS)
  surface: '#FFFFFF',
  surface2: '#F2F2F7',
  surface3: '#E5E5EA',
  // Testo
  ink: '#1C1C1E',
  ink2: '#3A3A3C',
  inkMuted: '#8E8E93',
  // Bordi
  border: '#E5E5EA',
  borderStrong: '#D1D1D6',
  // Semantici (alto contrasto per esterni)
  success: '#166534',
  warning: '#B45309',
  error: '#991B1B',
};

const DS_DARK: typeof DS_LIGHT = {
  brand: '#8B5CF6',
  brandDark: '#A78BFA',
  brandSoft: '#2A2044',
  brandTint: '#1D1630',
  accent: '#FB923C',
  accentSoft: '#3A2410',
  live: '#2DD4BF',
  liveSoft: '#0B322E',
  surface: '#171221',
  surface2: '#0B0714',
  surface3: '#241D33',
  ink: '#F5F3F9',
  ink2: '#D6D1E0',
  inkMuted: '#938DA3',
  border: '#2A2440',
  borderStrong: '#3A3153',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
};

/** Token DS correnti (mutati da applyThemeMode all'avvio/toggle) */
export const DS = { ...DS_LIGHT };

/** Modo tema corrente (aggiornato da applyThemeMode) */
export let currentThemeMode: ThemeMode = 'light';

/**
 * Applica la palette al set di token condivisi. Gli StyleSheet catturano i
 * valori al primo import del modulo: va chiamata PRIMA di renderizzare le
 * route (gate in app/_layout) e richiede un reload per il cambio a runtime.
 */
export function applyThemeMode(mode: ThemeMode): void {
  currentThemeMode = mode;
  Object.assign(DS, mode === 'dark' ? DS_DARK : DS_LIGHT);
  Object.assign(COLORS, mode === 'dark' ? COLORS_DARK : COLORS_LIGHT);
  // Web: allinea anche il background del documento (evita flash chiaro in dark)
  try {
    const doc = (globalThis as { document?: { documentElement?: { style: { backgroundColor: string } }; body?: { style: { backgroundColor: string } } } }).document;
    if (doc?.documentElement) doc.documentElement.style.backgroundColor = COLORS.bg;
    if (doc?.body) doc.body.style.backgroundColor = COLORS.bg;
  } catch {
    // native: nessun document
  }
}

// WEB: applica SUBITO il tema salvato in modo sincrono (AsyncStorage su web usa
// localStorage con la stessa chiave). Questo modulo viene valutato prima di
// qualunque StyleSheet che usa i token, quindi l'ordine è garantito.
// Su native localStorage non esiste: ci pensa il gate async in app/_layout.
try {
  const ls = (globalThis as { localStorage?: { getItem: (k: string) => string | null } }).localStorage;
  if (ls && ls.getItem(THEME_MODE_KEY) === 'dark') applyThemeMode('dark');
} catch {
  // ambiente senza localStorage (native/SSR): ignora
}

export async function getStoredThemeMode(): Promise<ThemeMode> {
  try {
    const v = await AsyncStorage.getItem(THEME_MODE_KEY);
    return v === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export async function setStoredThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_MODE_KEY, mode);
  } catch {
    // best effort
  }
}

/** Font Plus Jakarta Sans (caricati localmente via expo-font in _layout) */
export const JAKARTA = {
  regular: 'Jakarta_400',
  medium: 'Jakarta_500',
  semibold: 'Jakarta_600',
  bold: 'Jakarta_700',
};

/** Greet user based on local time */
export function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

/** Generate user initials from full name or email */
export function getUserInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
}

/** Determine avatar gradient based on user identifier hash */
export function getAvatarGradient(seed: string): [string, string] {
  const palette: [string, string][] = [
    GRADIENTS.primary,
    GRADIENTS.success,
    GRADIENTS.purple,
    GRADIENTS.pink,
    GRADIENTS.teal,
    GRADIENTS.sunset,
    GRADIENTS.ocean,
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}
