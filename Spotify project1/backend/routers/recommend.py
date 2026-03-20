from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from collections import Counter
from database import get_db
import models
from auth import get_optional_user

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("/")
def get_recommendations(
    current_user=Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Content-based filtering:
    1. Analyze user's play history & liked songs for genre/artist affinity.
    2. Score all local songs by affinity.
    3. Return top-N sorted by score (diverse, not just most-played).
    """
    all_songs = db.query(models.Song).all()

    if not current_user:
        # Return random selection for guests
        import random
        sample = random.sample(all_songs, min(10, len(all_songs)))
        return _format_local(sample)

    # Gather affinity signals
    history = db.query(models.PlayHistory).filter(
        models.PlayHistory.user_id == current_user.id
    ).order_by(models.PlayHistory.played_at.desc()).limit(100).all()

    liked = db.query(models.LikedSong).filter(
        models.LikedSong.user_id == current_user.id
    ).all()

    genre_counts = Counter()
    artist_counts = Counter()

    for h in history:
        if h.genre:
            genre_counts[h.genre.lower()] += 1
        if h.artist_name:
            artist_counts[h.artist_name.lower()] += 1

    for lk in liked:
        if lk.artist_name:
            artist_counts[lk.artist_name.lower()] += 2  # weight likes more

    # Score local songs
    played_song_ids = {h.song_id for h in history if h.song_id}

    def score(song):
        s = 0
        if song.genre and song.genre.lower() in genre_counts:
            s += genre_counts[song.genre.lower()] * 2
        if song.artist and song.artist.lower() in artist_counts:
            s += artist_counts[song.artist.lower()] * 3
        if song.id in played_song_ids:
            s -= 1  # slight penalty for already-played, to diversify
        return s

    sorted_songs = sorted(all_songs, key=score, reverse=True)
    top = sorted_songs[:12]

    return _format_local(top)


def _format_local(songs):
    return [
        {
            "type": "local",
            "id": s.id,
            "title": s.title,
            "artist": s.artist,
            "cover_url": s.cover_url,
            "folder": s.folder,
            "filename": s.filename,
            "genre": s.genre
        }
        for s in songs
    ]
