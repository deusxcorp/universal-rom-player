export const coreMap = {
  // Nintendo
  nes: [{ core: 'fceumm', name: 'Nintendo Entertainment System', fallbacks: ['nestopia'] }],
  sfc: [{ core: 'snes9x', name: 'Super Nintendo', fallbacks: ['snes9x2010'] }],
  smc: [{ core: 'snes9x', name: 'Super Nintendo', fallbacks: ['snes9x2010'] }],
  gb: [{ core: 'gambatte', name: 'Game Boy' }],
  gbc: [{ core: 'gambatte', name: 'Game Boy Color' }],
  gba: [{ core: 'mgba', name: 'Game Boy Advance', fallbacks: ['vba_next'] }],
  vb: [{ core: 'mednafen_vb', name: 'Virtual Boy' }],

  // Sega
  md: [{ core: 'genesis_plus_gx', name: 'Sega Genesis', fallbacks: ['picodrive'] }],
  smd: [{ core: 'genesis_plus_gx', name: 'Sega Genesis', fallbacks: ['picodrive'] }],
  gen: [{ core: 'genesis_plus_gx', name: 'Sega Genesis', fallbacks: ['picodrive'] }],
  sms: [{ core: 'gearsystem', name: 'Sega Master System' }],
  gg: [{ core: 'gearsystem', name: 'Sega Game Gear' }],
  '32x': [{ core: 'picodrive', name: 'Sega 32X' }],

  // Sony PlayStation 1
  pbp: [{ core: 'pcsx_rearmed', name: 'PlayStation 1 (PSP EBOOT)' }],

  // Atari
  a26: [{ core: 'stella2014', name: 'Atari 2600' }],
  a78: [{ core: 'prosystem', name: 'Atari 7800' }],
  lnx: [{ core: 'handy', name: 'Atari Lynx' }],

  // SNK & Bandai Handhelds
  ngp: [{ core: 'mednafen_ngp', name: 'Neo Geo Pocket' }],
  ngc: [{ core: 'mednafen_ngp', name: 'Neo Geo Pocket Color' }],
  ws: [{ core: 'mednafen_wswan', name: 'WonderSwan' }],
  wsc: [{ core: 'mednafen_wswan', name: 'WonderSwan Color' }],

  // NEC
  pce: [{ core: 'mednafen_pce_fast', name: 'TurboGrafx-16 / PC Engine' }],

  // Coleco & Fantasy
  col: [{ core: 'gearcoleco', name: 'ColecoVision' }],
  tic: [{ core: 'tic80', name: 'TIC-80' }],

  // CD-Based Systems & Ambiguous Extensions
  m3u: [
    { core: 'pcsx_rearmed', name: 'PlayStation 1 (Multi-Disc)' },
    { core: 'genesis_plus_gx', name: 'Sega CD' },
  ],
  cue: [
    { core: 'pcsx_rearmed', name: 'PlayStation 1' },
    { core: 'genesis_plus_gx', name: 'Sega CD' },
  ],
  iso: [
    { core: 'pcsx_rearmed', name: 'PlayStation 1' },
    { core: 'genesis_plus_gx', name: 'Sega CD' },
  ],
  chd: [
    { core: 'pcsx_rearmed', name: 'PlayStation 1' },
    { core: 'genesis_plus_gx', name: 'Sega CD' },
  ],
  bin: [
    { core: 'genesis_plus_gx', name: 'Sega Genesis' },
    { core: 'pcsx_rearmed', name: 'PlayStation 1' },
    { core: 'stella2014', name: 'Atari 2600' },
  ],

  // Arcade
  zip: [{ core: 'mame2003_plus', name: 'Arcade (MAME)' }],
};

export const bootablePriority = [
  'm3u',
  'cue',
  'pbp',
  'chd',
  'iso',
  '32x',
  'nes',
  'sfc',
  'smc',
  'gba',
  'gbc',
  'gb',
  'md',
  'smd',
  'gen',
  'sms',
  'gg',
  'pce',
  'a26',
  'a78',
  'lnx',
  'ngp',
  'ngc',
  'ws',
  'wsc',
  'vb',
  'col',
  'tic',
  'zip',
  'bin',
];

export const getCoreOptionsForFiles = (files) => {
  if (!files || files.length === 0) return null;

  let primaryFile = null;
  let primaryExt = null;

  for (const ext of bootablePriority) {
    const matchedFile = files.find((f) => f.name.toLowerCase().endsWith('.' + ext));
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
    ...files.filter((f) => f !== primaryFile),
  ];

  const options = coreMap[primaryExt] || null;

  return {
    options,
    orderedFiles,
  };
};
