# 🎵 SoundWave — Full-Stack Music Streaming Platform

A complete, feature-rich music streaming app built with **FastAPI** (Python) backend and a premium **HTML/CSS/JS** frontend.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎵 **Music Player** | Play/pause, next/prev, seekbar, volume, keyboard shortcuts |
| 🔀 **Shuffle & Repeat** | Shuffle queue, repeat one/all/off |
| ❤️ **Liked Songs** | Like any song; access from sidebar |
| 📋 **Playlists** | Create, edit, delete playlists; add local & Deezer tracks |
| 👥 **Collaborative Playlists** | Share invite link; others can add songs |
| 🔍 **Search** | Searches your local library + 90M Deezer catalog (30s previews) |
| 🎙️ **Voice Search** | Click mic icon, speak your query (Chrome/Edge) |
| 📝 **Lyrics** | Real-time lyrics via Lyrics.ovh API |
| 📻 **Podcasts** | Search iTunes + stream RSS podcast episodes |
| 🤖 **Recommendations** | Content-based filtering from your listening history |
| 📈 **Listening History** | Auto-logged; view/clear from sidebar |
| 🔊 **Audio Quality** | Quality selector in header (Auto/Low/Medium/High) |
| 📴 **PWA / Offline** | Installable as app; songs cached for offline use |
| 📱 **Fully Responsive** | Mobile, tablet, desktop — hamburger menu on mobile |

---

## 🛠️ Tech Stack

- **Backend**: FastAPI, Uvicorn, SQLAlchemy, SQLite
- **Auth**: JWT (python-jose), bcrypt (passlib)
- **External APIs**: Deezer (free catalog), Lyrics.ovh (free lyrics), iTunes (podcasts)
- **Frontend**: Vanilla HTML + CSS + JavaScript (no framework)
- **PWA**: Service Worker + Web App Manifest

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python 3.9+** installed
- No Node.js or database setup needed

### 2. Install Python Dependencies

```bash
cd "c:\Users\admin\Desktop\Spotify project1"
pip install -r backend/requirements.txt
```

### 3. Start the Server

```bash
python backend/main.py
```

The server will:
- Automatically create the SQLite database
- Scan all `songs/` subfolders and seed song metadata
- Serve the frontend at `http://localhost:8000`

### 4. Open the App

Open your browser and go to: **http://localhost:8000**

---

## 🎵 Adding Your Own Songs

Your song folders are already set up! Just drop `.mp3` files into any folder:

```
songs/
├── ncs/              ← Drop NCS MP3s here
├── cs/               ← Drop cover songs here
├── Diljit/           ← Drop Diljit songs here
├── karan aujla/      ← Drop Karan Aujla songs here
├── Chill_(mood)/     ← Drop chill songs here
├── Dark_(mood)/
├── Angry_(mood)/
├── Bright_(mood)/
├── Funky_(mood)/
├── Love_(mood)/
└── Uplifting_(mood)/
```

Restart the server and they'll be auto-imported into the database.

**To add a new album folder:**
1. Create a new folder in `songs/`
2. Add a `cover.jpg` and `info.json`:
   ```json
   { "title": "My Album", "description": "A cool album" }
   ```
3. Drop `.mp3` files in the folder
4. Restart the server

---

## 📡 API Reference

The auto-generated interactive API docs are available at:
**`http://localhost:8000/docs`** (Swagger UI)

### Key Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Login, get JWT |
| `GET` | `/api/songs/` | List/search songs |
| `GET` | `/api/songs/albums` | List albums |
| `GET` | `/api/songs/stream/{folder}/{file}` | Stream MP3 |
| `GET` | `/api/deezer/search?q=...` | Search Deezer |
| `GET` | `/api/deezer/chart` | Trending tracks |
| `GET` | `/api/recommendations` | Personalized picks |
| `GET` | `/api/lyrics/?artist=&title=` | Song lyrics |
| `GET/POST` | `/api/playlists/` | Manage playlists |
| `GET/POST` | `/api/liked/` | Like/unlike songs |
| `GET/POST` | `/api/history/` | Play history |
| `GET` | `/api/podcasts/search?q=...` | Search podcasts |
| `GET` | `/api/podcasts/episodes?feed_url=...` | Podcast episodes |

---

## 🏗️ Project Structure

```
Spotify project1/
├── backend/
│   ├── main.py              ← FastAPI entry point
│   ├── database.py          ← SQLite/SQLAlchemy setup
│   ├── models.py            ← ORM models
│   ├── schemas.py           ← Pydantic schemas
│   ├── auth.py              ← JWT + bcrypt
│   ├── seed.py              ← DB seeder from songs/ folder
│   ├── requirements.txt
│   └── routers/
│       ├── auth.py
│       ├── songs.py
│       ├── playlists.py
│       ├── history.py
│       ├── liked.py
│       ├── recommend.py
│       ├── lyrics.py
│       ├── deezer.py
│       └── podcasts.py
├── songs/                   ← Your music folders
├── img/                     ← SVG icons
├── index.html               ← Main app (SPA)
├── style.css                ← Premium dark theme
├── script.js                ← Full app logic
├── sw.js                    ← Service Worker (PWA)
├── manifest.json            ← PWA manifest
└── README.md
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `←` | Seek back 10s |
| `→` | Seek forward 10s |
| `↑` | Volume up |
| `↓` | Volume down |

---

## 📝 Notes

- **Deezer previews** are 30-second clips (legal, free, no API key needed)
- **Lyrics** from Lyrics.ovh (free, may not have all songs)
- **Podcast** search uses iTunes API (free, no key needed)
- Full songs are only played from your own `songs/` folder MP3s
- The database file `backend/spotify.db` is auto-created on first run
