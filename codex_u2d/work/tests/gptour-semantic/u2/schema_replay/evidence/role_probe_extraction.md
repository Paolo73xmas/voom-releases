# Estrazione leggibile — appartenenze ai ruoli (pg_auth_members) durante la sonda

Lettura: il MEMBRO possiede i privilegi del RUOLO CONCESSO. `authenticator` (ruolo di login di PostgREST) è membro di anon/authenticated/service_role (appartenenze legacy hosted, non modificate) e del nuovo `gptour_semantic_backend`; nessun ruolo è membro di `authenticator`; `gptour_semantic_owner` e `u2_probe_writer` non hanno membri.

| ruolo_concesso | membro | admin_option |
|---|---|---|
| anon | authenticator | false |
| authenticated | authenticator | false |
| gptour_semantic_backend | authenticator | false |
| service_role | authenticator | false |

# Helper privilegiato (variante adottata) — `public.u2_role_probe_is_authorized(uuid, uuid)`

- proprietario: `postgres` (ruolo migratore, proprietario di profiles/user_access)
- SECURITY DEFINER: true
- proconfig: `search_path=""`
- argomenti: `p_uid uuid, p_agent_id uuid`; ritorno: `boolean`
- ACL (proacl): `postgres=X/postgres;gptour_semantic_owner=X/postgres` → EXECUTE solo postgres (proprietario) e gptour_semantic_owner; nessun PUBLIC/anon/authenticated/service_role/backend

```sql
CREATE OR REPLACE FUNCTION public.u2_role_probe_is_authorized(p_uid uuid, p_agent_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = p_uid and p.is_active and p.role in ('agent','admin','admincustom','supervisor')
      and (p_agent_id = p_uid or p.role in ('admin','admincustom'))
  ) and coalesce((select a.enabled from public.gptour_orchestrator_user_access a where a.user_id = p_uid), false)
$function$
```

# Variante respinta — `public.u2_role_probe_is_authorized_ownerrole(uuid, uuid)` (owner = gptour_semantic_owner, soli grant di colonna → RLS applicata → false)

- proprietario: `gptour_semantic_owner`; ACL: `gptour_semantic_owner=X/gptour_semantic_owner`; proconfig: `search_path=""`

# Allowlist jti

- tabella `u2_role_probe.backend_keys`: owner|ACL = `gptour_semantic_owner|gptour_semantic_owner=arwdDxt/gptour_semantic_owner` (nessun grant a backend/authenticated)
- gestione: solo il ruolo migratore/DBA tramite migration o runbook operativo; nessuna RPC backend scrive la allowlist
- prove negative: INSERT/UPDATE del backend → permission denied; via PostgREST → schema non esposto; nessuna funzione della sonda scrive la allowlist.
