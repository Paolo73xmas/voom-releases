// Direct RLS verification of createTourInspection path (as roberto, agente):
// 1) insert inspections row (status completed)
// 2) upload a small JPG into bucket 'inspection_photos'
// 3) insert inspection_photos row (gps + photo_order)
// Then cleanup all 3.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);

const { data: auth, error: aerr } = await supabase.auth.signInWithPassword({
  email: 'roberto.beretta@voomweb.it', password: 'Roberto123!',
});
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }
const uid = auth.user.id;
console.log('AUTH OK uid=', uid);

// Pick any customer visible to roberto
const { data: customers, error: cerr } = await supabase.from('customers').select('id, business_name, contact_mobile, contact_email').limit(1);
if (cerr || !customers?.length) { console.error('NO CUSTOMER visible', cerr?.message); process.exit(1); }
const cust = customers[0];
console.log('Using customer:', cust.id, cust.business_name);

// 1) inspections insert
const { data: insp, error: ierr } = await supabase.from('inspections').insert({
  customer_id: cust.id,
  agent_id: uid,
  status: 'completed',
  notes: '[AI Tour] Esito: test RLS probe',
  latitude: 45.4642,
  longitude: 9.19,
  inspection_date: new Date().toISOString(),
}).select().single();
if (ierr) { console.error('INSP INSERT FAIL:', ierr.message); process.exit(1); }
console.log('INSP CREATED:', insp.id);

// 2) storage upload — 1x1 red JPG (minimal valid JPEG)
const jpgB64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8/wCiiigD/9k=';
const bytes = Buffer.from(jpgB64, 'base64');
const path = `${insp.id}/${Date.now()}_test_1.jpg`;
const { error: sterr } = await supabase.storage.from('inspection_photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
if (sterr) { console.error('STORAGE UPLOAD FAIL:', sterr.message); }
else console.log('STORAGE UPLOAD OK path=', path);

const { data: pub } = supabase.storage.from('inspection_photos').getPublicUrl(path);
const photoUrl = pub.publicUrl;

// 3) inspection_photos insert
const { data: pRow, error: perr } = await supabase.from('inspection_photos').insert({
  inspection_id: insp.id,
  photo_url: photoUrl,
  gps_lat: 45.4642,
  gps_lng: 9.19,
  photo_order: 1,
}).select().single();
if (perr) { console.error('PHOTO ROW FAIL:', perr.message); }
else console.log('PHOTO ROW OK id=', pRow.id);

console.log('--- Summary ---');
console.log('inspections insert:', ierr ? 'FAIL' : 'PASS');
console.log('storage upload:', sterr ? 'FAIL' : 'PASS');
console.log('inspection_photos insert:', perr ? 'FAIL' : 'PASS');

// Cleanup: delete photo row → storage file → inspection row
if (pRow) await supabase.from('inspection_photos').delete().eq('id', pRow.id);
if (!sterr) await supabase.storage.from('inspection_photos').remove([path]);
await supabase.from('inspections').delete().eq('id', insp.id);
console.log('CLEANUP done');
process.exit(0);
