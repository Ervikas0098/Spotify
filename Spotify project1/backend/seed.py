import os
import sys
import json

# Add parent dir to path so imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
import models

SONGS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "songs")

# Mapping folder names to genres for better recommendations
FOLDER_GENRE_MAP = {
    "ncs": "Electronic",
    "cs": "Pop",
    "Diljit": "Punjabi",
    "Chill_(mood)": "Chill",
    "Dark_(mood)": "Dark",
    "Angry_(mood)": "Rock",
    "Bright_(mood)": "Happy",
    "Funky_(mood)": "Funk",
    "karan aujla": "Punjabi",
    "Love_(mood)": "Romance",
    "Uplifting_(mood)": "Uplifting",
}

FOLDER_ARTIST_MAP = {
    "Diljit": "Diljit Dosanjh",
    "karan aujla": "Karan Aujla",
    "ncs": "NCS",
}


def seed():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if not os.path.exists(SONGS_DIR):
            print(f"Songs directory not found: {SONGS_DIR}")
            return

        for folder in os.listdir(SONGS_DIR):
            folder_path = os.path.join(SONGS_DIR, folder)
            if not os.path.isdir(folder_path):
                continue

            # Read info.json
            info_path = os.path.join(folder_path, "info.json")
            album_title = folder.replace("_", " ").replace("(mood)", "").strip()
            if os.path.exists(info_path):
                try:
                    with open(info_path) as f:
                        info = json.load(f)
                        album_title = info.get("title", album_title)
                except Exception:
                    pass

            genre = FOLDER_GENRE_MAP.get(folder, "")
            default_artist = FOLDER_ARTIST_MAP.get(folder, "Various Artists")
            cover_url = f"/songs/{folder}/cover.jpg"

            # Find MP3 files in the folder
            mp3_files = [
                f for f in os.listdir(folder_path)
                if f.lower().endswith(".mp3")
            ]

            for mp3 in mp3_files:
                # Check if already seeded
                existing = db.query(models.Song).filter(
                    models.Song.folder == folder,
                    models.Song.filename == mp3
                ).first()
                if existing:
                    continue

                title = mp3.replace(".mp3", "").replace("_", " ").strip()
                song = models.Song(
                    title=title,
                    artist=default_artist,
                    album=album_title,
                    folder=folder,
                    filename=mp3,
                    genre=genre,
                    duration=0.0,
                    cover_url=cover_url
                )
                db.add(song)
                print(f"  Seeded: {folder}/{mp3}")

        db.commit()
        print("Database seeding complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
