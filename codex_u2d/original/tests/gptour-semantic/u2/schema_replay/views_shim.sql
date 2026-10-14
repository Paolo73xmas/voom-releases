-- LOCAL SHIM (declared): hosted views/platform objects whose definitions are not versioned in the repository.
-- `categories` column set taken from the Views section of src/lib/supabase/database.types.ts (hosted view over product_categories).
begin;
create or replace view public.categories as
  select created_at, description, id, is_active, name, parent_id, updated_at from public.product_categories;
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
commit;
