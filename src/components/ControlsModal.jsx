import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  RotateCcw, 
  Gamepad2, 
  Check, 
  Cpu, 
  Sliders, 
  Gamepad, 
  Trash2, 
  UploadCloud, 
  HardDrive, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';
import { 
  BUTTON_METADATA, 
  getSavedInputConfig, 
  saveInputConfig, 
  resetInputConfig, 
  eventToRetroarchKey, 
  formatKeyDisplay 
} from '../utils/inputMap';
import { 
  getAllBiosList, 
  saveBios, 
  deleteBios, 
  KNOWN_BIOS_INFO, 
  getDualShockEnabled, 
  setDualShockEnabled 
} from '../utils/biosManager';

export default function ControlsModal({ isOpen, onClose, onConfigSaved }) {
  const [activeTab, setActiveTab] = useState('keyboard'); // 'keyboard' | 'bios' | 'mode'
  const [config, setConfig] = useState(getSavedInputConfig());
  const [activeBinding, setActiveBinding] = useState(null);
  const [saveToast, setSaveToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // BIOS state
  const [biosList, setBiosList] = useState([]);
  const [biosLoading, setBiosLoading] = useState(false);
  const [isBiosDragging, setIsBiosDragging] = useState(false);
  const biosFileInputRef = useRef(null);

  // DualShock mode state
  const [isDualShock, setIsDualShock] = useState(getDualShockEnabled());

  const showToast = (msg) => {
    setToastMessage(msg);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2200);
  };

  const refreshBios = async () => {
    setBiosLoading(true);
    try {
      const list = await getAllBiosList();
      setBiosList(list);
    } catch (e) {
      console.warn('Could not load BIOS list:', e);
    } finally {
      setBiosLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setConfig(getSavedInputConfig());
      setActiveBinding(null);
      setIsDualShock(getDualShockEnabled());
      refreshBios();
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

      showToast('Saved button binding!');
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
    showToast('Reset keyboard controls to defaults!');
  };

  const handleBiosUpload = async (files) => {
    if (!files || files.length === 0) return;
    setBiosLoading(true);
    try {
      for (const file of Array.from(files)) {
        await saveBios(file);
      }
      await refreshBios();
      showToast('BIOS file saved to IndexedDB!');
    } catch (err) {
      console.error('Error uploading BIOS:', err);
      alert('Failed to save BIOS file: ' + err.message);
    } finally {
      setBiosLoading(false);
    }
  };

  const handleBiosDelete = async (fileName) => {
    try {
      await deleteBios(fileName);
      await refreshBios();
      showToast(`Removed ${fileName}`);
    } catch (err) {
      console.error('Error deleting BIOS:', err);
    }
  };

  const handleDualShockToggle = (enabled) => {
    setIsDualShock(enabled);
    setDualShockEnabled(enabled);
    showToast(enabled ? 'Enabled DualShock Analog Controller!' : 'Set to Standard Digital Controller');
  };

  const groups = ['D-Pad', 'Action Buttons', 'Shoulders & Triggers', 'System'];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="controls-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrapper">
            <Gamepad2 size={28} style={{ color: 'var(--primary-color)' }} />
            <div>
              <h2>Controller & System Settings</h2>
              <p className="modal-subtitle">
                Configure keyboard controls, install system BIOS files, and set controller modes.
              </p>
            </div>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="modal-tabs">
          <button 
            className={`tab-btn ${activeTab === 'keyboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('keyboard')}
          >
            <Sliders size={16} />
            <span>Keyboard Controls</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'bios' ? 'active' : ''}`}
            onClick={() => setActiveTab('bios')}
          >
            <Cpu size={16} />
            <span>System BIOS ({biosList.length})</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'mode' ? 'active' : ''}`}
            onClick={() => setActiveTab('mode')}
          >
            <Gamepad size={16} />
            <span>Controller Mode</span>
          </button>
        </div>

        {saveToast && (
          <div className="save-toast">
            <Check size={16} /> {toastMessage || 'Settings saved!'}
          </div>
        )}

        {/* Tab 1: Keyboard Mapping */}
        {activeTab === 'keyboard' && (
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
        )}

        {/* Tab 2: System BIOS Management */}
        {activeTab === 'bios' && (
          <div className="modal-content bios-tab-content">
            <div className="bios-info-banner glass-panel">
              <ShieldCheck size={24} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
              <div>
                <strong>Enhance Console Compatibility & Saves</strong>
                <p>
                  Official BIOS files enable 100% native game compatibility, authentic boot sequences, and working memory card saves for PlayStation 1, Sega CD, and TurboGrafx-CD. Stored safely in your local browser storage.
                </p>
              </div>
            </div>

            {/* BIOS Dropzone */}
            <div 
              className={`bios-dropzone glass-panel ${isBiosDragging ? 'drag-active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsBiosDragging(true); }}
              onDragLeave={() => setIsBiosDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsBiosDragging(false);
                if (e.dataTransfer.files) handleBiosUpload(e.dataTransfer.files);
              }}
              onClick={() => biosFileInputRef.current?.click()}
            >
              <UploadCloud size={32} style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }} />
              <h4>Drag & drop BIOS files here (.bin, .pce)</h4>
              <p>or click to browse from your computer</p>
              <input 
                type="file" 
                ref={biosFileInputRef} 
                style={{ display: 'none' }} 
                multiple 
                onChange={(e) => {
                  if (e.target.files) handleBiosUpload(e.target.files);
                }} 
              />
            </div>

            {/* Installed BIOS List */}
            <div className="installed-bios-section">
              <h3 className="group-title">Installed BIOS Files ({biosList.length})</h3>
              {biosList.length === 0 ? (
                <div className="empty-bios-placeholder glass-panel">
                  <AlertCircle size={20} style={{ color: 'var(--secondary-color)' }} />
                  <span>No BIOS files installed yet. HLE fallback emulation will be used for CD systems.</span>
                </div>
              ) : (
                <div className="bios-file-grid">
                  {biosList.map((item) => (
                    <div key={item.fileName} className="bios-file-card glass-panel">
                      <div className="bios-card-left">
                        <HardDrive size={18} style={{ color: 'var(--primary-color)' }} />
                        <div>
                          <div className="bios-card-name">{item.originalName}</div>
                          <div className="bios-card-meta">
                            {item.info.console} • {(item.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                      <button 
                        className="bios-delete-btn"
                        onClick={() => handleBiosDelete(item.fileName)}
                        title="Delete this BIOS"
                        aria-label={`Delete ${item.fileName}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommended BIOS Names Reference */}
            <div className="bios-reference-section">
              <h3 className="group-title">Common Recognized BIOS Filenames</h3>
              <div className="bios-ref-grid">
                {Object.entries(KNOWN_BIOS_INFO).map(([fname, info]) => {
                  const isInstalled = biosList.some((b) => b.fileName === fname);
                  return (
                    <div key={fname} className={`bios-ref-item glass-panel ${isInstalled ? 'installed' : ''}`}>
                      <div className="ref-name">{fname}</div>
                      <div className="ref-desc">{info.console} - {info.label}</div>
                      <span className={`ref-badge ${isInstalled ? 'ready' : 'missing'}`}>
                        {isInstalled ? 'Installed' : 'Optional'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Controller Mode */}
        {activeTab === 'mode' && (
          <div className="modal-content mode-tab-content">
            <div className="controller-mode-section">
              <h3 className="group-title">PlayStation 1 & 3D Game Controller Mode</h3>
              <p className="section-desc">
                Select how the emulator reports your controller to the console. Some 3D racing games (like *Need for Speed III: Hot Pursuit* and *Gran Turismo*) require a DualShock analog controller to steer and accelerate.
              </p>

              <div className="mode-options-grid">
                <div 
                  className={`mode-card glass-panel ${!isDualShock ? 'selected' : ''}`}
                  onClick={() => handleDualShockToggle(false)}
                >
                  <div className="mode-card-header">
                    <Gamepad2 size={22} style={{ color: !isDualShock ? 'var(--primary-color)' : 'var(--text-main)' }} />
                    <h4>Standard Digital Pad (Default)</h4>
                  </div>
                  <p>
                    Standard 8-way directional pad. Best for 2D platformers, fighting games, arcade classics, and general retro gaming.
                  </p>
                  <span className={`mode-badge ${!isDualShock ? 'active' : ''}`}>
                    {!isDualShock ? 'Active' : 'Select'}
                  </span>
                </div>

                <div 
                  className={`mode-card glass-panel ${isDualShock ? 'selected' : ''}`}
                  onClick={() => handleDualShockToggle(true)}
                >
                  <div className="mode-card-header">
                    <Gamepad size={22} style={{ color: isDualShock ? 'var(--primary-color)' : 'var(--text-main)' }} />
                    <h4>Sony DualShock Analog Controller</h4>
                  </div>
                  <p>
                    Emulates analog thumbstick inputs (`device_p1 = 517`). Resolves non-responsive steering in 3D racers (*Need for Speed III*, *Gran Turismo*, *Ridge Racer Type 4*, *Ape Escape*).
                  </p>
                  <span className={`mode-badge ${isDualShock ? 'active' : ''}`}>
                    {isDualShock ? 'Active' : 'Select'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="modal-footer">
          {activeTab === 'keyboard' && (
            <button className="control-btn" onClick={handleReset}>
              <RotateCcw size={16} /> Reset to Defaults
            </button>
          )}
          <button className="btn-primary" onClick={onClose} style={{ marginLeft: 'auto' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
