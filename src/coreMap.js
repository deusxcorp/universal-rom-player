export const getCoreForExtension = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  
  const coreMap = {
    // Nintendo Entertainment System (NES)
    nes: 'fceumm',
    // Super Nintendo Entertainment System (SNES)
    sfc: 'snes9x',
    smc: 'snes9x',
    // Game Boy / Game Boy Color
    gb: 'gambatte',
    gbc: 'gambatte',
    // Game Boy Advance
    gba: 'mgba',
    // Nintendo 64
    n64: 'mupen64plus_next',
    z64: 'mupen64plus_next',
    v64: 'mupen64plus_next',
    // Sega Master System / Game Gear / Genesis / Mega Drive
    md: 'genesis_plus_gx',
    smd: 'genesis_plus_gx',
    gen: 'genesis_plus_gx',
    sms: 'genesis_plus_gx',
    gg: 'genesis_plus_gx',
    // PlayStation
    iso: 'pcsx_rearmed',
    bin: 'pcsx_rearmed',
    cue: 'pcsx_rearmed',
  };

  return coreMap[ext] || null;
};

export const SUPPORTED_EXTENSIONS = [
  '.nes', '.sfc', '.smc', '.gb', '.gbc', '.gba', 
  '.n64', '.z64', '.md', '.gen', '.sms', '.gg', '.bin'
];
