"""
Genera il Manuale Utente PDF di VOOM crm a partire dagli screenshot in img/.
Output: /app/manual/manuale-utente-voom.pdf
"""
import base64
import os
from datetime import date
from playwright.sync_api import sync_playwright

IMG = "/app/manual/img"
OUT = "/app/manual/manuale-utente-voom.pdf"

def b64(name):
    path = os.path.join(IMG, f"{name}.png")
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()

def fig(name, caption):
    src = b64(name)
    if not src:
        return ""
    return f'''<figure><img src="{src}" alt="{caption}"/><figcaption>{caption}</figcaption></figure>'''

def figrow(*figs):
    inner = "".join(figs)
    return f'<div class="figrow">{inner}</div>'

today = date.today().strftime("%d/%m/%Y")

html = f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<style>
  @page {{ size: A4; margin: 16mm 14mm 18mm 14mm; }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1C1C1E; font-size: 11.5px; line-height: 1.65; }}

  /* Copertina */
  .cover {{ height: 250mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; }}
  .cover .logo {{ font-size: 54px; font-weight: 800; color: #C2410C; letter-spacing: -1.5px; }}
  .cover .logo small {{ font-weight: 400; color: #8E8E93; }}
  .cover h1 {{ font-size: 30px; margin-top: 18px; color: #1C1C1E; }}
  .cover .sub {{ font-size: 15px; color: #8E8E93; margin-top: 10px; }}
  .cover .badge {{ margin-top: 28px; background: #FFF7ED; border: 1.5px solid #FED7AA; color: #9A3412; border-radius: 999px; padding: 8px 22px; font-weight: 700; font-size: 13px; }}
  .cover .foot {{ margin-top: 60px; color: #8E8E93; font-size: 11px; }}

  /* Indice */
  .toc {{ page-break-after: always; }}
  .toc h2 {{ font-size: 22px; color: #C2410C; margin-bottom: 14px; }}
  .toc ol {{ margin-left: 20px; font-size: 13px; }}
  .toc li {{ padding: 4px 0; }}

  h2.chapter {{ font-size: 20px; color: #FFFFFF; background: #C2410C; padding: 10px 14px; border-radius: 10px; margin: 0 0 12px 0; page-break-before: always; }}
  h2.chapter:first-of-type {{ page-break-before: avoid; }}
  h3 {{ font-size: 14px; color: #9A3412; margin: 14px 0 6px 0; }}
  p {{ margin-bottom: 7px; }}
  ul, ol {{ margin: 4px 0 10px 20px; }}
  li {{ margin-bottom: 3px; }}
  strong {{ color: #1C1C1E; }}

  .tip {{ background: #FFF7ED; border-left: 4px solid #C2410C; border-radius: 6px; padding: 8px 12px; margin: 10px 0; font-size: 11px; color: #7C2D12; }}
  .info {{ background: #EFF6FF; border-left: 4px solid #3B82F6; border-radius: 6px; padding: 8px 12px; margin: 10px 0; font-size: 11px; color: #1E3A8A; }}

  figure {{ display: inline-block; text-align: center; margin: 8px 8px 12px 8px; page-break-inside: avoid; vertical-align: top; }}
  figure img {{ width: 62mm; border: 1px solid #E5E5EA; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.10); }}
  figcaption {{ font-size: 9.5px; color: #8E8E93; margin-top: 4px; max-width: 62mm; }}
  .figrow {{ text-align: center; }}

  table.legend {{ border-collapse: collapse; margin: 8px 0 12px 0; font-size: 11px; }}
  table.legend td {{ border: 1px solid #E5E5EA; padding: 5px 10px; }}
  .dot {{ display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }}

  .footer-note {{ margin-top: 24px; font-size: 9.5px; color: #8E8E93; border-top: 1px solid #E5E5EA; padding-top: 8px; }}
</style>
</head>
<body>

<!-- ═══ COPERTINA ═══ -->
<div class="cover">
  <div class="logo">VOOM <small>crm</small></div>
  <h1>Manuale Utente</h1>
  <div class="sub">Guida completa all'uso dell'app mobile per agenti di vendita</div>
  <div class="badge">Versione app 3.0.1 &nbsp;·&nbsp; {today}</div>
  <div class="foot">iOS &amp; Android · Documento a uso interno della rete vendita VOOM</div>
</div>

<!-- ═══ INDICE ═══ -->
<div class="toc">
  <h2>Indice</h2>
  <ol>
    <li>Introduzione</li>
    <li>Primo accesso e login</li>
    <li>Dashboard</li>
    <li>Mappa Punti Vendita</li>
    <li>Clienti</li>
    <li>Raccolta Ordine (wizard in 5 passi)</li>
    <li>PDF Preventivo</li>
    <li>Bozze ordine</li>
    <li>Ordini</li>
    <li>Prodotti</li>
    <li>Calendario</li>
    <li>Menu Altro e strumenti</li>
    <li>Profilo</li>
    <li>Consigli utili e FAQ</li>
  </ol>
</div>

<!-- ═══ 1. INTRODUZIONE ═══ -->
<h2 class="chapter">1. Introduzione</h2>
<p><strong>VOOM crm</strong> è l'app mobile per gli agenti di vendita della rete VOOM: permette di gestire l'intero ciclo di lavoro sul territorio — dalla visita al punto vendita fino alla raccolta dell'ordine — direttamente dallo smartphone.</p>
<h3>Cosa puoi fare con l'app</h3>
<ul>
  <li><strong>Mappa interattiva</strong> dei punti vendita con stato visite e ricerca unificata</li>
  <li><strong>Raccolta ordini</strong> guidata in 5 passi, con stock in tempo reale, CashBack, Rottamazione e Sconto Benvenuto</li>
  <li><strong>Preventivi PDF</strong> da consegnare al cliente prima di confermare l'ordine</li>
  <li><strong>Anagrafica / Prima Visita</strong> con foto e posizione GPS</li>
  <li><strong>Calendario</strong> appuntamenti, <strong>sostituzioni</strong>, <strong>rimborsi</strong>, <strong>ispezioni</strong> e molto altro</li>
</ul>
<div class="info">💡 L'app funziona su iPhone e Android. I dati sono sincronizzati in tempo reale con il gestionale centrale: ogni ordine, visita o modifica è subito visibile a tutta la rete.</div>

<!-- ═══ 2. ACCESSO ═══ -->
<h2 class="chapter">2. Primo accesso e login</h2>
<p>Al primo avvio l'app mostra l'<strong>Informativa Privacy e i Termini di Utilizzo</strong>: leggi i documenti, spunta le tre caselle di presa visione e tocca <strong>“Accetta e Continua”</strong>.</p>
<p>Nella schermata di <strong>login</strong> inserisci l'email e la password fornite dall'amministrazione, poi tocca <strong>Accedi</strong>.</p>
{figrow(fig("01-privacy", "Consenso privacy: spunta le 3 caselle e tocca “Accetta e Continua”"), fig("02-login", "Schermata di login: inserisci email e password"))}
<div class="tip">🔐 <strong>Face ID / Touch ID</strong>: dopo il primo login puoi abilitare l'accesso biometrico — al successivo avvio entrerai senza digitare la password.</div>
<div class="tip">🗝️ <strong>Password dimenticata?</strong> Contatta l'amministratore della rete per il reset delle credenziali.</div>

<!-- ═══ 3. DASHBOARD ═══ -->
<h2 class="chapter">3. Dashboard</h2>
<p>La Dashboard è la schermata principale: riassume la tua attività e dà accesso rapido a tutte le funzioni.</p>
<ul>
  <li><strong>Prossimi appuntamenti</strong>: i tuoi impegni dei prossimi 7 giorni, scorrevoli in orizzontale (chip <strong>OGGI</strong> / <strong>DOMANI</strong> in evidenza). Toccali per aprire il Calendario.</li>
  <li><strong>Panoramica</strong>: contatori di Clienti, Ordini, Visite e ordini In attesa.</li>
  <li><strong>Venduto del mese</strong>: card arancione con il netto del mese, numero ordini e dettaglio Accisa / IVA / Lordo.</li>
  <li><strong>Azioni rapide</strong>: scorciatoie per Raccolta Ordine, Bozze, Sostituzioni, Rimborsi, Ispezioni, Anagrafica, Rivendite No Mappa e Reclami.</li>
</ul>
{figrow(fig("03-dashboard-top", "Dashboard: appuntamenti, panoramica e venduto del mese"), fig("04-dashboard-azioni", "Azioni rapide: le scorciatoie alle funzioni principali"))}

<!-- ═══ 4. MAPPA ═══ -->
<h2 class="chapter">4. Mappa Punti Vendita</h2>
<p>Il tab <strong>Mappa</strong> mostra tutti i punti vendita nella zona visualizzata. I numeri nei cerchi indicano gruppi di punti (cluster): tocca per ingrandire.</p>
<h3>Colori dei punti</h3>
<table class="legend">
  <tr><td><span class="dot" style="background:#EF4444"></span><strong>Rosso</strong></td><td>Non visitato</td></tr>
  <tr><td><span class="dot" style="background:#F97316"></span><strong>Arancio</strong></td><td>Visitato (senza ordine)</td></tr>
  <tr><td><span class="dot" style="background:#10B981"></span><strong>Verde</strong></td><td>Cliente con ordini</td></tr>
  <tr><td><span class="dot" style="background:#7C3AED"></span><span class="dot" style="background:#EAB308"></span><strong>Viola / Giallo</strong></td><td>Punti “orfani” (senza agente assegnato, rivendicabili)</td></tr>
</table>
<h3>Ricerca unificata 🔍</h3>
<p>Tocca la <strong>lente</strong> in alto a destra e digita almeno 2 caratteri: la ricerca trova contemporaneamente</p>
<ul>
  <li><strong>Clienti / Punti vendita</strong> — per nome, indirizzo, comune, P.IVA o codice fiscale (con etichetta del campo trovato)</li>
  <li><strong>Luoghi</strong> — città, vie e indirizzi geografici</li>
</ul>
<p>Selezionando un <strong>cliente</strong> la mappa si centra sul punto e apre la sua scheda; selezionando un <strong>luogo</strong> la mappa si sposta sulla zona.</p>
{figrow(fig("05-mappa", "La mappa con cluster e punti colorati per stato"), fig("06-mappa-ricerca", "Ricerca unificata: clienti e luoghi in un'unica tendina"))}
<h3>Scheda del punto vendita</h3>
<p>Toccando un punto (o un risultato di ricerca) si apre la scheda dal basso con denominazione, indirizzo, stato e le azioni rapide:</p>
<ul>
  <li><strong>Naviga</strong> — apre il navigatore verso il punto vendita</li>
  <li><strong>Ordine</strong> — avvia la Raccolta Ordine con il cliente già selezionato</li>
  <li><strong>Visita / Ispezione</strong> — registra una prima visita o un'ispezione</li>
</ul>
{figrow(fig("07-mappa-popup", "Scheda punto vendita con azioni Naviga / Ordine / Visita"))}
<div class="tip">📍 Il pulsante a forma di mirino ricentra la mappa sulla tua posizione GPS (alla prima richiesta l'app chiederà il permesso di localizzazione).</div>

<!-- ═══ 5. CLIENTI ═══ -->
<h2 class="chapter">5. Clienti</h2>
<p>Il tab <strong>Clienti</strong> elenca tutti i tuoi clienti e prospect, con ricerca per nome. Tocca una card per aprire la <strong>scheda cliente</strong> completa:</p>
<ul>
  <li>Azioni rapide: <strong>Chiama · Email · Naviga · Ordine · Ispezione</strong></li>
  <li>Statistiche: numero ordini, fatturato, visite</li>
  <li>Storico ordini recenti e visite recenti</li>
  <li>Contatti, indirizzo e dati fiscali</li>
</ul>
{figrow(fig("08-clienti", "Lista clienti con ricerca"), fig("09-cliente-dettaglio", "Scheda cliente: azioni, statistiche e storico"))}
<div class="tip">🛒 Toccando <strong>Ordine</strong> dalla scheda cliente, il wizard di Raccolta Ordine parte con il cliente già selezionato: ti basta premere “Continua ai Prodotti”.</div>

<!-- ═══ 6. RACCOLTA ORDINE ═══ -->
<h2 class="chapter">6. Raccolta Ordine — wizard in 5 passi</h2>
<p>La Raccolta Ordine ti guida in <strong>5 passi</strong>. In alto vedi sempre a che punto sei (“Passo X di 5”); in basso il pulsante per proseguire. Puoi tornare ai passi precedenti toccando i cerchi verdi.</p>

<h3>Passo 1 · Cliente</h3>
<p>Cerca e seleziona il cliente per cui stai raccogliendo l'ordine (la card selezionata si evidenzia), poi tocca <strong>“Continua ai Prodotti”</strong>.</p>
{figrow(fig("10-ordine-step1", "Passo 1: selezione del cliente"))}

<h3>Passo 2 · Prodotti</h3>
<p>Sfoglia il catalogo per categoria o cerca il prodotto. Per ogni articolo vedi il <strong>prezzo</strong> e lo <strong>stock disponibile in tempo reale</strong>.</p>
<ul>
  <li>Aggiungi con <strong>+1</strong> / <strong>+10</strong>; regola le quantità con i pulsanti − / +</li>
  <li>Il toggle <strong>Italia / Estero</strong> imposta il regime fiscale dell'ordine (gli ordini esteri sono esenti IVA)</li>
  <li>La barra in basso riepiloga pezzi e totale del carrello</li>
</ul>
{figrow(fig("11-ordine-step2", "Passo 2: catalogo con stock live"), fig("12-ordine-step2-carrello", "Prodotto aggiunto: la riga si evidenzia e il carrello si aggiorna"))}
<div class="tip">⚠️ Non è possibile ordinare quantità superiori allo stock disponibile: le righe che superano la disponibilità vengono segnalate in rosso e bloccano l'avanzamento.</div>

<h3>Passo 3 · Pagamento &nbsp;/&nbsp; Passo 4 · Spedizione</h3>
<p>Seleziona il <strong>metodo di pagamento</strong> concordato e poi il <strong>metodo di spedizione</strong> (con eventuale costo, IVA inclusa per ordini Italia). Puoi indicare un indirizzo di consegna diverso da quello anagrafico.</p>
{figrow(fig("13-ordine-step3-pagamento", "Passo 3: metodo di pagamento"), fig("14-ordine-step4-spedizione", "Passo 4: metodo di spedizione"))}

<h3>Passo 5 · Riepilogo</h3>
<p>Controlla il riepilogo completo: cliente, prodotti, <strong>Imponibile, Accisa, IVA, Spedizione e TOTALE</strong>. Qui puoi applicare le agevolazioni:</p>
<ul>
  <li><strong>CashBack</strong> — se il cliente ha saldo disponibile, scegli quanto utilizzarne: lo sconto viene ripartito sui prodotti idonei</li>
  <li><strong>Rottamazione</strong> — seleziona l'importo (lordo IVA inclusa): il netto viene ripartito sui prodotti idonei; l'imponibile minimo richiesto è 3 volte la rottamazione</li>
  <li><strong>Sconto Benvenuto 25%</strong> — proposto automaticamente al primo ordine del cliente sui prodotti idonei</li>
  <li><strong>Note</strong> — campo libero per indicazioni sull'ordine</li>
</ul>
<p>Infine tocca <strong>“Crea Ordine”</strong> per confermare: lo stock viene scalato e l'ordine appare nello storico.</p>
{figrow(fig("15-ordine-step5-riepilogo", "Passo 5: riepilogo con totali, CashBack e Rottamazione"))}

<!-- ═══ 7. PDF PREVENTIVO ═══ -->
<h2 class="chapter">7. PDF Preventivo</h2>
<p>Nel <strong>Passo 5</strong>, sotto le note, trovi la card <strong>“Preventivo PDF”</strong>: tocca <strong>“Genera PDF Preventivo”</strong> per creare un documento professionale con tutto il contenuto del riepilogo (prodotti, prezzi con sconti applicati, totali, dati cliente e agente).</p>
<ul>
  <li>Si apre il menu di <strong>condivisione</strong> del telefono: invia il PDF via WhatsApp, email, oppure stampalo</li>
  <li>Il preventivo <strong>non impegna lo stock</strong> e non crea l'ordine: ha validità 7 giorni</li>
  <li>Dopo averlo consegnato al cliente puoi <strong>creare subito l'ordine</strong> oppure toccare <strong>“Bozza”</strong> in alto e confermarlo in un secondo momento</li>
</ul>
{figrow(fig("16-ordine-pdf-preventivo", "La card Preventivo PDF nel riepilogo"))}

<!-- ═══ 8. BOZZE ═══ -->
<h2 class="chapter">8. Bozze ordine</h2>
<p>Ogni ordine in lavorazione viene <strong>salvato automaticamente come bozza</strong>: se esci dal wizard o chiudi l'app non perdi nulla.</p>
<ul>
  <li>Accedi alle bozze da <strong>Dashboard → Bozze Ordine</strong> o dal menu <strong>Altro</strong></li>
  <li>Tocca una bozza per <strong>riprenderla</strong> esattamente dal passo in cui l'avevi lasciata (cliente e carrello inclusi)</li>
  <li>Alla ripresa, l'app <strong>riverifica lo stock</strong>: se un prodotto non è più disponibile viene segnalato in rosso</li>
  <li>Scorri o usa il cestino per eliminare le bozze non più necessarie</li>
</ul>
{figrow(fig("17-bozze", "Elenco bozze: riprendi l'ordine da dove l'avevi lasciato"))}

<!-- ═══ 9. ORDINI ═══ -->
<h2 class="chapter">9. Ordini</h2>
<p>La sezione <strong>Ordini</strong> (menu Altro → Ordini) mostra lo storico completo con stato, data e totale. Tocca un ordine per il dettaglio: prodotti, quantità, prezzi, note, pagamento e spedizione.</p>
<ul>
  <li><strong>Stati</strong>: In attesa · Confermato · Spedito · Consegnato · Annullato</li>
  <li><strong>Duplica Ordine</strong>: dal dettaglio puoi ricreare lo stesso carrello per un nuovo ordine (con stock riverificato)</li>
</ul>
{figrow(fig("18-ordini", "Storico ordini con stati e totali"))}

<!-- ═══ 10. PRODOTTI ═══ -->
<h2 class="chapter">10. Prodotti</h2>
<p>Il catalogo <strong>Prodotti</strong> (menu Altro → Prodotti) è organizzato per categorie e sottocategorie, con immagini, prezzi e disponibilità. Usalo per consultazione rapida durante le visite.</p>
{figrow(fig("19-prodotti", "Catalogo prodotti per categorie"))}

<!-- ═══ 11. CALENDARIO ═══ -->
<h2 class="chapter">11. Calendario</h2>
<p>Il <strong>Calendario</strong> (menu Altro → Calendario) gestisce i tuoi appuntamenti: prime visite, follow-up e consegne.</p>
<ul>
  <li>Viste <strong>Giorno · 3 Giorni · Settimana · Mese</strong></li>
  <li>Tocca <strong>+</strong> per creare un appuntamento collegato a un cliente (o a un nominativo libero)</li>
  <li>Gli appuntamenti imminenti compaiono anche in Dashboard</li>
</ul>
{figrow(fig("20-calendario", "Calendario appuntamenti"))}

<!-- ═══ 12. MENU ALTRO ═══ -->
<h2 class="chapter">12. Menu Altro e strumenti</h2>
<p>Il tab <strong>Altro</strong> raccoglie le sezioni principali (Ordini, Prodotti, Calendario, Profilo) e gli strumenti operativi:</p>
<ul>
  <li><strong>Anagrafica / Prima Visita</strong> — registra un nuovo punto vendita in 3 passi: foto e posizione GPS, dati anagrafici e fiscali, riepilogo e invio</li>
  <li><strong>Sostituzioni</strong> — gestisci la sostituzione di prodotti difettosi o invenduti</li>
  <li><strong>Rimborsi</strong> — richieste di rimborso con foto allegate (per gli utenti abilitati)</li>
  <li><strong>Reclami Orfani</strong> — rivendica i punti vendita senza agente assegnato</li>
  <li><strong>Rivendite No Mappa</strong> — elenco dei punti vendita privi di coordinate GPS</li>
  <li><strong>Nuova Ispezione</strong> — verbale di ispezione con foto del punto vendita</li>
</ul>
{figrow(fig("21-altro", "Menu Altro: tutte le sezioni e gli strumenti"), fig("22-anagrafica", "Anagrafica / Prima Visita in 3 passi"))}
{figrow(fig("23-sostituzioni", "Sostituzioni prodotti"))}

<!-- ═══ 13. PROFILO ═══ -->
<h2 class="chapter">13. Profilo</h2>
<p>Dal <strong>Profilo</strong> (menu Altro → Profilo) puoi vedere i tuoi dati account e ruolo, gestire le preferenze (es. accesso biometrico) ed effettuare il <strong>logout</strong>.</p>
{figrow(fig("24-profilo", "Profilo utente e impostazioni"))}

<!-- ═══ 14. FAQ ═══ -->
<h2 class="chapter">14. Consigli utili e FAQ</h2>
<h3>Permessi del telefono</h3>
<p>Alla prima occasione l'app chiede i permessi necessari: <strong>Posizione</strong> (mappa e prima visita), <strong>Fotocamera</strong> e <strong>Galleria</strong> (ispezioni, anagrafica, rimborsi), <strong>Face ID</strong> (login rapido). Se neghi un permesso puoi riattivarlo dalle Impostazioni del telefono.</p>
<h3>Domande frequenti</h3>
<ul>
  <li><strong>Il totale non torna?</strong> Ricorda che il TOTALE include accisa e IVA (tranne ordini Estero) più la spedizione.</li>
  <li><strong>Non riesco ad avanzare al Passo 2?</strong> Verifica di aver selezionato un cliente; al Passo 2 serve almeno un prodotto nel carrello entro lo stock disponibile.</li>
  <li><strong>Ho perso un ordine a metà?</strong> Controlla in <strong>Bozze</strong>: il salvataggio è automatico.</li>
  <li><strong>Un punto vendita non è sulla mappa?</strong> Cercalo in <strong>Rivendite No Mappa</strong> oppure censiscilo con l'<strong>Anagrafica</strong>.</li>
  <li><strong>Il CashBack non si applica?</strong> Il saldo è per cliente e vale solo sui prodotti idonei; non è cumulabile con la Rottamazione.</li>
</ul>
<div class="info">📞 Per assistenza tecnica o credenziali contatta l'amministratore della rete VOOM.</div>

<div class="footer-note">VOOM crm · Manuale Utente · versione app 3.0.1 · generato il {today} · Le schermate sono esemplificative: i dati mostrati non sono reali.</div>

</body>
</html>"""

with open("/app/manual/manuale.html", "w") as f:
    f.write(html)
print("HTML scritto:", len(html), "caratteri")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("file:///app/manual/manuale.html", wait_until="load")
    page.wait_for_timeout(1500)
    page.pdf(path=OUT, format="A4", print_background=True, prefer_css_page_size=True)
    browser.close()

size = os.path.getsize(OUT)
print(f"PDF generato: {OUT} ({size/1024:.0f} KB)")
