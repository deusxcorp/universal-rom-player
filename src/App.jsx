import React, { useState } from 'react';
import RomUploader from './components/RomUploader';
import EmulatorPlayer from './components/EmulatorPlayer';
import './index.css';

function App() {
  const [currentRom, setCurrentRom] = useState(null);

  const handleRomLoad = (file) => {
    setCurrentRom(file);
  };

  const handleQuit = () => {
    setCurrentRom(null);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Universal ROM Player</h1>
        <p>Experience classic gaming in your browser with premium design</p>
      </header>

      <main style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {!currentRom ? (
          <RomUploader onRomLoad={handleRomLoad} />
        ) : (
          <EmulatorPlayer romFile={currentRom} onQuit={handleQuit} />
        )}
      </main>
    </div>
  );
}

export default App;
