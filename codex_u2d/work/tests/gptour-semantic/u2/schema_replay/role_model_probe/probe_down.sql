-- Removes every object of the role-model probe (lab only).
begin;
drop function if exists public.u2_role_probe_internal(uuid,uuid,text,text,jsonb);
drop function if exists public.u2_role_probe_read(uuid,uuid,text);
drop function if exists public.u2_role_probe_is_authorized(uuid,uuid);
drop function if exists public.u2_role_probe_is_authorized_ownerrole(uuid,uuid);
drop schema if exists u2_role_probe cascade;
revoke all on public.profiles, public.gptour_orchestrator_user_access from gptour_semantic_owner;
alter default privileges in schema public grant all on tables to gptour_semantic_backend, gptour_semantic_owner;
alter default privileges in schema public grant all on functions to gptour_semantic_backend, gptour_semantic_owner;
revoke all on schema public from gptour_semantic_owner, gptour_semantic_backend;
revoke gptour_semantic_backend from authenticator;
drop owned by u2_probe_writer; drop role if exists u2_probe_writer;
drop owned by gptour_semantic_backend; drop role if exists gptour_semantic_backend;
drop owned by gptour_semantic_owner; drop role if exists gptour_semantic_owner;
commit;
notify pgrst, 'reload schema';
