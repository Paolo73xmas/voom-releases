/**
 * Design Tokens — VOOM Crm
 * Centralized colors, spacing, typography for consistency
 */

export const COLORS = {
  // Brand
  primary: '#1E40AF',
  primaryDark: '#1E3A8A',
  primaryLight: '#3B82F6',
  primarySoft: '#EFF6FF',

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

export const GRADIENTS: Record<string, [string, string]> = {
  primary: ['#3B82F6', '#1E40AF'],
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
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
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
 * DS — Nuovo design system "iOS-Native Clean" (restyling giu 2026)
 * Brand: Terracotta #C2410C — blueprint completo in /app/design_guidelines.json
 */
export const DS = {
  // Brand
  brand: '#C2410C',
  brandDark: '#9A3412',
  brandSoft: '#F9E0D4',
  brandTint: '#FFF7ED',
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
