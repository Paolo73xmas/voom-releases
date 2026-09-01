"""Narrazione v2 (it-IT-DiegoNeural): scene NUOVE (Dillo all'AI V4, multi-giornata, nome tour,
portafoglio, pallino mappa) + scene aggiornate v2_s5/v2_s6. Gli altri mp3 esistenti restano.
Output: /app/manual/video/audio/*.mp3 + durations.json aggiornato."""
import asyncio, os, json, subprocess, re
import edge_tts
import imageio_ffmpeg

VOICE = 'it-IT-DiegoNeural'
RATES = {}

OUT = '/app/manual/video/audio'
FF = imageio_ffmpeg.get_ffmpeg_exe()

NEW_SCENES = {
    # ── V2 aggiornate (mappa con posizione live, salvataggio con nome) ──
    'v2_s5': "Passa alla vista Mappa: vedi il percorso, le fermate numerate e, novità, il pallino blu con la tua posizione in tempo reale. Con Schermo intero navighi la mappa con le dita, e da ogni fermata apri il navigatore già puntato sulla tappa giusta.",
    'v2_s6': "Se il piano ti convince, tocca Salva: ora puoi dare un nome al giro, così lo riconosci al volo nella scheda I miei Tour. E quando sei pronto a partire, il tasto Avvia Tour è sempre lì, in alto.",
    # ── V6: Dillo all'AI (linguaggio naturale, GPT Luna) ──
    'v6_s1': "E adesso la novità più potente di AI Tour: Dillo all'AI. Dimentica il modulo: descrivi il giro con parole tue, esattamente come lo diresti a un collega. Puoi scriverlo, oppure dettarlo con il microfono.",
    'v6_s2': "Facciamo un esempio vero. Scrivo: domani fammi visitare una decina di clienti Laservideo e DoctorVape, quelli fermi da più tempo, non farmi girare troppo e alla fine torno a casa. Puoi nominare i tuoi progetti, Laservideo, FED, DoctorVape, indicare le zone da includere o da evitare, i clienti da vedere per forza, perfino un appuntamento: alle quindici e trenta dal tabacchi della stazione.",
    'v6_s3': "Tocco Interpreta la richiesta. L'intelligenza artificiale GPT Luna legge la frase, corregge anche il parlato impreciso, e la trasforma in chip chiari e modificabili: i progetti, il numero di visite, la preferenza per i clienti più fermi, il percorso compatto e il rientro a casa. Controlli tutto, correggi o elimini con un tocco: l'ultima parola è sempre tua.",
    'v6_s4': "Tocco Genera il giro. L'AI seleziona i clienti giusti e ottimizza il percorso con un principio economico: meno chilometri e meno tempo alla guida, più valore dai clienti. E siccome l'ho chiesto, il giro si chiude con il rientro verso casa.",
    'v6_s5': "E se chiedi più di quanto entra nel tempo che hai? Proviamo: oggi pomeriggio, dalle quattordici alle diciotto, devo visitare tutti i miei clienti di Voghera, Pavia, Stradella e Broni, tutti quanti. Interpreto e genero.",
    'v6_s6': "Il giro sfora l'orario di lavoro, e l'AI se ne accorge da sola: ti dice di quanto sfora e ti propone di dividere il giro su più giornate. Tocco Sì, crea più giornate.",
    'v6_s7': "Ecco il risultato: il territorio è stato diviso in zone, una per giornata, bilanciate per tempo di lavoro e ordinate in modo intelligente: ogni giorno riparte vicino a dove finisce il precedente, senza mai ripassare due volte nella stessa zona. Tocca i tab Giorno uno, Giorno due e Giorno tre per sfogliare i piani.",
    'v6_s8': "Tocca Salva e dai un nome al giro: tutte le giornate finiscono nella scheda I miei Tour, una per riga, pronte da avviare quando vuoi.",
    'v6_s9': "Ultima novità: la scheda Portafoglio. Qui vedi l'attività di ogni cliente: ultima visita, ultimo pagamento e giorni di ritardo, con la ricerca sempre a portata di mano. E ricorda: GPT Luna impara dall'uso. Ogni richiesta, ogni visita e ogni esito alimentano il database di VOOM, e rendono i prossimi giri sempre più precisi. Buone vendite con AI Tour!",
}

FORCE = {'v6_s5'}  # testi cambiati: rigenera

def mp3_duration(path):
    r = subprocess.run([FF, '-i', path], capture_output=True, text=True)
    m = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', r.stderr)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))

async def main():
    durations = json.load(open(f'{OUT}/durations.json'))
    for key, text in NEW_SCENES.items():
        path = f'{OUT}/{key}.mp3'
        if key in FORCE and os.path.exists(path):
            os.remove(path)
        if not os.path.exists(path):
            c = edge_tts.Communicate(text, VOICE, rate=RATES.get(key, '+0%'))
            await c.save(path)
        durations[key] = round(mp3_duration(path), 2)
        print(f'{key}: {durations[key]}s')
    with open(f'{OUT}/durations.json', 'w') as f:
        json.dump(durations, f, indent=1)
    print('OK, scene totali:', len(durations))

asyncio.run(main())
