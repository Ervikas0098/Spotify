import os
import mimetypes
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from database import get_db
import models, schemas
from auth import get_optional_user

router = APIRouter(prefix="/api/songs", tags=["songs"])

SONGS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "songs")


@router.get("/albums")
def get_albums(db: Session = Depends(get_db)):
    import json
    albums = []
    if not os.path.exists(SONGS_DIR):
        return albums
    for folder in os.listdir(SONGS_DIR):
        folder_path = os.path.join(SONGS_DIR, folder)
        if not os.path.isdir(folder_path):
            continue
        info_path = os.path.join(folder_path, "info.json")
        title = folder.replace("_", " ").replace("(mood)", "").strip()
        description = "A great collection of songs"
        if os.path.exists(info_path):
            try:
                with open(info_path) as f:
                    info = json.load(f)
                    title = info.get("title", title)
                    description = info.get("description", description)
            except Exception:
                pass
        song_count = db.query(models.Song).filter(models.Song.folder == folder).count()
        cover_url = f"/songs/{folder}/cover.jpg"
        albums.append({
            "folder": folder,
            "title": title,
            "description": description,
            "cover_url": cover_url,
            "song_count": song_count
        })
    return albums


@router.get("/", response_model=List[schemas.SongOut])
def get_songs(
    search: Optional[str] = None,
    genre: Optional[str] = None,
    artist: Optional[str] = None,
    folder: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(models.Song)
    if search:
        q = q.filter(
            models.Song.title.ilike(f"%{search}%") |
            models.Song.artist.ilike(f"%{search}%") |
            models.Song.album.ilike(f"%{search}%")
        )
    if genre:
        q = q.filter(models.Song.genre.ilike(f"%{genre}%"))
    if artist:
        q = q.filter(models.Song.artist.ilike(f"%{artist}%"))
    if folder:
        q = q.filter(models.Song.folder == folder)
    return q.all()


@router.get("/stream/{folder:path}/{filename:path}")
async def stream_song(folder: str, filename: str, request: Request):
    """Stream MP3 with Range header support for seeking."""
    file_path = os.path.join(SONGS_DIR, folder, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Song file not found")

    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("range")

    mime_type = mimetypes.guess_type(file_path)[0] or "audio/mpeg"

    if range_header:
        start, end = 0, file_size - 1
        range_val = range_header.replace("bytes=", "")
        parts = range_val.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        end = min(end, file_size - 1)
        chunk_size = end - start + 1

        def iterfile():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    read_size = min(65536, remaining)
                    data = f.read(read_size)
                    if not data:
                        break
                    yield data
                    remaining -= len(data)

        return StreamingResponse(
            iterfile(),
            status_code=206,
            media_type=mime_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_size),
            }
        )

    def iterfile_full():
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                yield chunk

    return StreamingResponse(
        iterfile_full(),
        media_type=mime_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
        }
    )


@router.get("/{song_id}", response_model=schemas.SongOut)
def get_song(song_id: int, db: Session = Depends(get_db)):
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return song
