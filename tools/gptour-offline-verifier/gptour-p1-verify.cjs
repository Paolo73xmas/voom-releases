#!/usr/bin/env node
'use strict';
// STANDALONE TEXT SOURCE. No external dependencies, Mobile workspace, fixtures or credentials required.
// Generated from the actual Mobile pure functions; only TypeScript annotations/module syntax transformed.
// This checks contract and shared view-model fidelity, NOT Android/iPhone/browser rendering.
const factories = {
"./contract": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVER_STATUSES = exports.ACTION_NAMES = exports.CONTRACT_VERSION = void 0;
/** INTERNAL presentation/transport abstractions. Official API 1.0 types: wire-contract.ts. */
exports.CONTRACT_VERSION = '1.0';
exports.ACTION_NAMES = ['answer', 'set_date', 'set_start_time', 'follow_up_decision', 'require_stop', 'exclude_stop', 'get_plan', 'reset'];
exports.SERVER_STATUSES = ['needs_clarification', 'planning', 'ready', 'infeasible', 'blocked', 'failed'];
// Approved official binding lives in ./binding; activation remains a separate, disabled pilot flag.

},
"./errors": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeError = exports.OrchestratorError = void 0;
exports.httpError = httpError;
const messages = {
    HANDOFF_REQUIRED: 'Integrazione in preparazione: manca la specifica API verificata. Nessuna richiesta è stata inviata.',
    INVALID_REQUEST: 'Richiesta non valida. Nessun dato è stato inviato.',
    INVALID_RESPONSE: 'Risposta server non riconosciuta o non coerente. Il piano non è confermato.',
    AUTH_REQUIRED: 'Sessione non disponibile o scaduta. Accedi nuovamente.',
    FORBIDDEN: 'Accesso al pilota o all’agente selezionato non autorizzato dal server. Nessun passaggio automatico al legacy.',
    ACCOUNT_CHANGED: 'Account cambiato: risposta ignorata e dati della conversazione rimossi dalla schermata.',
    CONFLICT: 'La sessione è cambiata sul server. Controlla la revisione indicata e ripeti il messaggio: verrà usato un nuovo identificativo.',
    UNAVAILABLE: 'Motore centrale temporaneamente non disponibile. Puoi riprovare la stessa richiesta.',
    NETWORK: 'Risposta non ricevuta. La richiesta potrebbe essere stata elaborata: riprova con lo stesso identificativo.',
    CANCELLED: 'Attesa interrotta. L’elaborazione server potrebbe continuare; nessun piano è stato confermato.',
    STORAGE: 'Impossibile conservare gli identificativi della richiesta. Nessuna nuova richiesta può partire in sicurezza.',
    PENDING_REQUEST: 'Una richiesta attende conferma: riprovala prima di inviarne un’altra.',
    REQUEST_REJECTED: 'Richiesta respinta dal motore centrale. Recupera lo stato della sessione.',
};
class OrchestratorError extends Error {
    code;
    details;
    constructor(code, details) {
        super(messages[code]);
        this.code = code;
        this.details = details;
        this.name = 'OrchestratorError';
    }
    get retryable() { return ['NETWORK', 'UNAVAILABLE', 'CANCELLED', 'PENDING_REQUEST'].includes(this.code); }
}
exports.OrchestratorError = OrchestratorError;
function httpError(status, body) {
    const value = body;
    return new OrchestratorError(status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT'
        : status && status >= 500 ? 'UNAVAILABLE' : status && status >= 400 ? 'REQUEST_REJECTED' : 'NETWORK', { httpStatus: status, errorCode: typeof value?.errorCode === 'string' ? value.errorCode : undefined,
        revision: status === 409 && typeof value?.sessionRevision === 'number' && Number.isSafeInteger(value.sessionRevision) && value.sessionRevision >= 0 ? value.sessionRevision : undefined });
}
const safeError = (e) => e instanceof OrchestratorError ? e : new OrchestratorError('NETWORK');
exports.safeError = safeError;

},
"./coordinates": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validCoordinate = validCoordinate;
exports.displayCoordinates = displayCoordinates;
const errors_1 = require("./errors");
function validCoordinate(p) {
    return !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
}
/** Coordinate order MUST come from the verified handoff, never a geographic guess. */
function displayCoordinates(points, order) {
    if (!['lat_lng', 'lng_lat'].includes(order))
        throw new errors_1.OrchestratorError('INVALID_RESPONSE');
    return points.map(p => {
        if (p.length !== 2)
            throw new errors_1.OrchestratorError('INVALID_RESPONSE');
        const point = { latitude: p[order === 'lat_lng' ? 0 : 1], longitude: p[order === 'lat_lng' ? 1 : 0] };
        if (!validCoordinate(point))
            throw new errors_1.OrchestratorError('INVALID_RESPONSE');
        return point;
    });
}

},
"./wire-contract": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GPTOUR_ENGINE_VERSION = exports.GPTOUR_CONTRACT_VERSION = void 0;
// Reviewed type-only transcription of the official 2026-10-11 handoff, API1.0 / Edgev6.
// Not a second planner. Keep server field names unchanged.
exports.GPTOUR_CONTRACT_VERSION = '1.0';
exports.GPTOUR_ENGINE_VERSION = 'gptour-orchestrator/0.2.0';

},
"./wire-actions": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeWireAction = encodeWireAction;
exports.validateWireRequest = validateWireRequest;
const errors_1 = require("./errors");
const fail = () => { throw new errors_1.OrchestratorError('INVALID_REQUEST'); };
const text = (v) => typeof v === 'string' && !!v.trim();
const date = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** Shape validation only, no interpretation of dates or commercial conditions. */
function encodeWireAction(command) {
    const input = command.input && !Array.isArray(command.input) && typeof command.input === 'object' ? command.input : {};
    const field = (key) => text(input[key]) ? input[key] : fail();
    switch (command.name) {
        case 'answer': return { type: 'answer', questionId: field('questionId'), optionId: field('optionId'), ...(input.value === undefined ? {} : { value: field('value') }) };
        case 'set_date': {
            const value = field('date');
            if (!date(value))
                fail();
            return { type: 'set_date', date: value };
        }
        case 'set_start_time': {
            const time = field('time');
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
                fail();
            return { type: 'set_start_time', time };
        }
        case 'follow_up_decision': {
            const decision = field('decision');
            if (!['include', 'exclude', 'propose_reschedule'].includes(decision))
                fail();
            if (input.proposedDate !== undefined && !date(input.proposedDate))
                fail();
            return { type: command.name, followUpId: field('followUpId'), decision: decision,
                ...(input.proposedDate === undefined ? {} : { proposedDate: input.proposedDate }) };
        }
        case 'require_stop':
        case 'exclude_stop': return { type: command.name, key: field('key') };
        case 'get_plan': return { type: 'get_plan', planId: field('planId') };
        case 'reset': return { type: 'reset' };
        default: return fail();
    }
}
function validateWireRequest(request) {
    if (request.sessionId.length > 128 || request.requestId.length > 128 || (request.message?.length ?? 0) > 2000)
        fail();
    if (request.expectedRevision !== undefined && (!Number.isSafeInteger(request.expectedRevision) || Number(request.expectedRevision) < 0))
        fail();
    if (request.action !== undefined) {
        const a = request.action;
        if (!a || Array.isArray(a) || typeof a !== 'object')
            fail();
        const { type, ...input } = a;
        const valid = encodeWireAction({ name: type, input });
        if (Object.keys(valid).length !== Object.keys(a).length || Object.entries(valid).some(([k, v]) => a[k] !== v))
            fail();
    }
    for (const value of [request.departure, request.gps])
        if (value !== undefined) {
            const p = value;
            if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180)
                fail();
        }
    if (request.departure !== undefined) {
        const p = request.departure;
        if (Object.keys(p).some(k => !['lat', 'lng', 'label'].includes(k)) || (p.label !== undefined && typeof p.label !== 'string'))
            fail();
    }
    if (request.gps !== undefined) {
        const p = request.gps;
        if (Object.keys(p).some(k => !['lat', 'lng', 'accuracyM', 'capturedAt'].includes(k)) || !Number.isFinite(p.accuracyM) || p.accuracyM < 0 || !text(p.capturedAt))
            fail();
    }
}

},
"./wire-response": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWireResponse = validateWireResponse;
const wire_contract_1 = require("./wire-contract");
const coordinates_1 = require("./coordinates");
const errors_1 = require("./errors");
function fail() { throw new errors_1.OrchestratorError('INVALID_RESPONSE'); }
const string = (x) => typeof x === 'string';
const number = (x) => typeof x === 'number' && Number.isFinite(x);
const strings = (x) => Array.isArray(x) && x.every(string);
const object = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const geo = (x) => object(x) && (0, coordinates_1.validCoordinate)({ latitude: x.lat, longitude: x.lng }) && (x.label === undefined || string(x.label));
function validateWireResponse(raw, req) {
    if (!object(raw) || raw.contractVersion !== wire_contract_1.GPTOUR_CONTRACT_VERSION || raw.engineVersion !== wire_contract_1.GPTOUR_ENGINE_VERSION
        || raw.sessionId !== req.sessionId || raw.requestId !== req.requestId || !Number.isSafeInteger(raw.sessionRevision) || Number(raw.sessionRevision) < 0
        || !['needs_clarification', 'planning', 'ready', 'infeasible', 'blocked', 'failed'].includes(String(raw.status))
        || !string(raw.message) || !string(raw.generatedAt) || !strings(raw.pendingDecisions) || !strings(raw.conflicts))
        fail();
    const c = raw.criteria;
    if (!object(c) || !['requiredKeys', 'requiredNames', 'excludedKeys', 'excludedNames', 'consents'].every(k => strings(c[k]))
        || !['date', 'startTime', 'endTime'].every(k => c[k] === null || string(c[k]))
        || !['wantAll', 'nonWorkingConfirmed', 'extraDaysApproved'].every(k => typeof c[k] === 'boolean')
        || ![c.dateAnchorTurn, c.maxDays].every(x => x === null || number(x)))
        fail();
    if (c.groups !== null && (!object(c.groups) || c.groups.version !== 1 || !['existing', 'newPoints', 'ownOnly', 'needsDays'].every(k => typeof c.groups[k] === 'boolean')
        || !(c.groups.inactiveDays === null || number(c.groups.inactiveDays))))
        fail();
    if (c.area !== null && (!object(c.area) || !strings(c.area.comuni) || !(c.area.provincia === null || string(c.area.provincia)) || typeof c.area.exhaustive !== 'boolean'))
        fail();
    if (raw.question !== null) {
        const q = raw.question;
        if (!object(q) || !string(q.id) || !string(q.kind) || !string(q.text) || !Array.isArray(q.options)
            || !q.options.every(o => object(o) && string(o.id) && string(o.label)))
            fail();
    }
    const dq = raw.dataQuality;
    if (!object(dq) || !strings(dq.notes) || !['osrm', 'estimate', 'none'].includes(String(dq.routingSource))
        || !['candidatesComplete', 'poolTruncated', 'purchasesVerified', 'registryVerified'].every(k => typeof dq[k] === 'boolean'))
        fail();
    if (!object(raw.metrics) || !['durationMs', 'crmQueries', 'aiCalls', 'routingCalls'].every(k => number(raw.metrics[k])))
        fail();
    if (raw.planId !== null && !string(raw.planId))
        fail();
    if (raw.errorCode !== undefined && !string(raw.errorCode))
        fail();
    if (raw.plan !== null)
        validatePlan(raw.plan, req);
    if (raw.status === 'ready' && (!raw.plan || raw.plan.verification !== 'verified_routing'))
        fail();
    if (raw.status === 'planning' && raw.plan && raw.plan.verification !== 'estimated_routing')
        fail();
    if (raw.plan && raw.plan.planId !== raw.planId)
        fail();
    const action = req.action;
    if (raw.plan && action?.type === 'get_plan' && raw.plan.planId !== action.planId)
        fail();
    if (raw.plan && (raw.plan.sessionRevision > Number(raw.sessionRevision)
        || (req.action?.type !== 'get_plan' && raw.plan.sessionRevision !== raw.sessionRevision)))
        fail();
}
function validatePlan(p, req) {
    if (!object(p) || !string(p.planId) || p.sessionId !== req.sessionId || p.contractVersion !== '1.0' || p.engineVersion !== wire_contract_1.GPTOUR_ENGINE_VERSION
        || !Number.isSafeInteger(p.sessionRevision) || Number(p.sessionRevision) < 0 || !string(p.generatedAt) || !string(p.snapshotRef)
        || !['verified_routing', 'estimated_routing'].includes(String(p.verification)) || !strings(p.warnings) || !strings(p.dependsOnPendingChanges)
        || !object(p.selectionReasons) || !Array.isArray(p.selectionReasons.selected) || !Array.isArray(p.selectionReasons.excluded))
        fail();
    for (const e of p.selectionReasons.excluded)
        if (!object(e) || !string(e.key) || !string(e.name) || !string(e.reason))
            fail();
    for (const e of p.selectionReasons.selected)
        if (!object(e) || !string(e.key) || !string(e.reason))
            fail();
    if (p.days !== undefined && !Array.isArray(p.days))
        fail();
    for (const [index, d] of [p, ...(Array.isArray(p.days) ? p.days : [])].entries()) {
        if (!object(d) || !string(d.date) || !geo(d.departure) || !(d.returnTo === null || geo(d.returnTo)) || !Array.isArray(d.stops)
            || ![d.startMin, d.finishMin, d.endMin].every(number) || !Array.isArray(d.geometry) || !object(d.totals))
            fail();
        if (!['driveMin', 'visitMin', 'waitMin', 'breakMin', 'returnMin', 'totalMin', 'availableMin', 'bufferMin', 'totalKm'].every(k => number(d.totals[k])))
            fail();
        if (!d.geometry.every(g => Array.isArray(g) && g.length === 2 && (0, coordinates_1.validCoordinate)({ latitude: g[0], longitude: g[1] })))
            fail();
        for (const s of d.stops)
            if (!object(s) || !geo(s) || !['key', 'name', 'city', 'reason'].every(k => string(s[k]))
                || !['suggested', 'required_by_agent', 'appointment', 'follow_up_confirmed'].includes(String(s.role)) || !['existing', 'new'].includes(String(s.group))
                || !['arrivalMin', 'departureMin', 'travelMinFromPrev', 'travelKmFromPrev', 'waitMin', 'visitMin', 'lunchBeforeMin'].every(k => number(s[k]))
                || !(s.lastOrderDate === null || string(s.lastOrderDate)) || !(s.daysSinceOrder === null || number(s.daysSinceOrder)) || typeof s.outsideWindow !== 'boolean')
                fail();
        if (index && (!number(d.day) || !strings(d.warnings) || !strings(d.conflicts) || typeof d.returnHomeAfterDay !== 'boolean'
            || !['home', 'previous_day_end'].includes(String(d.startsFrom)) || !(d.nightKmHome === null || number(d.nightKmHome))
            || !['last_day', 'threshold', 'global', 'routing_unknown'].includes(String(d.nightDecision))))
            fail();
    }
}

},
"./presentation": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMinute = void 0;
exports.presentPlan = presentPlan;
exports.criteriaLabels = criteriaLabels;
exports.presentQuestion = presentQuestion;
const coordinates_1 = require("./coordinates");
const formatMinute = (m) => `${String(Math.floor(Math.round(m) / 60)).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;
exports.formatMinute = formatMinute;
const minutes = (m) => `${m} min`;
const km = (n) => `${n.toFixed(1).replace('.', ',')} km`;
const point = (p) => ({ coordinate: { latitude: p.lat, longitude: p.lng }, label: p.label || `${p.lat}, ${p.lng}` });
function stopView(s, i, day) {
    return { id: `${day}-${i + 1}`, sequence: String(i + 1), name: s.name, city: s.city, coordinate: point(s).coordinate,
        arrival: (0, exports.formatMinute)(s.arrivalMin), departure: (0, exports.formatMinute)(s.departureMin), travel: `${minutes(s.travelMinFromPrev)} · ${km(s.travelKmFromPrev)}`,
        visit: minutes(s.visitMin), wait: minutes(s.waitMin), lunch: minutes(s.lunchBeforeMin), reason: s.reason,
        role: s.role, group: s.group, outsideWindow: s.outsideWindow, mandatory: s.role !== 'suggested',
        lastOrder: s.lastOrderDate ? `${s.lastOrderDate}${s.daysSinceOrder != null ? ` · ${s.daysSinceOrder} giorni` : ''}` : 'Non fornito dal motore',
        options: [
            { id: 'require', label: 'Richiedi questa tappa', command: { name: 'require_stop', input: { key: s.key } } },
            { id: 'exclude', label: 'Escludi questa tappa', command: { name: 'exclude_stop', input: { key: s.key } } },
        ] };
}
function presentPlan(plan) {
    const multi = !!plan.days && plan.days.length > 1;
    const days = multi ? plan.days : [plan];
    return { planId: plan.planId, metadata: `${plan.engineVersion} · contratto ${plan.contractVersion} · ${plan.generatedAt}`,
        routing: plan.verification === 'verified_routing' ? 'verified' : 'estimated', warnings: [...plan.warnings, ...plan.dependsOnPendingChanges],
        excluded: plan.selectionReasons.excluded,
        days: days.map((d, index) => {
            const day = d, t = d.totals;
            const geometry = d.geometry.length ? d.geometry : [[d.departure.lat, d.departure.lng], ...d.stops.map(s => [s.lat, s.lng]), ...(d.returnTo ? [[d.returnTo.lat, d.returnTo.lng]] : [])];
            return { id: String(multi ? day.day : 1), title: `Giorno ${multi ? day.day : 1}`, date: d.date,
                start: { ...point(d.departure), label: `${(0, exports.formatMinute)(d.startMin)} · ${point(d.departure).label}${day.startsFrom === 'previous_day_end' ? ' · fine giornata precedente' : ''}` },
                end: d.returnTo ? { ...point(d.returnTo), label: `${(0, exports.formatMinute)(d.finishMin)} · ${point(d.returnTo).label}` } : null,
                geometry: (0, coordinates_1.displayCoordinates)(geometry, 'lat_lng'), geometryKind: d.geometry.length ? 'server' : 'connections',
                stops: d.stops.map((s, i) => stopView(s, i, index + 1)),
                metrics: [['distance', 'Chilometri complessivi', km(t.totalKm)], ['drive', 'Guida tra tappe', minutes(t.driveMin)],
                    ['return', 'Rientro', minutes(t.returnMin)], ['visit', 'Visite', minutes(t.visitMin)], ['wait', 'Attese', minutes(t.waitMin)],
                    ['break', 'Pause', minutes(t.breakMin)], ['total', 'Tempo complessivo', minutes(t.totalMin)],
                    ['available', 'Tempo disponibile', minutes(t.availableMin)], ['buffer', 'Margine', minutes(t.bufferMin)],
                    ['finish', 'Fine / limite', `${(0, exports.formatMinute)(d.finishMin)} / ${(0, exports.formatMinute)(d.endMin)}`]].map(([id, label, value]) => ({ id, label, value })),
                breaks: [], commitments: [], overnight: multi && !day.returnHomeAfterDay ? `Pernottamento proposto${day.nightKmHome != null ? ` · casa a ${km(day.nightKmHome)}` : ''} · ${day.nightDecision}` : undefined,
                warnings: [...(multi ? [...day.warnings, ...day.conflicts] : []), ...(!d.geometry.length ? ['Geometria non fornita: la linea collega solo i punti, non è un percorso stradale ricostruito.'] : [])] };
        }) };
}
function criteriaLabels(c) {
    const g = c.groups;
    return [g?.existing && 'Clienti esistenti', g?.newPoints && 'Nuovi punti mai visitati', g?.ownOnly && 'Solo mio portafoglio',
        g?.inactiveDays != null && `Inattività ≥ ${g.inactiveDays} giorni`, g?.needsDays && 'Soglia da chiarire',
        c.area?.comuni.join(', '), c.area?.provincia, c.date, c.startTime && `Partenza ${c.startTime}`, c.endTime && `Fine entro ${c.endTime}`,
        c.maxDays != null && `Giornate: ${c.maxDays}`, c.extraDaysApproved && 'Giornate aggiuntive autorizzate',
        c.wantAll && 'Tutte le tappe richieste', c.area?.exhaustive && 'Area esaustiva', c.nonWorkingConfirmed && 'Giorno non lavorativo confermato',
        ...c.requiredKeys.map(k => `Richiesta: ${k}`), ...c.requiredNames.map(k => `Richiesta: ${k}`),
        ...c.excludedKeys.map(k => `Esclusa: ${k}`), ...c.excludedNames.map(k => `Esclusa: ${k}`), ...c.consents].filter((v) => typeof v === 'string' && !!v);
}
function presentQuestion(q) {
    const result = { id: q.id, kind: q.kind, text: q.text, options: q.options.map(o => ({ id: o.id, label: o.label,
            command: { name: 'answer', input: { questionId: q.id, optionId: o.id } } })) };
    if (q.kind === 'follow_ups' && q.id.startsWith('followups:')) {
        const ids = q.id.slice('followups:'.length).split(',').filter(Boolean);
        const rows = q.text.split('\n').filter(row => row.trim().startsWith('•')).map(row => row.replace(/^\s*•\s*/, ''));
        // No guessed association if the parallel ID/text lists do not agree.
        if (ids.length === rows.length && new Set(ids).size === ids.length)
            result.followUps = ids.map((id, i) => ({ id, text: rows[i] }));
    }
    return result;
}

},
"./request": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validRevision = validRevision;
exports.jsonSafe = jsonSafe;
exports.buildRequest = buildRequest;
const contract_1 = require("./contract");
const errors_1 = require("./errors");
function validRevision(value) {
    return (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) || (typeof value === 'string' && value.length > 0 && value.length < 200);
}
const authFields = /^(?:role|roles|permissions|agentId|tenantId|is_admin|isAdmin|access_token|refresh_token|authorization|service_role|api_key)$/i;
function jsonSafe(value, depth = 0) {
    if (depth > 30)
        return false;
    if (value === null || typeof value === 'boolean' || typeof value === 'string')
        return true;
    if (typeof value === 'number')
        return Number.isFinite(value);
    if (Array.isArray(value))
        return value.every(v => jsonSafe(v, depth + 1));
    return typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
        && Object.entries(value).every(([k, v]) => !authFields.test(k) && jsonSafe(v, depth + 1));
}
/** Whitelist envelope. Identity comes exclusively from the Supabase session, not caller roles. */
function buildRequest(input) {
    const bad = () => { throw new errors_1.OrchestratorError('INVALID_REQUEST'); };
    if (input.contractVersion !== contract_1.CONTRACT_VERSION || typeof input.sessionId !== 'string' || !input.sessionId.trim()
        || typeof input.requestId !== 'string' || !input.requestId.trim())
        bad();
    if ((input.message !== undefined) === (input.action !== undefined))
        bad();
    if (input.message !== undefined && (typeof input.message !== 'string' || !input.message.trim()))
        bad();
    if (input.action !== undefined && (input.action === null || !jsonSafe(input.action)))
        bad();
    if (input.expectedRevision !== undefined && !validRevision(input.expectedRevision))
        bad();
    if (input.targetAgentId !== undefined && (typeof input.targetAgentId !== 'string' || !input.targetAgentId.trim()))
        bad();
    for (const value of [input.departure, input.gps])
        if (value !== undefined && (value === null || !jsonSafe(value)))
            bad();
    const out = { contractVersion: contract_1.CONTRACT_VERSION, sessionId: input.sessionId, requestId: input.requestId };
    for (const key of ['expectedRevision', 'message', 'action', 'targetAgentId', 'departure', 'gps'])
        if (input[key] !== undefined)
            Object.assign(out, { [key]: input[key] });
    return JSON.parse(JSON.stringify(out));
}

},
"./view": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSnapshot = assertSnapshot;
exports.definitivePlan = definitivePlan;
exports.visibleServerPlan = visibleServerPlan;
const contract_1 = require("./contract");
const coordinates_1 = require("./coordinates");
const request_1 = require("./request");
const errors_1 = require("./errors");
const strings = (xs) => Array.isArray(xs) && xs.every(s => typeof s === 'string');
const id = (value) => typeof value === 'string' && value.length > 0;
const optionalText = (value) => value === undefined || typeof value === 'string';
function options(values) {
    if (!Array.isArray(values))
        throw new Error('options');
    for (const o of values)
        if (!id(o.id) || typeof o.label !== 'string' || !contract_1.ACTION_NAMES.includes(o.command?.name)
            || (o.command.input !== undefined && !(0, request_1.jsonSafe)(o.command.input)))
            throw new Error('option');
}
/** Structural checks on the INTERNAL renderer model. Wire decoding must precede this. No planning decisions. */
function assertSnapshot(s, request) {
    try {
        if (!s || s.sessionId !== request.sessionId || !(0, request_1.validRevision)(s.revision) || !contract_1.SERVER_STATUSES.includes(s.status))
            throw new Error('identity');
        if (typeof request.expectedRevision === 'number' && typeof s.revision === 'number' && s.revision < request.expectedRevision)
            throw new Error('stale');
        if (!strings(s.warnings) || !Array.isArray(s.messages) || !Array.isArray(s.questions))
            throw new Error('shape');
        for (const m of s.messages)
            if (!id(m.id) || !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string')
                throw new Error('message');
        for (const q of s.questions) {
            if (!id(q.id) || typeof q.text !== 'string')
                throw new Error('question');
            options(q.options);
        }
        if (s.status === 'ready' && !s.plan)
            throw new Error('ready without plan');
        if (s.plan) {
            if (!['verified', 'estimated', 'unknown'].includes(s.plan.routing) || !strings(s.plan.warnings) || !Array.isArray(s.plan.days) || !s.plan.days.length)
                throw new Error('plan');
            for (const d of s.plan.days) {
                if (!id(d.id) || !id(d.date) || typeof d.title !== 'string' || !(0, coordinates_1.validCoordinate)(d.start.coordinate) || typeof d.start.label !== 'string'
                    || (d.end && (!(0, coordinates_1.validCoordinate)(d.end.coordinate) || typeof d.end.label !== 'string')) || !optionalText(d.overnight)
                    || !strings(d.breaks) || !strings(d.commitments) || !strings(d.warnings))
                    throw new Error('day');
                if (!Array.isArray(d.geometry) || !d.geometry.every(coordinates_1.validCoordinate) || !Array.isArray(d.metrics) || !Array.isArray(d.stops))
                    throw new Error('arrays');
                for (const m of d.metrics)
                    if (!id(m.id) || typeof m.label !== 'string' || typeof m.value !== 'string')
                        throw new Error('metrics');
                for (const stop of d.stops) {
                    if (!id(stop.id) || !(0, coordinates_1.validCoordinate)(stop.coordinate) || !['sequence', 'name', 'arrival', 'departure', 'travel', 'visit'].every(k => typeof stop[k] === 'string')
                        || !optionalText(stop.wait) || !optionalText(stop.reason) || (stop.mandatory !== undefined && typeof stop.mandatory !== 'boolean'))
                        throw new Error('stop');
                    if (stop.options)
                        options(stop.options);
                }
            }
        }
    }
    catch {
        throw new errors_1.OrchestratorError('INVALID_RESPONSE');
    }
}
function definitivePlan(snapshot, unconfirmed = false) {
    return !unconfirmed && snapshot?.status === 'ready' ? snapshot.plan : null;
}
/** An estimated plan may be shown only as a non-confirmable draft, never as a ready plan. */
function visibleServerPlan(snapshot, unconfirmed = false) {
    return !unconfirmed && snapshot && ['ready', 'planning'].includes(snapshot.status) ? snapshot.plan : null;
}

},
"./binding": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPROVED_ORCHESTRATOR_BINDING = void 0;
exports.decodeOfficialResponse = decodeOfficialResponse;
const wire_response_1 = require("./wire-response");
const wire_actions_1 = require("./wire-actions");
const presentation_1 = require("./presentation");
const errors_1 = require("./errors");
/** Official package reviewed offline. This does NOT attest the currently deployed service version. */
function decodeOfficialResponse(raw, req) {
    const small = raw;
    if (small?.status === 'blocked' && small.errorCode === 'pilot_not_enabled' && typeof small.error === 'string' && !small.sessionId) {
        return { sessionId: req.sessionId, revision: req.expectedRevision ?? 0, revisionConfirmed: false,
            status: 'blocked', messages: [{ id: `${req.requestId}-a`, role: 'assistant', text: small.error }],
            questions: [], plan: null, planId: null, warnings: [], errorCode: 'pilot_not_enabled' };
    }
    (0, wire_response_1.validateWireResponse)(raw, req);
    if (raw.status !== 'ready' && raw.status !== 'planning' && raw.plan !== null)
        throw new errors_1.OrchestratorError('INVALID_RESPONSE');
    return { sessionId: raw.sessionId, revision: raw.sessionRevision, status: raw.status, revisionConfirmed: true,
        messages: [{ id: `${raw.requestId}-a`, role: 'assistant', text: raw.message }], questions: raw.question ? [(0, presentation_1.presentQuestion)(raw.question)] : [],
        plan: raw.plan ? (0, presentation_1.presentPlan)(raw.plan) : null, planId: raw.planId, engineVersion: raw.engineVersion, errorCode: raw.errorCode,
        criteria: (0, presentation_1.criteriaLabels)(raw.criteria), pendingDecisions: raw.pendingDecisions, warnings: [...raw.conflicts, ...raw.dataQuality.notes] };
}
exports.APPROVED_ORCHESTRATOR_BINDING = {
    version: '1.0', provenance: 'handoff-verified', recoveryRevision: 'confirmed', historyMode: 'local-transcript',
    validateRequest: wire_actions_1.validateWireRequest, encodeAction: wire_actions_1.encodeWireAction, decodeResponse: decodeOfficialResponse,
};

}
};
const cache = Object.create(null);
function mobileRequire(name) {
  if (!Object.hasOwn(factories, name)) throw new Error('Forbidden dependency');
  if (!cache[name]) { const m = { exports: {} }; cache[name] = m; factories[name](m, m.exports, mobileRequire); }
  return cache[name].exports;
}
const mobile = Object.assign({}, ...["./contract","./errors","./coordinates","./wire-contract","./wire-actions","./wire-response","./presentation","./request","./view","./binding"].map(mobileRequire));
'use strict';
// Verifier source: no fixtures, network, CRM queries, identifiers or coordinates are embedded.
function createVerifier(mobile, provenance) {
  const equal = require('node:util').isDeepStrictEqual;
  const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-6;
  const time = value => `${String(Math.floor(Math.round(value) / 60)).padStart(2, '0')}:${String(Math.round(value) % 60).padStart(2, '0')}`;
  const km = value => `${value.toFixed(1).replace('.', ',')} km`;
  const minutes = value => `${value} min`;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of Object.values(value)) freeze(child);
    }
    return value;
  }
  function base() {
    return { verifierVersion: '1.0.0', result: 'FAIL', profile: 'P1-three-turns-API1.0',
      mobileSources: provenance, checks: [], observations: [],
      limits: { nativeAndroid: 'NOT_EXECUTED', nativeIPhone: 'NOT_EXECUTED', browserRendering: 'NOT_EXECUTED',
        sourceAuthenticity: 'NOT_ATTESTED', roadFeasibility: 'SERVER_FLAG_ONLY_NO_INDEPENDENT_ROUTING',
        networkCalls: 0, outputContainsRawFixture: false } };
  }
  function finish(report) {
    report.summary = { passed: report.checks.filter(c => c.result === 'PASS').length,
      failed: report.checks.filter(c => c.result === 'FAIL').length };
    report.result = report.summary.failed === 0 ? 'PASS' : 'FAIL';
    return report;
  }
  function verifyTurns(input) {
    const report = base();
    const add = (code, ok, turn, mismatches) => {
      report.checks.push({ code, ...(turn ? { turn } : {}), result: ok ? 'PASS' : 'FAIL',
        ...(Number.isSafeInteger(mismatches) ? { mismatches } : {}) });
    };
    if (!Array.isArray(input) || input.length !== 3) { add('INPUT_EXACTLY_THREE_TURNS', false); return finish(report); }
    add('INPUT_EXACTLY_THREE_TURNS', true);
    let envelopes;
    try {
      envelopes = input.map(item => object(item) && Object.hasOwn(item, 'response')
        ? { response: item.response, request: item.request } : { response: item });
      freeze(envelopes);
    } catch { add('INPUT_DEPTH_OR_SHAPE', false); return finish(report); }
    const raw = envelopes.map(e => e.response);
    const views = [];
    let valid = true;
    report.requestCoverage = { originalRequestsProvided: envelopes.filter(e => e.request !== undefined).length,
      responseOnlyCorrelations: envelopes.filter(e => e.request === undefined).length };
    for (let i = 0; i < 3; i++) {
      const turn = i + 1;
      try {
        const r = raw[i];
        if (!object(r)) throw new Error();
        const req = envelopes[i].request ?? { contractVersion: '1.0', sessionId: r.sessionId, requestId: r.requestId,
          message: 'Offline response validation only', ...(i ? { expectedRevision: raw[i - 1].sessionRevision } : {}) };
        const wireRequest = mobile.buildRequest(req);
        if (envelopes[i].request !== undefined) add('ORIGINAL_REQUEST_WIRE_PAYLOAD_EXACT', equal(req, wireRequest), turn);
        mobile.validateWireRequest(wireRequest);
        mobile.validateWireResponse(r, wireRequest);
        const snapshot = mobile.decodeOfficialResponse(r, wireRequest);
        mobile.assertSnapshot(snapshot, wireRequest);
        views.push(snapshot);
        add('API1_0_MOBILE_VALIDATION', true, turn);
        add('ASSISTANT_MESSAGE_PRESERVED', snapshot.messages.length === 1 && snapshot.messages[0].text === r.message, turn);
        add('RESPONSE_WARNINGS_PRESERVED', equal(snapshot.warnings, [...r.conflicts, ...r.dataQuality.notes]), turn);
        add('PENDING_DECISIONS_PRESERVED', equal(snapshot.pendingDecisions, r.pendingDecisions), turn);
        add('TURN_EXPECTED_REVISION', r.sessionRevision === turn, turn);
      } catch { add('API1_0_MOBILE_VALIDATION', false, turn); valid = false; }
    }
    if (!valid) return finish(report);
    add('SAME_SESSION_THREE_TURNS', raw.every(r => r.sessionId === raw[0].sessionId));
    add('DISTINCT_REQUEST_IDS', new Set(raw.map(r => r.requestId)).size === 3);
    add('P1_STATUS_SEQUENCE', equal(raw.map(r => r.status), ['needs_clarification', 'ready', 'ready']));
    const question = raw[0].question, qview = views[0].questions[0];
    const rows = question?.text.split('\n').filter(s => s.trim().startsWith('•')).map(s => s.replace(/^\s*•\s*/, '')) ?? [];
    const ids = question?.id.startsWith('followups:') ? question.id.slice('followups:'.length).split(',') : [];
    add('TWO_FOLLOWUPS_EXACT_MAPPING', question?.kind === 'follow_ups' && ids.length === 2 && rows.length === 2
      && new Set(ids).size === 2 && equal(qview?.followUps, ids.map((id, index) => ({ id, text: rows[index] }))), 1);
    add('FOLLOWUP_QUESTION_AND_OPTIONS_PRESERVED', !!question && qview?.id === question.id && qview.text === question.text
      && equal(qview.options, question.options.map(o => ({ id: o.id, label: o.label,
        command: { name: 'answer', input: { questionId: question.id, optionId: o.id } } })))
      && question.options.some(o => o.id === 'include_all'), 1);
    add('CLARIFICATION_HAS_NO_PLAN', raw[0].plan === null && views[0].plan === null, 1);
    const plans = [raw[1].plan, raw[2].plan];
    if (!plans.every(Boolean)) { add('TWO_COMPLETE_PLANS_REQUIRED', false); return finish(report); }
    add('TWO_COMPLETE_PLANS_REQUIRED', true);
    function checkPlan(r, snapshot, turn) {
      const p = r.plan, d = snapshot.plan?.days[0];
      const expectedStart = turn === 2 ? 420 : 480;
      const t = p.totals, stops = p.stops;
      add('P1_SINGLE_DAY', !p.days || (p.days.length === 1
        && ['date', 'startMin', 'finishMin', 'endMin', 'departure', 'returnTo', 'stops', 'totals', 'geometry'].every(k => equal(p.days[0][k], p[k]))), turn);
      add('P1_THIRTEEN_UNIQUE_STOP_KEYS', stops.length === 13 && stops.every(s => !!s.key.trim()) && new Set(stops.map(s => s.key)).size === 13, turn);
      add('P1_MIXED_GROUPS', stops.some(s => s.group === 'existing') && stops.some(s => s.group === 'new'), turn);
      add('P1_GEOMETRY_2704', p.geometry.length === 2704, turn);
      add('P1_TOTAL_KM_79_7', near(t.totalKm, 79.7), turn);
      add('P1_START_07_THEN_08', p.startMin === expectedStart && mobile.formatMinute(p.startMin) === (turn === 2 ? '07:00' : '08:00'), turn);
      add('P1_BREAK_TOTAL_30_MIN', near(t.breakMin, 30), turn);
      add('P1_TWO_PLAN_WARNINGS', p.warnings.length === 2, turn);
      add('P1_VERIFIED_ROUTING', p.verification === 'verified_routing' && r.dataQuality.routingSource === 'osrm', turn);
      add('P1_CRITERIA_AND_PLAN_DATE', r.criteria.date === p.date && (r.criteria.startTime === null || r.criteria.startTime === time(p.startMin)), turn);
      add('P1_END_TIME_COHERENT', r.criteria.endTime === null || r.criteria.endTime === time(p.endMin), turn);
      add('P1_NO_PENDING_CONFLICTS', r.conflicts.length === 0 && r.pendingDecisions.length === 0 && p.dependsOnPendingChanges.length === 0, turn);
      add('P1_DAY_FITS_SERVER_LIMIT', p.finishMin <= p.endMin && t.bufferMin >= 0, turn);
      const nonnegative = ['travelMinFromPrev', 'travelKmFromPrev', 'visitMin', 'waitMin', 'lunchBeforeMin'];
      add('NONNEGATIVE_DURATIONS_DISTANCES', Object.values(t).every(v => Number.isFinite(v) && v >= 0)
        && stops.every(s => nonnegative.every(k => s[k] >= 0)), turn);
      let previous = p.startMin, badChronology = 0;
      for (const s of stops) {
        if (!near(s.arrivalMin, previous + s.travelMinFromPrev + s.waitMin + s.lunchBeforeMin)
          || !near(s.departureMin - s.arrivalMin, s.visitMin)) badChronology++;
        previous = s.departureMin;
      }
      add('STOP_CHRONOLOGY_WITH_BREAKS', badChronology === 0, turn, badChronology);
      add('RETURN_FINISH_COHERENT', near(previous + t.returnMin, p.finishMin), turn);
      for (const [source, total] of [['travelMinFromPrev', 'driveMin'], ['visitMin', 'visitMin'], ['waitMin', 'waitMin'], ['lunchBeforeMin', 'breakMin']]) {
        add(`TOTAL_${total.toUpperCase()}_COHERENT`, near(stops.reduce((sum, s) => sum + s[source], 0), t[total]), turn);
      }
      add('TOTAL_DAY_ARITHMETIC', near(t.totalMin, t.driveMin + t.visitMin + t.waitMin + t.breakMin + t.returnMin)
        && near(t.totalMin, p.finishMin - p.startMin) && near(t.availableMin, p.endMin - p.startMin)
        && near(t.bufferMin, p.endMin - p.finishMin), turn);
      add('DISTANCE_NOT_LESS_THAN_STOP_LEGS', t.totalKm + 1e-6 >= stops.reduce((sum, s) => sum + s.travelKmFromPrev, 0), turn);
      if (!d) { add('MOBILE_DAY_PRESENT', false, turn); return; }
      add('MOBILE_DAY_PRESENT', snapshot.plan.days.length === 1 && d.date === p.date && snapshot.plan.planId === p.planId, turn);
      add('MOBILE_GEOMETRY_EXACT_LAT_LNG', equal(d.geometry, p.geometry.map(([latitude, longitude]) => ({ latitude, longitude }))), turn);
      const fields = ['name', 'city', 'reason', 'role', 'group', 'outsideWindow'];
      let badStops = 0;
      for (let index = 0; index < stops.length; index++) {
        const s = stops[index], v = d.stops[index];
        if (!v || v.sequence !== String(index + 1) || fields.some(k => v[k] !== s[k])
          || v.coordinate.latitude !== s.lat || v.coordinate.longitude !== s.lng
          || v.arrival !== time(s.arrivalMin) || v.departure !== time(s.departureMin)
          || v.visit !== minutes(s.visitMin) || v.travel !== `${minutes(s.travelMinFromPrev)} · ${km(s.travelKmFromPrev)}`
          || v.wait !== minutes(s.waitMin) || v.lunch !== minutes(s.lunchBeforeMin)
          || v.mandatory !== (s.role !== 'suggested')
          || v.lastOrder !== (s.lastOrderDate ? `${s.lastOrderDate}${s.daysSinceOrder !== null ? ` · ${s.daysSinceOrder} giorni` : ''}` : 'Non fornito dal motore')
          || !equal(v.options?.map(o => [o.command.name, o.command.input.key]), [['require_stop', s.key], ['exclude_stop', s.key]])) badStops++;
      }
      add('MOBILE_EVERY_STOP_ID_ORDER_TIME_DETAIL', d.stops.length === stops.length && badStops === 0, turn, badStops);
      const expectedMetrics = { distance: km(t.totalKm), drive: minutes(t.driveMin), return: minutes(t.returnMin), visit: minutes(t.visitMin),
        wait: minutes(t.waitMin), break: minutes(t.breakMin), total: minutes(t.totalMin), available: minutes(t.availableMin), buffer: minutes(t.bufferMin), finish: `${time(p.finishMin)} / ${time(p.endMin)}` };
      add('MOBILE_ALL_TOTALS_EXACT', equal(Object.fromEntries(d.metrics.map(m => [m.id, m.value])), expectedMetrics), turn);
      const pointLabel = point => point.label || `${point.lat}, ${point.lng}`;
      add('MOBILE_DEPARTURE_RETURN_EXACT', equal(d.start.coordinate, { latitude: p.departure.lat, longitude: p.departure.lng })
        && d.start.label === `${time(p.startMin)} · ${pointLabel(p.departure)}`
        && (p.returnTo === null ? d.end === null : !!d.end && equal(d.end.coordinate, { latitude: p.returnTo.lat, longitude: p.returnTo.lng })
          && d.end.label === `${time(p.finishMin)} · ${pointLabel(p.returnTo)}`), turn);
      add('MOBILE_WARNINGS_EXCLUSIONS_EXACT', equal(snapshot.plan.warnings, [...p.warnings, ...p.dependsOnPendingChanges])
        && equal(snapshot.plan.excluded, p.selectionReasons.excluded), turn);
      const visibleWarnings = [...snapshot.warnings, ...snapshot.plan.warnings, ...d.warnings];
      add('MOBILE_SINGLE_DAY_EXTRA_WARNINGS_PRESERVED', !p.days?.length
        || [...p.days[0].warnings, ...p.days[0].conflicts].every(w => visibleWarnings.includes(w)), turn);
      add('MOBILE_SERVER_ROUTING_GEOMETRY_LABELS', snapshot.plan.routing === 'verified' && d.geometryKind === 'server', turn);
      report.observations.push({ turn, stopCount: stops.length, geometryPointCount: p.geometry.length,
        existingCount: stops.filter(s => s.group === 'existing').length, newCount: stops.filter(s => s.group === 'new').length,
        planWarningCount: p.warnings.length, excludedCount: p.selectionReasons.excluded.length,
        totalKm: t.totalKm, totalMin: t.totalMin, visitMin: t.visitMin, driveMin: t.driveMin, returnMin: t.returnMin,
        waitMin: t.waitMin, breakMin: t.breakMin, availableMin: t.availableMin, bufferMin: t.bufferMin,
        startTime: time(p.startMin), finishTime: time(p.finishMin), dayLimit: time(p.endMin),
        pauses: stops.map((s, index) => s.lunchBeforeMin > 0 ? index + 1 : null).filter(Boolean) });
    }
    try { checkPlan(raw[1], views[1], 2); checkPlan(raw[2], views[2], 3); }
    catch { add('PLAN_CHECKS_COMPLETED', false); }
    const [p2, p3] = plans;
    add('SHIFT_SAME_STOP_IDS_AND_ORDER', equal(p2.stops.map(s => s.key), p3.stops.map(s => s.key)));
    add('SHIFT_SAME_STOP_IDENTITY_AND_COORDINATES', equal(p2.stops.map(s => [s.key, s.name, s.city, s.lat, s.lng, s.group]), p3.stops.map(s => [s.key, s.name, s.city, s.lat, s.lng, s.group])));
    add('SHIFT_SAME_2704_GEOMETRY_PAIRS', equal(p2.geometry, p3.geometry));
    add('SHIFT_SAME_COMMERCIAL_CRITERIA', ['groups', 'area', 'date', 'requiredKeys', 'requiredNames', 'excludedKeys', 'excludedNames'].every(k => equal(raw[1].criteria[k], raw[2].criteria[k])));
    add('SHIFT_CRITERIA_08_APPLIED', raw[2].criteria.startTime === '08:00');
    add('SHIFT_SAME_DATE_ENDPOINTS_WARNINGS', p2.date === p3.date && equal(p2.departure, p3.departure) && equal(p2.returnTo, p3.returnTo) && equal(p2.warnings, p3.warnings));
    add('SHIFT_NEW_PLAN_REVISION', p2.planId !== p3.planId && p3.sessionRevision === p2.sessionRevision + 1);
    add('SHIFT_FINISH_PLUS_60_MINUTES', near(p3.finishMin - p2.finishMin, 60));
    add('SHIFT_PRESERVES_NON_BUFFER_TOTALS', ['driveMin', 'visitMin', 'waitMin', 'breakMin', 'returnMin', 'totalMin', 'totalKm'].every(k => near(p2.totals[k], p3.totals[k])));
    add('SHIFT_AVAILABLE_BUFFER_MINUS_60', near(p2.totals.availableMin - p3.totals.availableMin, 60) && near(p2.totals.bufferMin - p3.totals.bufferMin, 60));
    return finish(report);
  }
  return { verifyTurns, base, finish };
}

'use strict';
function runCli(api, argv) {
  const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
  const MAX_BYTES = 32 * 1024 * 1024;
  const fail = code => { const error = new Error('Verification stopped'); error.safeCode = code; throw error; };
  // Defense in depth; neither the CLI nor the copied mobile modules imports network code.
  globalThis.fetch = () => { throw new Error('NETWORK_DISABLED'); };
  globalThis.WebSocket = class { constructor() { throw new Error('NETWORK_DISABLED'); } };
  const files = [], before = [], selectors = [];
  let output, report, exitCode = 2;
  function pointer(root, value) {
    if (value === '') return root;
    if (!value.startsWith('/')) fail('INVALID_JSON_POINTER');
    let current = root;
    for (const token of value.slice(1).split('/')) {
      if (/~(?![01])/u.test(token)) fail('INVALID_JSON_POINTER');
      const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
      if (!current || typeof current !== 'object' || !Object.hasOwn(current, key)) fail('JSON_POINTER_NOT_FOUND');
      current = current[key];
    }
    return current;
  }
  function read(file) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(file)) fail('LOCAL_FILES_ONLY');
    let buffer;
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size > MAX_BYTES) fail('INPUT_SIZE_OR_TYPE');
      buffer = fs.readFileSync(file);
    } catch (e) { if (e.safeCode) throw e; fail('INPUT_READ_FAILED'); }
    before.push({ file, digest: crypto.createHash('sha256').update(buffer).digest('hex') });
    try { return JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, '')); }
    catch { fail('INPUT_NOT_VALID_JSON'); }
  }
  try {
    if (argv.length === 1 && argv[0] === '--help') {
      process.stdout.write('Offline P1 verifier — Node.js18+; no dependencies or network.\n'
        + 'node gptour-p1-verify.cjs --input /private/three-turns.json [--report /private/NEW-report.json]\n'
        + 'node gptour-p1-verify.cjs --turn1 /private/one.json --turn2 /private/two.json --turn3 /private/three.json [--report /private/NEW-report.json]\n'
        + 'Custom container: --input file.json --select /a/response --select /b/response --select /c/response\n'
        + 'Default container: array of3, or {turns:[...]}, or {responses:[...]}. Each entry is a response or {request,response}.\n'
        + 'Exit0 PASS;1 check failure;2 invalid input/output. Reports never contain raw values/paths/IDs/coordinates.\n'
        + 'Do not upload original fixtures. Transfer only the aggregate report. No native/UI rendering claim.\n');
      return 0;
    }
    const options = {};
    for (let i = 0; i < argv.length; i += 2) {
      const key = argv[i], value = argv[i + 1];
      if (!['--input', '--turn1', '--turn2', '--turn3', '--report', '--select'].includes(key) || value === undefined || value.startsWith('--')) fail('INVALID_ARGUMENTS');
      if (key === '--select') selectors.push(value);
      else { if (Object.hasOwn(options, key)) fail('DUPLICATE_ARGUMENT'); options[key] = value; }
    }
    output = options['--report'];
    let turns;
    if (options['--input']) {
      if (['--turn1', '--turn2', '--turn3'].some(k => options[k])) fail('MIXED_INPUT_MODES');
      files.push(options['--input']);
      const root = read(files[0]);
      if (selectors.length) {
        if (selectors.length !== 3) fail('THREE_SELECTORS_REQUIRED');
        turns = selectors.map(s => pointer(root, s));
      } else turns = Array.isArray(root) ? root : root?.turns ?? root?.responses;
    } else {
      if (selectors.length || !['--turn1', '--turn2', '--turn3'].every(k => options[k])) fail('THREE_FILES_REQUIRED');
      files.push(options['--turn1'], options['--turn2'], options['--turn3']);
      if (new Set(files.map(p => fs.realpathSync(p))).size !== 3) fail('DISTINCT_FILES_REQUIRED');
      turns = files.map(read);
    }
    if (!Array.isArray(turns) || turns.length !== 3) fail('INPUT_SHAPE_THREE_TURNS_REQUIRED');
    report = api.verifyTurns(turns);
    exitCode = report.result === 'PASS' ? 0 : 1;
  } catch (error) {
    report = api.base(); report.result = 'ERROR';
    report.checks.push({ code: error.safeCode || 'INPUT_OR_VERIFIER_ERROR', result: 'FAIL' });
    api.finish(report); report.result = 'ERROR';
  }
  let unchanged = true;
  try {
    unchanged = before.every(({ file, digest }) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') === digest);
  } catch { unchanged = false; }
  report.inputFilesUnchanged = unchanged;
  report.inputFilesRead = before.length;
  if (!unchanged) { report.checks.push({ code: 'INPUT_FILE_CHANGED_DURING_CHECK', result: 'FAIL' }); api.finish(report); exitCode = 2; }
  report.exitCode = exitCode;
  if (output) {
    try {
      if (files.some(file => path.resolve(file) === path.resolve(output))) fail('OUTPUT_MUST_NOT_OVERWRITE_INPUT');
      // Exclusive creation also prevents symlink/hardlink clobbering of originals or old reports.
      fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    } catch {
      report.checks.push({ code: 'REPORT_CREATE_REFUSED_NO_OVERWRITE', result: 'FAIL' });
      api.finish(report); report.result = 'ERROR'; report.exitCode = 2; exitCode = 2;
    }
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return exitCode;
}

const api = createVerifier(mobile, {
  "source": "VOOM Mobile pure Orchestrator functions",
  "moduleCount": 10,
  "fingerprint": "cbde323da92e55858903caa3331794421dc4b4e329c10957f717f09b6ad3c871",
  "files": [
    {
      "module": "contract.ts",
      "sha256": "c918c4188d13a8ce5cf5641db31f8605a15f04da4584382606c254d762337739"
    },
    {
      "module": "errors.ts",
      "sha256": "f317f9864c1810afb1826dcc8e8cb864da415d00578f16068cbde8558a87643e"
    },
    {
      "module": "coordinates.ts",
      "sha256": "fb18f4583f3fcaf970a5ddde88e417f526802d0e6f97d0408668df8987ad588e"
    },
    {
      "module": "wire-contract.ts",
      "sha256": "ddf36ebcd427437647bc0922beed1047d6a69ecbf7c3b379505fb5d3c9e52415"
    },
    {
      "module": "wire-actions.ts",
      "sha256": "82ea590e3930b551db219daf9ca20717acf39aee0a59a0835f435a352b49bf7f"
    },
    {
      "module": "wire-response.ts",
      "sha256": "25ddcf0f2af9437f6b4243f75c8e8f9fb8b1ebd42a6eeefda42cae4f3e5e64a1"
    },
    {
      "module": "presentation.ts",
      "sha256": "a29cb796e01da30cef77035b68e67a89b3499cc680c9039e28e195c0718411bc"
    },
    {
      "module": "request.ts",
      "sha256": "8237efe094e4c3aa2cc3d8b2891cf97bbd5768e4d775484ad4e6c67a6de250d2"
    },
    {
      "module": "view.ts",
      "sha256": "a8d9eacd3c50405c011d2716b59780b5be9519bdb04d1e5995cc49f4fe630279"
    },
    {
      "module": "binding.ts",
      "sha256": "c61d5764efd3eab6b64c7d30daaa23f266e5f624d225da06bae4bcd2296d7cd1"
    }
  ]
});
module.exports = { verifyTurns: api.verifyTurns, provenance: {"source":"VOOM Mobile pure Orchestrator functions","moduleCount":10,"fingerprint":"cbde323da92e55858903caa3331794421dc4b4e329c10957f717f09b6ad3c871","files":[{"module":"contract.ts","sha256":"c918c4188d13a8ce5cf5641db31f8605a15f04da4584382606c254d762337739"},{"module":"errors.ts","sha256":"f317f9864c1810afb1826dcc8e8cb864da415d00578f16068cbde8558a87643e"},{"module":"coordinates.ts","sha256":"fb18f4583f3fcaf970a5ddde88e417f526802d0e6f97d0408668df8987ad588e"},{"module":"wire-contract.ts","sha256":"ddf36ebcd427437647bc0922beed1047d6a69ecbf7c3b379505fb5d3c9e52415"},{"module":"wire-actions.ts","sha256":"82ea590e3930b551db219daf9ca20717acf39aee0a59a0835f435a352b49bf7f"},{"module":"wire-response.ts","sha256":"25ddcf0f2af9437f6b4243f75c8e8f9fb8b1ebd42a6eeefda42cae4f3e5e64a1"},{"module":"presentation.ts","sha256":"a29cb796e01da30cef77035b68e67a89b3499cc680c9039e28e195c0718411bc"},{"module":"request.ts","sha256":"8237efe094e4c3aa2cc3d8b2891cf97bbd5768e4d775484ad4e6c67a6de250d2"},{"module":"view.ts","sha256":"a8d9eacd3c50405c011d2716b59780b5be9519bdb04d1e5995cc49f4fe630279"},{"module":"binding.ts","sha256":"c61d5764efd3eab6b64c7d30daaa23f266e5f624d225da06bae4bcd2296d7cd1"}]} };
if (require.main === module) process.exitCode = runCli(api, process.argv.slice(2));
