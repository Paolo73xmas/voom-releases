# Test AI Tour

Eseguire dalla root `voom-repo`. Non usare plain `tsx` per le suite che importano moduli Vite: questi leggono `import.meta.env` e richiedono il bundle test.

```sh
for test in brief_journey planner_journey_order brief_saved_places match_brief_customers brief_area_select planner_mandatory journey_localities brief_development; do
  ./node_modules/.bin/esbuild tests/aitour/${test}.unit.ts \
    --bundle --platform=node --format=cjs \
    --alias:@/lib/supabase/client=./tests/aitour/fixtures/supabase-client.stub.ts \
    --alias:@=./src \
    --define:import.meta.env='{"VITE_SUPABASE_URL":"https://example.invalid","VITE_SUPABASE_ANON_KEY":"test-only"}' \
    --outfile=/tmp/${test}.cjs && \
  node --import ./tests/aitour/ws-preload.mjs /tmp/${test}.cjs || exit 1
done
```

**MOCKED solo nei test unitari**: Supabase e OSRM. URL e chiave nel comando sono fixture non operative. Non usare credenziali reali per queste suite. Nessuna API dell'app è simulata.

I test browser/API reali devono essere read-only sul Supabase produttivo: non salvare/avviare tour e non cambiare impostazioni, clienti, credenziali o costi. Credenziali test autorizzate in `/app/memory/test_credentials.md`, mai nei report.