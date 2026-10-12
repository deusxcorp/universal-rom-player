import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Copy, Check, Users, Sparkles, Zap, Vibrate, CheckCircle2 } from 'lucide-react';

export default function PhonePairingModal({ isOpen, onClose, roomId, connectedPlayers = { player1: false, player2: false, count: 0 } }) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const controllerUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?controller=${roomId}`
    : '';

  useEffect(() => {
    if (isOpen && roomId && controllerUrl) {
      QRCode.toDataURL(controllerUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0b0c10',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error('Failed to generate QR code:', err));
    }
  }, [isOpen, roomId, controllerUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(controllerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const { player1 = false, player2 = false, count = 0 } = connectedPlayers;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="pairing-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrapper">
            <Smartphone size={28} style={{ color: 'var(--primary-color)' }} />
            <div>
              <h2>Use Phone as Controller</h2>
              <p className="modal-subtitle">Scan with phone camera to connect up to 2 players</p>
            </div>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <div className="pairing-content">
          {/* Dual Player Slots Status Grid */}
          <div className="players-status-grid">
            <div className={`player-slot-card p1 ${player1 ? 'active' : ''}`}>
              <div className="slot-header">
                <span className="player-tag p1">P1</span>
                <span className="slot-title">Player 1</span>
              </div>
              <div className="slot-status">
                <span className={`status-dot ${player1 ? 'connected' : 'waiting'}`} />
                <span className={`status-text ${player1 ? 'connected' : 'waiting'}`}>
                  {player1 ? 'Connected' : 'Waiting for scan...'}
                </span>
              </div>
            </div>

            <div className={`player-slot-card p2 ${player2 ? 'active' : ''}`}>
              <div className="slot-header">
                <span className="player-tag p2">P2</span>
                <span className="slot-title">Player 2</span>
              </div>
              <div className="slot-status">
                <span className={`status-dot ${player2 ? 'connected' : 'waiting'}`} />
                <span className={`status-text ${player2 ? 'connected' : 'waiting'}`}>
                  {player2 ? 'Connected' : 'Waiting for scan...'}
                </span>
              </div>
            </div>
          </div>

          <div className="qr-container">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="Scan QR Code to play on phone" className="qr-image" />
            ) : (
              <div className="qr-placeholder">Generating QR code...</div>
            )}
          </div>

          <div className="pairing-pin-box">
            <span className="pin-label">Room PIN:</span>
            <span className="pin-code">{roomId}</span>
          </div>

          <div className="pairing-link-row">
            <input 
              type="text" 
              readOnly 
              value={controllerUrl} 
              className="pairing-url-input"
            />
            <button className="btn-secondary" onClick={handleCopy} title="Copy link">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="pairing-features-hint">
            <div className="hint-item">
              <Sparkles size={14} />
              <span>No app download needed</span>
            </div>
            <div className="hint-item">
              <Zap size={14} />
              <span>Ultra-low latency P2P</span>
            </div>
            <div className="hint-item">
              <Vibrate size={14} />
              <span>Haptic touch feedback</span>
            </div>
            <div className="hint-item">
              <Users size={14} />
              <span>2-Player simultaneous</span>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={onClose}>
            {count > 0 ? 'Start Playing' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
