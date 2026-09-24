// E2E script (Iter 46): valida che createVisit chiuda i follow_up scheduled dello stesso
// giorno per il cliente TEST-FUP mentre lascia aperti quelli di domani.
// Usa SOLO l'account di test gdeintinis@gmail.com. Pulisce sempre le righe TEST-FUP create.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) { console.error('Missing supabase env'); process.exit(2); }

const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

const EMAIL = 'gdeintinis@gmail.com';
const PASSWORD = 'GabrieleDeIntinis123!';
const TAG = 'TEST-FUP-iter46';

async function closeDueFollowUps(customerId, agentId, at = new Date()) {
  const dayEnd = new Date(at); dayEnd.setHours(23, 59, 59, 999);
  const { data, error } = await sb
    .from('appointments')
    .update({ status: 'completed' })
    .eq('customer_id', customerId)
    .eq('agent_id', agentId)
    .eq('appointment_type', 'follow_up')
    .eq('status', 'scheduled')
    .lte('appointment_date', dayEnd.toISOString())
    .select('id');
  if (error) throw new Error(`closeDueFollowUps: ${error.message}`);
  return data || [];
}

let customerId = null;
let apptToday = null;
let apptTomorrow = null;
let visitId = null;
let ownerId = null;

async function cleanup() {
  console.log('[cleanup] rimozione dati TEST-FUP...');
  try {
    if (visitId) await sb.from('visits').delete().eq('id', visitId);
    if (apptToday) await sb.from('appointments').delete().eq('id', apptToday);
    if (apptTomorrow) await sb.from('appointments').delete().eq('id', apptTomorrow);
    if (customerId) {
      await sb.from('appointments').delete().eq('customer_id', customerId);
      await sb.from('visits').delete().eq('customer_id', customerId);
      await sb.from('customers').delete().eq('id', customerId);
    }
  } catch (e) { console.warn('cleanup warn:', e.message); }
}

try {
  console.log('[step 1] login agente di test:', EMAIL);
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authErr) throw authErr;
  ownerId = auth.user.id;
  console.log('  agent_id =', ownerId);

  console.log('[step 2] creo cliente TEST-FUP');
  customerId = randomUUID();
  const custIns = await sb.from('customers').insert({
    id: customerId,
    business_name: `${TAG} ${new Date().toISOString()}`,
    agent_id: ownerId,
    city: 'TEST',
    province: 'XX',
    postal_code: '00000',
    address: 'TEST',
    vat_number: `TEST${Date.now()}`,
    fiscal_code: `TEST${Date.now()}`,
    contact_phone: '0000000000',
    contact_name: 'TEST',
    contact_surname: 'TEST',
    customer_type: 'private',
    category: 'prospect',
    source: 'off_map',
    notes: 'TEST-FUP iter46',
    first_visit_date: new Date().toISOString(),
    last_visit_date: new Date().toISOString(),
    latitude: 45.0,
    longitude: 9.0,
  }).select('id').single();
  if (custIns.error) throw new Error(`customer insert: ${custIns.error.message}`);
  console.log('  customer_id =', customerId);

  // Appuntamento OGGI ore 23:00 (nel futuro rispetto ad ora)
  const today = new Date(); today.setHours(23, 0, 0, 0);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);

  console.log('[step 3] inserisco follow_up OGGI 23:00 e DOMANI 09:00');
  apptToday = randomUUID();
  apptTomorrow = randomUUID();
  const apptA = await sb.from('appointments').insert({
    id: apptToday, agent_id: ownerId, created_by_id: ownerId, customer_id: customerId,
    appointment_date: today.toISOString(), duration_minutes: 30,
    appointment_type: 'follow_up', status: 'scheduled', notes: `${TAG} oggi`,
  }).select('id').single();
  if (apptA.error) throw new Error(`appt today: ${apptA.error.message}`);
  const apptB = await sb.from('appointments').insert({
    id: apptTomorrow, agent_id: ownerId, created_by_id: ownerId, customer_id: customerId,
    appointment_date: tomorrow.toISOString(), duration_minutes: 30,
    appointment_type: 'follow_up', status: 'scheduled', notes: `${TAG} domani`,
  }).select('id').single();
  if (apptB.error) throw new Error(`appt tomorrow: ${apptB.error.message}`);

  console.log('[step 4] simulo createVisit -> insert visits + closeDueFollowUps');
  const visitIns = await sb.from('visits').insert({
    customer_id: customerId, agent_id: ownerId, visit_type: 'follow_up',
    visit_date: new Date().toISOString(), latitude: 45.0, longitude: 9.0,
    outcome: 'neutral', notes: `${TAG} test visit`,
  }).select('id').single();
  if (visitIns.error) throw new Error(`visit insert: ${visitIns.error.message}`);
  visitId = visitIns.data.id;
  const closed = await closeDueFollowUps(customerId, ownerId, new Date());
  console.log('  chiusi:', closed.length, 'id:', closed.map(x => x.id));

  console.log('[step 5] verifica stati appuntamenti');
  const rd = await sb.from('appointments').select('id,status,appointment_date')
    .in('id', [apptToday, apptTomorrow]);
  if (rd.error) throw rd.error;
  const byId = Object.fromEntries(rd.data.map(r => [r.id, r]));
  const stToday = byId[apptToday]?.status;
  const stTomorrow = byId[apptTomorrow]?.status;
  console.log('  today status =', stToday, ' (atteso completed)');
  console.log('  tomorrow status =', stTomorrow, ' (atteso scheduled)');

  const ok = stToday === 'completed' && stTomorrow === 'scheduled' && closed.length === 1 && closed[0].id === apptToday;
  console.log(ok ? '[RESULT] PASS' : '[RESULT] FAIL');
  await cleanup();
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.error('[error]', e.message || e);
  await cleanup();
  process.exit(1);
}
