-- Tabaccherie del registro segnalate come chiuse: escluse dai giri AI Tour

alter table public.tabaccherie add column if not exists chiusa boolean not null default false;
alter table public.tabaccherie add column if not exists chiusa_at timestamptz;

create or replace function public.ai_tour_free_tabaccherie(
  p_min_lat double precision,
  p_max_lat double precision,
  p_min_lng double precision,
  p_max_lng double precision,
  p_limit integer DEFAULT 60,
  p_provincia text DEFAULT NULL::text,
  p_comune text DEFAULT NULL::text,
  p_ref_lat double precision DEFAULT NULL::double precision,
  p_ref_lng double precision DEFAULT NULL::double precision,
  p_agent_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(id uuid, denominazione text, codice_rivendita text, indirizzo text, comune text, provincia text, lat double precision, lng double precision, assigned boolean)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    t.id,
    t.denominazione::text,
    t.codice_rivendita::text,
    t.indirizzo::text,
    t.comune::text,
    t.provincia::text,
    t.gps_lat::float8 AS lat,
    t.gps_lng::float8 AS lng,
    (t.agente_id IS NOT NULL OR t.agente_assegnato_id IS NOT NULL) AS assigned
  FROM public.tabaccherie t
  WHERE (
      (t.agente_id IS NULL AND t.agente_assegnato_id IS NULL)
      OR (
        p_agent_id IS NOT NULL
        AND (t.agente_id = p_agent_id OR t.agente_assegnato_id = p_agent_id)
        AND COALESCE(t.stato_visita, 'non_visitato') = 'non_visitato'
      )
    )
    AND COALESCE(t.chiusa, false) = false
    AND t.customer_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.tabaccheria_id = t.id)
    AND COALESCE(NULLIF(btrim(t.partita_iva), ''), '~') NOT IN (
      SELECT btrim(c2.vat_number) FROM public.customers c2
      WHERE c2.vat_number IS NOT NULL AND btrim(c2.vat_number) <> ''
    )
    AND COALESCE(NULLIF(btrim(t.cf_iva), ''), '~') NOT IN (
      SELECT btrim(c2.vat_number) FROM public.customers c2
      WHERE c2.vat_number IS NOT NULL AND btrim(c2.vat_number) <> ''
    )
    AND t.gps_lat ~ '^-?[0-9]+(\.[0-9]+)?$'
    AND t.gps_lng ~ '^-?[0-9]+(\.[0-9]+)?$'
    AND t.gps_lat::float8 BETWEEN p_min_lat AND p_max_lat
    AND t.gps_lng::float8 BETWEEN p_min_lng AND p_max_lng
    AND (p_provincia IS NULL OR upper(trim(t.provincia)) = upper(trim(p_provincia)))
    AND (p_comune IS NULL OR lower(trim(t.comune)) = lower(trim(p_comune)))
  ORDER BY
    CASE WHEN t.agente_id IS NOT NULL OR t.agente_assegnato_id IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN p_ref_lat IS NOT NULL AND p_ref_lng IS NOT NULL
      THEN (t.gps_lat::float8 - p_ref_lat)^2 + (t.gps_lng::float8 - p_ref_lng)^2
      ELSE 0 END
  LIMIT p_limit;
$function$;
