// Parità con web tests/aitour/gptour_purchase_request.unit.ts @ 30b163a/2eea9933 (61 asserzioni).
// Differenza mobile: i candidati fixture hanno coordinate valide (il filtro mobile scarta anche
// 'coordinate mancanti', invariante del planner nativo); regole e risultati sono identici al web.
import assert from 'node:assert/strict';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_INTENT, mergeIntent } from '../lib/aitour/gptour-intent';
import { applyConversationRules, explicitLocalityNames, verifiedPlanningPool } from '../lib/aitour/gptour-registry';
import { explicitRequestArea } from '../lib/aitour/gptour-request-area';
import { purchaseMinDays } from '../lib/aitour/gptour-purchase-intent';
import { refreshPurchaseHistory } from '../lib/aitour/gptour-purchases';
import { requestedAreaLabel, withVerifiedPurchaseReply } from '../lib/aitour/gptour-purchase-summary';
import type { GptResult } from '../lib/aitour/gptour-api';
import { candidateMatchesTourIntent, provinceMatches } from '../lib/aitour/gptour-criteria';
import type { TourCandidate } from '../lib/aitour/types';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

describe('GPTour richieste acquisti/provincia (parità web gptour_purchase_request)', () => {
  it('61 asserzioni identiche al web', async () => {
    let checks = 0;
    const ok = (value: unknown, label: string) => { assert.ok(value, label); checks++; };
    const phrase = 'TABACCHERIE DI TREVISO E PROVINCIA CHE NON COMPRANO DA 30 GIORNI';
    const request = (s: string) => applyConversationRules({ ...DEFAULT_INTENT, orderMinDays: 30, physicalContactMinDays: 30 }, s, DEFAULT_INTENT);
    const province = request(phrase);
    ok(province.orderMinDays === 30 && province.requireOrderHistory, 'la parola tabaccherie non cancella i 30 giorni');
    ok(province.physicalContactMinDays === null, 'acquisti non sono visite: soglia inventata ignorata');
    ok(request('Domani voglio visitare le tabaccherie di Treviso che non comprano da 30 giorni').physicalContactMinDays === null, 'visitare non implica un filtro sulla data della visita');
    ok(province.requestedArea?.provincia === 'TV' && !province.requestedArea.comuni?.length, 'Treviso e provincia non si restringe al capoluogo');
    ok(province.requestedEntityTypes.join() === 'client,orphan' && !province.allTobacconists, 'inattivi non sono nuovi punti vendita');
    ok(!province.wantAll, 'nessun tutti implicito dalla sola parola tabaccherie con filtro');
    ok(explicitLocalityNames(phrase).length === 0, 'nessuna pseudo-località provincia che non comprano');
    ok(request('Tutte le tabaccherie di Treviso che non comprano da 30 giorni').wantAll, 'tutte esplicito preservato');

    for (const text of [
      phrase,
      'tabaccherie di Treviso e tabaccherie presenti nella provincia di Treviso che non comprano da 30 giorni',
      'clienti nella provincia di Treviso che non ordinano da trenta giorni',
      'tabaccherie di Treviso e provincia senza acquisti da almeno 30 giorni',
    ]) {
      const it = request(text);
      ok(it.orderMinDays === 30 && it.requestedArea?.provincia === 'TV' && it.requestedArea.comuni?.length === 0, text);
    }
    const town = request('Tabaccherie di Treviso che non comprano da 30 giorni');
    ok(town.requestedArea?.comune === 'Treviso' && !town.requestedArea.provincia, 'solo Treviso resta comune');
    ok(explicitLocalityNames('tabaccherie di Monte di Procida che non acquistano da 60 giorni')[0] === 'Monte di Procida', 'nome composto preservato');
    ok(explicitRequestArea('tabaccherie nella provincia di Monza e Brianza che non ordinano da 30 giorni')?.provincia === 'MB', 'provincia composta');
    for (const qualifier of [' in provincia di ', ', provincia di ']) {
      const area = explicitRequestArea(`tabaccherie del comune di Castelfranco Veneto${qualifier}Treviso che non comprano da 30 giorni`);
      ok(area?.provincia === 'TV' && area.comuni?.join() === 'Castelfranco Veneto', 'provincia di disambiguazione non allarga il comune');
    }
    for (const text of [
      'visitare le tyabaccherie di treviso e le tabbacherie in provincia di treviso',
      'visitare le tabaccherie di treviso e le tabaccherie in provincia di treviso',
      'visitare le tabaccherie di treviso e provincia',
      'visitare le tabaccherie nella provincia di Treviso',
    ]) {
      const it = applyConversationRules(DEFAULT_INTENT, text, DEFAULT_INTENT);
      ok(it.requestedArea?.provincia === 'TV' && it.requestedArea.comuni?.length === 0, `provincia con soggetto ripetuto/refusi: ${text}`);
      ok(it.allTobacconists && it.requestedEntityTypes.length === 5 && it.orderMinDays == null, 'richiesta geografica generica, nessun filtro acquisti inventato');
    }
    ok(explicitLocalityNames('Domani nuovi punti nei comuni di Campo, Chiassola e Roana').join('|') === 'Campo|Chiassola|Roana', 'nessun nome ignoto omesso');
    ok(explicitRequestArea('tabaccherie nella provincia di Sconosciuta che non comprano da 30 giorni')?.provincia === 'Sconosciuta', 'provincia ignota non diventa località');
    for (const verb of ['non comprano', 'non acquista', 'non ordinano', 'non hanno comprato', 'non ha acquistato', 'senza ordini', 'fermi']) {
      ok(purchaseMinDays(`${verb} da almeno 30 giorni`) === 30, `sinonimo ${verb}`);
    }
    ok(purchaseMinDays('non visitati da 30 giorni') === null, 'visite non trasformate in acquisti');
    ok(purchaseMinDays('non comprano da 60 giorni') === 60, 'soglia non fissa a trenta');

    let next = applyConversationRules(mergeIntent(province, { orderMinDays: null, requestedArea: { comuni: ['Treviso'] } }), 'Treviso', province);
    ok(next.orderMinDays === 30 && next.requestedArea?.provincia === 'TV' && !next.requestedArea.comuni?.length, 'chiarimento breve conserva provincia e acquisti');
    next = applyConversationRules(mergeIntent(next, { orderMinDays: null }), 'Domani, niente follow up', next);
    ok(next.orderMinDays === 30 && next.skipFollowUps && next.singleDayRequested, 'turno successivo conserva filtro e modifica solo data/followup');
    next = applyConversationRules(next, 'Tabaccherie di Treviso che non comprano da 60 giorni', next);
    ok(next.orderMinDays === 60 && next.requestedArea?.comune === 'Treviso' && !next.requestedArea.provincia, 'nuova soglia e area sostituiscono le precedenti');
    ok(!applyConversationRules(next, 'Rimuovi il filtro acquisti', next).requireOrderHistory, 'rimozione esplicita consentita');
    const added = applyConversationRules(town, 'aggiungi le tabaccherie di Conegliano', town);
    ok(added.requestedArea?.comuni?.join() === 'Treviso,Conegliano' && added.orderMinDays === 30, 'aggiunta comune conserva criterio');
    const stale = { ...town, requestedArea: { comuni: ['Treviso', 'Provincia che non comprano da 30 giorni'] } };
    ok(applyConversationRules(stale, 'Treviso', stale).requestedArea?.comuni?.join() === 'Treviso', 'chiarimento ripara località contaminata');

    const cand = (key: string, extra: Partial<TourCandidate> = {}) => ({
      key, entityType: 'client', customerId: key, tabaccheriaId: null, name: key,
      city: 'Treviso', province: 'TV', lat: 45.6669, lng: 12.2431, daysSinceOrder: 30, daysSincePhysicalContact: 1,
      revenue6m: 0, ...extra,
    }) as TourCandidate;
    const pool = [cand('29', { daysSinceOrder: 29 }), cand('30'), cand('31', { daysSinceOrder: 31, city: 'Conegliano', province: 'Treviso', entityType: 'orphan' }),
      cand('new', { daysSinceOrder: null, entityType: 'free' }), cand('never', { daysSinceOrder: null }),
      cand('other', { city: 'Venezia', province: 'VE' }), cand('missing', { city: 'Conegliano', province: '' }), cand('invalid', { daysSinceOrder: NaN })];
    ok(verifiedPlanningPool(pool, province).map(c => c.key).join() === '30,31', 'confine 30 incluso, comuni provincia inclusi, mai acquirenti/altre province esclusi');
    ok(verifiedPlanningPool(pool, town).map(c => c.key).join() === '30', 'comune non allarga alla provincia');
    for (const mode of ['fill', 'corridor'] as const) {
      ok(!candidateMatchesTourIntent(pool[0], province, mode), `${mode}: ordine 29 escluso`);
      ok(candidateMatchesTourIntent(pool[1], province, mode), `${mode}: visita ieri non sostituisce ordine 30`);
      ok(!candidateMatchesTourIntent(pool[3], province, mode), `${mode}: niente sviluppo automatico`);
    }
    ok(!provinceMatches(cand('x', { province: 'Venezia' }), 'TV'), 'sigla vs nome altra provincia escluso');
    ok(!provinceMatches(cand('x'), 'Sconosciuta'), 'provincia ignota fail-closed');
    ok(requestedAreaLabel(province.requestedArea) === 'nella provincia di Treviso', 'riepilogo provinciale non si dichiara comunale');
    ok(requestedAreaLabel(town.requestedArea) === 'nel comune di Treviso', 'riepilogo comunale distinto');
    const rawResult: GptResult = { reply: 'Tutti nel comune di Treviso, aggiungi anche Paese', needsInfo: false, multiDay: false, lodging: null,
      tourDate: null, startTime: null, endTime: null, selection: [{ key: '30', reason: null }], days: [], notes: null };
    const summary = withVerifiedPurchaseReply(rawResult, province, 31);
    ok(summary.reply.includes('1 tappa tra 31') && summary.reply.includes('nella provincia di Treviso') && !summary.reply.includes('Paese'), 'riepilogo derivato dai criteri/dati verificati, non da proposte testuali non verificate');
    ok(withVerifiedPurchaseReply({ ...rawResult, needsInfo: true, reply: 'Quale data?' }, province, 31).reply === 'Quale data?', 'domande necessarie preservate');

    const offsets: number[] = [];
    const rows = Array.from({ length: 500 }, (_, n) => ({ id: `o${n}`, customer_id: '30', order_date: '2026-09-09' }));
    const refreshed = await refreshPurchaseHistory(pool, async (_ids, offset) => {
      offsets.push(offset);
      return offset === 0 ? rows : [{ id: 'last', customer_id: '31', order_date: '2026-09-08' }];
    });
    ok(offsets.join() === '0,500', 'paginazione oltre il primo blocco');
    ok(refreshed.find(c => c.key === '31')?.lastOrderDate === '2026-09-08', 'ordine nella seconda pagina incluso');
    ok(refreshed.find(c => c.key === '29')?.daysSinceOrder == null, 'assenza storico non usa date vecchie');
    await assert.rejects(refreshPurchaseHistory(pool, async () => { throw new Error('rete'); }), /rete/); checks++;
    await assert.rejects(refreshPurchaseHistory(pool, async () => [{ id: 'bad', customer_id: '30', order_date: null }]), /data mancante/); checks++;
    expect(checks).toBe(61);
  });
});
