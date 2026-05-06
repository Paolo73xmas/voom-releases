/**
 * Haptic feedback helpers — VOOM Crm
 * Wrap expo-haptics calls so feature is centralized and easy to disable later.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const ENABLED = Platform.OS !== 'web';

export const hap = {
  /** Subtle tap feedback for buttons/cards */
  light: () => {
    if (!ENABLED) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  },
  /** Medium impact for actions */
  medium: () => {
    if (!ENABLED) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  },
  /** Heavy impact (delete confirm, etc.) */
  heavy: () => {
    if (!ENABLED) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
  },
  /** Success notification */
  success: () => {
    if (!ENABLED) return;
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  },
  /** Warning notification */
  warning: () => {
    if (!ENABLED) return;
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
  },
  /** Error notification */
  error: () => {
    if (!ENABLED) return;
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
  },
  /** Selection changed (toggles, picker scrolls) */
  select: () => {
    if (!ENABLED) return;
    try { Haptics.selectionAsync(); } catch {}
  },
};
