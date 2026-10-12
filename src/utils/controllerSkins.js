// Console Controller Skins & Layout Registry

export const CONSOLE_SKINS = {
  nes: {
    id: 'nes',
    name: 'Nintendo Entertainment System',
    shortName: 'NES',
    layout: 'nes',
    hasShoulders: false,
    skins: {
      classic: {
        id: 'nes-classic',
        name: 'NES Classic Grey',
        themeClass: 'skin-nes-classic',
        accentColor: '#dc2626',
      },
      variant: {
        id: 'nes-famicom',
        name: 'Famicom Crimson & Gold',
        themeClass: 'skin-nes-famicom',
        accentColor: '#eab308',
      },
    },
    actionButtons: [
      { id: 'b', label: 'B', retroButton: 'b' },
      { id: 'a', label: 'A', retroButton: 'a' },
    ],
  },

  snes: {
    id: 'snes',
    name: 'Super Nintendo',
    shortName: 'SNES',
    layout: 'snes',
    hasShoulders: true,
    skins: {
      classic: {
        id: 'snes-classic',
        name: 'Super Nintendo US',
        themeClass: 'skin-snes-classic',
        accentColor: '#8b5cf6',
      },
      variant: {
        id: 'snes-famicom',
        name: 'Super Famicom 4-Color',
        themeClass: 'skin-snes-famicom',
        accentColor: '#22c55e',
      },
    },
    actionButtons: [
      { id: 'x', label: 'X', retroButton: 'x', subLabel: 'Top' },
      { id: 'y', label: 'Y', retroButton: 'y', subLabel: 'Left' },
      { id: 'a', label: 'A', retroButton: 'a', subLabel: 'Right' },
      { id: 'b', label: 'B', retroButton: 'b', subLabel: 'Bottom' },
    ],
  },

  genesis: {
    id: 'genesis',
    name: 'Sega Genesis / Mega Drive',
    shortName: 'Genesis',
    layout: 'genesis',
    hasShoulders: false,
    skins: {
      classic: {
        id: 'genesis-classic',
        name: 'Model 1 High-Definition',
        themeClass: 'skin-genesis-classic',
        accentColor: '#ef4444',
      },
      variant: {
        id: 'genesis-arcade',
        name: 'Mega Drive 6-Button Arcade',
        themeClass: 'skin-genesis-arcade',
        accentColor: '#38bdf8',
      },
    },
    actionButtons: [
      { id: 'a', label: 'A', retroButton: 'y' },
      { id: 'b', label: 'B', retroButton: 'b' },
      { id: 'c', label: 'C', retroButton: 'a' },
    ],
  },

  ps1: {
    id: 'ps1',
    name: 'Sony PlayStation 1',
    shortName: 'PlayStation',
    layout: 'ps1',
    hasShoulders: true,
    skins: {
      classic: {
        id: 'ps1-classic',
        name: 'PSX 1994 Industrial Grey',
        themeClass: 'skin-ps1-classic',
        accentColor: '#3b82f6',
      },
      variant: {
        id: 'ps1-smoke',
        name: 'DualShock Midnight Smoke',
        themeClass: 'skin-ps1-smoke',
        accentColor: '#10b981',
      },
    },
    actionButtons: [
      { id: 'triangle', label: '△', retroButton: 'x', colorClass: 'btn-ps-triangle', name: 'Triangle' },
      { id: 'square', label: '□', retroButton: 'y', colorClass: 'btn-ps-square', name: 'Square' },
      { id: 'circle', label: '○', retroButton: 'a', colorClass: 'btn-ps-circle', name: 'Circle' },
      { id: 'cross', label: 'X', retroButton: 'b', colorClass: 'btn-ps-cross', name: 'Cross' },
    ],
  },

  gba: {
    id: 'gba',
    name: 'Game Boy Advance',
    shortName: 'GBA',
    layout: 'gba',
    hasShoulders: true,
    skins: {
      classic: {
        id: 'gba-classic',
        name: 'Indigo Purple',
        themeClass: 'skin-gba-classic',
        accentColor: '#6366f1',
      },
      variant: {
        id: 'gba-glacier',
        name: 'Glacier Frost Translucent',
        themeClass: 'skin-gba-glacier',
        accentColor: '#38bdf8',
      },
    },
    actionButtons: [
      { id: 'b', label: 'B', retroButton: 'b' },
      { id: 'a', label: 'A', retroButton: 'a' },
    ],
  },

  universal: {
    id: 'universal',
    name: 'Modern Cyberpunk Retro',
    shortName: 'Universal',
    layout: 'snes',
    hasShoulders: true,
    skins: {
      classic: {
        id: 'modern-cyan',
        name: 'RomPlayer Neon Cyan',
        themeClass: 'skin-modern-cyan',
        accentColor: '#66fcf1',
      },
      variant: {
        id: 'modern-amber',
        name: 'Synthwave Sunset Amber',
        themeClass: 'skin-modern-amber',
        accentColor: '#f59e0b',
      },
    },
    actionButtons: [
      { id: 'x', label: 'X', retroButton: 'x' },
      { id: 'y', label: 'Y', retroButton: 'y' },
      { id: 'a', label: 'A', retroButton: 'a' },
      { id: 'b', label: 'B', retroButton: 'b' },
    ],
  },
};

/**
 * Resolves Nostalgist core string to a console controller definition
 * @param {string} core 
 * @returns {string} console ID ('nes', 'snes', 'genesis', 'ps1', 'gba', 'universal')
 */
export function coreToConsole(core) {
  if (!core) return 'snes';
  const c = core.toLowerCase();

  if (c.includes('fceumm') || c.includes('nestopia') || c.includes('quicknes')) {
    return 'nes';
  }
  if (c.includes('snes9x')) {
    return 'snes';
  }
  if (c.includes('genesis') || c.includes('picodrive') || c.includes('gearsystem')) {
    return 'genesis';
  }
  if (c.includes('pcsx') || c.includes('beetle_psx')) {
    return 'ps1';
  }
  if (c.includes('mgba') || c.includes('vba')) {
    return 'gba';
  }
  if (c.includes('gambatte') || c.includes('gearboy')) {
    return 'gba'; // Handheld 2-button layout works great for Game Boy
  }
  if (c.includes('pce') || c.includes('stella') || c.includes('prosystem') || c.includes('handy') || c.includes('ngp') || c.includes('wswan')) {
    return 'nes'; // 2-button classic works great for PC Engine, Atari, WonderSwan
  }
  if (c.includes('mame') || c.includes('fba') || c.includes('neogeo')) {
    return 'genesis'; // 3-button arc feels like an authentic arcade cabinet!
  }

  return 'snes';
}
