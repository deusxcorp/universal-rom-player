import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Copy, Check, Wifi, Sparkles } from 'lucide-react';

export default function PhonePairingModal({ isOpen, onClose, roomId, isConnected }) {
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="pairing-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrapper">
            <Smartphone size={28} style={{ color: 'var(--primary-color)' }} />
            <div>
              <h2>Use Phone as Controller</h2>
              <p className="modal-subtitle">Scan with your phone's camera to play wirelessly</p>
            </div>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <div className="pairing-content">
          <div className="pairing-status-badge">
            <span className={`status-dot ${isConnected ? 'connected' : 'waiting'}`} />
            {isConnected ? (
              <span className="status-text connected">Phone Controller Connected! 🎮</span>
            ) : (
              <span className="status-text waiting">Waiting for phone to scan...</span>
            )}
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
            <span>✨ No app download needed</span>
            <span>⚡ Ultra-low latency P2P</span>
            <span>📳 Haptic touch feedback</span>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={onClose}>
            {isConnected ? 'Start Playing' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
