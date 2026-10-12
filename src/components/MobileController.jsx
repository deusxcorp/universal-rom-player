import React, { useState, useEffect, useRef } from 'react';
import { createClientSession } from '../utils/inputRemote';
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
  ChevronRight 
} from 'lucide-react';

export default function MobileController({ roomId: propRoomId }) {
  const [roomId, setRoomId] = useState(propRoomId || '');
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected' | 'error'
  const [playerNumber, setPlayerNumber] = useState(1); // 1 or 2
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [activeButtons, setActiveButtons] = useState(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const clientSessionRef = useRef(null);

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
    <div className={`mobile-gamepad-container player-${playerNumber}`}>
      {/* Top Status & Controls Bar */}
      <div className="gamepad-topbar">
        <div className="connection-pill">
          <span className={`status-dot ${status === 'connected' ? 'connected' : 'waiting'}`} />
          <span className={`player-badge-tag p${playerNumber}`}>P{playerNumber}</span>
          <span className="status-label">
            {status === 'connected' ? `Player ${playerNumber}` : 'Connecting...'}
          </span>
        </div>

        <div className="topbar-actions">
          <button 
            className="topbar-btn" 
            onClick={() => setHapticsEnabled(!hapticsEnabled)}
            title="Toggle Vibration"
          >
            {hapticsEnabled ? <Vibrate size={15} /> : <VibrateOff size={15} style={{ opacity: 0.5 }} />}
            <span>{hapticsEnabled ? 'Haptics' : 'Off'}</span>
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

      {/* Shoulders Bar */}
      <div className="gamepad-shoulders">
        <button 
          className={`shoulder-btn ${activeButtons.has('l') ? 'active' : ''}`}
          {...getButtonHandlers('l')}
        >
          L1
        </button>
        <div className="shoulder-spacer">
          <span className="room-indicator-mini">{roomId}</span>
        </div>
        <button 
          className={`shoulder-btn ${activeButtons.has('r') ? 'active' : ''}`}
          {...getButtonHandlers('r')}
        >
          R1
        </button>
      </div>

      {/* Main Body: D-Pad (Left), Center (Select/Start), Action Buttons (Right) */}
      <div className="gamepad-main-body">
        {/* Left Side: D-Pad */}
        <div className="dpad-zone">
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

        {/* Center: Select & Start */}
        <div className="center-zone">
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
        </div>

        {/* Right Side: Action Buttons (Diamond layout: Y, X, B, A) */}
        <div className="action-zone">
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
        </div>
      </div>
    </div>
  );
}
