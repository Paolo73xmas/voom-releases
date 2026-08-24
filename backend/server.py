from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
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
