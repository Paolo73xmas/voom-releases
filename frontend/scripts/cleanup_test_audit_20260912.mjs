import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const manifestPath = '/app/test_reports/artifacts_iter30/fixture_manifest_TEST_AUDIT_20260912.json';
if (!fs.existsSync(manifestPath)) {
  console.error('Manifest not found:', manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
if (!url || !key) {
  console.error('Missing Supabase env values');
  process.exit(2);
}

const supabase = createClient(url, key);
const { error: authErr } = await supabase.auth.signInWithPassword({
  email: 'admin1@voomweb.it',
  password: 'Test123!',
});
if (authErr) {
  console.error('AUTH FAIL', authErr.message);
  process.exit(3);
}

const report = { deleted: {}, errors: [] };

const safeDelete = async (label, table, id) => {
  if (!id) return;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    report.errors.push(`${label}: ${error.message}`);
  } else {
    report.deleted[label] = id;
  }
};

// Delete child records first
await safeDelete('appointment', 'appointments', manifest.appointment?.id);
await safeDelete('visit', 'visits', manifest.visit?.id);

// Optional order cleanup if present
if (manifest.order?.id) {
  const orderId = manifest.order.id;
  const { error: oiErr } = await supabase.from('order_items').delete().eq('order_id', orderId);
  if (oiErr) report.errors.push(`order_items(${orderId}): ${oiErr.message}`);
  const { error: ordErr } = await supabase.from('orders').delete().eq('id', orderId);
  if (ordErr) report.errors.push(`orders(${orderId}): ${ordErr.message}`);
  else report.deleted.order = orderId;
}

await safeDelete('customer', 'customers', manifest.customer?.id);
for (const extraId of (manifest.extra_customer_ids || [])) {
  await safeDelete(`extra_customer_${extraId}`, 'customers', extraId);
}

const cleanupPath = '/app/test_reports/artifacts_iter30/fixture_cleanup_result_TEST_AUDIT_20260912.json';
fs.writeFileSync(cleanupPath, JSON.stringify({
  cleaned_at: new Date().toISOString(),
  manifest_path: manifestPath,
  report,
}, null, 2));

console.log(`CLEANUP REPORT -> ${cleanupPath}`);
console.log(JSON.stringify(report));
process.exit(report.errors.length ? 4 : 0);
