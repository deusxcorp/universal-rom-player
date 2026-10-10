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
            
            // Create a File object from the Uint8Array
            const file = new File([fileData], filename);
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
    
    // If a single zip file is uploaded, extract it
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      try {
        const extracted = await extractZip(files[0]);
        // Let's see what getCoreOptionsForFiles thinks of the extracted files.
        const res = getCoreOptionsForFiles(extracted);
        if (res && res.options) {
          // If we found a known core for the extracted files, use them
          files = extracted;
        } else {
          // Fallback to passing the zip itself (for MAME)
          files = [files[0]];
        }
      } catch (err) {
        console.error("Zip extraction failed:", err);
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
      // Ambiguous console (e.g. .cue file) - ask user
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
          This file format can belong to multiple consoles. Which one is it?
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
        Supports .nes, .sfc, .gb, .gba, .md, .n64, .zip, and multi-file CD games (.cue + .bin)
      </p>
      
      <input 
        type="file" 
        className="file-input" 
        ref={fileInputRef} 
        onChange={handleFileChange}
        accept=".nes,.sfc,.smc,.gb,.gbc,.gba,.md,.smd,.gen,.sms,.gg,.n64,.z64,.iso,.bin,.cue,.chd,.zip"
        multiple
        disabled={processing}
      />
      
      <button className="btn-primary" disabled={processing} onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
        Browse Files
      </button>

      <div className="supported-formats">
        {['NES', 'SNES', 'GBA', 'Genesis', 'N64', 'PS1', 'Saturn', 'Sega CD', 'Arcade'].map(fmt => (
          <span key={fmt} className="format-badge">{fmt}</span>
        ))}
      </div>
    </div>
  );
}
