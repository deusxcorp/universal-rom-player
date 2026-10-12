import React, { useState, useEffect, useRef } from 'react';
import { createClientSession } from '../utils/inputRemote';
import { CONSOLE_SKINS } from '../utils/controllerSkins';
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
  Check
} from 'lucide-react';

export default function MobileController({ roomId: propRoomId }) {
  const [roomId, setRoomId] = useState(propRoomId || '');
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected' | 'error'
  const [playerNumber, setPlayerNumber] = useState(1); // 1 or 2
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [activeButtons, setActiveButtons] = useState(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const clientSessionRef = useRef(null);

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

  // Connect to Host WebRTC
  useEffect(() => {
    if (!roomId) return;

    setStatus('connecting');

    const session = createClientSession(roomId, {
      onConnected: () => {
        setStatus('connected');
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      },
      onPlayerAssigned: (assignedSlot) => {
        setPlayerNumber(assignedSlot);
      },
      onConsoleChange: (consoleType) => {
        if (consoleType && CONSOLE_SKINS[consoleType]) {
          setDetectedConsole(consoleType);
        }
      },
      onDisconnected: () => {
        setStatus('disconnected');
      },
      onError: (err) => {
        console.error('Mobile client connection error:', err);
        setStatus('error');
      },
    });

    clientSessionRef.current = session;

    return () => {
      session.disconnect();
    };
  }, [roomId]);

  // Active console & skin configuration
  const activeConsoleKey = selectedConsole === 'auto' ? detectedConsole : selectedConsole;
  const consoleConfig = CONSOLE_SKINS[activeConsoleKey] || CONSOLE_SKINS.snes;
  const currentSkin = consoleConfig.skins[skinVariant] || consoleConfig.skins.classic;

  const toggleSkinVariant = () => {
    const next = skinVariant === 'classic' ? 'variant' : 'classic';
    setSkinVariant(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('romplayer_skin_variant', next);
    }
    if (hapticsEnabled && navigator.vibrate) {
      try { navigator.vibrate(20); } catch (e) {}
    }
  };

  // Send input down/up
  const handleButtonPress = (btnName) => {
    if (clientSessionRef.current) {
      clientSessionRef.current.sendInput(btnName, 'down');
    }
    setActiveButtons((prev) => new Set(prev).add(btnName));

    if (hapticsEnabled && navigator.vibrate) {
      try { navigator.vibrate(15); } catch (e) {}
    }
  };

  const handleButtonRelease = (btnName) => {
    if (clientSessionRef.current) {
      clientSessionRef.current.sendInput(btnName, 'up');
    }
    setActiveButtons((prev) => {
      const next = new Set(prev);
      next.delete(btnName);
      return next;
    });
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

  // Helper to create touch/mouse listeners for a button
  const getButtonHandlers = (btnName) => ({
    onTouchStart: (e) => {
      e.preventDefault();
      handleButtonPress(btnName);
    },
    onTouchEnd: (e) => {
      e.preventDefault();
      handleButtonRelease(btnName);
    },
    onTouchCancel: (e) => {
      e.preventDefault();
      handleButtonRelease(btnName);
    },
    onMouseDown: (e) => {
      e.preventDefault();
      handleButtonPress(btnName);
    },
    onMouseUp: (e) => {
      e.preventDefault();
      handleButtonRelease(btnName);
    },
    onMouseLeave: (e) => {
      if (activeButtons.has(btnName)) {
        handleButtonRelease(btnName);
      }
    },
  });

  if (status === 'error' || !roomId) {
    return (
      <div className="mobile-controller-error">
        <WifiOff size={48} style={{ color: 'var(--danger-color)', marginBottom: '1rem' }} />
        <h2>Connection Failed</h2>
        <p>Could not connect to laptop room <strong>{roomId || 'Unknown'}</strong>.</p>
        <p className="error-hint">Make sure the laptop has the game running and the room is not already full (max 2 players).</p>
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

  return (
    <div className={`mobile-gamepad-container player-${playerNumber} ${currentSkin.themeClass} layout-${consoleConfig.layout}`}>
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
            className="topbar-btn" 
            onClick={() => setHapticsEnabled(!hapticsEnabled)}
            title="Toggle Vibration"
          >
            {hapticsEnabled ? <Vibrate size={15} /> : <VibrateOff size={15} style={{ opacity: 0.5 }} />}
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

      {/* Shoulders Bar (Displayed when console has shoulder bumpers) */}
      {consoleConfig.hasShoulders && (
        <div className="gamepad-shoulders">
          <button 
            className={`shoulder-btn ${activeButtons.has('l') ? 'active' : ''}`}
            {...getButtonHandlers('l')}
          >
            {consoleConfig.layout === 'ps1' ? 'L1' : 'L'}
          </button>
          <div className="shoulder-spacer">
            <span className="room-indicator-mini">{roomId} • {consoleConfig.shortName}</span>
          </div>
          <button 
            className={`shoulder-btn ${activeButtons.has('r') ? 'active' : ''}`}
            {...getButtonHandlers('r')}
          >
            {consoleConfig.layout === 'ps1' ? 'R1' : 'R'}
          </button>
        </div>
      )}

      {/* Main Body: D-Pad (Left), Center (Select/Start), Action Buttons (Right) */}
      <div className={`gamepad-main-body layout-${consoleConfig.layout}`}>
        {/* Left Side: Authentic D-Pad */}
        <div className="dpad-zone">
          <div className={`dpad-cross-container ${consoleConfig.layout}`}>
            {consoleConfig.layout === 'genesis' && <div className="genesis-dpad-ring" />}
            <div className="dpad-cross">
              <button 
                className={`dpad-btn up ${activeButtons.has('up') ? 'active' : ''}`}
                {...getButtonHandlers('up')}
                aria-label="Up"
              >
                <ChevronUp size={24} />
              </button>
              <div className="dpad-middle-row">
                <button 
                  className={`dpad-btn left ${activeButtons.has('left') ? 'active' : ''}`}
                  {...getButtonHandlers('left')}
                  aria-label="Left"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="dpad-center" />
                <button 
                  className={`dpad-btn right ${activeButtons.has('right') ? 'active' : ''}`}
                  {...getButtonHandlers('right')}
                  aria-label="Right"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
              <button 
                className={`dpad-btn down ${activeButtons.has('down') ? 'active' : ''}`}
                {...getButtonHandlers('down')}
                aria-label="Down"
              >
                <ChevronDown size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Center: System Buttons (Select & Start / Genesis Start) */}
        <div className={`center-zone layout-${consoleConfig.layout}`}>
          {consoleConfig.layout === 'genesis' ? (
            <button 
              className={`pill-btn genesis-start-btn ${activeButtons.has('start') ? 'active' : ''}`}
              {...getButtonHandlers('start')}
            >
              START
            </button>
          ) : (
            <>
              <button 
                className={`pill-btn ${activeButtons.has('select') ? 'active' : ''}`}
                {...getButtonHandlers('select')}
              >
                SELECT
              </button>
              <button 
                className={`pill-btn ${activeButtons.has('start') ? 'active' : ''}`}
                {...getButtonHandlers('start')}
              >
                START
              </button>
            </>
          )}
        </div>

        {/* Right Side: Action Buttons Zone Adapted to Console Layout */}
        <div className="action-zone">
          {/* 1. NES & GBA: 2-Button Horizontal / Angled Layout (B, A) */}
          {(consoleConfig.layout === 'nes' || consoleConfig.layout === 'gba') && (
            <div className={`action-two-btn ${consoleConfig.layout}`}>
              <button 
                className={`action-btn btn-nes-b ${activeButtons.has('b') ? 'active' : ''}`}
                {...getButtonHandlers('b')}
              >
                B
              </button>
              <button 
                className={`action-btn btn-nes-a ${activeButtons.has('a') ? 'active' : ''}`}
                {...getButtonHandlers('a')}
              >
                A
              </button>
            </div>
          )}

          {/* 2. Sega Genesis: 3-Button Ergonomic Arc (A, B, C) */}
          {consoleConfig.layout === 'genesis' && (
            <div className="action-genesis-arc">
              <button 
                className={`action-btn btn-gen-a ${activeButtons.has('y') ? 'active' : ''}`}
                {...getButtonHandlers('y')}
              >
                A
              </button>
              <button 
                className={`action-btn btn-gen-b ${activeButtons.has('b') ? 'active' : ''}`}
                {...getButtonHandlers('b')}
              >
                B
              </button>
              <button 
                className={`action-btn btn-gen-c ${activeButtons.has('a') ? 'active' : ''}`}
                {...getButtonHandlers('a')}
              >
                C
              </button>
            </div>
          )}

          {/* 3. PlayStation 1: Authentic Geometric Diamond (△, □, ○, X) */}
          {consoleConfig.layout === 'ps1' && (
            <div className="action-diamond ps1-diamond">
              <button 
                className={`action-btn btn-ps-triangle ${activeButtons.has('x') ? 'active' : ''}`}
                {...getButtonHandlers('x')}
                aria-label="Triangle"
              >
                △
              </button>
              <div className="action-middle-row">
                <button 
                  className={`action-btn btn-ps-square ${activeButtons.has('y') ? 'active' : ''}`}
                  {...getButtonHandlers('y')}
                  aria-label="Square"
                >
                  □
                </button>
                <button 
                  className={`action-btn btn-ps-circle ${activeButtons.has('a') ? 'active' : ''}`}
                  {...getButtonHandlers('a')}
                  aria-label="Circle"
                >
                  ○
                </button>
              </div>
              <button 
                className={`action-btn btn-ps-cross ${activeButtons.has('b') ? 'active' : ''}`}
                {...getButtonHandlers('b')}
                aria-label="Cross"
              >
                X
              </button>
            </div>
          )}

          {/* 4. SNES & Universal: 4-Button Diamond (X, Y, A, B) */}
          {(consoleConfig.layout === 'snes' || (!['nes', 'gba', 'genesis', 'ps1'].includes(consoleConfig.layout))) && (
            <div className="action-diamond">
              <button 
                className={`action-btn btn-x ${activeButtons.has('x') ? 'active' : ''}`}
                {...getButtonHandlers('x')}
              >
                X
              </button>
              <div className="action-middle-row">
                <button 
                  className={`action-btn btn-y ${activeButtons.has('y') ? 'active' : ''}`}
                  {...getButtonHandlers('y')}
                >
                  Y
                </button>
                <button 
                  className={`action-btn btn-a ${activeButtons.has('a') ? 'active' : ''}`}
                  {...getButtonHandlers('a')}
                >
                  A
                </button>
              </div>
              <button 
                className={`action-btn btn-b ${activeButtons.has('b') ? 'active' : ''}`}
                {...getButtonHandlers('b')}
              >
                B
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Skin Selection Bottom Sheet Drawer */}
      {showSkinDrawer && (
        <div className="skin-drawer-backdrop" onClick={() => setShowSkinDrawer(false)}>
          <div className="skin-drawer glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="skin-drawer-header">
              <div className="drawer-title-wrapper">
                <Palette size={20} style={{ color: 'var(--primary-color)' }} />
                <h3>Controller Skins & Layouts</h3>
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
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
