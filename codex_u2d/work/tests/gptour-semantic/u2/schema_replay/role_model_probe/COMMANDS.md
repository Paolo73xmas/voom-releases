# Comandi della prova del modello dei ruoli (laboratorio locale, credenziali sintetiche)

Prerequisito: laboratorio replay avviato (`replay_up.sh`, vedi `docs/gptour-semantic/U2_0_SCHEMA_REPLAY_REPORT.md` §8).

```bash
export U2_PG_BIN=/usr/lib/postgresql/15/bin U2_PG_OS_USER=postgres U2_REPLAY_ROOT=/tmp/voom-u2-replay
# applica probe.sql → esegue probe_verify.py (85 controlli, report in $U2_REPLAY_ROOT/role_probe_report.json) → rimuove con probe_down.sql
bash tests/gptour-semantic/u2/schema_replay/role_model_probe/probe_run.sh
# per ispezionare gli oggetti senza rimuoverli: U2_PROBE_KEEP=1 … ; poi psql -f probe_down.sql
# verifica rimozione (eseguita dopo probe_down.sql; output in evidence/role_probe_removal_verification.txt)
PORT=$(python3 -c "import json;print(json.load(open('$U2_REPLAY_ROOT/lab.json'))['pg_port'])")
runuser -u postgres -- $U2_PG_BIN/psql -X -h $U2_REPLAY_ROOT/socket -p $PORT -d u2_replay -Atc \
 "select count(*) from pg_roles where rolname in ('gptour_semantic_owner','gptour_semantic_backend','u2_probe_writer')"   # atteso 0
bash tests/gptour-semantic/u2/schema_replay/replay_verify.sh    # atteso 111/111 dopo la rimozione
```

File: `probe.sql` (ruoli, schema di sonda, trigger write-once, assert_backend_caller, helper A/B, RPC interna e proiezione, grant/revoke), `probe_verify.py` (sezioni R1–R8), `probe_down.sql`, `probe_run.sh`; dipendenze `../replay_verify_lib.py`, `../replay_common.py`, `../../lab_common.py`.
