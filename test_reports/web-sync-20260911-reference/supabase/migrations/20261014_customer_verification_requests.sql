-- AI Tour: segnalazioni anomalie cliente (GPS errato, chiuso, trasferito, altro)

alter table public.customers add column if not exists disabled boolean not null default false;

create table if not exists public.customer_verification_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  reported_by_agent_id uuid not null references public.profiles(id) on delete cascade,
  reported_at timestamptz not null default now(),
  anomaly_type text not null check (anomaly_type in ('geolocation','closed','moved','other')),
  notes text,
  agent_gps_lat numeric,
  agent_gps_lng numeric,
  customer_gps_lat numeric,
  customer_gps_lng numeric,
  distance_km numeric,
  status text not null default 'pending' check (status in ('pending','verified_ok','updated','disabled')),
  verified_at timestamptz,
  verified_by_user_id uuid references public.profiles(id) on delete set null,
  verification_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cvr_customer_idx on public.customer_verification_requests (customer_id);
create index if not exists cvr_agent_idx on public.customer_verification_requests (reported_by_agent_id);
create index if not exists cvr_status_reported_idx on public.customer_verification_requests (status, reported_at desc);

drop trigger if exists cvr_set_updated_at on public.customer_verification_requests;
create trigger cvr_set_updated_at
  before update on public.customer_verification_requests
  for each row execute function public.update_updated_at_column();

alter table public.customer_verification_requests enable row level security;

drop policy if exists cvr_agent_insert on public.customer_verification_requests;
create policy cvr_agent_insert on public.customer_verification_requests
  for insert to authenticated
  with check (reported_by_agent_id = (select auth.uid()));

drop policy if exists cvr_select_own_or_admin on public.customer_verification_requests;
create policy cvr_select_own_or_admin on public.customer_verification_requests
  for select to authenticated
  using (
    reported_by_agent_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

drop policy if exists cvr_admin_update on public.customer_verification_requests;
create policy cvr_admin_update on public.customer_verification_requests
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

drop policy if exists cvr_admin_delete on public.customer_verification_requests;
create policy cvr_admin_delete on public.customer_verification_requests
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );
