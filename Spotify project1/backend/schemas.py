from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


# ── Songs ─────────────────────────────────────────────────────────
class SongOut(BaseModel):
    id: int
    title: str
    artist: str
    album: str
    folder: str
    filename: str
    genre: str
    duration: float
    cover_url: str

    class Config:
        from_attributes = True


class AlbumOut(BaseModel):
    folder: str
    title: str
    description: str
    cover_url: str
    song_count: int


# ── Playlists ─────────────────────────────────────────────────────
class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    is_collaborative: Optional[bool] = False


class PlaylistSongAdd(BaseModel):
    song_id: Optional[int] = None
    deezer_id: Optional[str] = ""
    deezer_title: Optional[str] = ""
    deezer_artist: Optional[str] = ""
    deezer_preview: Optional[str] = ""
    deezer_cover: Optional[str] = ""


class PlaylistSongOut(BaseModel):
    id: int
    song_id: Optional[int]
    deezer_id: str
    deezer_title: str
    deezer_artist: str
    deezer_preview: str
    deezer_cover: str
    position: int

    class Config:
        from_attributes = True


class PlaylistOut(BaseModel):
    id: int
    name: str
    description: str
    is_collaborative: bool
    invite_code: str
    created_at: datetime
    songs: List[PlaylistSongOut] = []

    class Config:
        from_attributes = True


# ── History ───────────────────────────────────────────────────────
class HistoryCreate(BaseModel):
    song_id: Optional[int] = None
    deezer_id: Optional[str] = ""
    song_title: str
    artist_name: str
    genre: Optional[str] = ""


class HistoryOut(BaseModel):
    id: int
    song_title: str
    artist_name: str
    genre: str
    played_at: datetime

    class Config:
        from_attributes = True


# ── Liked Songs ───────────────────────────────────────────────────
class LikeCreate(BaseModel):
    song_id: Optional[int] = None
    deezer_id: Optional[str] = ""
    song_title: str
    artist_name: str
    cover_url: Optional[str] = ""
    preview_url: Optional[str] = ""


class LikedOut(BaseModel):
    id: int
    song_id: Optional[int]
    deezer_id: str
    song_title: str
    artist_name: str
    cover_url: str
    preview_url: str
    liked_at: datetime

    class Config:
        from_attributes = True


# ── Artists ───────────────────────────────────────────────────────
class ArtistFollow(BaseModel):
    artist_name: str
    artist_deezer_id: Optional[str] = ""


# ── Podcasts ──────────────────────────────────────────────────────
class PodcastSubscribe(BaseModel):
    feed_url: str
    name: str
    image_url: Optional[str] = ""
