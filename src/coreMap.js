export const coreMap = {
  // Nintendo
  nes: [{ core: 'fceumm', name: 'Nintendo Entertainment System' }],
  sfc: [{ core: 'snes9x', name: 'Super Nintendo' }],
  smc: [{ core: 'snes9x', name: 'Super Nintendo' }],
  gb: [{ core: 'gambatte', name: 'Game Boy' }],
  gbc: [{ core: 'gambatte', name: 'Game Boy Color' }],
  gba: [{ core: 'mgba', name: 'Game Boy Advance' }],
  n64: [{ core: 'mupen64plus_next', name: 'Nintendo 64' }],
  z64: [{ core: 'mupen64plus_next', name: 'Nintendo 64' }],

  // Sega
  md: [{ core: 'genesis_plus_gx', name: 'Sega Genesis' }],
  smd: [{ core: 'genesis_plus_gx', name: 'Sega Genesis' }],
  gen: [{ core: 'genesis_plus_gx', name: 'Sega Genesis' }],
  sms: [{ core: 'genesis_plus_gx', name: 'Sega Master System' }],
  gg: [{ core: 'genesis_plus_gx', name: 'Sega Game Gear' }],

  // Arcade
  zip: [{ core: 'mame2003_plus', name: 'Arcade (MAME)' }],

  // CD-Based Systems (Ambiguous)
  cue: [
    { core: 'yabause', name: 'Sega Saturn' },
    { core: 'pcsx_rearmed', name: 'PlayStation 1' },
    { core: 'genesis_plus_gx', name: 'Sega CD' }
  ],
  iso: [
    { core: 'yabause', name: 'Sega Saturn' },
    { core: 'pcsx_rearmed', name: 'PlayStation 1' },
    { core: 'genesis_plus_gx', name: 'Sega CD' }
  ],
  chd: [
    { core: 'yabause', name: 'Sega Saturn' },
    { core: 'pcsx_rearmed', name: 'PlayStation 1' },
    { core: 'genesis_plus_gx', name: 'Sega CD' }
  ],
};

// Common bootable extensions ordered by priority
const bootablePriority = ['m3u', 'cue', 'iso', 'chd', 'zip', 'nes', 'sfc', 'smc', 'gb', 'gbc', 'gba', 'md', 'smd', 'gen', 'n64', 'z64'];

export const getCoreOptionsForFiles = (files) => {
  if (!files || files.length === 0) return null;

  // Find the primary boot file by looking for known extensions
  let primaryFile = null;
  let primaryExt = null;
  
  for (const ext of bootablePriority) {
    const matchedFile = files.find(f => f.name.toLowerCase().endsWith('.' + ext));
    if (matchedFile) {
      primaryFile = matchedFile;
      primaryExt = ext;
      break;
    }
  }

  // Fallback to the first file if we can't identify by extension
  if (!primaryFile) {
    primaryFile = files[0];
    primaryExt = primaryFile.name.split('.').pop().toLowerCase();
  }

  // Re-order the array so the primary file is at index 0 (Nostalgist requires this)
  const orderedFiles = [
    primaryFile,
    ...files.filter(f => f !== primaryFile)
  ];

  const options = coreMap[primaryExt] || null;
  
  return {
    options,
    orderedFiles
  };
};
