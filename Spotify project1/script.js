/* ══════════════════════════════════════════════════════════════════
   SoundWave - Complete App Logic
   Modules: API, Auth, Player, Library, Search, Playlists, Podcasts
══════════════════════════════════════════════════════════════════ */
'use strict';

const API = 'http://localhost:8000';

/* ══════════════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════════════ */
const state = {
  token: localStorage.getItem('sw_token') || null,
  user: JSON.parse(localStorage.getItem('sw_user') || 'null'),
  currentSong: null,
  currentType: null, // 'local' | 'deezer' | 'podcast'
  queue: [],
  queueIndex: 0,
  shuffle: false,
  repeat: 'off', // 'off' | 'all' | 'one'
  isPlaying: false,
  currentView: 'home',
  currentAlbum: null,
  currentPlaylistId: null,
  pendingAddSong: null, // song to add to playlist (via "Add to Playlist" modal)
  likedIds: new Set(),
};

const audio = new Audio();
audio.volume = 0.8;
audio.preload = 'metadata';

/* ══════════════════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════════════════ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function fmt(secs) {
  if (isNaN(secs) || secs == null) return '0:00';
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function toast(msg, duration = 2500) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.classList.add('hidden'), 300); }, duration);
}

function setView(view) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${view}`)?.classList.add('active');
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  state.currentView = view;
  // Hide mobile sidebar
  $('#sidebar').classList.remove('open');
  $('#sidebar-overlay').classList.add('hidden');
}

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

function greetUser() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  $('#home-greeting').textContent = state.user ? `${greet}, ${state.user.username}!` : `${greet}!`;
}

/* ══════════════════════════════════════════════════════════════════
   AUTH MODULE
══════════════════════════════════════════════════════════════════ */
function updateAuthUI() {
  const authArea = $('#auth-area');
  const userArea = $('#user-area');
  if (state.user) {
    authArea.classList.add('hidden');
    userArea.classList.remove('hidden');
    $('#username-display').textContent = state.user.username;
    const av = $('#user-avatar');
    av.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(state.user.username)}&background=1DB954&color=000&size=64`;
  } else {
    authArea.classList.remove('hidden');
    userArea.classList.add('hidden');
  }
  greetUser();
}

function openAuthModal(tab = 'login') {
  $('#auth-modal').classList.remove('hidden');
  switchAuthTab(tab);
}

function closeAuthModal() { $('#auth-modal').classList.add('hidden'); }

function switchAuthTab(tab) {
  $('#login-form').classList.toggle('hidden', tab !== 'login');
  $('#signup-form').classList.toggle('hidden', tab !== 'signup');
  $$('.modal-tab').forEach(t => t.classList.toggle('active', t.id === `tab-${tab}`));
}

async function handleLogin(e) {
  e.preventDefault();
  const email = $('#login-email').value, password = $('#login-password').value;
  const errEl = $('#login-error');
  errEl.classList.add('hidden');
  try {
    const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    state.token = data.access_token;
    state.user = data.user;
    localStorage.setItem('sw_token', data.access_token);
    localStorage.setItem('sw_user', JSON.stringify(data.user));
    closeAuthModal();
    updateAuthUI();
    onLogin();
    toast(`Welcome back, ${data.user.username}!`);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const username = $('#signup-username').value, email = $('#signup-email').value, password = $('#signup-password').value;
  const errEl = $('#signup-error');
  errEl.classList.add('hidden');
  try {
    const data = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });
    state.token = data.access_token;
    state.user = data.user;
    localStorage.setItem('sw_token', data.access_token);
    localStorage.setItem('sw_user', JSON.stringify(data.user));
    closeAuthModal();
    updateAuthUI();
    onLogin();
    toast(`Welcome to SoundWave, ${data.user.username}!`);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function logout() {
  state.token = null;
  state.user = null;
  state.likedIds.clear();
  localStorage.removeItem('sw_token');
  localStorage.removeItem('sw_user');
  updateAuthUI();
  loadSidebarPlaylists();
  toast('Logged out');
}

async function onLogin() {
  await loadLikedIds();
  await loadSidebarPlaylists();
  loadRecentHistory();
  loadRecommendations();
}

/* ══════════════════════════════════════════════════════════════════
   LIKED SONGS
══════════════════════════════════════════════════════════════════ */
async function loadLikedIds() {
  if (!state.token) return;
  try {
    const data = await apiFetch('/api/liked/');
    state.likedIds = new Set(data.map(l => l.deezer_id || `local_${l.song_id}`));
  } catch {}
}

async function toggleLike(songObj) {
  if (!state.token) { openAuthModal(); toast('Log in to like songs'); return; }
  const key = songObj.type === 'deezer' ? songObj.id : `local_${songObj.id}`;
  if (state.likedIds.has(key)) {
    // Unlike - find the id
    try {
      const liked = await apiFetch('/api/liked/');
      const item = liked.find(l => (l.deezer_id === key) || (`local_${l.song_id}` === key));
      if (item) { await apiFetch(`/api/liked/${item.id}`, { method: 'DELETE' }); }
      state.likedIds.delete(key);
      updateLikeBtn(false);
      toast('Removed from Liked Songs');
    } catch {}
  } else {
    try {
      await apiFetch('/api/liked/', {
        method: 'POST',
        body: JSON.stringify({
          song_id: songObj.type === 'local' ? songObj.id : null,
          deezer_id: songObj.type === 'deezer' ? songObj.id : '',
          song_title: songObj.title,
          artist_name: songObj.artist,
          cover_url: songObj.cover_url || '',
          preview_url: songObj.type === 'deezer' ? (songObj.preview_url || '') : ''
        })
      });
      state.likedIds.add(key);
      updateLikeBtn(true);
      toast('Added to Liked Songs');
    } catch {}
  }
}

function updateLikeBtn(liked) {
  const btn = $('#player-like-btn');
  btn?.classList.toggle('liked', liked);
}

async function loadLikedView() {
  if (!state.token) { toast('Log in to see Liked Songs'); openAuthModal(); return; }
  try {
    const data = await apiFetch('/api/liked/');
    $('#liked-count').textContent = `${data.length} songs`;
    const list = $('#liked-song-list');
    list.innerHTML = '';
    if (!data.length) { list.innerHTML = '<div class="empty-msg">No liked songs yet. Heart a song to save it here.</div>'; return; }
    data.forEach((item, i) => {
      const songObj = {
        type: item.deezer_id ? 'deezer' : 'local',
        id: item.deezer_id || item.song_id,
        title: item.song_title,
        artist: item.artist_name,
        cover_url: item.cover_url,
        preview_url: item.preview_url
      };
      list.appendChild(makeSongItem(songObj, i + 1, {
        onUnlike: async () => {
          await apiFetch(`/api/liked/${item.id}`, { method: 'DELETE' });
          state.likedIds.delete(item.deezer_id || `local_${item.song_id}`);
          loadLikedView();
        }
      }));
    });
  } catch (e) { toast('Could not load liked songs'); }
}

/* ══════════════════════════════════════════════════════════════════
   HISTORY
══════════════════════════════════════════════════════════════════ */
async function logPlay(songObj) {
  if (!state.token) return;
  try {
    await apiFetch('/api/history/', {
      method: 'POST',
      body: JSON.stringify({
        song_id: songObj.type === 'local' ? songObj.id : null,
        deezer_id: songObj.type === 'deezer' ? songObj.id : '',
        song_title: songObj.title,
        artist_name: songObj.artist,
        genre: songObj.genre || ''
      })
    });
  } catch {}
}

async function loadRecentHistory() {
  // Home view mini-list
  const list = $('#recent-list');
  if (!state.token || !list) return;
  try {
    const data = await apiFetch('/api/history/?limit=6');
    list.innerHTML = '';
    if (!data.length) { list.innerHTML = '<div class="empty-msg">Start listening to see your history here</div>'; return; }
    data.forEach(item => {
      const div = document.createElement('div');
      div.className = 'song-item';
      div.innerHTML = `<div class="song-item-info"><div class="song-item-title">${item.song_title}</div><div class="song-item-artist">${item.artist_name}</div></div>`;
      list.appendChild(div);
    });
  } catch {}
}

async function loadHistoryView() {
  if (!state.token) { toast('Log in to see history'); openAuthModal(); return; }
  try {
    const data = await apiFetch('/api/history/?limit=50');
    const list = $('#history-list');
    list.innerHTML = '';
    if (!data.length) { list.innerHTML = '<div class="empty-msg">No listening history yet.</div>'; return; }
    data.forEach((item, i) => {
      const songObj = {
        type: item.deezer_id ? 'deezer' : 'local',
        id: item.deezer_id || null,
        title: item.song_title,
        artist: item.artist_name,
        cover_url: ''
      };
      const el = makeSongItem(songObj, i + 1);
      list.appendChild(el);
    });
  } catch { toast('Could not load history'); }
}

async function clearHistory() {
  if (!state.token) return;
  try {
    await apiFetch('/api/history/', { method: 'DELETE' });
    toast('History cleared');
    loadHistoryView();
    loadRecentHistory();
  } catch {}
}

/* ══════════════════════════════════════════════════════════════════
   PLAYER MODULE
══════════════════════════════════════════════════════════════════ */
function playSong(songObj) {
  state.currentSong = songObj;
  state.currentType = songObj.type;

  // Determine audio URL
  let src = '';
  if (songObj.type === 'local') {
    src = `${API}/api/songs/stream/${encodeURIComponent(songObj.folder)}/${encodeURIComponent(songObj.filename)}`;
  } else if (songObj.type === 'deezer') {
    src = songObj.preview_url || '';
    if (!src) { toast('No preview available for this track'); return; }
  } else if (songObj.type === 'podcast') {
    src = songObj.audio_url || '';
    if (!src) { toast('No audio available for this episode'); return; }
  }

  audio.src = src;
  audio.play().catch(() => toast('Could not play this track'));
  state.isPlaying = true;

  updatePlayerUI(songObj);
  logPlay(songObj);

  const key = songObj.type === 'deezer' ? songObj.id : `local_${songObj.id}`;
  updateLikeBtn(state.likedIds.has(key));
  highlightCurrentSong();
  updateQueueUI();
}

function updatePlayerUI(song) {
  $('#player-title').textContent = song.title || 'Unknown';
  $('#player-artist').textContent = song.artist || '—';
  const cover = $('#player-cover');
  if (song.cover_url) {
    cover.src = song.cover_url;
    cover.onerror = () => { cover.src = '/img/cover.jpg'; };
  } else {
    cover.src = '/img/cover.jpg';
  }
  setPlayPauseIcon(true);
  // Update page title
  document.title = `${song.title} • SoundWave`;
  // Update lyrics panel song name
  $('#lyrics-song-name').textContent = `${song.title} — ${song.artist}`;
}

function setPlayPauseIcon(playing) {
  $('#play-icon').classList.toggle('hidden', playing);
  $('#pause-icon').classList.toggle('hidden', !playing);
  state.isPlaying = playing;
}

function highlightCurrentSong() {
  $$('.song-item').forEach(el => el.classList.remove('playing'));
  $$('.queue-item').forEach(el => el.classList.remove('active'));
  if (!state.currentSong) return;
  const title = state.currentSong.title;
  $$('.song-item').forEach(el => {
    if (el.querySelector('.song-item-title')?.textContent?.trim() === title) el.classList.add('playing');
  });
  const qi = $$('.queue-item')[state.queueIndex];
  if (qi) qi.classList.add('active');
}

function playFromQueue(idx) {
  if (idx < 0 || idx >= state.queue.length) return;
  state.queueIndex = idx;
  playSong(state.queue[idx]);
}

function playNext() {
  if (!state.queue.length) return;
  if (state.repeat === 'one') { playSong(state.queue[state.queueIndex]); return; }
  let next = state.queueIndex + 1;
  if (state.shuffle) next = Math.floor(Math.random() * state.queue.length);
  if (next >= state.queue.length) {
    if (state.repeat === 'all') next = 0;
    else { setPlayPauseIcon(false); return; }
  }
  playFromQueue(next);
}

function playPrev() {
  if (!state.queue.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const prev = Math.max(0, state.queueIndex - 1);
  playFromQueue(prev);
}

function setQueue(songs, startIdx = 0) {
  state.queue = songs;
  state.queueIndex = startIdx;
  updateQueueUI();
}

function updateQueueUI() {
  const list = $('#queue-list');
  list.innerHTML = '';
  state.queue.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = `queue-item${i === state.queueIndex ? ' active' : ''}`;
    item.innerHTML = `
      <img src="${s.cover_url || '/img/cover.jpg'}" onerror="this.src='/img/cover.jpg'"/>
      <div class="queue-item-info">
        <div class="qt">${s.title}</div>
        <div class="qa">${s.artist}</div>
      </div>`;
    item.addEventListener('click', () => playFromQueue(i));
    list.appendChild(item);
  });
}

/* ══════════════════════════════════════════════════════════════════
   ALBUMS & HOME
══════════════════════════════════════════════════════════════════ */
let cachedAlbums = [];

async function loadAlbums() {
  try {
    const albums = await apiFetch('/api/songs/albums');
    cachedAlbums = albums;
    renderAlbumsRow($('#albums-row'), albums);
    renderAlbumsGrid($('#albums-grid'), albums);
  } catch {}
}

function renderAlbumsRow(container, albums) {
  container.innerHTML = '';
  albums.forEach(album => {
    const card = makeAlbumCard(album);
    container.appendChild(card);
  });
}

function renderAlbumsGrid(container, albums) {
  container.innerHTML = '';
  albums.forEach(album => {
    const card = makeAlbumCard(album);
    container.appendChild(card);
  });
}

function makeAlbumCard(album) {
  const card = document.createElement('div');
  card.className = 'music-card';
  card.innerHTML = `
    <img src="${album.cover_url}" alt="${album.title}" onerror="this.src='/img/cover.jpg'"/>
    <div class="card-title">${album.title}</div>
    <div class="card-sub">${album.song_count} songs</div>
    <button class="card-play-btn">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
    </button>`;
  card.querySelector('.card-play-btn').addEventListener('click', e => { e.stopPropagation(); openAlbum(album, true); });
  card.addEventListener('click', () => openAlbum(album));
  return card;
}

async function openAlbum(album, autoPlay = false) {
  state.currentAlbum = album;
  $('#album-hero-cover').src = album.cover_url;
  $('#album-hero-cover').onerror = () => { $('#album-hero-cover').src = '/img/cover.jpg'; };
  $('#album-hero-title').textContent = album.title;
  $('#album-hero-desc').textContent = album.description;

  setView('album');

  try {
    const songs = await apiFetch(`/api/songs/?folder=${encodeURIComponent(album.folder)}`);
    const list = $('#album-song-list');
    list.innerHTML = '';

    const songObjs = songs.map(s => ({
      type: 'local', id: s.id, title: s.title, artist: s.artist,
      folder: s.folder, filename: s.filename, cover_url: album.cover_url,
      genre: s.genre, duration: s.duration
    }));

    songObjs.forEach((song, i) => {
      const item = makeSongItem(song, i + 1);
      item.addEventListener('click', () => {
        setQueue(songObjs, i);
        playSong(song);
      });
      list.appendChild(item);
    });

    if (autoPlay && songObjs.length) {
      setQueue(songObjs, 0);
      playSong(songObjs[0]);
    }

    $('#play-all-btn').onclick = () => { if (songObjs.length) { setQueue(songObjs, 0); playSong(songObjs[0]); } };
    $('#shuffle-album-btn').onclick = () => {
      if (!songObjs.length) return;
      const shuffled = [...songObjs].sort(() => Math.random() - 0.5);
      setQueue(shuffled, 0);
      playSong(shuffled[0]);
    };
  } catch { toast('Could not load album songs'); }
}

/* ══════════════════════════════════════════════════════════════════
   TRENDING / RECOMMENDATIONS
══════════════════════════════════════════════════════════════════ */
async function loadTrending() {
  try {
    const data = await apiFetch('/api/deezer/chart?limit=12');
    const row = $('#trending-row');
    row.innerHTML = '';
    (data.results || []).forEach(track => {
      const card = makeDeezerCard(track);
      row.appendChild(card);
    });
  } catch {
    $('#trending-row').innerHTML = '<div class="empty-msg" style="color:var(--text-muted)">Could not load trending songs (Deezer offline)</div>';
  }
}

async function loadRecommendations() {
  try {
    const data = await apiFetch('/api/recommendations');
    const row = $('#recommendations-row');
    row.innerHTML = '';
    if (!data.length) { row.innerHTML = '<div class="empty-msg">Play more songs to get personalized recommendations</div>'; return; }
    data.forEach(song => {
      const card = document.createElement('div');
      card.className = 'music-card';
      card.innerHTML = `
        <img src="${song.cover_url || '/img/cover.jpg'}" alt="${song.title}" onerror="this.src='/img/cover.jpg'"/>
        <div class="card-title">${song.title}</div>
        <div class="card-sub">${song.artist}</div>
        <button class="card-play-btn">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>`;
      card.addEventListener('click', () => {
        const s = { type: 'local', ...song };
        setQueue([s], 0);
        playSong(s);
      });
      row.appendChild(card);
    });
  } catch {}
}

function makeDeezerCard(track) {
  const card = document.createElement('div');
  card.className = 'music-card';
  card.innerHTML = `
    <div class="deezer-badge">Preview</div>
    <img src="${track.cover_url}" alt="${track.title}" onerror="this.src='/img/cover.jpg'"/>
    <div class="card-title">${track.title}</div>
    <div class="card-sub">${track.artist}</div>
    <button class="card-play-btn">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
    </button>`;
  const play = () => {
    setQueue([track], 0);
    playSong(track);
  };
  card.querySelector('.card-play-btn').addEventListener('click', e => { e.stopPropagation(); play(); });
  card.addEventListener('click', play);
  return card;
}

/* ══════════════════════════════════════════════════════════════════
   SEARCH MODULE
══════════════════════════════════════════════════════════════════ */
let searchDebounce = null;

function handleSearch(query) {
  clearTimeout(searchDebounce);
  if (!query.trim()) {
    $$('#search-local-section, #search-deezer-section').forEach(el => el.classList.add('hidden'));
    $('#search-empty').classList.remove('hidden');
    $('#search-loading').classList.add('hidden');
    return;
  }
  setView('search');
  $('#search-empty').classList.add('hidden');
  $('#search-loading').classList.remove('hidden');
  searchDebounce = setTimeout(() => runSearch(query), 350);
}

async function runSearch(q) {
  try {
    const [localRes, deezerRes] = await Promise.allSettled([
      apiFetch(`/api/songs/?search=${encodeURIComponent(q)}`),
      apiFetch(`/api/deezer/search?q=${encodeURIComponent(q)}&limit=12`)
    ]);

    $('#search-loading').classList.add('hidden');

    // Local results
    const localSection = $('#search-local-section');
    const localList = $('#search-local-results');
    const localSongs = localRes.status === 'fulfilled' ? localRes.value : [];
    if (localSongs.length) {
      localSection.classList.remove('hidden');
      localList.innerHTML = '';
      localSongs.forEach((s, i) => {
        const song = { type: 'local', id: s.id, title: s.title, artist: s.artist, folder: s.folder, filename: s.filename, cover_url: s.cover_url, genre: s.genre };
        const item = makeSongItem(song, i + 1);
        item.addEventListener('click', () => { setQueue(localSongs.map(x => ({ type: 'local', id: x.id, title: x.title, artist: x.artist, folder: x.folder, filename: x.filename, cover_url: x.cover_url, genre: x.genre })), i); playSong(song); });
        localList.appendChild(item);
      });
    } else {
      localSection.classList.add('hidden');
    }

    // Deezer results
    const deezerSection = $('#search-deezer-section');
    const deezerList = $('#search-deezer-results');
    const deezerTracks = deezerRes.status === 'fulfilled' ? (deezerRes.value.results || []) : [];
    if (deezerTracks.length) {
      deezerSection.classList.remove('hidden');
      deezerList.innerHTML = '';
      deezerTracks.forEach((t, i) => {
        const item = makeSongItem(t, i + 1);
        item.addEventListener('click', () => { setQueue(deezerTracks, i); playSong(t); });
        deezerList.appendChild(item);
      });
    } else {
      deezerSection.classList.add('hidden');
    }

    if (!localSongs.length && !deezerTracks.length) {
      $('#search-empty').classList.remove('hidden');
      $('#search-empty').querySelector('p').textContent = `No results found for "${q}"`;
    }
  } catch {
    $('#search-loading').classList.add('hidden');
    toast('Search error');
  }
}

/* ══════════════════════════════════════════════════════════════════
   VOICE SEARCH
══════════════════════════════════════════════════════════════════ */
function initVoiceSearch() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { $('#voice-btn').style.display = 'none'; return; }
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.onresult = e => {
    const q = e.results[0][0].transcript;
    $('#global-search').value = q;
    handleSearch(q);
    $('#voice-btn').classList.remove('listening');
  };
  recognition.onerror = () => { $('#voice-btn').classList.remove('listening'); toast('Voice search failed'); };
  recognition.onend = () => $('#voice-btn').classList.remove('listening');

  $('#voice-btn').addEventListener('click', () => {
    $('#voice-btn').classList.add('listening');
    recognition.start();
    toast('Listening...');
  });
}

/* ══════════════════════════════════════════════════════════════════
   PLAYLISTS MODULE
══════════════════════════════════════════════════════════════════ */
async function loadSidebarPlaylists() {
  const container = $('#sidebar-playlists');
  if (!state.token) { container.innerHTML = '<div class="sidebar-empty">Log in to see playlists</div>'; return; }
  try {
    const playlists = await apiFetch('/api/playlists/');
    container.innerHTML = '';
    if (!playlists.length) { container.innerHTML = '<div class="sidebar-empty">No playlists yet</div>'; return; }
    playlists.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'sidebar-playlist-item';
      item.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="flex-shrink:0"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1 2.5-2.5c.57 0 1.08.19 1.5.5V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/></svg><span>${pl.name}</span>`;
      item.addEventListener('click', () => openPlaylist(pl.id));
      container.appendChild(item);
    });
    renderPlaylistsGrid(playlists);
  } catch {}
}

async function renderPlaylistsGrid(playlists) {
  const grid = $('#playlists-grid');
  grid.innerHTML = '';
  playlists.forEach(pl => {
    const card = document.createElement('div');
    card.className = 'music-card';
    card.innerHTML = `
      <div style="width:100%;aspect-ratio:1;background:linear-gradient(135deg,#1e3264,#1DB954);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:12px">
        <svg viewBox="0 0 24 24" fill="white" width="40"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1 2.5-2.5c.57 0 1.08.19 1.5.5V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/></svg>
      </div>
      <div class="card-title">${pl.name}</div>
      <div class="card-sub">${pl.songs.length} songs${pl.is_collaborative ? ' · Collaborative' : ''}</div>`;
    card.addEventListener('click', () => openPlaylist(pl.id));
    grid.appendChild(card);
  });
}

async function openPlaylist(id) {
  setView('playlist');
  try {
    const playlists = await apiFetch('/api/playlists/');
    const pl = playlists.find(p => p.id === id);
    if (!pl) return;
    state.currentPlaylistId = id;
    $('#playlist-hero-title').textContent = pl.name;
    $('#playlist-hero-desc').textContent = (pl.description || '') + (pl.is_collaborative ? ' · Collaborative' : '');

    const list = $('#playlist-song-list');
    list.innerHTML = '';

    $('#share-playlist-btn').classList.toggle('hidden', !pl.is_collaborative);
    if (pl.is_collaborative) {
      $('#share-playlist-btn').onclick = () => {
        const link = `${window.location.origin}/?invite=${pl.invite_code}`;
        navigator.clipboard?.writeText(link).then(() => toast('Invite link copied!'));
      };
    }
    $('#delete-playlist-btn').onclick = async () => {
      if (!confirm(`Delete "${pl.name}"?`)) return;
      await apiFetch(`/api/playlists/${id}`, { method: 'DELETE' });
      toast('Playlist deleted');
      loadSidebarPlaylists();
      setView('library');
    };

    const songObjs = pl.songs.map(ps => {
      if (ps.deezer_id) {
        return { type: 'deezer', id: ps.deezer_id, title: ps.deezer_title, artist: ps.deezer_artist, cover_url: ps.deezer_cover, preview_url: ps.deezer_preview };
      }
      return { type: 'local', id: ps.song_id, title: ps.deezer_title || '?', artist: ps.deezer_artist || '?', cover_url: ps.deezer_cover || '/img/cover.jpg' };
    });

    if (!pl.songs.length) {
      list.innerHTML = '<div class="empty-msg">No songs yet. Use the ⋮ menu on any song to add it here.</div>';
    } else {
      pl.songs.forEach((ps, i) => {
        const song = songObjs[i];
        const item = makeSongItem(song, i + 1, {
          onRemove: async () => {
            await apiFetch(`/api/playlists/${id}/songs/${ps.id}`, { method: 'DELETE' });
            toast('Removed from playlist');
            openPlaylist(id);
          }
        });
        item.addEventListener('click', () => { setQueue(songObjs, i); playSong(song); });
        list.appendChild(item);
      });
    }

    $('#play-playlist-btn').onclick = () => { if (songObjs.length) { setQueue(songObjs, 0); playSong(songObjs[0]); } };
  } catch { toast('Could not load playlist'); }
}

function openCreatePlaylistModal() {
  if (!state.token) { openAuthModal(); toast('Log in to create playlists'); return; }
  $('#playlist-modal').classList.remove('hidden');
  $('#playlist-name').value = '';
  $('#playlist-desc').value = '';
  $('#playlist-collab').checked = false;
}

async function handleCreatePlaylist(e) {
  e.preventDefault();
  const name = $('#playlist-name').value.trim();
  if (!name) return;
  try {
    await apiFetch('/api/playlists/', {
      method: 'POST',
      body: JSON.stringify({ name, description: $('#playlist-desc').value, is_collaborative: $('#playlist-collab').checked })
    });
    $('#playlist-modal').classList.add('hidden');
    toast(`Playlist "${name}" created!`);
    loadSidebarPlaylists();
  } catch(err) { toast(err.message); }
}

function openAddToPlaylistModal(songObj) {
  if (!state.token) { openAuthModal(); return; }
  state.pendingAddSong = songObj;
  const modal = $('#add-to-playlist-modal');
  modal.classList.remove('hidden');
  apiFetch('/api/playlists/').then(playlists => {
    const list = $('#atp-playlist-list');
    list.innerHTML = '';
    if (!playlists.length) {
      list.innerHTML = '<div class="empty-msg">No playlists. Create one first.</div>';
      return;
    }
    playlists.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'atp-item';
      item.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="20"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1 2.5-2.5c.57 0 1.08.19 1.5.5V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/></svg><span>${pl.name}</span>`;
      item.addEventListener('click', async () => {
        const s = state.pendingAddSong;
        await apiFetch(`/api/playlists/${pl.id}/songs`, {
          method: 'POST',
          body: JSON.stringify({
            song_id: s.type === 'local' ? s.id : null,
            deezer_id: s.type === 'deezer' ? s.id : '',
            deezer_title: s.title,
            deezer_artist: s.artist,
            deezer_preview: s.preview_url || '',
            deezer_cover: s.cover_url || ''
          })
        });
        modal.classList.add('hidden');
        toast(`Added to "${pl.name}"`);
        loadSidebarPlaylists();
      });
      list.appendChild(item);
    });
  }).catch(() => toast('Could not load playlists'));
}

/* ══════════════════════════════════════════════════════════════════
   SONG ITEM BUILDER
══════════════════════════════════════════════════════════════════ */
function makeSongItem(song, num, options = {}) {
  const item = document.createElement('div');
  item.className = 'song-item';

  const durationStr = song.duration ? fmt(song.duration) : (song.type === 'deezer' ? fmt(song.duration || 30) : '');
  const coverSrc = song.cover_url || '/img/cover.jpg';
  const deezerBadge = song.type === 'deezer' ? '<span style="font-size:0.7rem;color:var(--green);margin-left:4px">▶ Preview</span>' : '';

  item.innerHTML = `
    <span class="song-num">${num}</span>
    <img class="song-item-cover" src="${coverSrc}" alt="" onerror="this.src='/img/cover.jpg'"/>
    <div class="song-item-info">
      <div class="song-item-title">${song.title || 'Unknown'}${deezerBadge}</div>
      <div class="song-item-artist">${song.artist || '—'}</div>
    </div>
    <div class="song-item-actions">
      <button class="song-action-btn like-action" title="Like">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </button>
      <button class="song-action-btn add-action" title="Add to Playlist">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>
      ${options.onRemove ? '<button class="song-action-btn remove-action" title="Remove"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>' : ''}
      ${options.onUnlike ? '<button class="song-action-btn unlike-action" title="Unlike"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>' : ''}
    </div>
    ${durationStr ? `<span class="song-item-duration">${durationStr}</span>` : ''}`;

  item.querySelector('.like-action')?.addEventListener('click', e => { e.stopPropagation(); toggleLike(song); });
  item.querySelector('.add-action')?.addEventListener('click', e => { e.stopPropagation(); openAddToPlaylistModal(song); });
  item.querySelector('.remove-action')?.addEventListener('click', e => { e.stopPropagation(); options.onRemove?.(); });
  item.querySelector('.unlike-action')?.addEventListener('click', e => { e.stopPropagation(); options.onUnlike?.(); });

  return item;
}

/* ══════════════════════════════════════════════════════════════════
   PODCASTS MODULE
══════════════════════════════════════════════════════════════════ */
async function searchPodcasts() {
  const q = $('#podcast-search-input').value.trim();
  if (!q) return;
  try {
    const data = await apiFetch(`/api/podcasts/search?q=${encodeURIComponent(q)}&limit=8`);
    const grid = $('#podcast-results');
    grid.innerHTML = '';
    (data.results || []).forEach(p => {
      if (!p.feed_url) return;
      const card = document.createElement('div');
      card.className = 'music-card';
      card.innerHTML = `
        <img src="${p.image_url || '/img/cover.jpg'}" alt="${p.name}" onerror="this.src='/img/cover.jpg'"/>
        <div class="card-title">${p.name}</div>
        <div class="card-sub">${p.author}</div>`;
      card.addEventListener('click', () => loadPodcastEpisodes(p));
      grid.appendChild(card);
    });
  } catch { toast('Podcast search failed'); }
}

async function loadPodcastEpisodes(podcast) {
  $('#podcast-episodes-title').textContent = podcast.name;
  const list = $('#podcast-episodes-list');
  list.innerHTML = '<div class="spinner"></div>';
  try {
    const data = await apiFetch(`/api/podcasts/episodes?feed_url=${encodeURIComponent(podcast.feed_url)}&limit=15`);
    list.innerHTML = '';
    (data.episodes || []).forEach((ep, i) => {
      const item = document.createElement('div');
      item.className = 'song-item';
      item.innerHTML = `
        <span class="song-num">${i + 1}</span>
        <div class="song-item-info">
          <div class="song-item-title">${ep.title}</div>
          <div class="song-item-artist">${ep.published || ''} · ${ep.duration || ''}</div>
        </div>`;
      item.addEventListener('click', () => {
        const podSong = { type: 'podcast', id: `pod_${i}`, title: ep.title, artist: podcast.name, cover_url: podcast.image_url || '', audio_url: ep.audio_url };
        setQueue([podSong], 0);
        playSong(podSong);
      });
      list.appendChild(item);
    });
    document.getElementById('podcast-episodes-panel').scrollIntoView({ behavior: 'smooth' });
  } catch { list.innerHTML = '<div class="empty-msg">Could not load episodes</div>'; }
}

/* ══════════════════════════════════════════════════════════════════
   LYRICS MODULE
══════════════════════════════════════════════════════════════════ */
async function toggleLyricsPanel() {
  const panel = $('#lyrics-panel');
  if (panel.classList.toggle('hidden')) return;

  if (!state.currentSong) { panel.classList.add('hidden'); return; }
  // Close queue if open
  $('#queue-panel').classList.add('hidden');

  const content = $('#lyrics-content');
  content.innerHTML = '<div class="lyrics-loading">Loading lyrics...</div>';

  try {
    const data = await apiFetch(`/api/lyrics/?artist=${encodeURIComponent(state.currentSong.artist)}&title=${encodeURIComponent(state.currentSong.title)}`);
    if (data.found && data.lyrics) {
      content.textContent = data.lyrics;
    } else {
      content.innerHTML = '<div class="lyrics-loading">Lyrics not found for this song.</div>';
    }
  } catch {
    content.innerHTML = '<div class="lyrics-loading">Could not load lyrics.</div>';
  }
}

/* ══════════════════════════════════════════════════════════════════
   SEEKBAR
══════════════════════════════════════════════════════════════════ */
function initSeekbar() {
  const seekbar = $('#seekbar');
  let dragging = false;

  audio.addEventListener('timeupdate', () => {
    if (dragging || !audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    $('#seekbar-fill').style.width = pct + '%';
    $('#seekbar-thumb').style.left = pct + '%';
    $('#current-time').textContent = fmt(audio.currentTime);
    $('#total-time').textContent = fmt(audio.duration);
  });

  audio.addEventListener('loadedmetadata', () => {
    $('#total-time').textContent = fmt(audio.duration);
  });

  audio.addEventListener('ended', () => {
    setPlayPauseIcon(false);
    playNext();
  });

  seekbar.addEventListener('mousedown', e => {
    dragging = true;
    seek(e);
    const onMove = e2 => seek(e2);
    const onUp = () => { dragging = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  seekbar.addEventListener('touchstart', e => {
    dragging = true;
    seek(e.touches[0]);
    const onMove = e2 => seek(e2.touches[0]);
    const onEnd = () => { dragging = false; window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd); };
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  }, { passive: true });

  function seek(e) {
    const rect = seekbar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    $('#seekbar-fill').style.width = (pct * 100) + '%';
    $('#seekbar-thumb').style.left = (pct * 100) + '%';
    if (audio.duration) {
      audio.currentTime = pct * audio.duration;
      $('#current-time').textContent = fmt(audio.currentTime);
    }
  }
}

/* ══════════════════════════════════════════════════════════════════
   VOLUME
══════════════════════════════════════════════════════════════════ */
function initVolume() {
  const slider = $('#volume-slider');
  slider.addEventListener('input', e => {
    const v = e.target.value / 100;
    audio.volume = v;
    updateVolIcon(v);
    updateVolSliderBg(e.target.value);
  });

  $('#mute-btn').addEventListener('click', () => {
    audio.muted = !audio.muted;
    updateVolIcon(audio.muted ? 0 : audio.volume);
    $('#vol-icon').classList.toggle('hidden', audio.muted);
    $('#mute-icon').classList.toggle('hidden', !audio.muted);
  });

  function updateVolIcon(v) {
    const muted = v === 0;
    $('#vol-icon').classList.toggle('hidden', muted);
    $('#mute-icon').classList.toggle('hidden', !muted);
  }

  updateVolSliderBg(80);

  slider.addEventListener('input', e => updateVolSliderBg(e.target.value));
}

function updateVolSliderBg(val) {
  const slider = $('#volume-slider');
  slider.style.background = `linear-gradient(to right, var(--text-primary) ${val}%, var(--surface2) ${val}%)`;
}

/* ══════════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════════════════════════════════════ */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); setPlayPauseIcon(!audio.paused); }
    if (e.code === 'ArrowRight') audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
    if (e.code === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 10);
    if (e.code === 'ArrowUp') { audio.volume = Math.min(1, audio.volume + 0.1); $('#volume-slider').value = Math.round(audio.volume * 100); updateVolSliderBg($('#volume-slider').value); }
    if (e.code === 'ArrowDown') { audio.volume = Math.max(0, audio.volume - 0.1); $('#volume-slider').value = Math.round(audio.volume * 100); updateVolSliderBg($('#volume-slider').value); }
  });
}

/* ══════════════════════════════════════════════════════════════════
   NAVIGATION WIRING
══════════════════════════════════════════════════════════════════ */
function initNav() {
  // Nav buttons
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      setView(view);
      if (view === 'library') { loadSidebarPlaylists(); loadAlbums(); }
    });
  });

  // Sidebar quick buttons
  $$('.sidebar-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      setView(view);
      if (view === 'liked') loadLikedView();
      if (view === 'history') loadHistoryView();
      if (view === 'podcasts') {}
    });
  });

  // Show all -> library
  $$('.show-all-btn').forEach(btn => {
    btn.addEventListener('click', () => { setView(btn.dataset.view || 'library'); loadAlbums(); });
  });

  // Hamburger (mobile)
  $('#hamburger-btn').addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
    $('#sidebar-overlay').classList.toggle('hidden');
  });
  $('#sidebar-overlay').addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
    $('#sidebar-overlay').classList.add('hidden');
  });

  // Create playlist buttons
  $('#create-playlist-btn').addEventListener('click', openCreatePlaylistModal);
  $('#new-playlist-btn').addEventListener('click', openCreatePlaylistModal);

  // Auth
  $('#login-btn').addEventListener('click', () => openAuthModal('login'));
  $('#signup-btn').addEventListener('click', () => openAuthModal('signup'));
  $('#auth-modal-close').addEventListener('click', closeAuthModal);
  $('#auth-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAuthModal(); });
  $('#tab-login').addEventListener('click', () => switchAuthTab('login'));
  $('#tab-signup').addEventListener('click', () => switchAuthTab('signup'));
  $('#login-form').addEventListener('submit', handleLogin);
  $('#signup-form').addEventListener('submit', handleSignup);
  $('#logout-btn').addEventListener('click', logout);

  // Playlist modal
  $('#playlist-modal-close').addEventListener('click', () => $('#playlist-modal').classList.add('hidden'));
  $('#playlist-modal').addEventListener('click', e => { if (e.target === e.currentTarget) $('#playlist-modal').classList.add('hidden'); });
  $('#playlist-form').addEventListener('submit', handleCreatePlaylist);

  // Add-to-playlist modal
  $('#atp-modal-close').addEventListener('click', () => $('#add-to-playlist-modal').classList.add('hidden'));
  $('#add-to-playlist-modal').addEventListener('click', e => { if (e.target === e.currentTarget) $('#add-to-playlist-modal').classList.add('hidden'); });

  // Search
  $('#global-search').addEventListener('input', e => handleSearch(e.target.value));
  $('#global-search').addEventListener('focus', () => { if ($('#global-search').value) setView('search'); });

  // Player controls
  $('#play-pause-btn').addEventListener('click', () => {
    if (!state.currentSong) return;
    if (audio.paused) { audio.play(); setPlayPauseIcon(true); }
    else { audio.pause(); setPlayPauseIcon(false); }
  });
  $('#prev-btn').addEventListener('click', playPrev);
  $('#next-btn').addEventListener('click', playNext);

  $('#shuffle-btn').addEventListener('click', () => {
    state.shuffle = !state.shuffle;
    $('#shuffle-btn').classList.toggle('active', state.shuffle);
    toast(state.shuffle ? 'Shuffle on' : 'Shuffle off');
  });

  $('#repeat-btn').addEventListener('click', () => {
    const modes = ['off', 'all', 'one'];
    state.repeat = modes[(modes.indexOf(state.repeat) + 1) % 3];
    const btn = $('#repeat-btn');
    btn.classList.toggle('active', state.repeat !== 'off');
    btn.title = `Repeat: ${state.repeat}`;
    toast(`Repeat: ${state.repeat}`);
  });

  // Like button on player bar
  $('#player-like-btn').addEventListener('click', () => { if (state.currentSong) toggleLike(state.currentSong); });

  // Lyrics toggle
  $('#lyrics-toggle-btn').addEventListener('click', toggleLyricsPanel);
  $('#close-lyrics-btn').addEventListener('click', () => { $('#lyrics-panel').classList.add('hidden'); });

  // Queue
  $('#queue-btn').addEventListener('click', () => {
    $('#queue-panel').classList.toggle('hidden');
    $('#lyrics-panel').classList.add('hidden');
  });
  $('#close-queue-btn').addEventListener('click', () => $('#queue-panel').classList.add('hidden'));

  // Clear history
  $('#clear-history-btn').addEventListener('click', clearHistory);

  // Podcast search
  $('#podcast-search-btn').addEventListener('click', searchPodcasts);
  $('#podcast-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') searchPodcasts(); });
}

/* ══════════════════════════════════════════════════════════════════
   PWA / SERVICE WORKER
══════════════════════════════════════════════════════════════════ */
function initSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

/* ══════════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════════ */
async function init() {
  initNav();
  initSeekbar();
  initVolume();
  initKeyboard();
  initVoiceSearch();
  initSW();

  updateAuthUI();

  // Load home content
  loadAlbums();
  loadTrending();
  loadRecommendations();

  if (state.token) {
    onLogin();
  }

  // Handle collaborative invite in URL
  const params = new URLSearchParams(window.location.search);
  const invite = params.get('invite');
  if (invite) {
    try {
      const pl = await apiFetch(`/api/playlists/join/${invite}`);
      toast(`Joined collaborative playlist: "${pl.name}"`);
      window.history.replaceState({}, '', '/');
    } catch { toast('Invalid invite code'); }
  }
}

document.addEventListener('DOMContentLoaded', init);