-- PROPOSAL ONLY. NOT APPLIED. Requires explicit shared-schema approval.
-- No production client currently calls this function. Legacy save_tours_batch unchanged.
-- Test in an isolated PostgreSQL/Supabase environment before approval/application.
BEGIN;

CREATE TABLE IF NOT EXISTS public.gptour_save_requests (
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  request_id uuid NOT NULL,
  payload_fingerprint text NOT NULL,
  tour_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, request_id)
);
ALTER TABLE public.gptour_save_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gptour_save_requests FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.gptour_save_requests TO authenticated;
-- The caller sees only their own request ledger; tour/stop RLS still governs the nested batch.
CREATE POLICY gptour_request_actor ON public.gptour_save_requests
  FOR ALL TO authenticated USING (actor_id = (SELECT auth.uid()))
  WITH CHECK (actor_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.save_gptour_batch(p_request_id uuid, p_tours jsonb)
RETURNS uuid[] LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  actor_role text;
  fingerprint text;
  existing public.gptour_save_requests%ROWTYPE;
  result_ids uuid[];
  entry jsonb;
BEGIN
  IF actor IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'Sessione o request_id assente'; END IF;
  SELECT p.role::text INTO actor_role FROM public.profiles p WHERE p.id = actor;
  IF actor_role IS NULL OR actor_role NOT IN ('agent', 'agentcustom', 'admin', 'admincustom') THEN
    RAISE EXCEPTION 'Ruolo non abilitato' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_tours) IS DISTINCT FROM 'array' OR jsonb_array_length(p_tours) = 0 THEN
    RAISE EXCEPTION 'Batch vuoto o non valido';
  END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_tours) LOOP
    IF actor_role IN ('agent', 'agentcustom') AND (entry->'tour'->>'agent_id')::uuid IS DISTINCT FROM actor THEN
      RAISE EXCEPTION 'Agente non autorizzato' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  fingerprint := encode(sha256(convert_to(p_tours::text, 'UTF8')), 'hex');
  INSERT INTO public.gptour_save_requests(actor_id, request_id, payload_fingerprint)
    VALUES(actor, p_request_id, fingerprint) ON CONFLICT DO NOTHING;
  -- A concurrent identical request waits here / at the INSERT until the first transaction completes.
  SELECT * INTO existing FROM public.gptour_save_requests
    WHERE actor_id = actor AND request_id = p_request_id FOR UPDATE;
  IF existing.payload_fingerprint <> fingerprint THEN RAISE EXCEPTION 'Request ID riusato con un payload diverso'; END IF;
  IF cardinality(existing.tour_ids) > 0 THEN RETURN existing.tour_ids; END IF;

  result_ids := public.save_tours_batch(p_tours);
  IF cardinality(result_ids) IS DISTINCT FROM jsonb_array_length(p_tours) THEN
    RAISE EXCEPTION 'Batch incompleto';
  END IF;
  UPDATE public.gptour_save_requests SET tour_ids = result_ids
    WHERE actor_id = actor AND request_id = p_request_id;
  RETURN result_ids;
  -- Any exception rolls back ledger, headers, stops and events together.
END;
$$;
REVOKE ALL ON FUNCTION public.save_gptour_batch(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_gptour_batch(uuid, jsonb) TO authenticated;
COMMIT;

-- REVIEW REQUIREMENTS (not executable tests):
-- 1. Concurrent identical calls return same IDs; different fingerprint rejected.
-- 2. Failure on day N leaves no tour headers/stops/events/ledger row.
-- 3. Preserve is_follow_up in the actually installed save_tours_batch implementation.
-- 4. No role escalation / cross-agent access under actual RLS.
-- 5. Define retention/deletion policy before approving a production rollout.
-- NOTE: with SECURITY INVOKER callers have direct ledger writes under their own RLS.
-- This cannot expose other actors' data, but tamper-resistance of caller-owned receipts
-- needs explicit review before claiming server-attested save receipts.