export const coreMap = {
  // Nintendo
  nes: [{ core: 'fceumm', name: 'Nintendo Entertainment System' }],
  sfc: [{ core: 'snes9x', name: 'Super Nintendo' }],
  smc: [{ core: 'snes9x', name: 'Super Nintendo' }],
  gb: [{ core: 'gambatte', name: 'Game Boy' }],
  gbc: [{ core: 'gambatte', name: 'Game Boy Color' }],
  gba: [{ core: 'mgba', name: 'Game Boy Advance' }],

  // Sega
  md: [{ core: 'genesis_plus_gx', name: 'Sega Genesis' }],
  smd: [{ core: 'genesis_plus_gx', name: 'Sega Genesis' }],
  gen: [{ core: 'genesis_plus_gx', name: 'Sega Genesis' }],
  sms: [{ core: 'gearsystem', name: 'Sega Master System' }],
  gg: [{ core: 'gearsystem', name: 'Sega Game Gear' }],

  // NEC
  pce: [{ core: 'mednafen_pce_fast', name: 'TurboGrafx-16 / PC Engine' }],

  // Arcade
  zip: [{ core: 'mame2003_plus', name: 'Arcade (MAME)' }],

  // CD-Based Systems
  cue: [
    { core: 'pcsx_rearmed', name: 'PlayStation 1' },
    { core: 'genesis_plus_gx', name: 'Sega CD' }
  ],
  iso: [
    { core: 'pcsx_rearmed', name: 'PlayStation 1' },
    { core: 'genesis_plus_gx', name: 'Sega CD' }
  ],
  chd: [
    { core: 'pcsx_rearmed', name: 'PlayStation 1' },
    { core: 'genesis_plus_gx', name: 'Sega CD' }
  ],
};

const bootablePriority = ['m3u', 'cue', 'iso', 'chd', 'zip', 'nes', 'sfc', 'smc', 'gb', 'gbc', 'gba', 'md', 'smd', 'gen', 'sms', 'gg', 'pce'];

export const getCoreOptionsForFiles = (files) => {
  if (!files || files.length === 0) return null;

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

  if (!primaryFile) {
    primaryFile = files[0];
    primaryExt = primaryFile.name.split('.').pop().toLowerCase();
  }

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
