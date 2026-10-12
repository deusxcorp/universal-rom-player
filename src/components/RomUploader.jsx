import React, { useState, useRef } from 'react';
import { UploadCloud, Gamepad2, AlertCircle } from 'lucide-react';
import { getCoreOptionsForFiles } from '../coreMap';
import * as fflate from 'fflate';

export default function RomUploader({ onRomLoad }) {
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [coreOptions, setCoreOptions] = useState(null);
  const [pendingFiles, setPendingFiles] = useState(null);
  const fileInputRef = useRef(null);

  const extractZip = async (zipFile) => {
    return new Promise(async (resolve, reject) => {
      try {
        const buffer = await zipFile.arrayBuffer();
        const u8 = new Uint8Array(buffer);
        fflate.unzip(u8, (err, unzipped) => {
          if (err) return reject(err);
          const extractedFiles = [];
          for (const [filename, fileData] of Object.entries(unzipped)) {
            // Ignore directories
            if (fileData.length === 0 && filename.endsWith('/')) continue;

            // Flatten filename to prevent subdirectory path mismatches
            const flatFilename = filename.split('/').filter(Boolean).pop();
            if (!flatFilename) continue;

            // Create a File object from the Uint8Array
            const file = new File([fileData], flatFilename);
            extractedFiles.push(file);
          }
          resolve(extractedFiles);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  const validateAndLoad = async (fileList) => {
    setProcessing(true);
    let files = Array.from(fileList);

    // Check if user dropped a .7z file
    const has7z = files.some((f) => f.name.toLowerCase().endsWith('.7z'));
    if (has7z) {
      setProcessing(false);
      alert('The browser cannot open .7z files directly. Please extract the .7z file on your computer first, then drag in the extracted ROM files.');
      return;
    }

    // Smart Zip Inspection: Unpack archives that contain console ROMs, but keep Arcade ROMsets as .zip
    const expandedFiles = [];
    for (const f of files) {
      if (f.name.toLowerCase().endsWith('.zip')) {
        try {
          const extracted = await extractZip(f);
          const res = getCoreOptionsForFiles(extracted);
          if (res && res.options && res.options[0]?.core !== 'mame2003_plus') {
            expandedFiles.push(...extracted);
          } else {
            expandedFiles.push(f);
          }
        } catch (err) {
          console.warn('Zip inspection fallback:', err);
          expandedFiles.push(f);
        }
      } else {
        expandedFiles.push(f);
      }
    }
    files = expandedFiles;

    // Check if a .cue file was uploaded without .bin files
    const cueFile = files.find((f) => f.name.toLowerCase().endsWith('.cue'));
    if (cueFile) {
      const binFiles = files.filter(
        (f) => f.name.toLowerCase().endsWith('.bin') || f.name.toLowerCase().endsWith('.iso')
      );
      if (binFiles.length === 0) {
        setProcessing(false);
        alert('A .cue file only contains a track index, not the game data. You must highlight and drag both the .cue file AND the .bin file(s) into the player together.');
        return;
      }
    }

    const res = getCoreOptionsForFiles(files);
    setProcessing(false);

    if (!res || !res.options || res.options.length === 0) {
      alert('Unsupported file format. Please upload a valid ROM file.');
      return;
    }

    const { options, orderedFiles } = res;

    if (options.length > 1) {
      // Ambiguous console (e.g. .cue or .iso file which could be PS1 or Sega CD) - ask user
      setCoreOptions(options);
      setPendingFiles(orderedFiles);
    } else {
      // Only one option, proceed directly
      onRomLoad(options[0].core, orderedFiles);
    }
  };

  const handleConsoleSelect = (core) => {
    onRomLoad(core, pendingFiles);
    setCoreOptions(null);
    setPendingFiles(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndLoad(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndLoad(e.target.files);
    }
  };

  if (coreOptions) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', width: '100%', margin: '0 auto', animation: 'fadeInUp 0.5s ease' }}>
        <Gamepad2 size={48} style={{ color: 'var(--primary-color)', marginBottom: '1rem' }} />
        <h2>Select Console</h2>
        <p style={{ color: 'var(--secondary-color)', marginBottom: '2rem' }}>
          This file format can belong to multiple consoles. Which one would you like to run?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {coreOptions.map((opt) => (
            <button key={opt.core} className="btn-primary" onClick={() => handleConsoleSelect(opt.core)}>
              {opt.name}
            </button>
          ))}
        </div>
        <button className="control-btn" style={{ marginTop: '2rem', alignSelf: 'center', display: 'inline-flex' }} onClick={() => setCoreOptions(null)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div
      className={`glass-panel uploader-container ${isDragging ? 'drag-active' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
      style={{ cursor: processing ? 'wait' : 'pointer' }}
    >
      <div className="upload-icon-wrapper">
        {processing ? <div className="spinner" style={{ width: '48px', height: '48px', margin: 0 }}></div> : <UploadCloud size={48} />}
      </div>
      <h2 className="upload-title">
        {processing ? 'Processing Files...' : (isDragging ? 'Drop ROMs Here' : 'Select or Drop ROM Files')}
      </h2>
      <p className="upload-subtitle">
        Supports NES, SNES, GBA, Genesis, 32X, PS1 (.chd/.pbp/.cue), Sega CD, TurboGrafx-16, Atari, Neo Geo Pocket, WonderSwan, and Arcade
      </p>

      <input
        type="file"
        className="file-input"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".nes,.sfc,.smc,.gb,.gbc,.gba,.md,.smd,.gen,.sms,.gg,.32x,.pce,.iso,.bin,.cue,.chd,.pbp,.m3u,.a26,.a78,.lnx,.ngp,.ngc,.ws,.wsc,.vb,.col,.tic,.zip"
        multiple
        disabled={processing}
      />

      <button className="btn-primary" disabled={processing} onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
        Browse Files
      </button>

      <div className="supported-formats">
        {[
          'NES', 'SNES', 'GBA', 'Genesis', 'Sega 32X', 'PS1', 'Sega CD',
          'Atari 2600', 'TurboGrafx-16', 'Neo Geo Pocket', 'WonderSwan', 'Arcade',
        ].map((fmt) => (
          <span key={fmt} className="format-badge">{fmt}</span>
        ))}
      </div>
    </div>
  );
}
