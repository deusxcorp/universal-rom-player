import React, { useState, useEffect } from 'react';
import { Gamepad2 } from 'lucide-react';
import RomUploader from './components/RomUploader';
import EmulatorPlayer from './components/EmulatorPlayer';
import ControlsModal from './components/ControlsModal';
import MobileController from './components/MobileController';
import './index.css';

function App() {
  const [currentRomState, setCurrentRomState] = useState(null);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [controllerRoom, setControllerRoom] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const room = params.get('controller');
      if (room) {
        setControllerRoom(room.toUpperCase());
      }
    }
  }, []);

  if (controllerRoom) {
    return <MobileController roomId={controllerRoom} />;
  }

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
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setIsControlsOpen(true)}>
            <Gamepad2 size={18} /> Controller Settings
          </button>
        </div>
      </header>

      <main style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {!currentRomState ? (
          <RomUploader onRomLoad={handleRomLoad} />
        ) : (
          <EmulatorPlayer core={currentRomState.core} romFiles={currentRomState.files} onQuit={handleQuit} />
        )}
      </main>

      <ControlsModal 
        isOpen={isControlsOpen} 
        onClose={() => setIsControlsOpen(false)} 
      />
    </div>
  );
}

export default App;
