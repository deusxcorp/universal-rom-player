import React, { useEffect, useRef, useState } from 'react';
import { Nostalgist } from 'nostalgist';
import { 
  Play, 
  Pause, 
  Save, 
  Download, 
  XCircle, 
  Maximize, 
  Minimize, 
  Gamepad2, 
  Smartphone, 
  Users, 
  SlidersHorizontal, 
  X 
} from 'lucide-react';
import { getSavedInputConfig, formatKeyDisplay } from '../utils/inputMap';
import { generateRoomId, createHostSession } from '../utils/inputRemote';
import ControlsModal from './ControlsModal';
import PhonePairingModal from './PhonePairingModal';
import { getAllBiosFiles, getDualShockEnabled } from '../utils/biosManager';

export default function EmulatorPlayer({ core, romFiles, onQuit }) {
  const canvasRef = useRef(null);
  const nostalgistRef = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [saveState, setSaveState] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsConfig, setControlsConfig] = useState(getSavedInputConfig());
  const [showControlsModal, setShowControlsModal] = useState(false);

  // Fullscreen HUD overlay state
  const [isFullscreenHudOpen, setIsFullscreenHudOpen] = useState(false);
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const mouseTimerRef = useRef(null);

  // Mobile Remote Controller State (Multi-Player P1 & P2)
  const [roomId] = useState(() => generateRoomId());
  const [connectedPlayers, setConnectedPlayers] = useState({ player1: false, player2: false, count: 0 });
  const [showPairingModal, setShowPairingModal] = useState(false);
  const hostSessionRef = useRef(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) {
        setIsFullscreenHudOpen(false);
        setIsMouseIdle(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Mouse idle detection in fullscreen mode (auto-fade HUD & cursor)
  useEffect(() => {
    if (!isFullscreen) {
      setIsMouseIdle(false);
      setIsFullscreenHudOpen(false);
      return;
    }

    const resetMouseTimer = () => {
      setIsMouseIdle(false);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
      mouseTimerRef.current = setTimeout(() => {
        setIsMouseIdle(true);
      }, 2500);
    };

    resetMouseTimer();
    window.addEventListener('mousemove', resetMouseTimer);
    return () => {
      window.removeEventListener('mousemove', resetMouseTimer);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
    };
  }, [isFullscreen]);

  // WebRTC Host Session for Remote Phone Controllers (Up to 2 players)
  useEffect(() => {
    const session = createHostSession(roomId, {
      onPlayersChange: (status) => {
        setConnectedPlayers(status);
      },
      onInput: (data) => {
        if (!nostalgistRef.current) return;
        try {
          const player = data.player || 1;
          if (data.type === 'down') {
            nostalgistRef.current.pressDown({ button: data.button, player });
          } else if (data.type === 'up') {
            nostalgistRef.current.pressUp({ button: data.button, player });
          }
        } catch (err) {
          console.warn('Error applying remote input:', err);
        }
      },
    });

    hostSessionRef.current = session;

    return () => {
      session.destroy();
    };
  }, [roomId]);

  useEffect(() => {
    let active = true;

    const initEmulator = async () => {
      try {
        if (!core) {
          throw new Error(`Core not provided.`);
        }

        const inputConfig = getSavedInputConfig();
        const storedBiosList = await getAllBiosFiles();
        const isDualShock = getDualShockEnabled();

        const retroarchConfig = {
          ...inputConfig,
          ...(isDualShock ? { input_libretro_device_p1: 517, input_libretro_device_p2: 517 } : {}),
        };

        const launchOptions = {
          core,
          rom: romFiles,
          element: canvasRef.current,
          size: { width: 800, height: 600 },
          retroarchConfig,
        };

        if (storedBiosList && storedBiosList.length > 0) {
          launchOptions.bios = storedBiosList;
        }

        const nostalgist = await Nostalgist.launch(launchOptions);

        if (active) {
          nostalgistRef.current = nostalgist;
          setLoading(false);

          // Auto-fullscreen on game load
          try {
            if (containerRef.current && !document.fullscreenElement) {
              containerRef.current.requestFullscreen().catch(() => {});
            }
          } catch (e) {}
        } else {
          try { nostalgist.exit(); } catch(e) {}
        }
      } catch (err) {
        if (active) {
          console.error("Nostalgist launch error:", err);
          setError({
            message: err.message,
            stack: err.stack,
            url: err.cause?.url || 'N/A'
          });
          setLoading(false);
        }
      }
    };

    initEmulator();

    return () => {
      active = false;
      if (nostalgistRef.current) {
        try {
          nostalgistRef.current.exit({ removeCanvas: false });
        } catch (e) {
          console.error("Error exiting emulator:", e);
        }
      }
    };
  }, [romFiles, core]);

  const handlePauseResume = async () => {
    if (!nostalgistRef.current) return;
    
    if (isPaused) {
      await nostalgistRef.current.resume();
      setIsPaused(false);
    } else {
      await nostalgistRef.current.pause();
      setIsPaused(true);
    }
  };

  const handleSaveState = async () => {
    if (!nostalgistRef.current) return;
    try {
      const state = await nostalgistRef.current.saveState();
      setSaveState(state);
      alert('State saved successfully!');
    } catch (err) {
      alert('Failed to save state: ' + err.message);
    }
  };

  const handleLoadState = async () => {
    if (!nostalgistRef.current || !saveState) return;
    try {
      await nostalgistRef.current.loadState(saveState.state);
    } catch (err) {
      alert('Failed to load state: ' + err.message);
    }
  };

  const handleQuit = () => {
    if (nostalgistRef.current) {
      try {
        nostalgistRef.current.exit();
      } catch(e) {}
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onQuit();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
      } catch (err) {
        alert(`Error attempting to enable fullscreen: ${err.message}`);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  };

  if (error) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger-color)' }}>
        <h2>Error Launching Game</h2>
        <p>{error.message}</p>
        {error.url !== 'N/A' && <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>URL: {error.url}</p>}
        <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.5)', padding: '1rem', marginTop: '1rem', borderRadius: '8px', overflowX: 'auto' }}>
          <pre style={{ fontSize: '0.75rem', color: '#ccc' }}>{error.stack}</pre>
        </div>
        <button className="control-btn danger" style={{ marginTop: '1rem' }} onClick={onQuit}>
          <XCircle size={18} /> Go Back
        </button>
      </div>
    );
  }

  const renderControlButtons = () => (
    <>
      <button className="control-btn" onClick={handlePauseResume} title={isPaused ? 'Resume Game' : 'Pause Game'}>
        {isPaused ? <Play size={15} /> : <Pause size={15} />}
        <span>{isPaused ? 'Resume' : 'Pause'}</span>
      </button>
      
      <button className="control-btn" onClick={handleSaveState} title="Save current progress">
        <Save size={15} />
        <span>Save State</span>
      </button>
      
      <button 
        className="control-btn" 
        onClick={handleLoadState}
        disabled={!saveState}
        style={{ opacity: !saveState ? 0.45 : 1, cursor: !saveState ? 'not-allowed' : 'pointer' }}
        title="Load saved progress"
      >
        <Download size={15} />
        <span>Load State</span>
      </button>
      
      <button className="control-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Enable Fullscreen'}>
        {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
        <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
      </button>

      <button className="control-btn" onClick={() => setShowControlsModal(true)} title="Customize Controller">
        <Gamepad2 size={15} />
        <span>Controls</span>
      </button>

      <button 
        className={`control-btn ${connectedPlayers.count > 0 ? 'remote-active' : ''}`}
        onClick={() => setShowPairingModal(true)}
        title="Use phone as game controller"
      >
        {connectedPlayers.count >= 2 ? (
          <>
            <Users size={15} />
            <span>2 Phones</span>
          </>
        ) : connectedPlayers.count === 1 ? (
          <>
            <Smartphone size={15} />
            <span>1 Phone</span>
          </>
        ) : (
          <>
            <Smartphone size={15} />
            <span>Phone</span>
          </>
        )}
      </button>
      
      <button className="control-btn danger" onClick={handleQuit} title="Exit to game select">
        <XCircle size={15} />
        <span>Quit Game</span>
      </button>
    </>
  );

  return (
    <div 
      className={`player-container ${isFullscreen && isMouseIdle && !isFullscreenHudOpen ? 'mouse-idle' : ''}`} 
      ref={containerRef}
    >
      <div className="canvas-wrapper glass-panel">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <h3>Booting Console...</h3>
          </div>
        )}
        <canvas ref={canvasRef} id="emulator-canvas" tabIndex="0"></canvas>
      </div>
      
      {/* Non-fullscreen Player Controls (Single Horizontal Row) */}
      {!loading && !isFullscreen && (
        <div className="player-controls glass-panel">
          {renderControlButtons()}
        </div>
      )}

      {/* Fullscreen Discreet HUD & Floating Action Button (Zero in-game obstruction) */}
      {!loading && isFullscreen && (
        <>
          <button 
            className={`fullscreen-hud-fab ${isMouseIdle && !isFullscreenHudOpen ? 'idle' : ''} ${isFullscreenHudOpen ? 'open' : ''}`}
            onClick={() => setIsFullscreenHudOpen(!isFullscreenHudOpen)}
            title={isFullscreenHudOpen ? 'Hide Menu' : 'Game Menu'}
            aria-label="Toggle game menu"
          >
            {isFullscreenHudOpen ? <X size={20} /> : <SlidersHorizontal size={20} />}
          </button>

          <div className={`fullscreen-hud-dock glass-panel ${isFullscreenHudOpen ? 'visible' : ''}`}>
            {renderControlButtons()}
          </div>
        </>
      )}

      {/* Non-fullscreen Controls Guide (Single Balanced Row with Dividers) */}
      {!loading && !isFullscreen && (
        <div className="controls-guide glass-panel">
          <div className="guide-item">
            <span className="guide-label">D-Pad:</span>
            <span className="key-badge">{formatKeyDisplay(controlsConfig.input_player1_up)}</span>
            <span className="key-badge">{formatKeyDisplay(controlsConfig.input_player1_down)}</span>
            <span className="key-badge">{formatKeyDisplay(controlsConfig.input_player1_left)}</span>
            <span className="key-badge">{formatKeyDisplay(controlsConfig.input_player1_right)}</span>
          </div>

          <div className="guide-divider" />

          <div className="guide-item">
            <span className="guide-label">Action:</span>
            <span className="key-badge highlight">{formatKeyDisplay(controlsConfig.input_player1_y)}</span>
            <span className="key-badge highlight">{formatKeyDisplay(controlsConfig.input_player1_b)}</span>
            <span className="key-badge highlight">{formatKeyDisplay(controlsConfig.input_player1_a)}</span>
            <span className="key-badge highlight">{formatKeyDisplay(controlsConfig.input_player1_x)}</span>
          </div>

          <div className="guide-divider" />

          <div className="guide-item">
            <span className="guide-label">Shoulders:</span>
            <span className="key-badge">{formatKeyDisplay(controlsConfig.input_player1_l)}</span>
            <span className="key-badge">{formatKeyDisplay(controlsConfig.input_player1_r)}</span>
          </div>

          <div className="guide-divider" />

          <div className="guide-item">
            <span className="guide-label">System:</span>
            <span className="key-badge">{formatKeyDisplay(controlsConfig.input_player1_select)}</span>
            <span className="key-badge">{formatKeyDisplay(controlsConfig.input_player1_start)}</span>
          </div>
        </div>
      )}

      <ControlsModal 
        isOpen={showControlsModal} 
        onClose={() => setShowControlsModal(false)}
        onConfigSaved={(newCfg) => setControlsConfig(newCfg)}
      />

      <PhonePairingModal 
        isOpen={showPairingModal} 
        onClose={() => setShowPairingModal(false)}
        roomId={roomId}
        connectedPlayers={connectedPlayers}
      />
    </div>
  );
}
