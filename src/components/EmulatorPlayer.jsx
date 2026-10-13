import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  X,
  HardDrive,
  RotateCcw,
} from 'lucide-react';
import { getSavedInputConfig, formatKeyDisplay } from '../utils/inputMap';
import ControlsModal from './ControlsModal';
import PhonePairingModal from './PhonePairingModal';
import BootSequence from './BootSequence';
import RewindScrubber from './RewindScrubber';
import { getAllBiosFiles, getDualShockEnabled } from '../utils/biosManager';
import { coreToConsole } from '../utils/controllerSkins';
import { useRewindBuffer } from '../hooks/useRewindBuffer';
import {
  makeGameId,
  upsertGame,
  updateThumbnail,
  captureThumbnail,
  saveSlot,
  getSlots,
} from '../utils/gameLibrary';

const NO_PLAYERS = { player1: false, player2: false, count: 0 };

/**
 * EmulatorPlayer
 * Manages emulator lifecycle, boot sequence, rewind buffer, library persistence,
 * and 3-slot save state management.
 */
export default function EmulatorPlayer({ core, romFiles, romOpts, onQuit, remote }) {
  const canvasRef = useRef(null);
  const nostalgistRef = useRef(null);
  const containerRef = useRef(null);
  const thumbTimerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [booting, setBooting] = useState(true); // show boot sequence overlay
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsConfig, setControlsConfig] = useState(getSavedInputConfig());
  const [showControlsModal, setShowControlsModal] = useState(false);

  // 3-slot save state management
  const [slots, setSlots] = useState([null, null, null]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [slotAction, setSlotAction] = useState(null); // 'save' | 'load'

  // Fullscreen HUD
  const [isFullscreenHudOpen, setIsFullscreenHudOpen] = useState(false);
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const mouseTimerRef = useRef(null);

  // Remote controller
  const roomId = remote?.roomId;
  const connectedPlayers = remote?.connectedPlayers || NO_PLAYERS;
  const setRemoteInputHandler = remote?.setInputHandler;
  const setRemoteGameState = remote?.setGameState;
  const [showPairingModal, setShowPairingModal] = useState(false);

  // Game identity
  const gameId = romOpts?.gameId || (romFiles ? makeGameId(Array.from(romFiles)) : 'unknown');
  const gameName = romFiles
    ? Array.from(romFiles)[0]?.name.replace(/\.[^.]+$/, '') || 'Unknown Game'
    : 'Unknown Game';

  // Rewind buffer
  const rewind = useRewindBuffer(nostalgistRef, !loading && !isPaused && !booting);

  // -------------------------------------------------------------------------
  // Fullscreen change detection
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleFsChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) { setIsFullscreenHudOpen(false); setIsMouseIdle(false); }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Mouse idle detection in fullscreen
  useEffect(() => {
    if (!isFullscreen) { setIsMouseIdle(false); setIsFullscreenHudOpen(false); return; }
    const reset = () => {
      setIsMouseIdle(false);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
      mouseTimerRef.current = setTimeout(() => setIsMouseIdle(true), 2500);
    };
    reset();
    window.addEventListener('mousemove', reset);
    return () => { window.removeEventListener('mousemove', reset); clearTimeout(mouseTimerRef.current); };
  }, [isFullscreen]);

  // -------------------------------------------------------------------------
  // Keyboard: Backspace = rewind, Enter/Space handled by RetroArch natively
  // -------------------------------------------------------------------------
  useEffect(() => {
    let holdTimer = null;
    const onKeyDown = (e) => {
      if (e.key === 'Backspace' && !e.repeat && !loading && !booting) {
        e.preventDefault();
        if (!rewind.isRewinding) {
          rewind.beginRewind();
        } else {
          rewind.stepBackward();
        }
        holdTimer = setInterval(() => rewind.stepBackward(), 150);
      }
      if (e.key === 'Escape' && rewind.isRewinding) {
        rewind.resumeFromRewind();
      }
    };
    const onKeyUp = (e) => {
      if (e.key === 'Backspace') {
        clearInterval(holdTimer);
        holdTimer = null;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearInterval(holdTimer);
    };
  }, [loading, booting, rewind]);

  // -------------------------------------------------------------------------
  // Attach to persistent phone controller session
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!setRemoteInputHandler || !setRemoteGameState) return undefined;
    const consoleType = coreToConsole(core);
    setRemoteInputHandler((data) => {
      if (!nostalgistRef.current) return;
      try {
        const player = data.player || 1;
        if (data.type === 'down') nostalgistRef.current.pressDown({ button: data.button, player });
        else if (data.type === 'up') nostalgistRef.current.pressUp({ button: data.button, player });
      } catch (err) { console.warn('Remote input error:', err); }
    });
    setRemoteGameState({ consoleType, inGame: true });
    return () => { setRemoteInputHandler(null); setRemoteGameState({ inGame: false }); };
  }, [core, setRemoteInputHandler, setRemoteGameState]);

  // -------------------------------------------------------------------------
  // Library: load save slots on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    getSlots(gameId).then(setSlots).catch(() => {});
  }, [gameId]);

  // -------------------------------------------------------------------------
  // Emulator init
  // -------------------------------------------------------------------------
  useEffect(() => {
    let active = true;

    const initEmulator = async () => {
      try {
        if (!core) throw new Error('Core not provided.');

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

        if (storedBiosList?.length > 0) launchOptions.bios = storedBiosList;

        const nostalgist = await Nostalgist.launch(launchOptions);

        if (!active) { try { nostalgist.exit(); } catch(e) {} return; }

        nostalgistRef.current = nostalgist;
        setLoading(false);

        // Restore from save slot if requested
        if (romOpts?.restoreSlot?.stateData) {
          try {
            await nostalgist.loadState(romOpts.restoreSlot.stateData);
          } catch (e) { console.warn('Slot restore failed:', e); }
        }

        // Register / update game in library
        await upsertGame({ id: gameId, name: gameName, core });

        // Auto-fullscreen
        try {
          if (containerRef.current && !document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(() => {});
          }
        } catch(e) {}

        // Capture thumbnail after 3 seconds of gameplay
        thumbTimerRef.current = setTimeout(async () => {
          if (!active || !canvasRef.current) return;
          const thumb = captureThumbnail(canvasRef.current);
          if (thumb) await updateThumbnail(gameId, thumb).catch(() => {});
        }, 3000);

      } catch (err) {
        if (active) {
          console.error('Nostalgist launch error:', err);
          setError({ message: err.message, stack: err.stack, url: err.cause?.url || 'N/A' });
          setLoading(false);
          setBooting(false);
        }
      }
    };

    initEmulator();

    return () => {
      active = false;
      clearTimeout(thumbTimerRef.current);
      if (nostalgistRef.current) {
        try { nostalgistRef.current.exit({ removeCanvas: false }); } catch(e) {}
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [romFiles, core]);

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------
  const handlePauseResume = async () => {
    if (!nostalgistRef.current) return;
    if (isPaused) { await nostalgistRef.current.resume(); setIsPaused(false); }
    else { await nostalgistRef.current.pause(); setIsPaused(true); }
  };

  const handleSaveToSlot = useCallback(async (slotIdx) => {
    if (!nostalgistRef.current) return;
    try {
      const snap = await nostalgistRef.current.saveState();
      const thumb = captureThumbnail(canvasRef.current);
      await saveSlot(gameId, slotIdx, snap.state, thumb);
      const updated = await getSlots(gameId);
      setSlots(updated);
    } catch (err) {
      console.error('Save slot error:', err);
    }
  }, [gameId]);

  const handleLoadFromSlot = useCallback(async (slotIdx) => {
    const slot = slots[slotIdx];
    if (!slot || !nostalgistRef.current) return;
    try { await nostalgistRef.current.loadState(slot.stateData); } catch (err) {
      console.error('Load slot error:', err);
    }
  }, [slots]);

  const handleQuit = () => {
    if (nostalgistRef.current) { try { nostalgistRef.current.exit(); } catch(e) {} }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onQuit();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try { await containerRef.current.requestFullscreen(); }
      catch (err) { console.warn('Fullscreen error:', err); }
    } else {
      await document.exitFullscreen();
    }
  };

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Slot picker modal
  // -------------------------------------------------------------------------
  const renderSlotPicker = () => (
    <div className="slot-picker-backdrop" onClick={() => setShowSlotPicker(false)}>
      <div className="slot-picker-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="slot-picker-header">
          <HardDrive size={16} />
          {slotAction === 'save' ? 'Save to Slot' : 'Load from Slot'}
          <button className="slot-picker-close" onClick={() => setShowSlotPicker(false)} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="slot-picker-grid">
          {[0, 1, 2].map((idx) => {
            const slot = slots[idx];
            const canLoad = slotAction === 'load' && slot;
            const canSave = slotAction === 'save';
            return (
              <button
                key={idx}
                className={`slot-picker-card ${slot ? 'has-data' : 'empty'} ${(slotAction === 'load' && !slot) ? 'disabled' : ''}`}
                disabled={slotAction === 'load' && !slot}
                onClick={() => {
                  if (slotAction === 'save') handleSaveToSlot(idx);
                  else if (canLoad) handleLoadFromSlot(idx);
                  setShowSlotPicker(false);
                }}
              >
                {slot?.thumbnail && <img src={slot.thumbnail} alt={`Slot ${idx + 1}`} className="slot-picker-thumb" />}
                <div className="slot-picker-label">
                  <span className="slot-num">Slot {idx + 1}</span>
                  {slot
                    ? <span className="slot-date">{new Date(slot.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    : <span className="slot-empty-txt">Empty</span>
                  }
                </div>
                {(canSave && slot) && <div className="slot-overwrite-badge">Overwrite</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Control buttons (shared between inline bar and fullscreen HUD)
  // -------------------------------------------------------------------------
  const renderControlButtons = () => (
    <>
      <button className="control-btn" onClick={handlePauseResume} title={isPaused ? 'Resume Game' : 'Pause Game'}>
        {isPaused ? <Play size={15} /> : <Pause size={15} />}
        <span>{isPaused ? 'Resume' : 'Pause'}</span>
      </button>

      <button className="control-btn" onClick={() => { setSlotAction('save'); setShowSlotPicker(true); }} title="Save game state">
        <Save size={15} />
        <span>Save</span>
      </button>

      <button
        className={`control-btn ${slots.every(s => !s) ? '' : ''}`}
        onClick={() => { setSlotAction('load'); setShowSlotPicker(true); }}
        disabled={slots.every(s => !s)}
        style={{ opacity: slots.every(s => !s) ? 0.45 : 1, cursor: slots.every(s => !s) ? 'not-allowed' : 'pointer' }}
        title="Load saved state"
      >
        <Download size={15} />
        <span>Load</span>
      </button>

      {/* Rewind button */}
      <RewindScrubber
        isRewinding={false}
        rewindProgress={rewind.rewindProgress}
        bufferCount={rewind.bufferCount}
        hasBuffer={rewind.hasBuffer}
        onBeginRewind={rewind.beginRewind}
        onStepBackward={rewind.stepBackward}
        onSeekTo={rewind.seekTo}
        onResume={rewind.resumeFromRewind}
        isPaused={isPaused}
      />

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
          <><Users size={15} /><span>2 Phones</span></>
        ) : connectedPlayers.count === 1 ? (
          <><Smartphone size={15} /><span>1 Phone</span></>
        ) : (
          <><Smartphone size={15} /><span>Phone</span></>
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
      {/* Cinematic boot overlay (shown until boot sequence complete) */}
      {booting && (
        <BootSequence core={core} onComplete={() => setBooting(false)} />
      )}

      {/* Game canvas */}
      <div className="canvas-wrapper glass-panel">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <h3>Booting Console...</h3>
          </div>
        )}
        <canvas ref={canvasRef} id="emulator-canvas" tabIndex="0" />
      </div>

      {/* Rewind overlay (full-screen takeover when rewinding) */}
      {rewind.isRewinding && (
        <RewindScrubber
          isRewinding
          rewindProgress={rewind.rewindProgress}
          bufferCount={rewind.bufferCount}
          hasBuffer={rewind.hasBuffer}
          onBeginRewind={rewind.beginRewind}
          onStepBackward={rewind.stepBackward}
          onSeekTo={rewind.seekTo}
          onResume={rewind.resumeFromRewind}
          isPaused={isPaused}
        />
      )}

      {/* Non-fullscreen control bar */}
      {!loading && !isFullscreen && (
        <div className="player-controls glass-panel">
          {renderControlButtons()}
        </div>
      )}

      {/* Fullscreen FAB + HUD dock */}
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

      {/* Controls guide (non-fullscreen) */}
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
            <span className="guide-label">Rewind:</span>
            <span className="key-badge">Backspace</span>
          </div>
        </div>
      )}

      {/* Slot picker modal */}
      {showSlotPicker && renderSlotPicker()}

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
