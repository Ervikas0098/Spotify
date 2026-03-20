from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    avatar = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    playlists = relationship("Playlist", back_populates="owner")
    history = relationship("PlayHistory", back_populates="user")
    liked = relationship("LikedSong", back_populates="user")
    followed_artists = relationship("FollowedArtist", back_populates="user")
    podcast_subs = relationship("PodcastSubscription", back_populates="user")


class Song(Base):
    __tablename__ = "songs"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    artist = Column(String, default="Unknown Artist")
    album = Column(String, default="")
    folder = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    genre = Column(String, default="")
    duration = Column(Float, default=0.0)
    cover_url = Column(String, default="")


class Playlist(Base):
    __tablename__ = "playlists"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    description = Column(String, default="")
    is_collaborative = Column(Boolean, default=False)
    invite_code = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="playlists")
    songs = relationship("PlaylistSong", back_populates="playlist", cascade="all, delete-orphan")


class PlaylistSong(Base):
    __tablename__ = "playlist_songs"
    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id"))
    song_id = Column(Integer, ForeignKey("songs.id"), nullable=True)
    deezer_id = Column(String, default="")
    deezer_title = Column(String, default="")
    deezer_artist = Column(String, default="")
    deezer_preview = Column(String, default="")
    deezer_cover = Column(String, default="")
    position = Column(Integer, default=0)
    added_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    playlist = relationship("Playlist", back_populates="songs")


class PlayHistory(Base):
    __tablename__ = "play_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    song_id = Column(Integer, ForeignKey("songs.id"), nullable=True)
    deezer_id = Column(String, default="")
    song_title = Column(String, default="")
    artist_name = Column(String, default="")
    genre = Column(String, default="")
    played_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="history")


class LikedSong(Base):
    __tablename__ = "liked_songs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    song_id = Column(Integer, ForeignKey("songs.id"), nullable=True)
    deezer_id = Column(String, default="")
    song_title = Column(String, default="")
    artist_name = Column(String, default="")
    cover_url = Column(String, default="")
    preview_url = Column(String, default="")
    liked_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="liked")


class FollowedArtist(Base):
    __tablename__ = "followed_artists"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    artist_name = Column(String, nullable=False)
    artist_deezer_id = Column(String, default="")
    followed_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="followed_artists")


class PodcastSubscription(Base):
    __tablename__ = "podcast_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    feed_url = Column(String, nullable=False)
    name = Column(String, default="")
    image_url = Column(String, default="")
    subscribed_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="podcast_subs")
