"""Contratto interprete AI Tour mobile, allineato al web 22cb583 (4.1)."""
import re

CAPABILITY = "ordered_journey_v1"
BRIEF_V41_RULES = """
AGGIORNAMENTO CONTRATTO 4.1: queste regole PREVALGONO sulle precedenti in caso di conflitto.
Conserva version:"4.0" e tutti i campi esistenti. Aggiungi SEMPRE:
"journey":null oppure {"stages":[{"name":"località come dettata","direction":"N"|"NE"|"E"|"SE"|"S"|"SW"|"W"|"NW"|null,"radiusKm":null}],"corridorKm":null},
"includeAutomatic":true|false,
in route "startPlace":null e "endPlace":null oppure {"kind":"home"|"office"|"address"|"customer","rawReference":"riferimento originale","cityHint":null},
in ogni mandatoryStop "priority":1|2|3 (default 2).
CLIENTI: tutti i clienti nominati da visitare sono obbligatori anche senza 'obbligatorio'. 'domani visito Rossi e Bianchi' = due mandatoryStops, includeAutomatic false, target unspecified. SOLO 'se riesci/magari/preferirei' crea preferredStops. Conserva nome e cityHint separato, MAI ID o coordinate. Priorità 1=alta/assoluta/prima, 2=normale, 3=bassa/per ultimo. La priorità non rende facoltativa la visita e non annulla appuntamenti. 'Prima Rossi poi Bianchi' priorità 1/2, NON journey.
AUTOMATICI: includeAutomatic false se elenca soltanto clienti, true se chiede altri clienti o un segmento. 'Rossi e altri 3' target exact 3 automatic_plus_mandatory. '10 clienti compresi Rossi e Bianchi' exact 10 total_including_mandatory. 'due clienti Rossi Bianchi Verdi' conserva tutti e tre + exact 2 + warning: UI chiederà correzione. Non inventare quantità contando i nomi.
LUOGHI: 'parto da Milano e finisco a Brescia' -> startPlace address Milano e endPlace address Brescia, NON aree e NON journey. 'parto da casa' -> home; 'dalla sede' -> office; indirizzo conserva civico/comune. 'finisco da Tabacchi Rossi' -> endPlace customer, NON visita se non richiesta. 'torno a casa' -> returnHome true e endPlace home; 'al punto di partenza' -> returnToStart true, endPlace null. Nessun luogo espresso -> null. Non usare mai GPS per una partenza esplicita. Casa/Sede vengono risolte dalle impostazioni, MAI inventare coordinate.
AREE: 'Brescia e provincia' è UN vincolo province BS, non raggio o solo city. Sigle ufficiali per province note. cities[] è un aiuto NON autorizza a cambiare un nome esplicitamente dettato. CityHint e start/endPlace NON sono filtri territoriali.
PERCORSI ORDINATI: direzioni relative a città -> journey anche con una zona. Sud-ovest/sudovest=SW, nordest=NE. 'clienti area sud di Milano poi Rozzano poi Pavia' -> journey stages Milano/S, Rozzano/null, Pavia/null, selection clients_all, includeAutomatic true, areas [], nessun start/endPlace se non espresso. NON duplicare le località in areas (eliminerebbe clienti lungo i corridoi stradali). Corridoi e raggi solo se detti, altrimenti null. Unione non ordinata 'clienti Milano e Pavia' -> areas, journey null. 'parto da casa, clienti sudovest Milano poi Rozzano e Pavia, torno a casa' -> journey più home start/end. Il ritorno a casa non annulla journey. Salvo arrivo esplicito, la UI propone l'ultima zona come arrivo finale.
DETTATURA: conserva nomi delle località anche se sospetti errore. 'sud di Milano poi Lozano e Pavia' -> Milano/S, Lozano, Pavia NON Rozzano. UI suggerisce correzioni verificate, con consenso. Non aggiungere gli stessi nomi a unresolvedEntities se già in uno stage: saranno risolti nella riga. Mai geometrie, coordinate, confirmedKey, preview o distanze inventate. Max 8 zone: oltre segnala unresolvedEntities.
SVILUPPO: 'zona sud di Foggia in modalità sviluppo' -> dayType sviluppo, includeAutomatic true, journey Foggia/S, selection OR prospects+orphans NON clients_all. 'solo orfani' -> solo orphans; 'solo nuovi' -> prospects. Non inventare tabaccherie.
CONFLITTI: obbligatori fuori zona restano espliciti, ma NON autorizzare l'eccezione: UI chiede includi/escludi. Non eliminare clienti o cambiare ordine per nascondere problemi di orari, priorità o appuntamenti. Le priorità non autorizzano violazioni silenziose. Preserva ulteriori esclusioni territoriali in areas.
"""


def validate_brief_contract(brief):
    if not isinstance(brief, dict):
        raise ValueError("Risposta AI non valida")
    required = {"version", "requestedDate", "selection", "mandatoryStops", "preferredStops",
                "visitTarget", "route", "areas", "interpretation", "includeAutomatic", "journey"}
    if not required.issubset(brief) or not isinstance(brief["route"], dict):
        raise ValueError("Risposta AI incompleta. Riprova l'interpretazione")
    if not {"startPlace", "endPlace"}.issubset(brief["route"]):
        raise ValueError("Luoghi di partenza e arrivo non verificabili: riprova")
    if not isinstance(brief["includeAutomatic"], bool):
        raise ValueError("Selezione automatica non verificabile")
    for field in ["areas", "mandatoryStops", "preferredStops"]:
        if not isinstance(brief[field], list):
            raise ValueError("Risposta AI non valida")
    times = [brief["route"].get(k) for k in ["startTime", "endTime", "finishBy"]]
    for stop in brief["mandatoryStops"]:
        appt = stop.get("appointment") if isinstance(stop, dict) else None
        if isinstance(appt, dict):
            times.extend(appt.get(k) for k in ["time", "from", "to"])
    if any(t is not None and (not isinstance(t, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", t)) for t in times):
        raise ValueError("Orari non validi: indica la fascia in formato HH:MM")
    return brief