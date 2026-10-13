/**
 * Controller Feedback Engine
 *
 * Makes the phone controller usable without looking at it:
 *  - Haptic patterns differ by control type (d-pad, action, shoulder, system)
 *  - Optional per-button "signatures" so each face button feels different
 *  - D-pad roll ticks and a soft "home" bump when the thumb returns to center
 *  - An off-target buzz when a thumb slides off the action buttons
 *  - Synthesized click sounds (for iOS Safari, which has no Vibration API)
 *  - Best-effort iOS 18+ system haptic tick fallback
 */

const STORAGE_KEY = 'romplayer_feedback_settings';

export const HAPTIC_LEVELS = [
  { id: 'off', label: 'Off' },
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'strong', label: 'Strong' },
];

const LEVEL_SCALE = { off: 0, light: 0.6, medium: 1, strong: 1.6 };
const LEVEL_GAIN = { off: 0, light: 0.06, medium: 0.1, strong: 0.16 };

export const canVibrate = () =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export function getDefaultFeedbackSettings() {
  return {
    haptics: 'medium',
    signatures: true,
    // Phones without vibration (iOS) get audible clicks by default
    sound: !canVibrate(),
    diagonals: true,
  };
}

export function loadFeedbackSettings() {
  const defaults = getDefaultFeedbackSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch (e) {
    return defaults;
  }
}

export function saveFeedbackSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {}
}

// Base vibration patterns (ms) at "medium". Even indices vibrate, odd indices pause.
const PATTERNS = {
  dpad: [16],
  dpadSlide: [10],
  dpadCenter: [5],
  action: [24],
  actionGlide: [14],
  shoulder: [12, 26, 12],
  system: [34],
  offTarget: [6, 28, 6],
  connect: [30, 50, 30],
  ui: [10],
};

// Per-button signatures, keyed by RetroArch button. Positions are consistent
// across layouts (b = bottom/left, a = right, y = left/first, x = top), so
// the same finger position always feels the same on every console.
const SIGNATURES = {
  b: [18],
  a: [36],
  y: [12, 30, 12],
  x: [8, 22, 8, 22, 8],
};

// Click sound voices
const TONES = {
  dpad: { freq: 1700, dur: 0.018, type: 'square' },
  dpadSlide: { freq: 2100, dur: 0.012, type: 'square' },
  dpadCenter: { freq: 1200, dur: 0.01, type: 'sine' },
  action: { freq: 520, dur: 0.035, type: 'triangle' },
  actionGlide: { freq: 620, dur: 0.022, type: 'triangle' },
  shoulder: { freq: 360, dur: 0.04, type: 'triangle' },
  system: { freq: 900, dur: 0.03, type: 'sine' },
  offTarget: { freq: 220, dur: 0.05, type: 'sawtooth' },
  connect: { freq: 880, dur: 0.08, type: 'sine' },
  ui: { freq: 1400, dur: 0.015, type: 'sine' },
};

const BUTTON_PITCH = { b: 440, a: 560, y: 680, x: 820 };

function scalePattern(pattern, level) {
  const scale = LEVEL_SCALE[level] ?? 1;
  if (!scale) return null;
  return pattern.map((ms, i) => (i % 2 === 0 ? Math.max(4, Math.round(ms * scale)) : ms));
}

let audioCtx = null;
function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audioCtx = new AC(); } catch (e) { return null; }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playClick(kind, button, level) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const tone = TONES[kind] || TONES.ui;
  const gainLevel = LEVEL_GAIN[level === 'off' ? 'medium' : level] || 0.1;
  const freq = (kind === 'action' || kind === 'actionGlide') && BUTTON_PITCH[button]
    ? BUTTON_PITCH[button]
    : tone.freq;

  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.55), t + tone.dur);
    gain.gain.setValueAtTime(gainLevel, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + tone.dur + 0.01);
  } catch (e) {}
}

// iOS 18+ plays a system haptic when a switch-style checkbox toggles.
let iosSwitchLabel = null;
function iosSystemTick() {
  if (typeof document === 'undefined') return;
  try {
    if (!iosSwitchLabel) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      label.appendChild(input);
      document.body.appendChild(label);
      iosSwitchLabel = label;
    }
    iosSwitchLabel.click();
  } catch (e) {}
}

// Only "primary" events get the single iOS tick, to avoid a buzzing mess
const IOS_TICK_KINDS = new Set(['dpad', 'dpadSlide', 'action', 'actionGlide', 'shoulder', 'system', 'connect']);

/**
 * Fire feedback for a controller event.
 * @param {string} kind - one of the PATTERNS keys
 * @param {object} settings - feedback settings
 * @param {string} [button] - RetroArch button for signatures / pitch
 */
export function triggerFeedback(kind, settings, button) {
  if (!settings) return;
  const level = settings.haptics || 'medium';

  if (level !== 'off') {
    if (canVibrate()) {
      let base = PATTERNS[kind] || PATTERNS.ui;
      if (settings.signatures && (kind === 'action' || kind === 'actionGlide') && SIGNATURES[button]) {
        base = SIGNATURES[button];
        if (kind === 'actionGlide') base = base.map((ms, i) => (i % 2 === 0 ? Math.round(ms * 0.75) : ms));
      }
      const pattern = scalePattern(base, level);
      if (pattern) {
        try { navigator.vibrate(pattern.length === 1 ? pattern[0] : pattern); } catch (e) {}
      }
    } else if (isIOS() && IOS_TICK_KINDS.has(kind)) {
      iosSystemTick();
    }
  }

  if (settings.sound) {
    playClick(kind, button, level);
  }
}

/** Unlock audio on the first user gesture (required by mobile browsers). */
export function primeFeedback(settings) {
  if (settings && settings.sound) getAudioContext();
}
