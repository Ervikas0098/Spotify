import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/api/deezer", tags=["deezer"])

DEEZER_API = "https://api.deezer.com"


@router.get("/search")
async def deezer_search(q: str, limit: int = 20):
    """Search the Deezer catalog. Returns 30-second preview URLs."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{DEEZER_API}/search", params={"q": q, "limit": limit})
            if resp.status_code == 200:
                data = resp.json()
                tracks = []
                for t in data.get("data", []):
                    tracks.append({
                        "type": "deezer",
                        "id": str(t["id"]),
                        "title": t["title"],
                        "artist": t["artist"]["name"],
                        "album": t["album"]["title"],
                        "cover_url": t["album"]["cover_medium"],
                        "preview_url": t["preview"],
                        "duration": t["duration"]
                    })
                return {"results": tracks, "total": data.get("total", 0)}
    except Exception:
        pass
    return {"results": [], "total": 0, "error": "Deezer unreachable"}


@router.get("/chart")
async def deezer_chart(limit: int = 20):
    """Get trending tracks from Deezer chart."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{DEEZER_API}/chart/0/tracks", params={"limit": limit})
            if resp.status_code == 200:
                data = resp.json()
                tracks = []
                for t in data.get("data", []):
                    tracks.append({
                        "type": "deezer",
                        "id": str(t["id"]),
                        "title": t["title"],
                        "artist": t["artist"]["name"],
                        "album": t["album"]["title"],
                        "cover_url": t["album"]["cover_medium"],
                        "preview_url": t["preview"],
                        "duration": t["duration"]
                    })
                return {"results": tracks}
    except Exception:
        pass
    return {"results": [], "error": "Deezer unreachable"}


@router.get("/artist/{artist_id}/top")
async def artist_top_tracks(artist_id: str, limit: int = 10):
    """Get top tracks for an artist from Deezer."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{DEEZER_API}/artist/{artist_id}/top", params={"limit": limit})
            if resp.status_code == 200:
                data = resp.json()
                tracks = []
                for t in data.get("data", []):
                    tracks.append({
                        "type": "deezer",
                        "id": str(t["id"]),
                        "title": t["title"],
                        "artist": t["artist"]["name"],
                        "cover_url": t["album"]["cover_medium"],
                        "preview_url": t["preview"],
                        "duration": t["duration"]
                    })
                return {"results": tracks}
    except Exception:
        pass
    return {"results": []}
