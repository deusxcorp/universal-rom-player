import React, { useState } from 'react';
import RomUploader from './components/RomUploader';
import EmulatorPlayer from './components/EmulatorPlayer';
import './index.css';

function App() {
  const [currentRomState, setCurrentRomState] = useState(null);

  const handleRomLoad = (core, files) => {
    setCurrentRomState({ core, files });
  };

  const handleQuit = () => {
    setCurrentRomState(null);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Universal ROM Player</h1>
        <p>Experience classic gaming in your browser with premium design</p>
      </header>

      <main style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {!currentRomState ? (
          <RomUploader onRomLoad={handleRomLoad} />
        ) : (
          <EmulatorPlayer core={currentRomState.core} romFiles={currentRomState.files} onQuit={handleQuit} />
        )}
      </main>
    </div>
  );
}

export default App;
