# Consegna tutorial AI Tour — Salvatore Pirone

## Verificato
- File MP4: 47.832.021 byte, 26:16.36, 1920×1080, 25fps, H.264/AAC.
- SHA256: `ad2113f6f00d15af95ce0a9d68cd0d4b083f93c1ba9cbdfa766c52528516fd5c`.
- Decode completo audio e video: PASS. 48 scene, 8 capitoli, 272 sottotitoli ordinati; pipeline originale con timeline campioni/frame coerente.
- 13 test HTTP reali PASS: video inline/download, integrità byte, SRT/copione, HEAD, range iniziale/intermedio/aperto/suffix,416,If-Range,multi-range ignorato,404.
- QA audiovisiva finale: nessun difetto rilevante segnalato, focus conferma zona06:06–10:50,calendario16:45–21:15,verifica21:15–25:00. Non è una certificazione di sincronizzazione percettiva perfetta di ogni frame.
- Sola lettura. Nessun dato operativo modificato; esempi agenda/verifiche marcati non salvati. Voce sintetica italiana DiegoNeural; account dimostrato Salvatore Pirone, non narratore personale.

## Correzione
La versione installata Starlette0.37.2 ignora Range su FileResponse. Nuovo helper `backend/media_response.py` applicato solo alla nuova guida: GET/HEAD,206/416,ripresa,download. Risolto Content-Length duplicato tramite aggiornamento delle chiavi lowercase. Nessuna modifica frontend,auth,DB,env,dipendenze,vecchi video.

## Limiti
Il browser automatico non ha completato loadedmetadata/seek; RCA indica supporto codec limitato. Download e decode verificati indipendentemente. Riproduzione Safari/iPhone/Android e approvazione qualità da parte dell'utente ancora da confermare. Nessuna persistenza esterna dei media certificata.

## Risorse
Base: `EXPO_PUBLIC_BACKEND_URL` corrente dal frontend/.env.
- `/api/manual/aitour-guida-pirone/video` (inline).
- `/api/manual/aitour-guida-pirone/video?download=true` (scarica MP4).
- `/api/manual/aitour-guida-pirone/sottotitoli` (SRT).
- `/api/manual/aitour-guida-pirone/copione` (Markdown con indice capitoli).

Riferimenti: `iteration_35.json`, `pytest/pytest_results_iteration_35.xml`, `artifacts_iter35/media_validation_iter35.json`, `manual/video/pirone2026/qa_report.json`.