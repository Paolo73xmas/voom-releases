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
module.exports = { createVerifier };