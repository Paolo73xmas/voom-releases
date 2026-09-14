# Regole ordine Italia/Estero — fonte verificata

Utente: «le categorie valide per l'estero sono solo Cassiopea 3% e Contanti».
Screenshot: gestionale `https://crm.voomweb.it/orders`, tab Pagamenti.

## Distinzione verificata in sola lettura
- `payment_methods`: CONTANTI, attivo. Il nome Contanti al Corriere è un altro metodo e NON è ammesso per Estero.
- `shipping_methods`: Cassiopea 3%, attivo, `foreign_only=true`; non è un pagamento e il suo ID non va mai salvato in `payment_method_id`.
- La tab pagamenti del web non espone campi territoriali. Nessuna migrazione o modifica DB necessaria.
- Applicazione: Estero -> pagamentoContanti + spedizioneCassiopea3%; Italia -> tutti i pagamenti attivi + spedizioni nazionali/ritiro. Non si costruiscono metodi fittizi se uno dei due manca o è disattivato.

## Costi: parità con codice pubblico del gestionale
Fonte letta: `https://crm.voomweb.it/assets/shipping-methods-BN61bpl1.js`, funzione esportata `a`.
```text
se cost_type=fixed: cost
se valore <= threshold_min: min_cost
altrimenti se threshold_max <= 0 o valore <= threshold_max: valore * cost_percentage / 100
altrimenti: threshold_max * cost_percentage / 100
```
Base da OrderCollection web: somma quantità × (prezzo unitario carrello + accisa effettiva), con accisa zero per prefisso EST-, prima dell'IVA e degli sconti riepilogo.
Configurazione Cassiopea effettiva: 3%, min_cost10, threshold_min300, threshold_max2000.
Esempi di parità: 300=>10;301=>9.03;1000=>30;2000=>60;3000=>60. **Non reinterpretare min_cost come clamp universale**: la funzione web applica il minimo solo sotto la prima soglia. Soglie e impostazioni non modificate.
La stessa logica viene usata in scelta spedizione, riepilogo, bozza, PDF e importo invio; gli ordini storici non vengono ricalcolati o riscritti.

## Protezioni
- Liste filtrate immediatamente, senza attendere reload shipping al toggle.
- Cambio flag/ripristino bozza: scelte non valide azzerate, avviso e ritorno al primo step da completare.
- Avanti/invio richiedono ID presenti nelle liste ammesse; autosave e PDF non usano ID nascosti/incompatibili.
- Nessun salvataggio operativo necessario per i test. Fixture solo nei browser di verifica.