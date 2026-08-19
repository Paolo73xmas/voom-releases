"""Genera la voce narrante (it-IT-DiegoNeural, italiano madrelingua) per i 3 video tutorial AI Tour.
Output: /app/manual/video/audio/vN_sM.mp3 + durations.json
RATES: velocizzazione per-scena per far rientrare l'audio nella finestra video."""
import asyncio, os, json, subprocess
import edge_tts
import imageio_ffmpeg

VOICE = 'it-IT-DiegoNeural'
RATES = {}  # es. {'v3_s4': '+10%'} se una scena sfora la finestra

OUT = '/app/manual/video/audio'
os.makedirs(OUT, exist_ok=True)
FF = imageio_ffmpeg.get_ffmpeg_exe()

SCENES = {
    # ── VIDEO 1: Genera il giro (form) ──
    'v1_s1': "Benvenuto in VOOM CRM. In questa serie di tre brevi video scopriamo AI Tour: l'assistente intelligente che pianifica i tuoi giri visita. In questo primo episodio prepariamo insieme il giro perfetto.",
    'v1_s2': "Dalla Dashboard tocca la card AI Tour, nella sezione Vendite.",
    'v1_s3': "Siamo nella scheda Genera. Per prima cosa scegli la data del giro tra i prossimi sette giorni, per esempio domani. Poi regola l'orario di inizio e di fine della giornata con i pulsanti più e meno quindici minuti.",
    'v1_s4': "Ora il tipo di giornata. Giro Clienti visita i clienti già acquisiti. Sviluppo Territorio punta su prospect, orfani e tabaccherie mai visitate. Giornata Mista combina le due cose. Oppure scegli Decidi tu AI: sarà l'assistente ad analizzare il portafoglio e a decidere il mix migliore.",
    'v1_s5': "Imposta la partenza: la tua posizione corrente, un indirizzo, casa o sede aziendale. E se vuoi, anche il punto di rientro a fine giornata.",
    'v1_s6': "L'area di lavoro. Con Territorio assegnato, l'AI lavora nelle zone disegnate per te. Se ne hai più di una, compaiono i chips: toccali per includere o escludere le zone dal giro.",
    'v1_s7': "Infine, le visite obbligatorie: cerca un cliente o un prospect e aggiungilo. Entrerà nel giro a prescindere, contrassegnato con una stella.",
    'v1_s8': "Il modulo è pronto. Nel prossimo video tocchiamo Genera con AI e scopriamo il risultato. A subito.",
    # ── VIDEO 2: Risultato, mappa e avvio ──
    'v2_s1': "Eccoci al secondo episodio. Il modulo è compilato: tocca GENERA CON AI. L'assistente analizza il portafoglio commerciale, seleziona i punti vendita con la priorità più alta, li raggruppa sul territorio e calcola i percorsi su strade reali, con gli orari di arrivo stimati per ogni tappa.",
    'v2_s1b': "L'elaborazione richiede in genere meno di un minuto. L'AI riserva anche un margine di sicurezza per gli imprevisti, e ha cura di non superare l'orario di fine che hai impostato.",
    'v2_s2': "Ecco il piano della giornata. In alto i numeri chiave: orario effettivo, numero di visite, chilometri totali, tempo di guida, tempo in visita e buffer di sicurezza, più il valore potenziale del giro.",
    'v2_s3': "Subito sotto, l'AI ti spiega la strategia con parole semplici: perché ha scelto quest'area, quali opportunità ha visto e come ha organizzato la giornata.",
    'v2_s4': "Poi le tappe, in ordine di percorso. Per ognuna vedi orario di arrivo, durata prevista, priorità e il motivo della scelta. Sui clienti Orfani il badge violetto è toccabile: si apre lo storico con gli ordini degli ultimi dodici mesi, le categorie acquistate e l'ultima visita. Così sai cosa comprava, prima ancora di entrare.",
    'v2_s5': "Passa alla vista Mappa per vedere il percorso e le fermate numerate. Con Schermo intero la navighi comodamente con le dita, e da ogni fermata puoi aprire il navigatore.",
    'v2_s6': "Se il piano ti convince, tocca Salva: lo ritrovi nella scheda I miei Tour. E quando sei pronto a partire, il tasto Avvia Tour è sempre lì, in alto. Lo vediamo nel prossimo episodio.",
    # ── VIDEO 3: Tour Live, Ispezione e orfano riassegnato ──
    'v3_s1': "Ultimo episodio: si parte davvero. Tocca Avvia Tour: entri in modalità Tour Live. In alto vedi il progresso della giornata, l'indicatore di ritardo o anticipo, e il tasto Termina.",
    'v3_s2': "La card Prossima Visita è il tuo centro di comando. Navigatore apre le mappe del telefono già puntate sulla tappa. Sono arrivato registra l'orario reale di arrivo, che alimenta le durate apprese. Raccolta Ordine apre la raccolta con il cliente già selezionato.",
    'v3_s3': "E poi il tasto verde Ispezione. L'ispezione è obbligatoria a ogni visita, e ora si fa tutto in un passaggio: scegli l'esito, scatta le due foto obbligatorie del punto vendita — senza foto la conferma resta bloccata — e controlla cellulare ed email, già precompilati: se li modifichi, vengono salvati sulla scheda cliente. Puoi anche fissare un follow-up con data e ora: l'appuntamento finisce dritto nel tuo Calendario.",
    'v3_s4': "Attenzione a questa novità: i clienti ORFANI. Se la tappa è un cliente orfano e sei fisicamente sul posto, con il GPS che ti conferma entro cinquecento metri, alla conferma dell'ispezione il cliente viene riassegnato automaticamente a te. L'app te lo annuncia con l'avviso: Cliente riassegnato a te. E da quel momento lo trovi tra i tuoi clienti. Non solo: dopo l'ispezione, l'orfano torna Cliente se ha già ordinato, o Prospect se non ha mai ordinato. In breve: chi visita, vince.",
    'v3_s5': "Se non puoi fermarti, usa Salta visita indicando il motivo. Dopo ogni esito o salto, l'AI ricalcola il giro dalla tua posizione attuale; e se sei in anticipo può proporti una tabaccheria vicina da aggiungere. Oltre l'orario di fine, invece, il giro non viene più toccato: le tappe restanti rimangono attive, e decidi tu.",
    'v3_s6': "Nella Mappa del giro segui tutto in tempo reale: verdi le completate, grigie le saltate, numerate le rimanenti.",
    'v3_s7': "A fine giornata tocca Termina: il consuntivo riassume tappe completate, ordini, ispezioni, follow-up e chilometri. Tocca Termina definitivamente, e la giornata è in archivio. Buone vendite con AI Tour!",
}

def mp3_duration(path):
    r = subprocess.run([FF, '-i', path], capture_output=True, text=True)
    import re
    m = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', r.stderr)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))

async def main():
    durations = {}
    for key, text in SCENES.items():
        path = f'{OUT}/{key}.mp3'
        if not os.path.exists(path):
            c = edge_tts.Communicate(text, VOICE, rate=RATES.get(key, '+0%'))
            await c.save(path)
        durations[key] = round(mp3_duration(path), 2)
        print(f'{key}: {durations[key]}s')
    with open(f'{OUT}/durations.json', 'w') as f:
        json.dump(durations, f, indent=1)
    print('TOTALE:', round(sum(durations.values()), 1), 's')

asyncio.run(main())
