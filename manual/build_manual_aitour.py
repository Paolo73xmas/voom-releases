"""
Genera il Manuale operativo AI Tour (app mobile) per l'agente, con gli screenshot in img/ai*.png.
Output: /app/manual/manuale-ai-tour-agente-mobile.pdf
"""
import base64
import os
from datetime import date
from playwright.sync_api import sync_playwright

IMG = "/app/manual/img"
OUT = "/app/manual/manuale-ai-tour-agente-mobile.pdf"
HTML_OUT = "/app/manual/manuale-aitour.html"


def b64(name):
    path = os.path.join(IMG, f"{name}.png")
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()


def fig(name, caption, w="58mm"):
    src = b64(name)
    if not src:
        return ""
    return f'''<figure><img style="width:{w}" src="{src}" alt="{caption}"/><figcaption>{caption}</figcaption></figure>'''


def figrow(*figs):
    return f'<div class="figrow">{"".join(figs)}</div>'


today = date.today().strftime("%d/%m/%Y")

html = f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<style>
  @page {{ size: A4; margin: 15mm 13mm 17mm 13mm; }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1C1C1E; font-size: 11.5px; line-height: 1.6; }}

  /* Copertina */
  .cover {{ height: 250mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; }}
  .cover .logo {{ font-size: 50px; font-weight: 800; color: #C2410C; letter-spacing: -1.5px; }}
  .cover .logo small {{ font-weight: 400; color: #8E8E93; font-size: 22px; }}
  .cover h1 {{ font-size: 34px; margin-top: 22px; color: #6D28D9; }}
  .cover h1 .spark {{ color: #7C3AED; }}
  .cover .sub {{ font-size: 15px; color: #48484A; margin-top: 10px; max-width: 130mm; }}
  .cover .box {{ margin-top: 26px; background: #F5F3FF; border: 1.5px solid #DDD6FE; color: #4C1D95; border-radius: 14px; padding: 14px 24px; font-size: 12.5px; max-width: 135mm; line-height: 1.6; }}
  .cover .badge {{ margin-top: 26px; background: #F3E8FF; border: 1.5px solid #DDD6FE; color: #6D28D9; border-radius: 999px; padding: 8px 22px; font-weight: 700; font-size: 12.5px; }}
  .cover .foot {{ margin-top: 46px; color: #8E8E93; font-size: 11px; }}

  /* Indice */
  .toc {{ page-break-after: always; }}
  .toc h2 {{ font-size: 22px; color: #6D28D9; margin-bottom: 14px; }}
  .toc ol {{ margin-left: 20px; font-size: 13px; }}
  .toc li {{ padding: 4px 0; }}

  h2.chapter {{ font-size: 19px; color: #FFFFFF; background: #6D28D9; padding: 10px 14px; border-radius: 10px; margin: 0 0 12px 0; page-break-before: always; }}
  h3 {{ font-size: 13.5px; color: #6D28D9; margin: 13px 0 5px 0; }}
  p {{ margin-bottom: 7px; }}
  ul, ol {{ margin: 4px 0 10px 20px; }}
  li {{ margin-bottom: 3px; }}
  strong {{ color: #1C1C1E; }}

  .tip {{ background: #F5F3FF; border-left: 4px solid #7C3AED; border-radius: 6px; padding: 8px 12px; margin: 10px 0; font-size: 11px; color: #4C1D95; page-break-inside: avoid; }}
  .info {{ background: #EFF6FF; border-left: 4px solid #3B82F6; border-radius: 6px; padding: 8px 12px; margin: 10px 0; font-size: 11px; color: #1E3A8A; page-break-inside: avoid; }}
  .warn {{ background: #FFFBEB; border-left: 4px solid #D97706; border-radius: 6px; padding: 8px 12px; margin: 10px 0; font-size: 11px; color: #92400E; page-break-inside: avoid; }}

  figure {{ display: inline-block; text-align: center; margin: 8px 7px 12px 7px; page-break-inside: avoid; vertical-align: top; }}
  figure img {{ border: 1px solid #E5E5EA; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.10); }}
  figcaption {{ font-size: 9.5px; color: #8E8E93; margin-top: 4px; max-width: 62mm; margin-left:auto; margin-right:auto; }}
  .figrow {{ text-align: center; }}

  table.legend {{ border-collapse: collapse; margin: 8px 0 12px 0; font-size: 10.8px; width: 100%; page-break-inside: avoid; }}
  table.legend th {{ background: #F5F3FF; color: #4C1D95; text-align: left; border: 1px solid #E5E5EA; padding: 5px 9px; }}
  table.legend td {{ border: 1px solid #E5E5EA; padding: 5px 9px; vertical-align: top; }}
  .dot {{ display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }}

  .steps li {{ margin-bottom: 6px; }}
  .footer-note {{ margin-top: 24px; font-size: 9.5px; color: #8E8E93; border-top: 1px solid #E5E5EA; padding-top: 8px; }}
</style>
</head>
<body>

<!-- ═══════════ COPERTINA ═══════════ -->
<div class="cover">
  <div class="logo">VOOM <small>crm · APP MOBILE</small></div>
  <h1><span class="spark">✦</span> AI Tour</h1>
  <div class="sub">Manuale operativo per l'agente — flussi, logica e apprendimento dell'AI</div>
  <div class="box">AI Tour è il tuo assistente commerciale sull'app: analizza ogni giorno il portafoglio, decide chi conviene visitare, costruisce il percorso ottimale e <strong>impara dai tuoi risultati reali</strong> per pianificare sempre meglio. Questo manuale spiega come usarlo dal telefono, passo per passo, e come "allenarlo".</div>
  <div class="badge">Versione 1.0 · {today} · Documento riservato agli agenti VOOM</div>
  <div class="foot">VOOM crm — Manuale AI Tour app mobile per l'agente</div>
</div>

<!-- ═══════════ INDICE ═══════════ -->
<div class="toc">
  <h2>Indice</h2>
  <ol>
    <li>Che cos'è AI Tour e cosa vedi tu</li>
    <li>Avvio rapido: il tuo primo tour in 60 secondi</li>
    <li>Il form "Genera Tour" spiegato campo per campo</li>
    <li>Come ragiona l'AI: punteggi, priorità e percorso</li>
    <li>Cosa impara l'AI dai tuoi dati (e come "allenarla")</li>
    <li>Il Tour Live passo per passo</li>
    <li>Pianificazione Settimana e Mese</li>
    <li>10 consigli per migliorare le tue performance con l'AI</li>
    <li>Messaggi dell'AI e cosa fare</li>
    <li>Legenda colori e glossario</li>
  </ol>
</div>

<!-- ═══════════ CAP 1 ═══════════ -->
<h2 class="chapter">1 · Che cos'è AI Tour e cosa vedi tu</h2>
<p><strong>AI Tour</strong> pianifica i tuoi giri visita combinando tre cose: il <strong>valore commerciale</strong> di ogni punto vendita, la <strong>geografia</strong> (dove si trovano e dove sei tu) e il <strong>tempo reale</strong> (orari di lavoro, tempi di guida su strade vere, durata delle visite). Sull'app la trovi in due punti: la card <strong>AI Tour</strong> tra le azioni rapide della Dashboard e la voce <strong>AI Tour</strong> nella sezione Altro → Strumenti.</p>
{figrow(fig("ai01-dashboard", "La card AI Tour tra le azioni rapide della Dashboard"), fig("ai02-genera-form", "La schermata AI Tour con le 4 schede in alto"))}
<h3>Le schede che usi come agente</h3>
<table class="legend">
  <tr><th>Scheda</th><th>A cosa serve</th></tr>
  <tr><td><strong>Genera</strong></td><td>Il giro di UNA giornata: scegli data, orario, partenza e tipo di giornata; l'AI fa il resto.</td></tr>
  <tr><td><strong>Settimana</strong></td><td>Distribuzione intelligente delle visite sui giorni della settimana, per territori.</td></tr>
  <tr><td><strong>Mese</strong></td><td>Vista d'insieme del mese: chi va coperto e in quale settimana.</td></tr>
  <tr><td><strong>I miei Tour</strong></td><td>Tour salvati: riaprili, avviali in Live, consultali o eliminali.</td></tr>
</table>
<div class="info">ℹ️ <strong>Territorio e Impostazioni</strong> (orari di lavoro, durate visita, casa/sede, zone del territorio) sono gestiti dallo staff dalla web app. Se ti serve una modifica, chiedi al tuo responsabile: l'app la userà automaticamente.</div>
<p>Se lo staff ha disegnato delle <strong>zone di territorio</strong> per te, l'AI le usa come area di lavoro predefinita ("Territorio assegnato"): dentro ci finiscono i tuoi clienti, gli orfani e le tabaccherie da acquisire comprese nel perimetro.</p>

<!-- ═══════════ CAP 2 ═══════════ -->
<h2 class="chapter">2 · Avvio rapido: il tuo primo tour in 60 secondi</h2>
<ol class="steps">
  <li>Dalla Dashboard tocca <strong>AI Tour</strong> → sei nella scheda <strong>Genera</strong>.</li>
  <li>Lascia la data di <strong>Oggi</strong>: l'orario di inizio si imposta da solo sull'ora attuale.</li>
  <li><strong>Partenza:</strong> lascia <em>Posizione corrente</em> e consenti il GPS quando l'app lo chiede.</li>
  <li><strong>Tipo giornata:</strong> lascia <em>Decidi tu AI</em>.</li>
  <li><strong>Area:</strong> lascia <em>Territorio assegnato</em> (se configurato) o <em>Automatica (AI)</em>.</li>
  <li>Premi <strong>GENERA CON AI</strong> e attendi qualche secondo.</li>
  <li>Controlla il piano proposto, tocca <strong>Salva</strong> e poi <strong>Avvia Tour</strong> per partire in Live.</li>
</ol>
{figrow(fig("ai04-generazione", "L'AI al lavoro: selezione → clustering → pianificazione"), fig("ai05-risultato", "Il piano generato: KPI, strategia dell'AI e prima fermata"))}
<div class="tip">💡 Prima di avviare il giro leggi il <strong>riquadro con la strategia dell'AI</strong> e apri le <strong>"Visite escluse"</strong> in fondo: capisci perché l'AI ha scelto proprio quelle visite e chi è rimasto fuori (sarà candidato per il giro successivo).</div>

<!-- ═══════════ CAP 3 ═══════════ -->
<h2 class="chapter">3 · Il form "Genera Tour" spiegato campo per campo</h2>
{figrow(fig("ai02-genera-form", "Parte alta del form: data, orari, tipo giornata"), fig("ai03-genera-form-2", "Parte bassa: partenza, rientro, area e visite obbligatorie"))}
<ul>
  <li><strong>Data</strong> — il giorno del giro: tocca uno dei 7 giorni proposti. Per oggi, l'ora di inizio si adegua automaticamente all'ora attuale.</li>
  <li><strong>Ora inizio / Ora fine</strong> — la finestra di lavoro del giro (tasti −/+ a passi di 15 minuti). L'AI riempie la giornata rispettando anche un <em>buffer di sicurezza</em> per gli imprevisti.</li>
  <li><strong>Partenza</strong> — <em>Posizione corrente</em> (GPS), <em>Indirizzo</em> scritto a mano, <em>Casa</em> o <em>Sede</em> (se configurate dallo staff).</li>
  <li><strong>Rientro</strong> — facoltativo: <em>Nessuno</em>, ritorno alla <em>Partenza</em>, un <em>Indirizzo</em>, <em>Casa</em> o <em>Sede</em>. Se impostato, l'AI riserva il tempo di rientro entro l'ora di fine.</li>
  <li><strong>Tipo giornata</strong> — vedi tabella sotto.</li>
  <li><strong>Area</strong> — <em>Territorio assegnato</em> (se hai zone), <em>Automatica (AI)</em> (l'AI sceglie il cluster migliore entro 120 km dalla partenza), <em>Provincia</em>, <em>Comune</em> o <em>Raggio km</em>.</li>
  <li><strong>Visite obbligatorie</strong> — cerca e aggiungi clienti/prospect che DEVONO entrare nel giro, anche fuori area. Compaiono con la ★ e non sono saltabili in Live.</li>
</ul>
<h3>I quattro tipi di giornata</h3>
<table class="legend">
  <tr><th>Tipo</th><th>Chi entra nel giro</th><th>Quando usarlo</th></tr>
  <tr><td><strong>Giro Clienti</strong></td><td>Solo clienti acquisiti</td><td>Consolidare il portafoglio, raccogliere riordini.</td></tr>
  <tr><td><strong>Sviluppo Territorio</strong></td><td>Prospect, orfani, mai visitate, tabaccherie libere</td><td>Aprire nuovi punti vendita, recuperare clienti fermi.</td></tr>
  <tr><td><strong>Giornata Mista</strong></td><td>Mix ragionato di clienti e sviluppo</td><td>La scelta equilibrata per la maggior parte dei giorni.</td></tr>
  <tr><td><strong>Decidi tu AI</strong></td><td>L'AI legge lo stato del portafoglio e sceglie, motivando</td><td>Quando vuoi il consiglio dell'assistente.</td></tr>
</table>

<!-- ═══════════ CAP 4 ═══════════ -->
<h2 class="chapter">4 · Come ragiona l'AI: punteggi, priorità e percorso</h2>
<p>Ogni punto vendita riceve un <strong>punteggio da 0 a 100</strong> che ne misura l'urgenza/valore commerciale. Lo vedi su ogni fermata (es. <em>Media · 45/100</em>) insieme al <strong>motivo</strong> in corsivo.</p>
<h3>Clienti attivi (base 30 punti)</h3>
<table class="legend">
  <tr><th>Fattore</th><th>Punti</th><th>Logica</th></tr>
  <tr><td>Riordino in ritardo rispetto alla frequenza abituale del cliente</td><td>fino a +30</td><td>Se ha superato la SUA frequenza media di riordino, sale di priorità.</td></tr>
  <tr><td>Passaggio in ritardo sulla cadenza visite</td><td>fino a +20</td><td>Cadenza standard configurata dallo staff.</td></tr>
  <tr><td>Ordine telefonico senza visita successiva</td><td>+15 (+8)</td><td>L'ordine al telefono non sostituisce la visita; +8 se l'ordine era piccolo.</td></tr>
  <tr><td>Fascia di fatturato degli ultimi 6 mesi</td><td>+15 / +8</td><td>Chi fattura di più pesa di più.</td></tr>
  <tr><td>Mai visitato</td><td>+10</td><td>Cliente registrato ma senza visite tracciate.</td></tr>
</table>
<h3>Prospect (base 25 punti)</h3>
<table class="legend">
  <tr><th>Fattore</th><th>Punti</th><th>Logica</th></tr>
  <tr><td>"Molto interessato" negli esiti precedenti</td><td>+30</td><td>Gli esiti che registri in Live alimentano la priorità.</td></tr>
  <tr><td>"Interessato"</td><td>+20</td><td>Idem.</td></tr>
  <tr><td>Mai visitato / ultimo contatto oltre 60 giorni</td><td>+12 / +10</td><td>Evita che il prospect "si raffreddi".</td></tr>
  <tr><td>Potenziale commerciale stimato alto</td><td>+10</td><td>Dalla scheda Prima Visita.</td></tr>
</table>
<h3>Orfani e sviluppo</h3>
<table class="legend">
  <tr><th>Soggetto</th><th>Base</th><th>Bonus</th></tr>
  <tr><td><strong>Orfano A</strong> (ordinava e ha smesso)</td><td>55</td><td>+22 o +12 in base allo storico, +8 se aveva ordini recenti.</td></tr>
  <tr><td><strong>Orfano B</strong> (visitato senza ordini recenti)</td><td>45</td><td>Come sopra.</td></tr>
  <tr><td><strong>Mai visitata</strong> (tabaccheria del tuo territorio)</td><td>58</td><td>Priorità alta nelle giornate di sviluppo.</td></tr>
  <tr><td><strong>Da acquisire</strong> (tabaccheria libera)</td><td>30</td><td>Riempie la giornata di sviluppo.</td></tr>
</table>
<h3>Bonus per tutti</h3>
<ul>
  <li>Appuntamento in agenda o follow-up entro 7 giorni: <strong>+15</strong> (<strong>+25</strong> se oggi/domani).</li>
  <li>Cliente di un Progetto Speciale: <strong>+8</strong>.</li>
</ul>
<h3>Classi di priorità</h3>
<p><strong>≥ 80 Urgente</strong> · <strong>60–79 Alta</strong> · <strong>40–59 Media</strong> · <strong>&lt; 40 Bassa</strong> — le vedi come badge colorato su ogni fermata.</p>
<h3>Dal punteggio al percorso</h3>
<ol>
  <li><strong>Cluster territoriale:</strong> l'AI raggruppa i candidati per zone (~5 km) e sceglie quella col valore complessivo massimo.</li>
  <li><strong>Selezione:</strong> aggiunge visite una alla volta massimizzando il punteggio e minimizzando il tempo di viaggio.</li>
  <li><strong>Ottimizzazione:</strong> riordina la sequenza per ridurre i chilometri e ricalcola i tempi su strade reali.</li>
  <li><strong>Buffer di sicurezza:</strong> una parte della giornata resta riservata agli imprevisti — 18% Giro Clienti, 25% Mista, 35% Sviluppo.</li>
</ol>
{figrow(fig("ai06-risultato-fermate", "Fermate in sequenza: orari, badge tipo, priorità e Naviga"), fig("ai07-risultato-escluse", "Le «Visite escluse»: chi è rimasto fuori e perché"))}
<div class="info">ℹ️ Le <strong>escluse</strong> non sono scartate per sempre: restano candidate e spesso entrano nel giro successivo.</div>
<h3>Elenco o Mappa</h3>
<p>Il giro proposto si consulta in due modi con il selettore <strong>Elenco / Mappa</strong>. La vista <strong>Mappa</strong> mostra il <strong>percorso reale</strong> in blu, il marker <strong>P</strong> di partenza (e <strong>A</strong> di rientro, se impostato) e le <strong>fermate numerate</strong> con il colore del tipo di soggetto (bordo rosso se obbligatoria). Toccando un marker si apre la scheda con orario di arrivo, durata, priorità, motivo dell'AI e il pulsante <strong>Naviga</strong>.</p>
{figrow(fig("ai19-tour-mappa", "La vista Mappa del giro: percorso, partenza P e fermate numerate con popup"))}

<!-- ═══════════ CAP 5 ═══════════ -->
<h2 class="chapter">5 · Cosa impara l'AI dai tuoi dati (e come "allenarla")</h2>
<h3>5.1 La frequenza di riordino di OGNI cliente</h3>
<p>L'AI misura, ordine dopo ordine, ogni quanti giorni riordina ciascun cliente e ti propone la visita al momento giusto (né troppo presto né troppo tardi).</p>
<div class="tip">💪 <strong>Come allenarla:</strong> registra sempre gli ordini nel CRM, subito. Ordini mancanti = frequenze sballate = visite proposte nel momento sbagliato.</div>
<h3>5.2 Le durate visita apprese</h3>
<p>Dai tour completati negli ultimi 12 mesi l'AI impara <strong>quanto duri davvero</strong> dalle sue visite presso ogni cliente e usa quella durata al posto di quella standard. Così i giri diventano realistici: più visite se sei rapido, meno se da un cliente servono 40 minuti.</p>
<div class="tip">💪 <strong>Come allenarla:</strong> in Live premi <strong>"Sono arrivato"</strong> quando entri e chiudi la tappa (esito) solo quando esci davvero.</div>
<h3>5.3 Ordini in visita vs ordini telefonici</h3>
<p>Un ordine raccolto <strong>in visita</strong> aggiorna anche la data dell'ultimo passaggio; un ordine <strong>telefonico/remoto</strong> no — il cliente resta in lista per la prossima visita di persona.</p>
<div class="tip">💪 <strong>Come allenarla:</strong> nel form Raccolta Ordine seleziona sempre il <strong>canale</strong> corretto (visita o telefonico/remoto).</div>
<h3>5.4 Gli esiti delle visite</h3>
<p>Gli esiti che registri in Live (Interessato, Molto interessato, Da richiamare, Chiuso...) cambiano le priorità future: un prospect "molto interessato" salirà, un "non interessato" scenderà.</p>
<div class="tip">💪 <strong>Come allenarla:</strong> compila SEMPRE l'esito a fine tappa, con una nota breve e, se serve, una data di follow-up.</div>
<h3>5.5 Il tuo territorio</h3>
<p>Le zone disegnate dallo staff definiscono il perimetro dell'AI: clienti, orfani e tabaccherie libere dentro il poligono. Se il tuo territorio cambia, segnalalo al responsabile.</p>
<div class="info">🔁 <strong>Il circolo virtuoso:</strong> dati corretti → punteggi giusti → giri più brevi e redditizi → più tempo per vendere → più dati corretti.</div>

<!-- ═══════════ CAP 6 ═══════════ -->
<h2 class="chapter">6 · Il Tour Live passo per passo</h2>
<p>Dal risultato di un tour (o da un tour salvato in "I miei Tour") tocca <strong>Avvia Tour</strong>: entri in modalità <strong>Live</strong>. Se chiudi l'app e la riapri, il tour in corso <strong>riprende da solo</strong>. Se avvii oggi un tour generato per un altro giorno, la data del tour viene <strong>riallineata a oggi</strong>: report e storici restano corretti.</p>
{figrow(fig("ai08-live", "Il Live: badge TOUR LIVE, progresso e prossima visita con le azioni"), fig("ai09-live-arrivato", "Dopo «Sono arrivato»: sei sul posto"))}
<ol class="steps">
  <li><strong>Avvia Tour.</strong> La tua posizione GPS viene salvata periodicamente per chilometraggio e sicurezza (con app aperta).</li>
  <li>Per ogni tappa vedi <strong>distanza, orario previsto di arrivo, durata stimata</strong> e il motivo per cui l'AI l'ha scelta. In alto, il conteggio <em>fatte · saltate · rimanenti</em> e l'indicatore <em>Ritardo/Anticipo</em>.</li>
  <li><strong>Navigatore</strong> apre le mappe del telefono già puntate sulla tappa. Con <strong>"Mappa del giro"</strong> (sopra la prossima visita) vedi invece tutte le tappe sulla mappa: numerate le rimanenti nell'ordine attuale, <strong>✓ verdi</strong> le completate, <strong>✕ grigie</strong> le saltate.</li>
  <li><strong>"Sono arrivato"</strong>: registra l'orario di arrivo reale (serve per le durate apprese!).</li>
  <li>Fai il tuo lavoro: <strong>Raccolta Ordine</strong> o <strong>Ispezione</strong>. Al salvataggio torni al tour e la tappa si <strong>chiude da sola</strong> con l'esito giusto (ordine/ispezione). <strong>Ricorda: l'ispezione è sempre obbligatoria durante la visita</strong> — non serve solo se il cliente fa l'ordine o se salti la tappa.</li>
  <li><strong>Tappa senza scheda cliente</strong> (tabaccheria da acquisire): toccando Ordine o Ispezione parte la <strong>Prima Visita</strong> con i dati della tabaccheria precompilati — solo se il GPS conferma che sei sul posto (entro 500 m). Al termine il nuovo prospect è collegato alla tappa e prosegui.</li>
  <li><strong>"Visita terminata"</strong>: registra l'<strong>esito</strong>, una nota e l'eventuale follow-up con <strong>data e ora</strong> (scegli l'orario tra le proposte: l'appuntamento viene creato in <strong>Calendario</strong> nel giorno e all'ora scelti). Usalo per chiudere la tappa quando l'ispezione o l'ordine non sono stati possibili (es. chiuso, titolare assente). L'esito viene registrato anche come <strong>visita nel CRM</strong> del cliente.</li>
  <li><strong>"Salta visita"</strong>: se non puoi fermarti, indica il motivo (chiuso, titolare assente...). Le visite obbligatorie (★) non si possono saltare.</li>
  <li>Dopo ogni esito o salto l'AI <strong>ricalcola il giro</strong> dalla tua posizione: se sei in ritardo toglie le tappe meno preziose (te lo dice), se sei in anticipo può proporti una <strong>tabaccheria vicina da aggiungere</strong>.</li>
  <li><strong>"Termina"</strong>: ottieni il <strong>consuntivo di fine giornata</strong> (tappe, ordini, ispezioni, interessati, follow-up, km e durata) e chiudi con <em>Termina definitivamente</em>.</li>
</ol>
{figrow(fig("ai10-live-esito", "Esito visita: note e follow-up con data e ora dell'appuntamento"), fig("ai12-live-salta", "Salta visita: scegli il motivo"))}
{figrow(fig("ai11-live-ricalcolo", "Dopo l'esito: giro ricalcolato e recupero tempo suggerito"), fig("ai14-consuntivo", "Il consuntivo di fine giornata con il report"))}
{figrow(fig("ai20-live-mappa", "La «Mappa del giro» nel Live: tappe numerate e stati in tempo reale"))}
<div class="warn">⚠️ <strong>Regola d'oro del Tour Live: l'ispezione è SEMPRE obbligatoria a ogni visita.</strong> Le uniche eccezioni sono due: il cliente fa l'ordine (la Raccolta Ordine sostituisce l'ispezione) oppure salti la visita con "Salta visita" indicando il motivo. In tutti gli altri casi, prima di chiudere la tappa, esegui l'<strong>Ispezione</strong> dal pulsante dedicato. L'app te lo ricorda con un avviso su ogni tappa.</div>
<div class="warn">⚠️ Non chiudere le tappe se non sei sul posto: "rovini" l'apprendimento delle durate e i report chilometrici. Meglio <strong>Salta</strong> con il motivo.</div>
<div class="info">📍 Con l'app pubblicata (build nativa) la posizione è tracciata in modo affidabile durante il giro; in Expo Go funziona solo con app in primo piano.</div>

<!-- ═══════════ CAP 7 ═══════════ -->
<h2 class="chapter">7 · Pianificazione Settimana e Mese</h2>
<h3>Settimana</h3>
<p>Nella scheda <strong>Settimana</strong> scegli la settimana, i giorni in cui lavori (Lun–Sab), partenza e rientro. L'AI distribuisce i clienti <strong>in scadenza di cadenza</strong> nei giorni scelti raggruppandoli per <strong>territorio</strong> (ogni giorno una zona, per non fare zig-zag) e, se vuoi, riempie con prospect/orfani/mai visitate. Da ogni giorno tocchi <strong>"Genera tour del giorno"</strong> per avere il giro dettagliato con gli orari.</p>
{figrow(fig("ai16-settimana-form", "Il form della Settimana: giorni, partenza, riempitivi"), fig("ai17-settimana-risultato", "La settimana pianificata: un territorio per giorno"))}
<h3>Mese</h3>
<p>Nella scheda <strong>Mese</strong> vedi le <strong>settimane rimanenti</strong> del mese con i clienti da coprire in base a cadenza e frequenza di riordino, bilanciati sulla tua capacità reale (visite/settimana). Da ogni settimana tocchi <strong>"Pianifica questa settimana"</strong>: si apre la scheda Settimana già compilata e pianificata.</p>
{figrow(fig("ai18-mese-risultato", "Il mese: settimane con carico bilanciato e in scadenza"), fig("ai15-tours", "I miei Tour: pianificati, in corso e completati"))}
<div class="tip">💡 <strong>Metodo consigliato:</strong> il lunedì mattina guarda il <strong>Mese</strong> per il quadro generale, poi la <strong>Settimana</strong> per organizzare i giorni, e ogni mattina <strong>Genera</strong> per il giro di oggi.</div>

<!-- ═══════════ CAP 8 ═══════════ -->
<h2 class="chapter">8 · 10 consigli per migliorare le tue performance con l'AI</h2>
<ol class="steps">
  <li><strong>Registra ogni ordine subito</strong> e con il canale giusto (visita/remoto): è la base di tutte le frequenze.</li>
  <li><strong>Compila sempre l'esito</strong> della visita in Live: alimenta le priorità di domani.</li>
  <li><strong>Fissa i follow-up con data e ora</strong>: l'appuntamento finisce in Calendario, quel cliente riceverà il bonus e tornerà nel giro al momento giusto.</li>
  <li><strong>Avvia e chiudi i tour in Live sul posto</strong>: durate apprese e km reali dipendono da questo.</li>
  <li><strong>Non ignorare gli orfani</strong>: partono già con punteggi alti, sono fatturato che stai perdendo.</li>
  <li><strong>Usa l'ordine telefonico come ponte</strong>, non come sostituto della visita.</li>
  <li><strong>Visite obbligatorie con parsimonia</strong>: ognuna toglie spazio alle scelte dell'AI.</li>
  <li><strong>Guarda le "escluse"</strong> a fine generazione: capisci la strategia e cosa ti aspetta domani.</li>
  <li><strong>Parti presto e imposta l'ora di fine reale</strong>: più finestra = più visite ad alto valore.</li>
  <li><strong>Acquisisci sul posto</strong> quando capiti davanti a una tabaccheria libera: il Live ti guida con la Prima Visita precompilata.</li>
</ol>

<!-- ═══════════ CAP 9 ═══════════ -->
<h2 class="chapter">9 · Messaggi dell'AI e cosa fare</h2>
<table class="legend">
  <tr><th>Messaggio</th><th>Significato</th><th>Cosa fare</th></tr>
  <tr><td>"Tour di oggi: partenza adeguata all'ora attuale (HH:MM)"</td><td>L'orario di inizio era già passato: si parte da adesso.</td><td>Nulla, è automatico.</td></tr>
  <tr><td>"L'orario di fine è già passato"</td><td>La finestra oraria è esaurita.</td><td>Sposta la data o allunga l'ora di fine.</td></tr>
  <tr><td>"Nessun soggetto disponibile con i filtri scelti"</td><td>Nessun candidato nell'area/tipo scelti.</td><td>Allarga l'area, cambia tipo giornata o verifica il territorio col responsabile.</td></tr>
  <tr><td>"Nessuna visita rientra nell'orario: la partenza è a circa Xh di guida..."</td><td>Punto di partenza troppo lontano dai candidati.</td><td>Cambia partenza o amplia l'orario.</td></tr>
  <tr><td>"Giro ricalcolato alle HH:MM... ho rimosso ..."</td><td>In Live l'AI ha tolto tappe per farti rientrare in orario.</td><td>Nulla: le rimosse restano candidate per domani.</td></tr>
  <tr><td>"Hai circa N minuti di margine. Nelle vicinanze c'è..."</td><td>Sei in anticipo: proposta di visita extra vicina.</td><td><em>Aggiungi</em> se vuoi sfruttare il tempo, altrimenti <em>No, grazie</em>.</td></tr>
  <tr><td>"Tempi stimati (servizio routing non disponibile)"</td><td>Il calcolo su strade reali non era raggiungibile.</td><td>I tempi sono stime: rigenera più tardi per averli precisi.</td></tr>
  <tr><td>"Nessun ordine/ispezione registrato: la tappa resta aperta"</td><td>Sei tornato al Live senza salvare nulla.</td><td>Riprova, oppure chiudi la tappa con un esito manuale.</td></tr>
</table>
{figrow(fig("ai13-live-suggerimento", "Recupero tempo: l'AI propone una tabaccheria vicina da acquisire"))}

<!-- ═══════════ CAP 10 ═══════════ -->
<h2 class="chapter">10 · Legenda colori e glossario</h2>
<h3>Colori dei soggetti</h3>
<table class="legend">
  <tr><th>Badge</th><th>Soggetto</th><th>Definizione</th></tr>
  <tr><td><span class="dot" style="background:#2563EB"></span>Blu</td><td><strong>Cliente</strong></td><td>Punto vendita acquisito che ordina.</td></tr>
  <tr><td><span class="dot" style="background:#059669"></span>Verde</td><td><strong>Prospect</strong></td><td>Contattato/visitato, non ancora cliente.</td></tr>
  <tr><td><span class="dot" style="background:#7C3AED"></span>Viola</td><td><strong>Orfano</strong></td><td>Ordinava e ha smesso (A) oppure visitato senza ordini recenti (B).</td></tr>
  <tr><td><span class="dot" style="background:#DB2777"></span>Rosa</td><td><strong>Mai visitata</strong></td><td>Tabaccheria del tuo territorio mai contattata.</td></tr>
  <tr><td><span class="dot" style="background:#0D9488"></span>Teal</td><td><strong>Da acquisire</strong></td><td>Tabaccheria libera, non assegnata a nessuno.</td></tr>
</table>
<h3>Glossario</h3>
<table class="legend">
  <tr><th>Termine</th><th>Significato</th></tr>
  <tr><td><strong>Punteggio (0–100)</strong></td><td>Valore commerciale calcolato dall'AI: Urgente ≥80, Alta 60–79, Media 40–59, Bassa &lt;40.</td></tr>
  <tr><td><strong>Cadenza</strong></td><td>Ogni quante settimane va rivisto di persona un cliente (default: 5 per gli attivi, 8 per chi ordina poco).</td></tr>
  <tr><td><strong>Frequenza di riordino</strong></td><td>Giorni medi tra un ordine e l'altro di un cliente, appresa dagli ordini reali.</td></tr>
  <tr><td><strong>Durata appresa</strong></td><td>Durata visita basata sui tuoi tour completati (ultimi 12 mesi).</td></tr>
  <tr><td><strong>Canale ordine</strong></td><td>"Visita" (raccolto di persona) o "Remoto" (telefono/online).</td></tr>
  <tr><td><strong>Buffer</strong></td><td>Percentuale della giornata riservata agli imprevisti.</td></tr>
  <tr><td><strong>Ispezione</strong></td><td>Visita operativa registrata durante il Tour Live.</td></tr>
  <tr><td><strong>Territorio assegnato</strong></td><td>Zone disegnate dallo staff come tuo perimetro di lavoro.</td></tr>
  <tr><td><strong>Escluse</strong></td><td>Visite valutate ma non incluse nel giro (candidate per il prossimo).</td></tr>
  <tr><td><strong>Visita obbligatoria (★)</strong></td><td>Tappa che hai imposto tu: entra sempre e non è saltabile.</td></tr>
</table>

<div class="footer-note">VOOM crm · Manuale AI Tour app mobile per l'agente v1.0 · generato il {today} · Le schermate sono esemplificative: i dati mostrati non sono reali. Per domande o segnalazioni rivolgiti al tuo responsabile.</div>

</body>
</html>"""

with open(HTML_OUT, "w") as f:
    f.write(html)
print("HTML scritto:", len(html), "caratteri")

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell",
        args=["--no-sandbox"],
    )
    page = browser.new_page()
    page.goto(f"file://{HTML_OUT}", wait_until="load")
    page.wait_for_timeout(1500)
    page.pdf(path=OUT, format="A4", print_background=True, prefer_css_page_size=True)
    browser.close()

size = os.path.getsize(OUT)
print(f"PDF generato: {OUT} ({size/1024:.0f} KB)")
