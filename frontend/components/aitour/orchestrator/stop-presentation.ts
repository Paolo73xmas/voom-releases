import type { StopView } from '../../../lib/aitour/orchestrator/contract';
import { DS } from '../../../lib/theme';
// Server groups are NOT inferred CRM entity types/ownership. Only visual labels and colors.
export const stopKind = (stop: StopView) => stop.group === 'new' ? 'Nuovo punto' : stop.group === 'existing' ? 'Cliente esistente' : 'Tappa';
export const stopColor = (stop: StopView) => stop.group === 'new' ? DS.success : DS.brand;