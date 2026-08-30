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

BRIEF_SYSTEM = """Sei l'assistente di pianificazione di VOOM CRM per agenti commerciali del settore tabacchi in Italia.
Ricevi una richiesta in linguaggio naturale (dettata o scritta) e la trasformi in un OGGETTO JSON che descrive come costruire il giro visite (AI Tour).

Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, senza markdown.

Schema JSON:
{
  "dayType": "clienti" | "sviluppo" | "mista" | null,   // clienti=solo clienti acquisiti; sviluppo=prospect/orfani/nuovi; mista=mix; null=non specificato
  "area": { "kind": "city" | "province" | "place" | "none", "value": string | null },
      // city=comune (es. "Voghera"); province=sigla o nome provincia (es. "Milano"); place=zona/luogo informale (es. "Lago di Garda"); none=nessuna area
  "segments": [   // uno o piu' filtri sui soggetti da includere; l'unione forma i candidati
     {"type": "clients_all"},                          // tutti i clienti
     {"type": "clients_frequent"},                     // clienti che ordinano spesso / ogni mese / abitualmente
     {"type": "clients_overdue", "minDays": 30},       // clienti che non ordinano da almeno minDays giorni
     {"type": "clients_top", "count": 5},              // i migliori N clienti (per fatturato)
     {"type": "project", "name": "DoctorVape"},        // clienti di un progetto/insegna/catena specifica
     {"type": "orphans", "count": 25},                 // clienti orfani da recuperare (count opzionale)
     {"type": "prospects"},                            // potenziali clienti gia' schedati
     {"type": "new_around", "radiusKm": 5}             // punti vendita NUOVI da acquisire vicino agli altri soggetti selezionati
  ],
  "targetCount": number | null,   // numero massimo di tappe desiderate (es. "25 clienti" -> 25)
  "compact": boolean,             // true se l'utente vuole i soggetti tutti vicini tra loro / in un'unica zona
  "splitDays": 1 | 2,             // 2 se l'utente chiede di dividere il giro su piu' giorni quando non entra in uno
  "startTime": "HH:MM" | null,
  "endTime": "HH:MM" | null,
  "mandatoryAll": boolean,        // true se l'utente vuole ASSOLUTAMENTE tutti i soggetti del filtro (es. "tutti i miei clienti DoctorVape")
  "summary": string               // 1 frase in italiano che riassume come hai interpretato la richiesta
}

Regole:
- Usa SOLO i tipi di segmento elencati. Se un concetto non e' rappresentabile, ignoralo e citalo in "summary".
- "ordinano ogni mese/frequentemente/abitualmente" -> clients_frequent.
- "30 giorni che non ordinano / non raccolgo ordini da X giorni" -> clients_overdue con minDays.
- "recuperare X orfani" -> orphans con count=X, e dayType "sviluppo".
- "migliori clienti" -> clients_top con count.
- "clienti nuovi / acquisire nuovi / clienti nuovi intorno" -> new_around (con radiusKm ragionevole, default 5).
- "tutti i miei clienti <insegna>" -> project con name=insegna e mandatoryAll=true.
- "accorpa in una zona / tutti vicini / zona singola" -> compact=true.
- "se non entra dividilo su due giorni" -> splitDays=2.
- Se un progetto/insegna citato somiglia a uno di quelli disponibili forniti dall'utente, usa il nome disponibile piu' simile.
- Non inventare comuni: se l'area e' un luogo informale (lago, zona, valle) usa kind="place".
"""


class BriefParseRequest(BaseModel):
    text: str
    projects: List[str] = Field(default_factory=list)
    cities: List[str] = Field(default_factory=list)


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
    ctx = ""
    if req.projects:
        ctx += f"\nProgetti/insegne disponibili: {', '.join(req.projects[:60])}."
    if req.cities:
        ctx += f"\nComuni presenti nel portafoglio: {', '.join(req.cities[:150])}."
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"brief-{uuid.uuid4()}",
        system_message=BRIEF_SYSTEM,
    ).with_model("openai", "gpt-5.4")
    try:
        raw = await chat.send_message(UserMessage(
            text=f"Richiesta dell'agente: \"{req.text.strip()}\".{ctx}\nRestituisci SOLO il JSON."
        ))
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
