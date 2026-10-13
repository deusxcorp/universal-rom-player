import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClientSession } from '../utils/inputRemote';
import { CONSOLE_SKINS } from '../utils/controllerSkins';
import {
  HAPTIC_LEVELS,
  canVibrate,
  loadFeedbackSettings,
  saveFeedbackSettings,
  triggerFeedback,
  primeFeedback,
} from '../utils/controllerFeedback';
import { 
  WifiOff, 
  Maximize, 
  Minimize, 
  Vibrate, 
  VibrateOff, 
  RefreshCw, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  Palette,
  Sparkles,
  X,
  Check,
  Volume2,
  Fingerprint,
  Move,
  Library,
} from 'lucide-react';

const DPAD_DEAD_ZONE = 0.14; // fraction of d-pad width around the center

export default function MobileController({ roomId: propRoomId }) {
  const [roomId, setRoomId] = useState(propRoomId || '');
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [playerNumber, setPlayerNumber] = useState(1); // 1 or 2
  const [hostInGame, setHostInGame] = useState(null); // null = unknown
  const [activeButtons, setActiveButtons] = useState(() => new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const clientSessionRef = useRef(null);

  // Tactile feedback settings
  const [feedbackSettings, setFeedbackSettings] = useState(loadFeedbackSettings);
  const [showFeelSheet, setShowFeelSheet] = useState(false);
  const settingsRef = useRef(feedbackSettings);

  // Console skin and adaptation state
  const [detectedConsole, setDetectedConsole] = useState('snes');
  const [selectedConsole, setSelectedConsole] = useState('auto'); // 'auto' | 'nes' | 'snes' | 'genesis' | 'ps1' | 'gba' | 'universal'
  const [skinVariant, setSkinVariant] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('romplayer_skin_variant') || 'classic';
    }
    return 'classic';
  });
  const [showSkinDrawer, setShowSkinDrawer] = useState(false);

  // Multi-touch engine state
  const touchesRef = useRef(new Map()); // pointerId -> touch record
  const pressedRef = useRef(new Set());
  const dpadRef = useRef(null);

  useEffect(() => {
    settingsRef.current = feedbackSettings;
    saveFeedbackSettings(feedbackSettings);
  }, [feedbackSettings]);

  const feel = useCallback((kind, button) => {
    triggerFeedback(kind, settingsRef.current, button);
  }, []);

  // Extract roomId from URL search params if not provided via props
  useEffect(() => {
    if (!roomId && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('controller');
      if (urlRoom) {
        setRoomId(urlRoom.toUpperCase());
      }
    }
  }, [roomId]);

  // ---------------------------------------------------------------------------
  // Input commit: union of all active touches -> diff -> send down/up
  // ---------------------------------------------------------------------------
  const commitPressed = useCallback(() => {
    const next = new Set();
    touchesRef.current.forEach((t) => t.buttons.forEach((b) => next.add(b)));
    const prev = pressedRef.current;
    const session = clientSessionRef.current;

    prev.forEach((b) => {
      if (!next.has(b) && session) session.sendInput(b, 'up');
    });
    next.forEach((b) => {
      if (!prev.has(b) && session) session.sendInput(b, 'down');
    });

    pressedRef.current = next;
    setActiveButtons(next);
  }, []);

  const releaseAll = useCallback(() => {
    touchesRef.current.clear();
    commitPressed();
  }, [commitPressed]);

  // Connect to Host WebRTC (auto-reconnecting)
  useEffect(() => {
    if (!roomId) return undefined;

    setStatus('connecting');

    const session = createClientSession(roomId, {
      onConnected: () => {
        setStatus('connected');
        setErrorMessage('');
        triggerFeedback('connect', settingsRef.current);
      },
      onReconnecting: () => {
        setStatus((prev) => (prev === 'connecting' ? 'connecting' : 'reconnecting'));
      },
      onPlayerAssigned: (assignedSlot) => {
        setPlayerNumber(assignedSlot);
      },
      onConsoleChange: (consoleType) => {
        if (consoleType && CONSOLE_SKINS[consoleType]) {
          setDetectedConsole(consoleType);
        }
      },
      onHostStatus: ({ inGame }) => {
        setHostInGame(inGame);
      },
      onDisconnected: () => {
        setStatus('disconnected');
      },
      onError: (err) => {
        console.error('Mobile client connection error:', err);
        setErrorMessage(err?.message || '');
        setStatus('error');
      },
    });

    clientSessionRef.current = session;

    return () => {
      session.disconnect();
      if (clientSessionRef.current === session) clientSessionRef.current = null;
    };
  }, [roomId]);

  // Keep the screen awake (screen lock is the #1 cause of dropped phones),
  // reconnect immediately on wake, and release held buttons when hidden.
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (e) {}
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        if (clientSessionRef.current) clientSessionRef.current.reconnectNow();
      } else {
        releaseAll();
      }
    };

    const handleBlur = () => releaseAll();

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [releaseAll]);

  // Active console & skin configuration
  const activeConsoleKey = selectedConsole === 'auto' ? detectedConsole : selectedConsole;
  const consoleConfig = CONSOLE_SKINS[activeConsoleKey] || CONSOLE_SKINS.snes;
  const currentSkin = consoleConfig.skins[skinVariant] || consoleConfig.skins.classic;

  // Layout changes can remove the element under a held finger: drop held input
  useEffect(() => {
    releaseAll();
  }, [activeConsoleKey, releaseAll]);

  const toggleSkinVariant = () => {
    const next = skinVariant === 'classic' ? 'variant' : 'classic';
    setSkinVariant(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('romplayer_skin_variant', next);
    }
    feel('ui');
  };

  const updateFeedback = (patch) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setFeedbackSettings(next);
    // Preview the new feel immediately
    primeFeedback(next);
    triggerFeedback('action', next, 'a');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Multi-touch engine
  // ---------------------------------------------------------------------------
  const dpadDirections = (x, y) => {
    const el = dpadRef.current;
    if (!el) return [];
    const rect = el.getBoundingClientRect();
    const dx = x - (rect.left + rect.width / 2);
    const dy = y - (rect.top + rect.height / 2);
    if (Math.hypot(dx, dy) < rect.width * DPAD_DEAD_ZONE) return [];

    const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360; // 0 = right, 90 = down
    const cardinalHalf = settingsRef.current.diagonals ? 27.5 : 45;
    const distTo = (target) => {
      const d = Math.abs(angle - target) % 360;
      return d > 180 ? 360 - d : d;
    };

    if (distTo(0) <= cardinalHalf) return ['right'];
    if (distTo(90) <= cardinalHalf) return ['down'];
    if (distTo(180) <= cardinalHalf) return ['left'];
    if (distTo(270) <= cardinalHalf) return ['up'];
    if (angle < 90) return ['right', 'down'];
    if (angle < 180) return ['down', 'left'];
    if (angle < 270) return ['left', 'up'];
    return ['up', 'right'];
  };

  const hitTest = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return { el: null };
    const dpad = el.closest('[data-dpad]');
    if (dpad) return { el, kind: 'dpad' };
    const btn = el.closest('[data-btn]');
    if (btn) return { el, kind: 'button', button: btn.dataset.btn, group: btn.dataset.group || 'action' };
    return { el };
  };

  const handlePointerDown = (e) => {
    if (showSkinDrawer || showFeelSheet) return;
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit.kind) return;

    e.preventDefault();
    primeFeedback(settingsRef.current);

    if (hit.kind === 'dpad') {
      const dirs = dpadDirections(e.clientX, e.clientY);
      touchesRef.current.set(e.pointerId, { kind: 'dpad', buttons: new Set(dirs), key: dirs.join('+') });
      feel(dirs.length ? 'dpad' : 'dpadCenter');
    } else {
      touchesRef.current.set(e.pointerId, {
        kind: 'button',
        group: hit.group,
        current: hit.button,
        buttons: new Set([hit.button]),
        offTarget: false,
      });
      feel(hit.group === 'shoulder' ? 'shoulder' : hit.group === 'system' ? 'system' : 'action', hit.button);
    }
    commitPressed();
  };

  const handlePointerMove = (e) => {
    const t = touchesRef.current.get(e.pointerId);
    if (!t) return;
    e.preventDefault();

    // D-pad owns its thumb: keeps tracking even if it drifts outside the cross
    if (t.kind === 'dpad') {
      const dirs = dpadDirections(e.clientX, e.clientY);
      const key = dirs.join('+');
      if (key !== t.key) {
        t.key = key;
        t.buttons = new Set(dirs);
        feel(dirs.length ? 'dpadSlide' : 'dpadCenter');
        commitPressed();
      }
      return;
    }

    // Shoulder & system buttons stay held until release (forgiving)
    if (t.group !== 'action') return;

    // Action buttons: roll the thumb between buttons without lifting
    const hit = hitTest(e.clientX, e.clientY);
    if (hit.kind === 'button' && hit.group === 'action') {
      if (hit.button !== t.current || t.offTarget) {
        t.current = hit.button;
        t.offTarget = false;
        t.buttons = new Set([hit.button]);
        feel('actionGlide', hit.button);
        commitPressed();
      }
      return;
    }

    // Gaps inside the action cluster keep the last button held; leaving the
    // cluster releases it and buzzes so you know your thumb slipped off.
    const insideCluster = hit.el && hit.el.closest('[data-zone="action"]');
    if (!insideCluster && !t.offTarget) {
      t.offTarget = true;
      t.buttons = new Set();
      feel('offTarget');
      commitPressed();
    }
  };

  const handlePointerUp = (e) => {
    if (!touchesRef.current.has(e.pointerId)) return;
    touchesRef.current.delete(e.pointerId);
    commitPressed();
  };

  const isActive = (btn) => activeButtons.has(btn);

  if (status === 'error' || !roomId) {
    return (
      <div className="mobile-controller-error">
        <WifiOff size={48} style={{ color: 'var(--danger-color)', marginBottom: '1rem' }} />
        <h2>Connection Failed</h2>
        <p>Could not connect to laptop room <strong>{roomId || 'Unknown'}</strong>.</p>
        <p className="error-hint">
          {errorMessage || 'Make sure the laptop tab is still open and the room is not already full (max 2 players).'}
        </p>
        <button 
          className="btn-primary" 
          style={{ marginTop: '1.5rem' }}
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={16} /> Retry Connection
        </button>
      </div>
    );
  }

  const statusBanner =
    status === 'reconnecting'
      ? { icon: <RefreshCw size={13} className="spin-icon" />, text: 'Reconnecting... controller will resume automatically', tone: 'warn' }
      : status === 'connecting'
        ? { icon: <RefreshCw size={13} className="spin-icon" />, text: `Connecting to ${roomId}...`, tone: 'warn' }
        : status === 'connected' && hostInGame === false
          ? { icon: <Library size={13} />, text: 'Paired. Waiting for the next game to load', tone: 'info' }
          : null;

  const HapticIcon = feedbackSettings.haptics === 'off' && !feedbackSettings.sound ? VibrateOff : Vibrate;

  return (
    <div
      className={`mobile-gamepad-container player-${playerNumber} ${currentSkin.themeClass} layout-${consoleConfig.layout}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Status & Controls Bar */}
      <div className="gamepad-topbar">
        <div className="topbar-left">
          <div className="connection-pill">
            <span className={`status-dot ${status === 'connected' ? 'connected' : 'waiting'}`} />
            <span className={`player-badge-tag p${playerNumber}`}>P{playerNumber}</span>
          </div>

          {/* Skin Selection & Variant Toggles */}
          <button 
            className="topbar-btn skin-indicator-btn"
            onClick={() => setShowSkinDrawer(true)}
            title="Choose Controller Skin"
          >
            <Palette size={14} />
            <span className="skin-label-text">{currentSkin.name}</span>
          </button>

          <button 
            className="topbar-btn variant-toggle-btn"
            onClick={toggleSkinVariant}
            title="Toggle Classic / Variant Skin"
          >
            <Sparkles size={14} />
            <span>{skinVariant === 'classic' ? 'Classic' : 'Variant'}</span>
          </button>
        </div>

        <div className="topbar-actions">
          <button 
            id="controller-feel-settings-btn"
            className="topbar-btn" 
            onClick={() => setShowFeelSheet(true)}
            title="Touch Feedback Settings"
          >
            <HapticIcon size={15} />
          </button>
          <button 
            className="topbar-btn" 
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className={`controller-status-banner ${statusBanner.tone}`} role="status">
          {statusBanner.icon}
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* Shoulders Bar (Displayed when console has shoulder bumpers) */}
      {consoleConfig.hasShoulders && (
        <div className="gamepad-shoulders">
          <button 
            className={`shoulder-btn ${isActive('l') ? 'active' : ''}`}
            data-btn="l"
            data-group="shoulder"
          >
            {consoleConfig.layout === 'ps1' ? 'L1' : 'L'}
          </button>
          <div className="shoulder-spacer">
            <span className="room-indicator-mini">{roomId} / {consoleConfig.shortName}</span>
          </div>
          <button 
            className={`shoulder-btn ${isActive('r') ? 'active' : ''}`}
            data-btn="r"
            data-group="shoulder"
          >
            {consoleConfig.layout === 'ps1' ? 'R1' : 'R'}
          </button>
        </div>
      )}

      {/* Main Body: D-Pad (Left), Center (Select/Start), Action Buttons (Right) */}
      <div className={`gamepad-main-body layout-${consoleConfig.layout}`}>
        {/* Left Side: Slide-anywhere D-Pad (one touch zone, 8-way with diagonals) */}
        <div className="dpad-zone">
          <div
            ref={dpadRef}
            data-dpad="true"
            className={`dpad-cross-container ${consoleConfig.layout}`}
            role="group"
            aria-label="Directional pad"
          >
            {consoleConfig.layout === 'genesis' && <div className="genesis-dpad-ring" />}
            <div className="dpad-cross">
              <div className={`dpad-btn up ${isActive('up') ? 'active' : ''}`} aria-label="Up">
                <ChevronUp size={24} />
              </div>
              <div className="dpad-middle-row">
                <div className={`dpad-btn left ${isActive('left') ? 'active' : ''}`} aria-label="Left">
                  <ChevronLeft size={24} />
                </div>
                <div className="dpad-center">
                  <span className="dpad-home-nub" />
                </div>
                <div className={`dpad-btn right ${isActive('right') ? 'active' : ''}`} aria-label="Right">
                  <ChevronRight size={24} />
                </div>
              </div>
              <div className={`dpad-btn down ${isActive('down') ? 'active' : ''}`} aria-label="Down">
                <ChevronDown size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Center: System Buttons (Select & Start / Genesis Start) */}
        <div className={`center-zone layout-${consoleConfig.layout}`}>
          {consoleConfig.layout === 'genesis' ? (
            <button 
              className={`pill-btn genesis-start-btn ${isActive('start') ? 'active' : ''}`}
              data-btn="start"
              data-group="system"
            >
              START
            </button>
          ) : (
            <>
              <button 
                className={`pill-btn ${isActive('select') ? 'active' : ''}`}
                data-btn="select"
                data-group="system"
              >
                SELECT
              </button>
              <button 
                className={`pill-btn ${isActive('start') ? 'active' : ''}`}
                data-btn="start"
                data-group="system"
              >
                START
              </button>
            </>
          )}
        </div>

        {/* Right Side: Action Buttons Zone Adapted to Console Layout */}
        <div className="action-zone" data-zone="action">
          {/* 1. NES & GBA: 2-Button Horizontal / Angled Layout (B, A) */}
          {(consoleConfig.layout === 'nes' || consoleConfig.layout === 'gba') && (
            <div className={`action-two-btn ${consoleConfig.layout}`}>
              <button className={`action-btn btn-nes-b ${isActive('b') ? 'active' : ''}`} data-btn="b" data-group="action">
                B
              </button>
              <button className={`action-btn btn-nes-a ${isActive('a') ? 'active' : ''}`} data-btn="a" data-group="action">
                A
              </button>
            </div>
          )}

          {/* 2. Sega Genesis: 3-Button Ergonomic Arc (A, B, C) */}
          {consoleConfig.layout === 'genesis' && (
            <div className="action-genesis-arc">
              <button className={`action-btn btn-gen-a ${isActive('y') ? 'active' : ''}`} data-btn="y" data-group="action">
                A
              </button>
              <button className={`action-btn btn-gen-b ${isActive('b') ? 'active' : ''}`} data-btn="b" data-group="action">
                B
              </button>
              <button className={`action-btn btn-gen-c ${isActive('a') ? 'active' : ''}`} data-btn="a" data-group="action">
                C
              </button>
            </div>
          )}

          {/* 3. PlayStation 1: Authentic Geometric Diamond (△, □, ○, X) */}
          {consoleConfig.layout === 'ps1' && (
            <div className="action-diamond ps1-diamond">
              <button className={`action-btn btn-ps-triangle ${isActive('x') ? 'active' : ''}`} data-btn="x" data-group="action" aria-label="Triangle">
                △
              </button>
              <div className="action-middle-row">
                <button className={`action-btn btn-ps-square ${isActive('y') ? 'active' : ''}`} data-btn="y" data-group="action" aria-label="Square">
                  □
                </button>
                <button className={`action-btn btn-ps-circle ${isActive('a') ? 'active' : ''}`} data-btn="a" data-group="action" aria-label="Circle">
                  ○
                </button>
              </div>
              <button className={`action-btn btn-ps-cross ${isActive('b') ? 'active' : ''}`} data-btn="b" data-group="action" aria-label="Cross">
                X
              </button>
            </div>
          )}

          {/* 4. SNES & Universal: 4-Button Diamond (X, Y, A, B) */}
          {(consoleConfig.layout === 'snes' || (!['nes', 'gba', 'genesis', 'ps1'].includes(consoleConfig.layout))) && (
            <div className="action-diamond">
              <button className={`action-btn btn-x ${isActive('x') ? 'active' : ''}`} data-btn="x" data-group="action">
                X
              </button>
              <div className="action-middle-row">
                <button className={`action-btn btn-y ${isActive('y') ? 'active' : ''}`} data-btn="y" data-group="action">
                  Y
                </button>
                <button className={`action-btn btn-a ${isActive('a') ? 'active' : ''}`} data-btn="a" data-group="action">
                  A
                </button>
              </div>
              <button className={`action-btn btn-b ${isActive('b') ? 'active' : ''}`} data-btn="b" data-group="action">
                B
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Touch Feedback Settings Sheet */}
      {showFeelSheet && (
        <div className="skin-drawer-backdrop" onClick={() => setShowFeelSheet(false)}>
          <div className="skin-drawer feel-sheet glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="skin-drawer-header">
              <div className="drawer-title-wrapper">
                <Vibrate size={20} style={{ color: 'var(--primary-color)' }} />
                <h3>Touch Feedback</h3>
              </div>
              <button className="icon-close-btn" onClick={() => setShowFeelSheet(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <p className="drawer-hint">
              Tune how the controller feels so you can keep your eyes on the game.
            </p>

            <div className="feel-section">
              <div className="feel-row-label">
                <Vibrate size={15} />
                <span>Haptic Strength</span>
              </div>
              <div className="feel-segmented" role="radiogroup" aria-label="Haptic strength">
                {HAPTIC_LEVELS.map((lvl) => (
                  <button
                    key={lvl.id}
                    role="radio"
                    aria-checked={feedbackSettings.haptics === lvl.id}
                    className={`feel-segment ${feedbackSettings.haptics === lvl.id ? 'active' : ''}`}
                    onClick={() => updateFeedback({ haptics: lvl.id })}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
              {!canVibrate() && (
                <p className="feel-note">
                  This browser does not expose vibration (e.g. iPhone Safari). A light system tick is used where
                  available; turn on Click Sounds for reliable feedback.
                </p>
              )}
            </div>

            <button
              className={`feel-toggle ${feedbackSettings.signatures ? 'on' : ''}`}
              onClick={() => updateFeedback({ signatures: !feedbackSettings.signatures })}
              aria-pressed={feedbackSettings.signatures}
            >
              <Fingerprint size={18} />
              <span className="feel-toggle-text">
                <strong>Button Signatures</strong>
                <small>Each face button has its own pulse: bottom = short, right = long, left = double, top = triple</small>
              </span>
              <span className="feel-switch" />
            </button>

            <button
              className={`feel-toggle ${feedbackSettings.sound ? 'on' : ''}`}
              onClick={() => updateFeedback({ sound: !feedbackSettings.sound })}
              aria-pressed={feedbackSettings.sound}
            >
              <Volume2 size={18} />
              <span className="feel-toggle-text">
                <strong>Click Sounds</strong>
                <small>Soft clicks with a distinct pitch per button</small>
              </span>
              <span className="feel-switch" />
            </button>

            <button
              className={`feel-toggle ${feedbackSettings.diagonals ? 'on' : ''}`}
              onClick={() => updateFeedback({ diagonals: !feedbackSettings.diagonals })}
              aria-pressed={feedbackSettings.diagonals}
            >
              <Move size={18} />
              <span className="feel-toggle-text">
                <strong>D-Pad Diagonals</strong>
                <small>Slide your thumb anywhere on the pad; turn off for strict 4-way input</small>
              </span>
              <span className="feel-switch" />
            </button>

            <div className="skin-drawer-footer">
              <button className="btn-primary" onClick={() => setShowFeelSheet(false)} style={{ width: '100%' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skin Selection Bottom Sheet Drawer */}
      {showSkinDrawer && (
        <div className="skin-drawer-backdrop" onClick={() => setShowSkinDrawer(false)}>
          <div className="skin-drawer glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="skin-drawer-header">
              <div className="drawer-title-wrapper">
                <Palette size={20} style={{ color: 'var(--primary-color)' }} />
                <h3>Controller Skins &amp; Layouts</h3>
              </div>
              <button className="icon-close-btn" onClick={() => setShowSkinDrawer(false)}>
                <X size={20} />
              </button>
            </div>

            <p className="drawer-hint">
              Controllers adapt automatically to loaded games. You can toggle between the Classic and Variant skins below, or manually lock your favorite console layout.
            </p>

            {/* Auto-Sync Option */}
            <div 
              className={`skin-console-card auto-sync-card ${selectedConsole === 'auto' ? 'selected' : ''}`}
              onClick={() => setSelectedConsole('auto')}
            >
              <div className="card-top">
                <span className="console-title">Auto-Sync with Loaded Game</span>
                {selectedConsole === 'auto' && <span className="active-tag"><Check size={14} /> Active</span>}
              </div>
              <span className="card-sub">
                Currently loaded: {CONSOLE_SKINS[detectedConsole]?.name || 'Super Nintendo'}
              </span>
            </div>

            {/* List of Console Skins */}
            <div className="skin-console-list">
              {Object.values(CONSOLE_SKINS).map((c) => {
                const isSelected = (selectedConsole === c.id) || (selectedConsole === 'auto' && detectedConsole === c.id);
                return (
                  <div key={c.id} className={`skin-console-card ${isSelected ? 'selected' : ''}`}>
                    <div className="card-top" onClick={() => setSelectedConsole(c.id)}>
                      <span className="console-title">{c.name}</span>
                      {isSelected && <span className="active-tag"><Check size={14} /> Active</span>}
                    </div>

                    <div className="skin-variant-row">
                      <button 
                        className={`variant-chip ${isSelected && skinVariant === 'classic' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedConsole(c.id);
                          setSkinVariant('classic');
                          if (typeof window !== 'undefined') localStorage.setItem('romplayer_skin_variant', 'classic');
                        }}
                      >
                        <span className="chip-badge">Classic</span>
                        <span>{c.skins.classic.name}</span>
                      </button>

                      <button 
                        className={`variant-chip ${isSelected && skinVariant === 'variant' ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedConsole(c.id);
                          setSkinVariant('variant');
                          if (typeof window !== 'undefined') localStorage.setItem('romplayer_skin_variant', 'variant');
                        }}
                      >
                        <span className="chip-badge variant">Variant</span>
                        <span>{c.skins.variant.name}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="skin-drawer-footer">
              <button className="btn-primary" onClick={() => setShowSkinDrawer(false)} style={{ width: '100%' }}>
                Apply &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
