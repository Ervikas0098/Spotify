from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter(prefix="/api/history", tags=["history"])


@router.post("/")
def log_play(
    data: schemas.HistoryCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = models.PlayHistory(
        user_id=current_user.id,
        song_id=data.song_id,
        deezer_id=data.deezer_id or "",
        song_title=data.song_title,
        artist_name=data.artist_name,
        genre=data.genre or ""
    )
    db.add(entry)
    db.commit()
    return {"detail": "Logged"}


@router.get("/", response_model=List[schemas.HistoryOut])
def get_history(
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return (
        db.query(models.PlayHistory)
        .filter(models.PlayHistory.user_id == current_user.id)
        .order_by(models.PlayHistory.played_at.desc())
        .limit(limit)
        .all()
    )


@router.delete("/")
def clear_history(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(models.PlayHistory).filter(models.PlayHistory.user_id == current_user.id).delete()
    db.commit()
    return {"detail": "History cleared"}
