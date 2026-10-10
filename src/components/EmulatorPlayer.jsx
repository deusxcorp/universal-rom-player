import React, { useEffect, useRef, useState } from 'react';
import { Nostalgist } from 'nostalgist';
import { getCoreForExtension } from '../coreMap';
import { Play, Pause, Save, Download, XCircle, Maximize, Minimize } from 'lucide-react';

export default function EmulatorPlayer({ romFile, onQuit }) {
  const canvasRef = useRef(null);
  const nostalgistRef = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [saveState, setSaveState] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    let active = true;

    const initEmulator = async () => {
      try {
        const core = getCoreForExtension(romFile.name);
        
        if (!core) {
          throw new Error(`Unsupported ROM format for file: ${romFile.name}`);
        }

        // Configure nostalgist to use our canvas and the right core
        const nostalgist = await Nostalgist.launch({
          core,
          rom: romFile,
          element: canvasRef.current,
          size: { width: 800, height: 600 }
        });

        if (active) {
          nostalgistRef.current = nostalgist;
          setLoading(false);
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
  }, [romFile]);

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

  return (
    <div className="player-container" ref={containerRef}>
      <div className="canvas-wrapper glass-panel">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <h3>Booting Console...</h3>
          </div>
        )}
        <canvas ref={canvasRef} id="emulator-canvas" tabIndex="0"></canvas>
      </div>
      
      {!loading && (
        <div className="player-controls glass-panel">
          <button className="control-btn" onClick={handlePauseResume}>
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          
          <button className="control-btn" onClick={handleSaveState}>
            <Save size={18} /> Save State
          </button>
          
          <button 
            className="control-btn" 
            onClick={handleLoadState}
            disabled={!saveState}
            style={{ opacity: !saveState ? 0.5 : 1, cursor: !saveState ? 'not-allowed' : 'pointer' }}
          >
            <Download size={18} /> Load State
          </button>
          
          <button className="control-btn" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
          
          <button className="control-btn danger" onClick={handleQuit}>
            <XCircle size={18} /> Quit Game
          </button>
        </div>
      )}
    </div>
  );
}
