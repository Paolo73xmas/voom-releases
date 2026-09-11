-- Segnalazioni anche per tappe senza scheda cliente (tabaccherie di registro / orfani)

alter table public.customer_verification_requests
  alter column customer_id drop not null;

alter table public.customer_verification_requests
  add column if not exists tabaccheria_id uuid references public.tabaccherie(id) on delete set null;

alter table public.customer_verification_requests
  add column if not exists subject_name text;

alter table public.customer_verification_requests
  drop constraint if exists cvr_subject_present;

alter table public.customer_verification_requests
  add constraint cvr_subject_present check (
    customer_id is not null or tabaccheria_id is not null or subject_name is not null
  );

create index if not exists cvr_tabaccheria_idx on public.customer_verification_requests (tabaccheria_id);
