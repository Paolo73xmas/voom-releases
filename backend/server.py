from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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
}

@api_router.get("/voice-sample/{name}")
async def get_voice_sample(name: str):
    if not name.replace("_", "").replace("-", "").isalnum():
        raise HTTPException(status_code=404, detail="Non trovato")
    path = f"{VIDEO_DIR}/sample_{name}.mp3"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Campione non trovato")
    return FileResponse(path, media_type="audio/mpeg", filename=f"campione-voce-{name}.mp3")

@api_router.get("/video-tutorial/{num}")
async def get_video_tutorial(num: str):
    if num not in VIDEO_FILES:
        raise HTTPException(status_code=404, detail="Video non trovato")
    src, name = VIDEO_FILES[num]
    path = f"{VIDEO_DIR}/{src}"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Video non ancora generato")
    return FileResponse(path, media_type="video/mp4", filename=name)

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
