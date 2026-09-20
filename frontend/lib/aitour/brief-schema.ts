// Schema rigido del TourBrief V4 (Fase 3): validazione deterministica lato CRM.
// Nessuna chiamata AI: qui si decide se il JSON del modello rispetta il contratto.
// I campi fuori schema vengono scartati da normalizeBriefV4 e segnalati all'agente.

export interface SchemaError { path: string; message: string }

const CONDITION_TYPES: Record<string, string[]> = {
  clients_all: [],
  clients_frequent: [],
  clients_top: ['count'],
  project_membership: ['names', 'match'],
  project: ['names', 'match', 'name'],
  orphans: ['count'],
  prospects: [],
  new_around: ['radiusKm'],
  last_order_days: ['operator', 'value'],
  last_visit_days: ['operator', 'value'],
  revenue: ['operator', 'value'],
  orders_count: ['operator', 'value', 'periodDays'],
};
const OPERATORS = new Set(['>=', '>', '<=', '<', '==', '=']);
const PREFERENCE_TYPES = new Set(['prefer_oldest_last_order', 'prefer_oldest_last_visit', 'prefer_highest_revenue', 'prefer_nearest', 'prefer_area']);
const RULE_TYPES = new Set(['priority', 'minimum_count', 'maximum_count', 'exact_count', 'ratio']);
const DIRECTIONS = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
const TARGET_MODES = new Set(['exact', 'approximately', 'minimum', 'maximum', 'range', 'all', 'maximize', 'unspecified']);
const TOP_KEYS = new Set([
  'version', 'dayType', 'requestedDate', 'areas', 'journey', 'selection', 'includeAutomatic', 'mandatoryStops', 'preferredStops',
  'exclusions', 'preferences', 'projectRules', 'fillers', 'visitTarget', 'route', 'interpretation', 'summary',
]);

const SECTION_LABELS: Record<string, string> = {
  dayType: 'tipo di giornata', requestedDate: 'data richiesta', areas: 'zone', journey: 'percorso a tappe',
  selection: 'criteri di selezione', exclusions: 'esclusioni', mandatoryStops: 'clienti obbligatori',
  preferredStops: 'clienti preferiti', preferences: 'preferenze', projectRules: 'quote tra progetti',
  fillers: 'riempitivi', visitTarget: 'numero di visite', route: 'partenza, arrivo e orari',
  interpretation: 'note dell\'AI', includeAutomatic: 'altri clienti oltre ai nominati', summary: 'riassunto', version: 'versione',
};

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isTime = (x: unknown) => typeof x === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x);
const isDate = (x: unknown) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
const isPosNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x > 0;

function checkCondition(c: unknown, path: string, out: SchemaError[]): void {
  if (!isObj(c)) { out.push({ path, message: 'deve essere un oggetto condizione' }); return; }
  const type = c.type;
  if (typeof type !== 'string' || !(type in CONDITION_TYPES)) {
    out.push({ path: `${path}.type`, message: `tipo condizione non ammesso (${String(type)}): usa solo ${Object.keys(CONDITION_TYPES).join(', ')}` });
    return;
  }
  for (const key of Object.keys(c)) {
    if (key !== 'type' && !CONDITION_TYPES[type].includes(key)) out.push({ path: `${path}.${key}`, message: `campo non previsto per la condizione ${type}` });
  }
  if (type === 'project_membership' || type === 'project') {
    const names = c.names ?? (typeof c.name === 'string' ? [c.name] : undefined);
    if (!Array.isArray(names) || !names.length || names.some((n) => typeof n !== 'string' || !n.trim())) out.push({ path: `${path}.names`, message: 'serve almeno un nome progetto in names[]' });
    if (c.match != null && c.match !== 'any' && c.match !== 'all') out.push({ path: `${path}.match`, message: 'match ammette solo "any" o "all"' });
  }
  if (['last_order_days', 'last_visit_days', 'revenue', 'orders_count'].includes(type)) {
    if (typeof c.operator !== 'string' || !OPERATORS.has(c.operator)) out.push({ path: `${path}.operator`, message: 'operator ammette solo >=, >, <=, <, ==' });
    if (typeof c.value !== 'number' || !Number.isFinite(c.value)) out.push({ path: `${path}.value`, message: 'value deve essere un numero' });
  }
  if (type === 'clients_top' && c.count != null && !isPosNum(c.count)) out.push({ path: `${path}.count`, message: 'count deve essere un numero maggiore di zero' });
  if (type === 'new_around' && c.radiusKm != null && !isPosNum(c.radiusKm)) out.push({ path: `${path}.radiusKm`, message: 'radiusKm deve essere un numero maggiore di zero' });
}

function checkConditionList(list: unknown, path: string, out: SchemaError[]): void {
  if (!Array.isArray(list)) { out.push({ path, message: 'deve essere un array di condizioni' }); return; }
  list.forEach((c, i) => checkCondition(c, `${path}[${i}]`, out));
}

function checkStops(list: unknown, path: string, out: SchemaError[]): void {
  if (!Array.isArray(list)) { out.push({ path, message: 'deve essere un array di tappe' }); return; }
  list.forEach((s, i) => {
    const p = `${path}[${i}]`;
    if (!isObj(s)) { out.push({ path: p, message: 'deve essere un oggetto tappa' }); return; }
    if (typeof s.rawReference !== 'string' || !s.rawReference.trim()) out.push({ path: `${p}.rawReference`, message: 'rawReference obbligatorio: il riferimento al cliente come detto dall\'agente' });
    if (s.cityHint != null && typeof s.cityHint !== 'string') out.push({ path: `${p}.cityHint`, message: 'cityHint deve essere testo o null' });
    if (s.priority != null && (typeof s.priority !== 'number' || ![1, 2, 3].includes(s.priority))) out.push({ path: `${p}.priority`, message: 'priority ammette solo 1, 2 o 3' });
    const a = s.appointment;
    if (a != null) {
      if (!isObj(a)) out.push({ path: `${p}.appointment`, message: 'appointment deve essere un oggetto o null' });
      else {
        if (!['exact', 'approximate', 'window', 'none'].includes(String(a.type))) out.push({ path: `${p}.appointment.type`, message: 'type ammette exact, approximate, window' });
        if (a.type === 'window') {
          if (!isTime(a.from) || !isTime(a.to)) out.push({ path: `${p}.appointment`, message: 'window richiede from e to in formato HH:MM' });
        } else if (a.type === 'exact' || a.type === 'approximate') {
          if (!isTime(a.time)) out.push({ path: `${p}.appointment.time`, message: 'time richiesto in formato HH:MM' });
        }
      }
    }
  });
}

function checkPlace(p: unknown, path: string, out: SchemaError[]): void {
  if (p == null) return;
  if (!isObj(p)) { out.push({ path, message: 'deve essere un oggetto luogo o null' }); return; }
  if (!['home', 'office', 'address', 'customer'].includes(String(p.kind))) out.push({ path: `${path}.kind`, message: 'kind ammette home, office, address, customer' });
  if (typeof p.rawReference !== 'string' || !p.rawReference.trim()) out.push({ path: `${path}.rawReference`, message: 'rawReference obbligatorio' });
}

export function validateBriefSchema(raw: unknown): SchemaError[] {
  const out: SchemaError[] = [];
  if (!isObj(raw)) return [{ path: 'brief', message: 'la risposta deve essere un oggetto JSON TourBrief V4' }];

  for (const key of Object.keys(raw)) if (!TOP_KEYS.has(key)) out.push({ path: key, message: 'campo non previsto dallo schema TourBrief V4' });

  if (raw.dayType != null && !['clienti', 'sviluppo', 'mista'].includes(String(raw.dayType))) out.push({ path: 'dayType', message: 'dayType ammette clienti, sviluppo, mista o null' });
  if (typeof raw.includeAutomatic !== 'boolean') out.push({ path: 'includeAutomatic', message: 'includeAutomatic deve essere true o false' });

  const rd = raw.requestedDate;
  if (!isObj(rd)) out.push({ path: 'requestedDate', message: 'requestedDate obbligatorio: {type, value}' });
  else {
    if (!['today', 'tomorrow', 'explicit', 'unspecified', 'selected'].includes(String(rd.type))) out.push({ path: 'requestedDate.type', message: 'type ammette today, tomorrow, explicit, unspecified' });
    if (rd.value != null && !isDate(rd.value)) out.push({ path: 'requestedDate.value', message: 'value deve essere una data YYYY-MM-DD o null' });
    if ((rd.type === 'tomorrow' || rd.type === 'explicit') && !isDate(rd.value)) out.push({ path: 'requestedDate.value', message: 'con type tomorrow/explicit la data YYYY-MM-DD e\' obbligatoria' });
  }

  if (!Array.isArray(raw.areas)) out.push({ path: 'areas', message: 'areas deve essere un array (vuoto se non espresso)' });
  else raw.areas.forEach((a, i) => {
    const p = `areas[${i}]`;
    if (!isObj(a)) { out.push({ path: p, message: 'deve essere un oggetto zona' }); return; }
    if (!['city', 'province', 'place'].includes(String(a.kind))) out.push({ path: `${p}.kind`, message: 'kind ammette city, province, place' });
    if (typeof a.value !== 'string' || !a.value.trim()) out.push({ path: `${p}.value`, message: 'value obbligatorio' });
    if (a.mode != null && !['include', 'exclude', 'prefer'].includes(String(a.mode))) out.push({ path: `${p}.mode`, message: 'mode ammette include, exclude, prefer' });
  });

  if (raw.journey != null) {
    if (!isObj(raw.journey)) out.push({ path: 'journey', message: 'journey deve essere un oggetto o null' });
    else {
      const stages = raw.journey.stages;
      if (!Array.isArray(stages) || !stages.length) out.push({ path: 'journey.stages', message: 'journey richiede almeno una zona in stages[]' });
      else stages.forEach((s, i) => {
        const p = `journey.stages[${i}]`;
        if (!isObj(s)) { out.push({ path: p, message: 'deve essere un oggetto zona' }); return; }
        if (typeof s.name !== 'string' || !s.name.trim()) out.push({ path: `${p}.name`, message: 'name obbligatorio: la localita\' come dettata' });
        if (s.direction != null && !DIRECTIONS.has(String(s.direction))) out.push({ path: `${p}.direction`, message: 'direction ammette solo N, NE, E, SE, S, SW, W, NW o null' });
        if (s.radiusKm != null && !isPosNum(s.radiusKm)) out.push({ path: `${p}.radiusKm`, message: 'radiusKm deve essere un numero maggiore di zero o null' });
      });
    }
  }

  const sel = raw.selection;
  if (!isObj(sel)) out.push({ path: 'selection', message: 'selection obbligatorio: {operator, conditions}' });
  else {
    if (sel.operator !== 'AND' && sel.operator !== 'OR') out.push({ path: 'selection.operator', message: 'operator ammette AND o OR' });
    checkConditionList(sel.conditions, 'selection.conditions', out);
  }
  checkConditionList(raw.exclusions, 'exclusions', out);
  checkStops(raw.mandatoryStops, 'mandatoryStops', out);
  checkStops(raw.preferredStops, 'preferredStops', out);

  if (!Array.isArray(raw.preferences)) out.push({ path: 'preferences', message: 'preferences deve essere un array' });
  else raw.preferences.forEach((p, i) => {
    if (!isObj(p) || typeof p.type !== 'string') { out.push({ path: `preferences[${i}]`, message: 'deve essere un oggetto {type, value}' }); return; }
    if (!PREFERENCE_TYPES.has(p.type)) out.push({ path: `preferences[${i}].type`, message: `preferenza non ammessa (${p.type}): usa ${[...PREFERENCE_TYPES].join(', ')}` });
  });

  if (!Array.isArray(raw.projectRules)) out.push({ path: 'projectRules', message: 'projectRules deve essere un array' });
  else raw.projectRules.forEach((r, i) => {
    const p = `projectRules[${i}]`;
    if (!isObj(r)) { out.push({ path: p, message: 'deve essere un oggetto regola' }); return; }
    if (!RULE_TYPES.has(String(r.type))) out.push({ path: `${p}.type`, message: `tipo regola non ammesso: usa ${[...RULE_TYPES].join(', ')}` });
    const project = typeof r.project === 'string' ? r.project : typeof r.name === 'string' ? r.name : '';
    if (!project.trim()) out.push({ path: `${p}.project`, message: 'project obbligatorio: nome ufficiale del progetto' });
    if (r.type === 'ratio') {
      if (typeof r.value !== 'number' || !(r.value > 0)) out.push({ path: `${p}.value`, message: 'ratio richiede un valore maggiore di zero (0.5 o 50)' });
    } else if (r.type !== 'priority' && (typeof r.value !== 'number' || !Number.isFinite(r.value) || r.value < 0)) {
      out.push({ path: `${p}.value`, message: 'value numerico obbligatorio per minimum_count, maximum_count, exact_count' });
    }
  });

  if (!Array.isArray(raw.fillers)) out.push({ path: 'fillers', message: 'fillers deve essere un array' });
  else raw.fillers.forEach((f, i) => {
    const p = `fillers[${i}]`;
    if (!isObj(f)) { out.push({ path: p, message: 'deve essere un oggetto riempitivo' }); return; }
    const fsel = f.selection;
    if (!isObj(fsel)) out.push({ path: `${p}.selection`, message: 'selection obbligatoria nel riempitivo' });
    else checkConditionList(fsel.conditions, `${p}.selection.conditions`, out);
    if (f.when != null && f.when !== 'time_available') out.push({ path: `${p}.when`, message: 'when ammette solo time_available' });
    const t = f.target;
    if (t != null) {
      if (!isObj(t)) out.push({ path: `${p}.target`, message: 'target deve essere un oggetto o null' });
      else {
        if (t.mode != null && !['maximum', 'exact', 'unspecified'].includes(String(t.mode))) out.push({ path: `${p}.target.mode`, message: 'mode ammette maximum, exact, unspecified' });
        if (t.value != null && !isPosNum(t.value)) out.push({ path: `${p}.target.value`, message: 'value deve essere un numero maggiore di zero o null' });
      }
    }
  });

  const vt = raw.visitTarget;
  if (!isObj(vt)) out.push({ path: 'visitTarget', message: 'visitTarget obbligatorio' });
  else {
    if (!TARGET_MODES.has(String(vt.mode))) out.push({ path: 'visitTarget.mode', message: `mode ammette ${[...TARGET_MODES].join(', ')}` });
    for (const k of ['value', 'min', 'max'] as const) if (vt[k] != null && !isPosNum(vt[k])) out.push({ path: `visitTarget.${k}`, message: 'deve essere un numero maggiore di zero o null' });
    if (vt.scope != null && !['total_including_mandatory', 'automatic_plus_mandatory'].includes(String(vt.scope))) out.push({ path: 'visitTarget.scope', message: 'scope ammette total_including_mandatory o automatic_plus_mandatory' });
    if (['exact', 'approximately', 'minimum', 'maximum'].includes(String(vt.mode)) && !isPosNum(vt.value)) out.push({ path: 'visitTarget.value', message: 'con questo mode serve value numerico' });
    if (vt.mode === 'range' && (!isPosNum(vt.min) || !isPosNum(vt.max))) out.push({ path: 'visitTarget', message: 'range richiede min e max numerici' });
  }

  const route = raw.route;
  if (!isObj(route)) out.push({ path: 'route', message: 'route obbligatorio' });
  else {
    checkPlace(route.startPlace, 'route.startPlace', out);
    checkPlace(route.endPlace, 'route.endPlace', out);
    if (route.compact != null && !['off', 'prefer', 'required'].includes(String(route.compact))) out.push({ path: 'route.compact', message: 'compact ammette off, prefer, required' });
    for (const k of ['startTime', 'endTime', 'finishBy'] as const) if (route[k] != null && !isTime(route[k])) out.push({ path: `route.${k}`, message: 'orario in formato HH:MM o null' });
    for (const k of ['returnHome', 'returnToStart'] as const) if (route[k] != null && typeof route[k] !== 'boolean') out.push({ path: `route.${k}`, message: 'deve essere true o false' });
    if (route.splitAllowed != null && typeof route.splitAllowed !== 'boolean') out.push({ path: 'route.splitAllowed', message: 'deve essere true, false o null' });
    if (route.maxDays != null && !isPosNum(route.maxDays)) out.push({ path: 'route.maxDays', message: 'maxDays deve essere un numero maggiore di zero o null' });
  }

  const interp = raw.interpretation;
  if (!isObj(interp)) out.push({ path: 'interpretation', message: 'interpretation obbligatorio' });
  else {
    if (typeof interp.confidence !== 'number' || interp.confidence < 0 || interp.confidence > 1) out.push({ path: 'interpretation.confidence', message: 'confidence deve essere un numero tra 0 e 1' });
    if (interp.needsConfirmation != null && typeof interp.needsConfirmation !== 'boolean') out.push({ path: 'interpretation.needsConfirmation', message: 'deve essere true o false' });
    for (const k of ['unresolvedEntities', 'warnings'] as const) {
      const v = interp[k];
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) out.push({ path: `interpretation.${k}`, message: 'deve essere un array di stringhe' });
    }
  }
  if (raw.summary != null && typeof raw.summary !== 'string') out.push({ path: 'summary', message: 'summary deve essere testo' });

  return out.slice(0, 40);
}

/** Istruzioni per il ritentativo del modello: una riga per errore, dedotte dallo schema. */
export function repairInstructions(errors: SchemaError[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of errors) {
    const line = `${e.path}: ${e.message}`;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= 12) break;
  }
  return out;
}

/** Avviso in italiano per l'agente: quali parti sono state ignorate perche' fuori schema. */
export function schemaErrorSummary(errors: SchemaError[]): string {
  const sections = [...new Set(errors.map((e) => SECTION_LABELS[e.path.split(/[.[]/)[0]] || e.path.split(/[.[]/)[0]))];
  return `Alcuni dettagli non rispettavano il formato previsto e sono stati ignorati: ${sections.slice(0, 5).join(', ')}. Controlla i chip prima di generare.`;
}
