// IndexedDB-backed System BIOS Manager for Nostalgist & RetroArch WebAssembly Cores

const DB_NAME = 'RomPlayerDB';
const DB_VERSION = 1;
const STORE_NAME = 'bios_files';

export const KNOWN_BIOS_INFO = {
  'scph5501.bin': { console: 'PlayStation 1', label: 'PS1 BIOS (US - Recommended)', priority: 'high' },
  'scph1001.bin': { console: 'PlayStation 1', label: 'PS1 BIOS (US - Original)', priority: 'high' },
  'scph7001.bin': { console: 'PlayStation 1', label: 'PS1 BIOS (US)', priority: 'medium' },
  'scph5500.bin': { console: 'PlayStation 1', label: 'PS1 BIOS (Japan)', priority: 'medium' },
  'scph5502.bin': { console: 'PlayStation 1', label: 'PS1 BIOS (Europe)', priority: 'medium' },
  'scph101.bin': { console: 'PlayStation 1', label: 'PSone BIOS (US)', priority: 'medium' },
  'psxonpsp660.bin': { console: 'PlayStation 1', label: 'PS1 PSP BIOS', priority: 'medium' },
  'bios_cd_u.bin': { console: 'Sega CD', label: 'Sega CD BIOS (US)', priority: 'high' },
  'bios_cd_e.bin': { console: 'Sega CD', label: 'Sega CD BIOS (Europe)', priority: 'medium' },
  'bios_cd_j.bin': { console: 'Sega CD', label: 'Sega CD BIOS (Japan)', priority: 'medium' },
  'gba_bios.bin': { console: 'Game Boy Advance', label: 'GBA Official BIOS', priority: 'low' },
  'syscard3.pce': { console: 'TurboGrafx-CD', label: 'Super CD-ROM2 System V3.0', priority: 'high' },
};

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'fileName' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a BIOS file into IndexedDB
 * @param {File} file 
 */
export async function saveBios(file) {
  const db = await openDB();
  const buffer = await file.arrayBuffer();
  const lowerName = file.name.toLowerCase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record = {
      fileName: lowerName,
      originalName: file.name,
      fileContent: buffer,
      size: file.size,
      updatedAt: Date.now(),
    };

    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all installed BIOS records (metadata only, without large buffers)
 */
export async function getAllBiosList() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result || []).map((item) => ({
          fileName: item.fileName,
          originalName: item.originalName,
          size: item.size,
          updatedAt: item.updatedAt,
          info: KNOWN_BIOS_INFO[item.fileName] || {
            console: 'Custom / Other',
            label: item.originalName,
            priority: 'medium',
          },
        }));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to read BIOS list from IndexedDB:', err);
    return [];
  }
}

/**
 * Retrieve all BIOS files formatted for Nostalgist launch
 * [{ fileName: 'scph5501.bin', fileContent: Blob | ArrayBuffer }]
 */
export async function getAllBiosFiles() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const files = (req.result || []).map((item) => ({
          fileName: item.fileName,
          fileContent: item.fileContent,
        }));
        resolve(files);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to load BIOS files from IndexedDB:', err);
    return [];
  }
}

/**
 * Delete a BIOS file by fileName
 * @param {string} fileName 
 */
export async function deleteBios(fileName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(fileName.toLowerCase());

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Check if at least one PS1 BIOS is installed
 */
export async function hasPs1Bios() {
  const list = await getAllBiosList();
  const ps1Names = ['scph5501.bin', 'scph1001.bin', 'scph7001.bin', 'scph5500.bin', 'scph5502.bin', 'scph101.bin', 'psxonpsp660.bin'];
  return list.some((b) => ps1Names.includes(b.fileName));
}

/**
 * DualShock controller toggle preference (stored in localStorage)
 */
const DUALSHOCK_KEY = 'romplayer_dualshock_enabled';

export function getDualShockEnabled() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DUALSHOCK_KEY) === 'true';
}

export function setDualShockEnabled(enabled) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DUALSHOCK_KEY, enabled ? 'true' : 'false');
}
