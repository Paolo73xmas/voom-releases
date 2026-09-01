from fastapi import FastAPI, APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import json as _json
import tempfile
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Manuale utente PDF (generato in /app/manual)
MANUAL_PATH = "/app/manual/manuale-utente-voom.pdf"
MANUAL_AITOUR_PATH = "/app/manual/manuale-ai-tour-agente-mobile.pdf"

@api_router.get("/manual")
async def get_manual():
    return FileResponse(
        MANUAL_PATH,
        media_type="application/pdf",
        filename="Manuale-Utente-VOOM-crm.pdf",
    )

@api_router.get("/manual-aitour")
async def get_manual_aitour():
    return FileResponse(
        MANUAL_AITOUR_PATH,
        media_type="application/pdf",
        filename="Manuale-AI-Tour-Agente-VOOM-crm.pdf",
    )

# Video tutorial AI Tour (generati in /app/manual/video)
VIDEO_DIR = "/app/manual/video"
VIDEO_FILES = {
    "1": ("aitour-tutorial-1-genera.mp4", "Tutorial-1-Genera-Tour.mp4"),
    "2": ("aitour-tutorial-2-risultato.mp4", "Tutorial-2-Mappa-Risultato.mp4"),
    "3": ("aitour-tutorial-3-live.mp4", "Tutorial-3-Live-Orfani.mp4"),
    "4": ("aitour-tutorial-4-fasce.mp4", "Tutorial-4-Fasce-Orarie.mp4"),
    "5": ("aitour-tutorial-5-liveops.mp4", "Tutorial-5-Operazioni-Live.mp4"),
    "completo": ("aitour-tutorial-completo.mp4", "Tutorial-AI-Tour-Completo.mp4"),
}

@api_router.get("/sim-mai-visitato")
async def get_sim_mai_visitato():
    return FileResponse("/app/manual/sim/sim-mai-visitato.png", media_type="image/png", filename="Simulazione-Mai-Visitato.png")

@api_router.get("/voice-sample/{name}")
async def get_voice_sample(name: str):
    if not name.replace("_", "").replace("-", "").isalnum():
        raise HTTPException(status_code=404, detail="Non trovato")
    path = f"{VIDEO_DIR}/sample_{name}.mp3"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Campione non trovato")
    return FileResponse(path, media_type="audio/mpeg", filename=f"campione-voce-{name}.mp3")

@api_router.api_route("/video-tutorial/{num}", methods=["GET", "HEAD"])
async def get_video_tutorial(num: str, request: Request):
    if num not in VIDEO_FILES:
        raise HTTPException(status_code=404, detail="Video non trovato")
    src, name = VIDEO_FILES[num]
    path = f"{VIDEO_DIR}/{src}"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Video non ancora generato")

    file_size = os.path.getsize(path)
    common_headers = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'attachment; filename="{name}"',
    }

    if request.method == "HEAD":
        return Response(
            status_code=200,
            media_type="video/mp4",
            headers={**common_headers, "Content-Length": str(file_size)},
        )

    range_header = request.headers.get("range")
    if range_header:
        # es. "bytes=0-1023" oppure "bytes=1024-" — richiesto da Safari/iOS per i video
        m = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if m:
            start = int(m.group(1)) if m.group(1) else 0
            end = int(m.group(2)) if m.group(2) else file_size - 1
            end = min(end, file_size - 1)
            if start > end or start >= file_size:
                return Response(
                    status_code=416,
                    headers={"Content-Range": f"bytes */{file_size}"},
                )

            def iter_range(p, s, e, chunk=1024 * 512):
                with open(p, "rb") as f:
                    f.seek(s)
                    remaining = e - s + 1
                    while remaining > 0:
                        data = f.read(min(chunk, remaining))
                        if not data:
                            break
                        remaining -= len(data)
                        yield data

            return StreamingResponse(
                iter_range(path, start, end),
                status_code=206,
                media_type="video/mp4",
                headers={
                    **common_headers,
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Content-Length": str(end - start + 1),
                },
            )

    return FileResponse(path, media_type="video/mp4", filename=name, headers={"Accept-Ranges": "bytes"})

# ==================== AI Tour: voce + interpretazione richiesta ====================
from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText
from emergentintegrations.llm.chat import LlmChat, UserMessage

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
AUDIO_EXTS = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"]

BRIEF_SYSTEM = """Sei l'interprete di "Dillo all'AI" (AI Tour, CRM VOOM): agenti di commercio che visitano tabaccherie/punti vendita in Italia descrivono liberamente il giro che vogliono fare. Tu NON sei il planner: trasformi il linguaggio libero (spesso trascrizione vocale sporca: errori, correzioni, pronomi, nomi storpiati) nell'oggetto JSON TourBrief V4. Capisci l'INTENZIONE commerciale, non le parole alla lettera. Massima elasticita' in ingresso, massimo rigore in uscita. Rispondi SOLO con JSON valido, nessun markdown/testo. Non inventare MAI: clienti, comuni, progetti, numeri, soglie, orari, date.
INPUT: {text, projects[] (nomi ufficiali progetti: match fonetico tollerante, restituisci SEMPRE il nome ufficiale), cities[] (comuni dell'agente: correggi la trascrizione), currentDate}.
OUTPUT (tutti i campi SEMPRE presenti, null/[]/default se non espressi):
{
 "version":"4.0",
 "dayType":"clienti"|"sviluppo"|"mista"|null,
 "requestedDate":{"type":"today"|"tomorrow"|"explicit"|"unspecified","value":"YYYY-MM-DD"|null},
 "areas":[{"kind":"city"|"province"|"place","value":"...","mode":"include"|"exclude"|"prefer"}],
 "selection":{"operator":"AND"|"OR","conditions":[...]},
 "mandatoryStops":[{"rawReference":"...","cityHint":null,"appointment":{"type":"exact"|"approximate"|"window","time":"HH:MM"|null,"from":null,"to":null}|null}],
 "preferredStops":[{"rawReference":"...","cityHint":null}],
 "exclusions":[...],
 "preferences":[{"type":"prefer_oldest_last_order"|"prefer_oldest_last_visit"|"prefer_highest_revenue"|"prefer_nearest"|"prefer_area","value":null}],
 "projectRules":[{"type":"priority"|"minimum_count"|"maximum_count"|"exact_count"|"ratio","project":"...","value":0,"priority":1}],
 "fillers":[{"selection":{"operator":"AND","conditions":[...]},"when":"time_available","target":{"mode":"maximum","value":3}}],
 "visitTarget":{"mode":"exact"|"approximately"|"minimum"|"maximum"|"range"|"all"|"maximize"|"unspecified","value":null,"min":null,"max":null,"scope":"total_including_mandatory"|"automatic_plus_mandatory"},
 "route":{"compact":"off"|"prefer"|"required","startTime":null,"endTime":null,"finishBy":null,"returnHome":false,"returnToStart":false,"splitAllowed":null,"maxDays":null},
 "interpretation":{"confidence":1.0,"needsConfirmation":false,"unresolvedEntities":[],"warnings":[]},
 "summary":"1-2 frasi italiane naturali non tecniche che restituiscono all'agente cosa hai capito"
}
CONDIZIONI ammesse in selection/exclusions/fillers: {"type":"clients_all"} {"type":"clients_frequent"} {"type":"clients_top","count":5} {"type":"project_membership","names":["FED"],"match":"any"|"all"} {"type":"orphans","count":null} {"type":"prospects"} {"type":"new_around","radiusKm":5} {"type":"last_order_days","operator":">=","value":30} {"type":"last_visit_days","operator":">=","value":30} {"type":"revenue","operator":">=","value":1000} {"type":"orders_count","periodDays":90,"operator":">=","value":3}.
REGOLE SELEZIONE: piu' progetti nominati -> UN solo project_membership con names=[tutti], match "any" (appartenenza ad ALMENO uno); match "all" SOLO se dice "sia X che Y"/"entrambi". Condizioni entita' (progetti/tutti/orfani/prospect) si UNISCONO; le condizioni numeriche FILTRANO il bacino: "FED e DoctorVape che non ordinano da un mese" = (FED OR DV) AND last_order_days>=30, operator resta "AND". "ordinano ogni mese/spesso"->clients_frequent; "migliori"->clients_top; "recuperare orfani"->orphans + dayType sviluppo; project_membership SOLO con insegna nominata; "tutti i miei clienti" senza insegna->clients_all + visitTarget all.
DATA: "domani"->tomorrow con value calcolato da currentDate; data precisa->explicit; niente->unspecified. Orari: "dalle 9 alle 17"->startTime/endTime; "per le 18 devo aver finito/essere a casa"->finishBy (+returnHome se dice casa).
AREE: piu' aree possibili; "tranne/evita Milano"->mode exclude; "possibilmente Pavia"->prefer; luogo informale (zona lago, verso Malpensa)->kind place. Non inventare comuni: usa il piu' simile in cities[].
CLIENTI NOMINATI: tu NON hai l'anagrafica: metti in rawReference il riferimento cosi' come detto ("Rossi di Pavia", "il bar della stazione"), cityHint se deducibile. OBBLIGATORI (devo/per forza/assolutamente/non puo' saltare/appuntamento/mi raccomando)->mandatoryStops: restano anche se fuori area o fuori progetto. DESIDERATI (se riesci/magari/preferirei/prova a)->preferredStops. Appuntamento: "alle 15 ho appuntamento"->exact 15:00; "verso le tre"->approximate 15:00; "tra le 14 e le 16"->window from/to. Un appuntamento implica mandatory.
TARGET: "10 precise"->exact; "una decina/dozzina/ventina/un paio"->approximately 10/12/20/2; "massimo/non piu' di/fino a 12"->maximum; "almeno 10"->minimum; "tra 10 e 15"->range; "tutti"->all; "quanti piu' possibile/riempi la giornata"->maximize. "10 visite e devo vedere Rossi"->scope total_including_mandatory (default); "oltre a Rossi fammene 10"->automatic_plus_mandatory.
"SOLO/soltanto/giusto/basta": determina lo scope, MAI applicarlo a tutta la frase: "solo 10"->maximum 10; "solo clienti"->dayType clienti; "solo FED"->solo quel progetto; "solo Pavia"->area vincolante; "solo 10 tra FED e DV"->maximum 10 COMPLESSIVO (mai 10+10).
QUOTE/PRIORITA': "prima FED poi DV"->projectRules priority; "almeno 6 FED"->minimum_count; "non piu' di 4 DV"->maximum_count; "5 e 5"->exact_count; "meta' e meta'"->ratio 0.5 (senza inventare il totale).
PREFERENZE (sacrificabili): "quelli piu' fermi" con contesto ordini->prefer_oldest_last_order, con contesto visite->prefer_oldest_last_visit; "non ordinano da un po'/da tanto" SENZA numero->preferenza, NON inventare 30gg (30gg solo se dice "un mese"). ESCLUSIONI: "niente prospect"->{"type":"prospects"} in exclusions; "non quelli visti questa settimana"->{"type":"last_visit_days","operator":"<=","value":7} in exclusions; "non DoctorVape"->project_membership in exclusions.
FILLER: "se avanza tempo/se finisco prima mettimi X"->fillers (NON selection): "massimo tre prospect"->target maximum 3.
PERCORSO: "vicini/poca strada/non farmi girare troppo"->compact prefer; "devono stare tutti in una zona"->required. "torno a casa/verso casa/rientro"->returnHome; "torno da dove parto/giro ad anello/alla base"->returnToStart. "se non ci stanno dividili"->splitAllowed true; "devono stare tutti oggi"->splitAllowed false; "massimo due giorni"->maxDays 2; se non ne parla->splitAllowed null e maxDays null.
CORREZIONI (no/anzi/aspetta/volevo dire/facciamo): vale l'ULTIMA formulazione: "Pavia no aspetta Voghera"->solo Voghera; "15 anzi 10"->10; "Rossi e Bianchi, anzi Bianchi no"->solo Rossi. Ignora riempitivi (allora/praticamente/cioe'/diciamo). Le negazioni (non/niente/tranne/evita/senza/lascia fuori) generano esclusioni.
GERARCHIA in conflitto: appuntamenti > obbligatori > esclusioni > orari rigidi > quantita' > selezione > quote > priorita' > preferenze > filler. Contraddizioni ("tutti i FED ma massimo 10", "non voglio Voghera ma devo vedere Rossi a Voghera"): mantieni ENTRAMBI i concetti + warning; l'obbligatorio e' eccezione al filtro. Impossibilita' materiali: registra e segnala warning, decide il planner.
CONFIDENCE: 0.95+ chiara; 0.8+ affidabile; <0.6 ambigua. needsConfirmation true SOLO se l'ambiguita' cambia materialmente il giro (mai solo perche' parla male). Entita' non riconosciute -> unresolvedEntities, MAI inventare match.
ESEMPI: "domani una dozzina di fed e doctor vape a pavia quelli che non ordinano da tanto e non farmi girare troppo tornando a casa" -> tomorrow, approximately 12, project_membership [FED,DoctorVape] any, area Pavia include, prefer_oldest_last_order, compact prefer, returnHome. || "fammi tutti i fed di pavia ma non quelli visti questa settimana se sono troppi dividili su tre giorni" -> all, FED, Pavia, exclusions last_visit_days<=7, splitAllowed true, maxDays 3. || "10 fed o doctor vape pero' almeno sei fed e devo assolutamente vedere il tabacchi rossi di voghera" -> exact 10 total_including_mandatory, project_membership any, projectRules minimum_count FED 6, mandatoryStops [{rawReference:"tabacchi rossi di voghera",cityHint:"Voghera"}]. || "alle tre e mezza ho appuntamento da fumagalli poi fammi quelli piu' comodi e per le sei devo essere a casa" -> mandatoryStops fumagalli appointment exact 15:30, prefer_nearest, finishBy 18:00, returnHome true."""


class BriefParseRequest(BaseModel):
    text: str
    projects: List[str] = Field(default_factory=list)
    cities: List[str] = Field(default_factory=list)
    today: str = ""


def _extract_json(raw: str):
    if not raw:
        return None
    raw = raw.strip()
    # rimuove eventuali fence markdown
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw).strip()
    try:
        return _json.loads(raw)
    except Exception:
        pass
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if m:
        try:
            return _json.loads(m.group(0))
        except Exception:
            return None
    return None


@api_router.post("/ai-tour/transcribe")
async def ai_tour_transcribe(audio: UploadFile = File(...)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="Servizio vocale non configurato")
    suffix = os.path.splitext(audio.filename or "")[1].lower()
    if suffix not in AUDIO_EXTS:
        suffix = ".m4a"
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Audio vuoto")
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(data)
    tmp.flush()
    tmp.close()
    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        resp = await stt.transcribe(file=Path(tmp.name), model="whisper-1", response_format="json", language="it")
        text = getattr(resp, "text", None)
        if text is None and isinstance(resp, dict):
            text = resp.get("text", "")
        return {"text": (text or "").strip()}
    except Exception as e:
        logger.error(f"[ai-tour] transcribe: {e}")
        raise HTTPException(status_code=500, detail="Trascrizione non riuscita")
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass


@api_router.post("/ai-tour/parse-brief")
async def ai_tour_parse_brief(req: BriefParseRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="Servizio AI non configurato")
    if not (req.text or "").strip():
        raise HTTPException(status_code=400, detail="Richiesta vuota")
    payload = {
        "text": req.text.strip()[:4000],
        "projects": req.projects[:100],
        "cities": req.cities[:300],
        "currentDate": req.today or "",
    }
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"brief-{uuid.uuid4()}",
        system_message=BRIEF_SYSTEM,
    ).with_model("openai", "gpt-5.6-luna")
    try:
        raw = await chat.send_message(UserMessage(text=_json.dumps(payload, ensure_ascii=False)))
        brief = _extract_json(raw)
        if not isinstance(brief, dict):
            raise ValueError("risposta non JSON")
        return brief
    except Exception as e:
        logger.error(f"[ai-tour] parse-brief: {e}")
        raise HTTPException(status_code=500, detail="Interpretazione non riuscita")


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
