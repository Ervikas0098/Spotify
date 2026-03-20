import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/api/lyrics", tags=["lyrics"])

LYRICS_API = "https://api.lyrics.ovh/v1"


@router.get("/")
async def get_lyrics(artist: str, title: str):
    """Proxy to Lyrics.ovh free API."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            url = f"{LYRICS_API}/{artist}/{title}"
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                return {"lyrics": data.get("lyrics", ""), "found": True}
            return {"lyrics": "", "found": False}
    except Exception:
        return {"lyrics": "", "found": False, "error": "Could not reach lyrics service"}
