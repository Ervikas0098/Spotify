import httpx
import feedparser
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter(prefix="/api/podcasts", tags=["podcasts"])

ITUNES_SEARCH = "https://itunes.apple.com/search"


@router.get("/search")
async def search_podcasts(q: str, limit: int = 10):
    """Search iTunes podcast directory (free API)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(ITUNES_SEARCH, params={
                "term": q, "media": "podcast", "limit": limit
            })
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for p in data.get("results", []):
                    results.append({
                        "name": p.get("collectionName", ""),
                        "author": p.get("artistName", ""),
                        "feed_url": p.get("feedUrl", ""),
                        "image_url": p.get("artworkUrl600", ""),
                        "genre": ", ".join(p.get("genres", [])),
                        "episode_count": p.get("trackCount", 0)
                    })
                return {"results": results}
    except Exception:
        pass
    return {"results": [], "error": "iTunes API unreachable"}


@router.get("/episodes")
async def get_episodes(feed_url: str, limit: int = 20):
    """Parse RSS feed and return episodes."""
    try:
        feed = feedparser.parse(feed_url)
        episodes = []
        for entry in feed.entries[:limit]:
            audio_url = ""
            for link in entry.get("links", []):
                if "audio" in link.get("type", ""):
                    audio_url = link.get("href", "")
                    break
            if not audio_url and entry.get("enclosures"):
                audio_url = entry["enclosures"][0].get("url", "")

            episodes.append({
                "title": entry.get("title", ""),
                "published": entry.get("published", ""),
                "duration": entry.get("itunes_duration", ""),
                "summary": entry.get("summary", "")[:300],
                "audio_url": audio_url,
                "image": entry.get("image", {}).get("href", "") if entry.get("image") else ""
            })
        return {
            "podcast_title": feed.feed.get("title", ""),
            "image": feed.feed.get("image", {}).get("href", "") if feed.feed.get("image") else "",
            "episodes": episodes
        }
    except Exception as e:
        return {"episodes": [], "error": str(e)}


@router.get("/subscriptions")
def get_subscriptions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.PodcastSubscription).filter(
        models.PodcastSubscription.user_id == current_user.id
    ).all()


@router.post("/subscribe")
def subscribe(
    data: schemas.PodcastSubscribe,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing = db.query(models.PodcastSubscription).filter(
        models.PodcastSubscription.user_id == current_user.id,
        models.PodcastSubscription.feed_url == data.feed_url
    ).first()
    if existing:
        return {"detail": "Already subscribed"}
    sub = models.PodcastSubscription(
        user_id=current_user.id,
        feed_url=data.feed_url,
        name=data.name,
        image_url=data.image_url or ""
    )
    db.add(sub)
    db.commit()
    return {"detail": "Subscribed"}


@router.delete("/subscribe")
def unsubscribe(
    feed_url: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(models.PodcastSubscription).filter(
        models.PodcastSubscription.user_id == current_user.id,
        models.PodcastSubscription.feed_url == feed_url
    ).delete()
    db.commit()
    return {"detail": "Unsubscribed"}
