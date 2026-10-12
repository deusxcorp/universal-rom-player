const STORAGE_KEY = 'universal_romplayer_controls';

export const DEFAULT_INPUT_CONFIG = {
  // D-Pad
  input_player1_up: 'up',
  input_player1_down: 'down',
  input_player1_left: 'left',
  input_player1_right: 'right',

  // Action buttons (single horizontal row: Z, X, C, V)
  input_player1_y: 'z',
  input_player1_b: 'x',
  input_player1_a: 'c',
  input_player1_x: 'v',

  // Shoulders & Triggers
  input_player1_l: 'a',
  input_player1_r: 's',
  input_player1_l2: 'q',
  input_player1_r2: 'w',

  // System
  input_player1_select: 'rshift',
  input_player1_start: 'enter',
};

export const DEFAULT_PLAYER2_CONFIG = {
  // D-Pad
  input_player2_up: 'num8',
  input_player2_down: 'num2',
  input_player2_left: 'num4',
  input_player2_right: 'num6',

  // Action buttons
  input_player2_y: 'i',
  input_player2_b: 'k',
  input_player2_a: 'l',
  input_player2_x: 'o',

  // Shoulders & Triggers
  input_player2_l: 'u',
  input_player2_r: 'p',
  input_player2_l2: '7',
  input_player2_r2: '9',

  // System
  input_player2_select: 'num0',
  input_player2_start: 'numenter',
};

export const BUTTON_METADATA = [
  { id: 'input_player1_up', label: 'Up', consoleHint: 'D-Pad Up', group: 'D-Pad' },
  { id: 'input_player1_down', label: 'Down', consoleHint: 'D-Pad Down', group: 'D-Pad' },
  { id: 'input_player1_left', label: 'Left', consoleHint: 'D-Pad Left', group: 'D-Pad' },
  { id: 'input_player1_right', label: 'Right', consoleHint: 'D-Pad Right', group: 'D-Pad' },

  { id: 'input_player1_y', label: 'Action 1', consoleHint: 'Y / Square / Gen A', group: 'Action Buttons' },
  { id: 'input_player1_b', label: 'Action 2', consoleHint: 'B / Cross / Gen B', group: 'Action Buttons' },
  { id: 'input_player1_a', label: 'Action 3', consoleHint: 'A / Circle / Gen C', group: 'Action Buttons' },
  { id: 'input_player1_x', label: 'Action 4', consoleHint: 'X / Triangle / Gen X', group: 'Action Buttons' },

  { id: 'input_player1_l', label: 'L1', consoleHint: 'Left Shoulder', group: 'Shoulders & Triggers' },
  { id: 'input_player1_r', label: 'R1', consoleHint: 'Right Shoulder', group: 'Shoulders & Triggers' },
  { id: 'input_player1_l2', label: 'L2', consoleHint: 'Left Trigger', group: 'Shoulders & Triggers' },
  { id: 'input_player1_r2', label: 'R2', consoleHint: 'Right Trigger', group: 'Shoulders & Triggers' },

  { id: 'input_player1_select', label: 'Select', consoleHint: 'Select / Coin', group: 'System' },
  { id: 'input_player1_start', label: 'Start', consoleHint: 'Start / Pause', group: 'System' },
];

// Mapping from browser KeyboardEvent.code to RetroArch config token
const CODE_TO_RETROARCH = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'enter',
  Space: 'space',
  ShiftLeft: 'shift',
  ShiftRight: 'rshift',
  ControlLeft: 'ctrl',
  ControlRight: 'rctrl',
  AltLeft: 'alt',
  AltRight: 'ralt',
  Tab: 'tab',
  Backspace: 'backspace',
  Delete: 'del',
  Escape: 'escape',
  Minus: 'minus',
  Equal: 'equals',
  BracketLeft: 'leftbracket',
  BracketRight: 'rightbracket',
  Semicolon: 'semicolon',
  Quote: 'quote',
  Backquote: 'backquote',
  Comma: 'comma',
  Period: 'period',
  Slash: 'slash',
};

// Friendly display names for badges
const RETROARCH_TO_DISPLAY = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  enter: 'Enter',
  space: 'Space',
  shift: 'L-Shift',
  rshift: 'R-Shift',
  ctrl: 'Ctrl',
  rctrl: 'R-Ctrl',
  alt: 'Alt',
  ralt: 'R-Alt',
  tab: 'Tab',
  backspace: 'Bksp',
  del: 'Del',
  escape: 'Esc',
  minus: '-',
  equals: '=',
  leftbracket: '[',
  rightbracket: ']',
  semicolon: ';',
  quote: "'",
  backquote: '`',
  comma: ',',
  period: '.',
  slash: '/',
};

export function eventToRetroarchKey(event) {
  const code = event.code;

  // Single letters: KeyA -> 'a'
  if (code.startsWith('Key') && code.length === 4) {
    return code.slice(3).toLowerCase();
  }

  // Digits: Digit1 -> '1'
  if (code.startsWith('Digit') && code.length === 6) {
    return code.slice(5);
  }

  // Numpad digits: Numpad1 -> 'num1'
  if (code.startsWith('Numpad') && code.length === 7 && !isNaN(Number(code.slice(6)))) {
    return `num${code.slice(6)}`;
  }

  // Direct code match
  if (CODE_TO_RETROARCH[code]) {
    return CODE_TO_RETROARCH[code];
  }

  // Fallback to lowercase key if length 1
  if (event.key && event.key.length === 1) {
    return event.key.toLowerCase();
  }

  return null;
}

export function formatKeyDisplay(retroarchKey) {
  if (!retroarchKey) return 'Unset';
  const lower = retroarchKey.toLowerCase();
  if (RETROARCH_TO_DISPLAY[lower]) {
    return RETROARCH_TO_DISPLAY[lower];
  }
  return lower.toUpperCase();
}

export function getSavedInputConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAYER2_CONFIG, ...DEFAULT_INPUT_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PLAYER2_CONFIG, ...DEFAULT_INPUT_CONFIG, ...parsed };
  } catch (err) {
    console.error('Failed to load saved controls:', err);
    return { ...DEFAULT_PLAYER2_CONFIG, ...DEFAULT_INPUT_CONFIG };
  }
}

export function saveInputConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save controls:', err);
  }
}

export function resetInputConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {}
  return { ...DEFAULT_INPUT_CONFIG };
}
