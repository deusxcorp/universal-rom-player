import React, { useState, useRef } from 'react';
import { UploadCloud, Gamepad2 } from 'lucide-react';
import { SUPPORTED_EXTENSIONS } from '../coreMap';

export default function RomUploader({ onRomLoad }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = (file) => {
    if (file) {
      onRomLoad(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div 
      className={`glass-panel uploader-container ${isDragging ? 'drag-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="upload-icon-wrapper">
        <Gamepad2 size={64} />
      </div>
      
      <h2 className="upload-title">Drop your ROM here</h2>
      <p className="upload-subtitle">or click to browse your files</p>
      
      <button className="btn-primary" onClick={handleButtonClick}>
        <UploadCloud size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
        Select ROM
      </button>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="file-input"
        accept={SUPPORTED_EXTENSIONS.join(',')}
      />

      <div className="supported-formats">
        {SUPPORTED_EXTENSIONS.map(ext => (
          <span key={ext} className="format-badge">{ext}</span>
        ))}
      </div>
    </div>
  );
}
