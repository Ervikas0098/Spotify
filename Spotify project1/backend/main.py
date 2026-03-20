import os
import sys

# Make sure imports resolve from this directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine
import models
from seed import seed

# Import all routers
from routers import auth, songs, playlists, history, liked, recommend, lyrics, deezer, podcasts

# Create DB tables on startup
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Spotify Clone API",
    description="Full-featured music streaming platform API",
    version="1.0.0"
)

# ── CORS ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static Files ──────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

songs_dir = os.path.join(BASE_DIR, "songs")
img_dir = os.path.join(BASE_DIR, "img")

if os.path.exists(songs_dir):
    app.mount("/songs", StaticFiles(directory=songs_dir), name="songs")
if os.path.exists(img_dir):
    app.mount("/img", StaticFiles(directory=img_dir), name="img")

# Serve frontend from project root
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="frontend")

# ── Routers ───────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(songs.router)
app.include_router(playlists.router)
app.include_router(history.router)
app.include_router(liked.router)
app.include_router(recommend.router)
app.include_router(lyrics.router)
app.include_router(deezer.router)
app.include_router(podcasts.router)


@app.on_event("startup")
def startup_event():
    """Seed database from songs/ directory on startup."""
    try:
        seed()
    except Exception as e:
        print(f"Seed warning: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
