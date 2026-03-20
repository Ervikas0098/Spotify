import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter(prefix="/api/playlists", tags=["playlists"])


@router.get("/", response_model=List[schemas.PlaylistOut])
def get_playlists(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.Playlist).filter(models.Playlist.user_id == current_user.id).all()


@router.post("/", response_model=schemas.PlaylistOut)
def create_playlist(
    data: schemas.PlaylistCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    invite_code = str(uuid.uuid4())[:8] if data.is_collaborative else ""
    playlist = models.Playlist(
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        is_collaborative=data.is_collaborative,
        invite_code=invite_code
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return playlist


@router.put("/{playlist_id}", response_model=schemas.PlaylistOut)
def update_playlist(
    playlist_id: int,
    data: schemas.PlaylistCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pl = db.query(models.Playlist).filter(
        models.Playlist.id == playlist_id,
        models.Playlist.user_id == current_user.id
    ).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    pl.name = data.name
    pl.description = data.description
    pl.is_collaborative = data.is_collaborative
    db.commit()
    db.refresh(pl)
    return pl


@router.delete("/{playlist_id}")
def delete_playlist(
    playlist_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pl = db.query(models.Playlist).filter(
        models.Playlist.id == playlist_id,
        models.Playlist.user_id == current_user.id
    ).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    db.delete(pl)
    db.commit()
    return {"detail": "Deleted"}


@router.post("/{playlist_id}/songs")
def add_song_to_playlist(
    playlist_id: int,
    data: schemas.PlaylistSongAdd,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pl = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    # Allow owner or collaborative users
    if pl.user_id != current_user.id and not pl.is_collaborative:
        raise HTTPException(status_code=403, detail="Not allowed")

    max_pos = db.query(models.PlaylistSong).filter(
        models.PlaylistSong.playlist_id == playlist_id
    ).count()

    ps = models.PlaylistSong(
        playlist_id=playlist_id,
        song_id=data.song_id,
        deezer_id=data.deezer_id or "",
        deezer_title=data.deezer_title or "",
        deezer_artist=data.deezer_artist or "",
        deezer_preview=data.deezer_preview or "",
        deezer_cover=data.deezer_cover or "",
        position=max_pos,
        added_by=current_user.id
    )
    db.add(ps)
    db.commit()
    return {"detail": "Added"}


@router.delete("/{playlist_id}/songs/{ps_id}")
def remove_song_from_playlist(
    playlist_id: int,
    ps_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pl = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if pl.user_id != current_user.id and not pl.is_collaborative:
        raise HTTPException(status_code=403, detail="Not allowed")
    ps = db.query(models.PlaylistSong).filter(
        models.PlaylistSong.id == ps_id,
        models.PlaylistSong.playlist_id == playlist_id
    ).first()
    if not ps:
        raise HTTPException(status_code=404, detail="Song not in playlist")
    db.delete(ps)
    db.commit()
    return {"detail": "Removed"}


@router.get("/join/{invite_code}", response_model=schemas.PlaylistOut)
def get_by_invite(invite_code: str, db: Session = Depends(get_db)):
    pl = db.query(models.Playlist).filter(models.Playlist.invite_code == invite_code).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Invite not found")
    return pl
