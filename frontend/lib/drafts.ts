/**
 * Order Drafts Manager
 * Saves/loads/deletes order drafts from AsyncStorage.
 * Fully offline — no backend changes needed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFTS_KEY = '@order_drafts';

export interface OrderDraft {
  id: string;
  customerId: string;
  customerName: string;
  cart: Array<{
    product: any;
    quantity: number;
    unit_price: number;
  }>;
  currentStep: number;
  isForeignOrder: boolean;
  selectedPaymentId: string | null;
  selectedShippingId: string | null;
  customShippingAddress: string;
  notes: string;
  rottamazioneAmount: number;
  rottamazioneDescription: string;
  cashBackToUse: number;
  totalAmount: number;
  productCount: number;
  savedAt: string;
}

/** Get all saved drafts, sorted by most recent first */
export async function getDrafts(): Promise<OrderDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const drafts: OrderDraft[] = JSON.parse(raw);
    return drafts.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch (e) {
    console.error('[drafts] Error loading drafts:', e);
    return [];
  }
}

/** Save or update a draft. If a draft with the same ID exists, it's replaced. */
export async function saveDraft(draft: OrderDraft): Promise<void> {
  try {
    const drafts = await getDrafts();
    const idx = drafts.findIndex(d => d.id === draft.id);
    if (idx >= 0) {
      drafts[idx] = { ...draft, savedAt: new Date().toISOString() };
    } else {
      drafts.unshift({ ...draft, savedAt: new Date().toISOString() });
    }
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    console.log(`[drafts] Saved draft ${draft.id} (${draft.customerName})`);
  } catch (e) {
    console.error('[drafts] Error saving draft:', e);
  }
}

/** Delete a draft by ID */
export async function deleteDraft(draftId: string): Promise<void> {
  try {
    const drafts = await getDrafts();
    const filtered = drafts.filter(d => d.id !== draftId);
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(filtered));
    console.log(`[drafts] Deleted draft ${draftId}`);
  } catch (e) {
    console.error('[drafts] Error deleting draft:', e);
  }
}

/** Get draft count */
export async function getDraftCount(): Promise<number> {
  const drafts = await getDrafts();
  return drafts.length;
}

/** Generate a unique draft ID */
export function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}
