-- Read-only introspection. Does NOT execute save_tours_batch or write CRM rows.
SELECT jsonb_build_object(
  'checked_at', now(),
  'function_identity', to_regprocedure('public.save_tours_batch(jsonb)')::text,
  'definition', pg_get_functiondef(to_regprocedure('public.save_tours_batch(jsonb)')),
  'column_metadata', (
    SELECT jsonb_agg(jsonb_build_object(
      'column_name', c.column_name, 'data_type', c.data_type,
      'is_nullable', c.is_nullable, 'column_default', c.column_default
    )) FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'ai_tour_stops'
      AND c.column_name = 'is_follow_up'
  ),
  'stop_triggers', (
    SELECT jsonb_agg(jsonb_build_object(
      'name', t.tgname, 'definition', pg_get_triggerdef(t.oid),
      'function_definition', pg_get_functiondef(t.tgfoid)
    )) FROM pg_trigger t
    WHERE t.tgrelid = to_regclass('public.ai_tour_stops') AND NOT t.tgisinternal
  )
) AS inspection;