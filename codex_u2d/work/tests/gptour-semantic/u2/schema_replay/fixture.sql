-- SYNTHETIC FIXTURE for the schema-replay lab. Invented data on the REAL replayed columns/triggers/policies.
-- No production data. UUIDs are fixed so the tests can assert exact key sets.
-- Agents: A (a000…a) Milano, B (b000…b) Monza, C admin, D portal customer role, E inactive agent.
begin;
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', 'agente-a@sintetico.local'),
  ('b0000000-0000-4000-8000-00000000000b', 'agente-b@sintetico.local'),
  ('c0000000-0000-4000-8000-00000000000c', 'admin-c@sintetico.local'),
  ('d0000000-0000-4000-8000-00000000000d', 'cliente-d@sintetico.local'),
  ('e0000000-0000-4000-8000-00000000000e', 'inattivo-e@sintetico.local')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role, is_active) values
  ('a0000000-0000-4000-8000-00000000000a', 'agente-a@sintetico.local', 'Agente A (SINTETICO)', 'agent', true),
  ('b0000000-0000-4000-8000-00000000000b', 'agente-b@sintetico.local', 'Agente B (SINTETICO)', 'agent', true),
  ('c0000000-0000-4000-8000-00000000000c', 'admin-c@sintetico.local', 'Admin C (SINTETICO)', 'admin', true),
  ('d0000000-0000-4000-8000-00000000000d', 'cliente-d@sintetico.local', 'Cliente D (SINTETICO)', 'customer', true),
  ('e0000000-0000-4000-8000-00000000000e', 'inattivo-e@sintetico.local', 'Agente E inattivo (SINTETICO)', 'agent', false)
on conflict (id) do nothing;

-- Territories: polygons as jsonb rings [lng, lat] (real agent_zones.coordinates shape). A = Milano, B = Monza.
insert into public.agent_zones (id, agent_id, zone_name, coordinates, is_active) values
  ('aa000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'Milano (SINTETICO)', '[[9.10,45.40],[9.35,45.40],[9.35,45.56],[9.10,45.56],[9.10,45.40]]', true),
  ('aa000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', 'Zona disattivata (SINTETICO)', '[[9.0,45.0],[9.5,45.0],[9.5,45.3],[9.0,45.3],[9.0,45.0]]', false),
  ('bb000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b', 'Monza (SINTETICO)', '[[9.20,45.55],[9.35,45.55],[9.35,45.65],[9.20,45.65],[9.20,45.55]]', true)
on conflict (id) do nothing;

insert into public.ai_tour_settings (agent_id, work_start, work_end, lunch_break_minutes, visit_minutes_client, visit_minutes_orphan, max_daily_buffer_minutes)
  values ('a0000000-0000-4000-8000-00000000000a', '08:30', '18:00', 30, 30, 20, 90)
on conflict (agent_id) do update set work_start = excluded.work_start, work_end = excluded.work_end;

-- Customers of A in Milano (inside polygon). 1..6 clients, 7 prospect, 8 disabled, 9 outside polygon (Pavia coords), 10 project out of zone.
insert into public.customers (id, agent_id, business_name, category, city, province, address, postal_code, latitude, longitude,
  contact_name, contact_surname, customer_type, first_visit_date, last_visit_date, fiscal_code, vat_number, notes, project_type)
select ('11111111-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'a0000000-0000-4000-8000-00000000000a', 'Tabacchi Sintetico MI ' || i,
  case when i = 7 then 'prospect' else 'client' end, 'Milano', 'MI', 'Via Sintetica ' || i, '20100',
  case when i = 9 then 45.18 else 45.44 + (i % 6) * 0.012 end, case when i = 9 then 9.16 else 9.16 + (i / 6) * 0.02 + (i % 3) * 0.003 end,
  'Nome', 'Cognome', 'tabaccheria', now() - interval '200 days', now() - interval '40 days', 'SNTCFA' || lpad(i::text, 10, '0'),
  'IT' || lpad((90000000000 + i)::text, 11, '0'), '', case when i = 10 then 'laservideo' else 'nessun_progetto' end
from generate_series(1, 10) i
on conflict (id) do nothing;
update public.customers set disabled = true where id = '11111111-0000-4000-8000-000000000008';
update public.customers set latitude = 45.19, longitude = 9.17 where id = '11111111-0000-4000-8000-000000000010';

-- Customers of B in Monza.
insert into public.customers (id, agent_id, business_name, category, city, province, address, postal_code, latitude, longitude,
  contact_name, contact_surname, customer_type, first_visit_date, last_visit_date, fiscal_code, vat_number, notes)
select ('22222222-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'b0000000-0000-4000-8000-00000000000b', 'Tabacchi Sintetico MB ' || i,
  'client', 'Monza', 'MB', 'Via Sintetica MB ' || i, '20900', 45.58 + i * 0.003, 9.27,
  'Nome', 'Cognome', 'tabaccheria', now() - interval '200 days', now() - interval '20 days', 'SNTCFB' || lpad(i::text, 10, '0'),
  'IT' || lpad((91000000000 + i)::text, 11, '0'), ''
from generate_series(1, 3) i
on conflict (id) do nothing;

-- Registry (tabaccherie) in Milano: 1..3 free never visited inside A polygon; 4 linked to A customer 1; 5 assigned to B (foreign);
-- 6 closed; 7 unusable gps; 8 free but outside A polygon (Monza coords, inside B polygon).
insert into public.tabaccherie (id, codice_rivendita, denominazione, indirizzo, comune, provincia, gps_lat, gps_lng, stato_visita, chiusa, customer_id, agente_id)
values
  ('33333333-0000-4000-8000-000000000001', 'MI0001', 'Registro MI 1 (SINTETICO)', 'Via R1', 'Milano', 'MI', '45.45', '9.17', 'non_visitato', false, null, null),
  ('33333333-0000-4000-8000-000000000002', 'MI0002', 'Registro MI 2 (SINTETICO)', 'Via R2', 'Milano', 'MI', '45.46', '9.185', 'non_visitato', false, null, null),
  ('33333333-0000-4000-8000-000000000003', 'MI0003', 'Registro MI 3 (SINTETICO)', 'Via R3', 'MILANO', 'MI', '45.47', '9.20', null, false, null, null),
  ('33333333-0000-4000-8000-000000000004', 'MI0004', 'Registro collegato (SINTETICO)', 'Via R4', 'Milano', 'MI', '45.46', '9.19', 'visitato', false, '11111111-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a'),
  ('33333333-0000-4000-8000-000000000005', 'MI0005', 'Registro di B (SINTETICO)', 'Via R5', 'Milano', 'MI', '45.455', '9.175', 'non_visitato', false, null, 'b0000000-0000-4000-8000-00000000000b'),
  ('33333333-0000-4000-8000-000000000006', 'MI0006', 'Registro chiuso (SINTETICO)', 'Via R6', 'Milano', 'MI', '45.46', '9.20', 'non_visitato', true, null, null),
  ('33333333-0000-4000-8000-000000000007', 'MI0007', 'Registro gps vuoto (SINTETICO)', 'Via R7', 'Milano', 'MI', '', '', 'non_visitato', false, null, null),
  ('33333333-0000-4000-8000-000000000008', 'MB0008', 'Registro Monza (SINTETICO)', 'Via R8', 'Monza', 'MB', '45.60', '9.27', 'non_visitato', false, null, null)
on conflict (id) do nothing;

-- Orders (real triggers: order number, last_order_date, prospect conversion guard).
insert into public.orders (id, customer_id, agent_id, order_number, order_date, status, total_amount)
values
  ('44444444-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'SINT-0001', now() - interval '45 days', 'delivered', 100),
  ('44444444-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', 'SINT-0002', now() - interval '10 days', 'delivered', 80),
  ('44444444-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a', 'SINT-0003', now() - interval '3 days', 'cancelled', 50)
on conflict (id) do nothing;

-- Agenda of A: one overdue follow-up, one first visit tomorrow; agenda of B: one appointment.
insert into public.appointments (id, agent_id, created_by_id, customer_id, appointment_date, appointment_type, status, duration_minutes) values
  ('55555555-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000004', (current_date - 5)::timestamptz + interval '10 hours', 'follow_up', 'scheduled', 30),
  ('55555555-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000005', (current_date + 1)::timestamptz + interval '9 hours', 'first_visit', 'scheduled', 30),
  ('55555555-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', '22222222-0000-4000-8000-000000000001', (current_date + 1)::timestamptz + interval '12 hours', 'first_visit', 'scheduled', 30)
on conflict (id) do nothing;
commit;
