import React, { useState } from 'react';
import { Gamepad2, Smartphone, Users } from 'lucide-react';
import RomUploader from './components/RomUploader';
import EmulatorPlayer from './components/EmulatorPlayer';
import ControlsModal from './components/ControlsModal';
import MobileController from './components/MobileController';
import PhonePairingModal from './components/PhonePairingModal';
import { useRemoteHost } from './hooks/useRemoteHost';
import './index.css';

function getControllerRoomFromUrl() {
  if (typeof window === 'undefined') return null;
  const room = new URLSearchParams(window.location.search).get('controller');
  return room ? room.toUpperCase() : null;
}

function App() {
  const [currentRomState, setCurrentRomState] = useState(null);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  // Resolved synchronously so a phone in controller mode never starts a host session
  const [controllerRoom] = useState(getControllerRoomFromUrl);

  // Phone controller host lives here (not in EmulatorPlayer) so paired phones
  // stay connected while users load, switch, or quit games.
  const remote = useRemoteHost(!controllerRoom);

  if (controllerRoom) {
    return <MobileController roomId={controllerRoom} />;
  }

  const handleRomLoad = (core, files) => {
    setCurrentRomState({ core, files });
  };

  const handleQuit = () => {
    setCurrentRomState(null);
  };

  const phoneCount = remote.connectedPlayers.count;

  return (
    <div className="app-container">
      <header className="header">
        <h1>Universal ROM Player</h1>
        <p>Experience classic gaming in your browser with premium design</p>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setIsControlsOpen(true)}>
            <Gamepad2 size={18} /> Controller Settings
          </button>
          <button
            id="header-phone-controller-btn"
            className={`btn-secondary ${phoneCount > 0 ? 'remote-active' : ''}`}
            onClick={() => setIsPairingOpen(true)}
            title="Use phone as game controller"
          >
            {phoneCount >= 2 ? <Users size={18} /> : <Smartphone size={18} />}
            {phoneCount >= 2 ? '2 Phones Paired' : phoneCount === 1 ? '1 Phone Paired' : 'Phone Controller'}
          </button>
        </div>
      </header>

      <main style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {!currentRomState ? (
          <RomUploader onRomLoad={handleRomLoad} />
        ) : (
          <EmulatorPlayer
            core={currentRomState.core}
            romFiles={currentRomState.files}
            onQuit={handleQuit}
            remote={remote}
          />
        )}
      </main>

      <ControlsModal 
        isOpen={isControlsOpen} 
        onClose={() => setIsControlsOpen(false)} 
      />

      <PhonePairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        roomId={remote.roomId}
        connectedPlayers={remote.connectedPlayers}
      />
    </div>
  );
}

export default App;
