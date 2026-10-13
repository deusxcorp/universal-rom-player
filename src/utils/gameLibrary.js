/**
 * gameLibrary.js
 * IndexedDB-backed persistent game library.
 * Stores game entries (thumbnail, name, core, lastPlayed) and up to 3 save slots per game.
 */

const DB_NAME = 'romplayer_library';
const DB_VERSION = 1;
const STORE_GAMES = 'games';
const STORE_SAVES = 'saves';

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_GAMES)) {
        const gs = db.createObjectStore(STORE_GAMES, { keyPath: 'id' });
        gs.createIndex('lastPlayed', 'lastPlayed', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SAVES)) {
        const ss = db.createObjectStore(STORE_SAVES, { keyPath: 'id' });
        ss.createIndex('gameId', 'gameId', { unique: false });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function promisify(req) {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

/** Generate a stable ID from rom file names */
export function makeGameId(files) {
  const names = files.map((f) => f.name).sort().join('|');
  let hash = 0;
  for (let i = 0; i < names.length; i++) {
    hash = (Math.imul(31, hash) + names.charCodeAt(i)) | 0;
  }
  return `game_${Math.abs(hash).toString(36)}`;
}

/** Capture a thumbnail from the emulator canvas as a data URL */
export function captureThumbnail(canvasEl) {
  try {
    if (!canvasEl) return null;
    const out = document.createElement('canvas');
    out.width = 320;
    out.height = 240;
    const ctx = out.getContext('2d');
    ctx.drawImage(canvasEl, 0, 0, 320, 240);
    return out.toDataURL('image/jpeg', 0.75);
  } catch {
    return null;
  }
}

/** Get human-readable console name from core */
const CORE_NAMES = {
  fceumm: 'NES', nestopia: 'NES',
  snes9x: 'SNES', snes9x2010: 'SNES',
  gambatte: 'Game Boy',
  mgba: 'GBA', vba_next: 'GBA',
  genesis_plus_gx: 'Sega Genesis', picodrive: 'Sega Genesis',
  gearsystem: 'Game Gear',
  pcsx_rearmed: 'PlayStation 1',
  mednafen_pce_fast: 'TurboGrafx-16',
  mednafen_ngp: 'Neo Geo Pocket',
  mednafen_wswan: 'WonderSwan',
  mednafen_vb: 'Virtual Boy',
  stella2014: 'Atari 2600',
  prosystem: 'Atari 7800',
  handy: 'Atari Lynx',
  gearcoleco: 'ColecoVision',
  mame2003_plus: 'Arcade',
  tic80: 'TIC-80',
};

export function coreToConsoleName(core) {
  return CORE_NAMES[core] || core;
}

/** Add or update a game entry in the library */
export async function upsertGame({ id, name, core, thumbnail }) {
  const store = await tx(STORE_GAMES, 'readwrite');
  const existing = await promisify(store.get(id));
  const entry = {
    id,
    name,
    core,
    consoleName: coreToConsoleName(core),
    thumbnail: thumbnail || existing?.thumbnail || null,
    lastPlayed: Date.now(),
    playCount: (existing?.playCount || 0) + 1,
    addedAt: existing?.addedAt || Date.now(),
  };
  await promisify(store.put(entry));
  return entry;
}

/** Update only the thumbnail for an existing game */
export async function updateThumbnail(gameId, thumbnail) {
  const store = await tx(STORE_GAMES, 'readwrite');
  const existing = await promisify(store.get(gameId));
  if (!existing) return;
  await promisify(store.put({ ...existing, thumbnail }));
}

/** Get all games, sorted by most recently played */
export async function getAllGames() {
  const store = await tx(STORE_GAMES, 'readonly');
  const games = await promisify(store.getAll());
  return games.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
}

/** Delete a game and all its save slots */
export async function deleteGame(gameId) {
  const db = await openDB();
  const txn = db.transaction([STORE_GAMES, STORE_SAVES], 'readwrite');
  txn.objectStore(STORE_GAMES).delete(gameId);
  const savesStore = txn.objectStore(STORE_SAVES);
  const idx = savesStore.index('gameId');
  const keys = await promisify(idx.getAllKeys(IDBKeyRange.only(gameId)));
  for (const k of keys) savesStore.delete(k);
  return new Promise((res, rej) => {
    txn.oncomplete = res;
    txn.onerror = () => rej(txn.error);
  });
}

/** Save a state into a slot (0, 1, or 2) for a game */
export async function saveSlot(gameId, slot, stateData, thumbnail) {
  const store = await tx(STORE_SAVES, 'readwrite');
  const id = `${gameId}_slot${slot}`;
  await promisify(store.put({
    id,
    gameId,
    slot,
    stateData,
    thumbnail,
    savedAt: Date.now(),
  }));
}

/** Load all save slots for a game */
export async function getSlots(gameId) {
  const store = await tx(STORE_SAVES, 'readonly');
  const idx = store.index('gameId');
  const slots = await promisify(idx.getAll(IDBKeyRange.only(gameId)));
  // Return array indexed by slot number
  const result = [null, null, null];
  for (const s of slots) {
    if (s.slot >= 0 && s.slot <= 2) result[s.slot] = s;
  }
  return result;
}

/** Load a specific save slot */
export async function loadSlot(gameId, slot) {
  const store = await tx(STORE_SAVES, 'readonly');
  return promisify(store.get(`${gameId}_slot${slot}`));
}

/** Delete a specific save slot */
export async function deleteSlot(gameId, slot) {
  const store = await tx(STORE_SAVES, 'readwrite');
  return promisify(store.delete(`${gameId}_slot${slot}`));
}
