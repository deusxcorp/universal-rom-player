import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Gamepad2, Check, Sparkles } from 'lucide-react';
import { 
  BUTTON_METADATA, 
  getSavedInputConfig, 
  saveInputConfig, 
  resetInputConfig, 
  eventToRetroarchKey, 
  formatKeyDisplay 
} from '../utils/inputMap';

export default function ControlsModal({ isOpen, onClose, onConfigSaved }) {
  const [config, setConfig] = useState(getSavedInputConfig());
  const [activeBinding, setActiveBinding] = useState(null);
  const [saveToast, setSaveToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getSavedInputConfig());
      setActiveBinding(null);
    }
  }, [isOpen]);

  // Listen for keydown when a button slot is active
  useEffect(() => {
    if (!activeBinding) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        setActiveBinding(null);
        return;
      }

      const retroarchKey = eventToRetroarchKey(e);
      if (!retroarchKey) return;

      const newConfig = {
        ...config,
        [activeBinding]: retroarchKey,
      };

      setConfig(newConfig);
      saveInputConfig(newConfig);
      setActiveBinding(null);
      if (onConfigSaved) onConfigSaved(newConfig);

      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2000);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [activeBinding, config, onConfigSaved]);

  if (!isOpen) return null;

  const handleReset = () => {
    const def = resetInputConfig();
    setConfig(def);
    setActiveBinding(null);
    if (onConfigSaved) onConfigSaved(def);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const groups = ['D-Pad', 'Action Buttons', 'Shoulders & Triggers', 'System'];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="controls-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrapper">
            <Gamepad2 size={28} style={{ color: 'var(--primary-color)' }} />
            <div>
              <h2>Customize Controller</h2>
              <p className="modal-subtitle">
                Click any button slot, then press a key on your keyboard to lock it in.
              </p>
            </div>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        {saveToast && (
          <div className="save-toast">
            <Check size={16} /> Saved to browser storage!
          </div>
        )}

        <div className="modal-content">
          {groups.map((group) => {
            const groupButtons = BUTTON_METADATA.filter((btn) => btn.group === group);
            return (
              <div key={group} className="config-group">
                <h3 className="group-title">{group}</h3>
                <div className="config-grid">
                  {groupButtons.map((btn) => {
                    const isBinding = activeBinding === btn.id;
                    const currentKey = config[btn.id];

                    return (
                      <div 
                        key={btn.id} 
                        className={`bind-card ${isBinding ? 'listening' : ''}`}
                        onClick={() => setActiveBinding(btn.id)}
                      >
                        <div className="bind-info">
                          <span className="bind-label">{btn.label}</span>
                          <span className="bind-hint">{btn.consoleHint}</span>
                        </div>
                        <div className={`bind-key-box ${isBinding ? 'pulse' : ''}`}>
                          {isBinding ? 'Press Key...' : formatKeyDisplay(currentKey)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="modal-footer">
          <button className="control-btn" onClick={handleReset}>
            <RotateCcw size={16} /> Reset to Defaults
          </button>
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
