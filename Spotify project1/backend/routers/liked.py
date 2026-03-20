from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter(prefix="/api/liked", tags=["liked"])


@router.get("/", response_model=List[schemas.LikedOut])
def get_liked(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return (
        db.query(models.LikedSong)
        .filter(models.LikedSong.user_id == current_user.id)
        .order_by(models.LikedSong.liked_at.desc())
        .all()
    )


@router.post("/")
def like_song(
    data: schemas.LikeCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check for duplicate
    existing = db.query(models.LikedSong).filter(
        models.LikedSong.user_id == current_user.id,
        models.LikedSong.song_id == data.song_id if data.song_id else True,
        models.LikedSong.deezer_id == (data.deezer_id or "")
    ).first()
    if existing:
        return {"detail": "Already liked"}

    liked = models.LikedSong(
        user_id=current_user.id,
        song_id=data.song_id,
        deezer_id=data.deezer_id or "",
        song_title=data.song_title,
        artist_name=data.artist_name,
        cover_url=data.cover_url or "",
        preview_url=data.preview_url or ""
    )
    db.add(liked)
    db.commit()
    return {"detail": "Liked"}


@router.delete("/{liked_id}")
def unlike_song(
    liked_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    liked = db.query(models.LikedSong).filter(
        models.LikedSong.id == liked_id,
        models.LikedSong.user_id == current_user.id
    ).first()
    if not liked:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(liked)
    db.commit()
    return {"detail": "Unliked"}


@router.get("/check")
def check_liked(
    song_id: int = None,
    deezer_id: str = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(models.LikedSong).filter(models.LikedSong.user_id == current_user.id)
    if song_id:
        q = q.filter(models.LikedSong.song_id == song_id)
    if deezer_id:
        q = q.filter(models.LikedSong.deezer_id == deezer_id)
    item = q.first()
    return {"liked": item is not None, "id": item.id if item else None}
