import { StyleSheet } from 'react-native';
import { DS } from '../../../lib/theme';
export const planStyles = StyleSheet.create({
  root: { gap: 10 }, flushCard: { padding: 0, gap: 0, overflow: 'hidden' },
  summary: { padding: 12, gap: 4 }, list: { padding: 4, gap: 0 },
  row: { minHeight: 66, paddingHorizontal: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10 },
  separator: { borderTopWidth: 1, borderTopColor: DS.border },
  selected: { backgroundColor: DS.brandSoft }, pressed: { opacity: 0.7 },
  sequence: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  number: { color: DS.surface, fontSize: 12, fontWeight: '700' },
  stopContent: { flex: 1, minWidth: 0, gap: 2 }, name: { fontSize: 14, fontWeight: '600', color: DS.ink },
  selection: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: DS.brandSoft },
  day: { minHeight: 44, justifyContent: 'center' }, selectedDay: { backgroundColor: DS.brand }, selectedDayText: { color: DS.surface },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, backdrop: { flex: 1 },
  sheetContent: { gap: 12, paddingBottom: 12 }, detail: { gap: 3 }, fullName: { fontSize: 19, lineHeight: 25 },
  metricRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
});