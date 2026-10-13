import React, { useState, useCallback } from 'react';
import { Gamepad2, Smartphone, Users } from 'lucide-react';
import RomUploader from './components/RomUploader';
import EmulatorPlayer from './components/EmulatorPlayer';
import ControlsModal from './components/ControlsModal';
import MobileController from './components/MobileController';
import PhonePairingModal from './components/PhonePairingModal';
import GameLibrary from './components/GameLibrary';
import { useRemoteHost } from './hooks/useRemoteHost';
import { makeGameId } from './utils/gameLibrary';
import './index.css';

function getControllerRoomFromUrl() {
  if (typeof window === 'undefined') return null;
  const room = new URLSearchParams(window.location.search).get('controller');
  return room ? room.toUpperCase() : null;
}

function App() {
  // null = library, 'upload' = uploader, { core, files, opts } = playing
  const [view, setView] = useState('library');
  const [currentRomState, setCurrentRomState] = useState(null);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [controllerRoom] = useState(getControllerRoomFromUrl);

  // Phone controller host lives at App level so paired phones persist across game loads
  const remote = useRemoteHost(!controllerRoom);

  if (controllerRoom) {
    return <MobileController roomId={controllerRoom} />;
  }

  /**
   * Called by both RomUploader and GameLibrary.
   * files: FileList | File[] | null (null when loading from library metadata)
   * opts: { gameId, restoreSlot } — used when coming from library
   */
  const handleRomLoad = useCallback((core, files, opts = {}) => {
    const gameId = opts.gameId || (files ? makeGameId(Array.from(files)) : null);
    setCurrentRomState({ core, files, opts: { ...opts, gameId } });
    setView('player');
  }, []);

  const handleQuit = useCallback(() => {
    setCurrentRomState(null);
    setView('library');
  }, []);

  /** Called from GameLibrary "Load ROM" — re-use uploader */
  const handleOpenUploader = useCallback((preloadFiles) => {
    if (preloadFiles) {
      // Files came from the hidden input inside GameLibrary; process them inline
      // by importing the uploader logic — simpler to just show uploader
    }
    setView('upload');
  }, []);

  const phoneCount = remote.connectedPlayers.count;

  const renderHeader = () => (
    <header className="header">
      <h1
        className={view === 'player' ? 'header-h1-compact' : ''}
        onClick={() => view !== 'player' && setView('library')}
        style={{ cursor: view !== 'player' ? 'pointer' : 'default' }}
        title={view !== 'player' ? 'Back to library' : undefined}
      >
        Universal ROM Player
      </h1>
      {view !== 'player' && (
        <p>Experience classic gaming in your browser with premium design</p>
      )}
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
  );

  return (
    <div className="app-container">
      {renderHeader()}

      <main style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {view === 'library' && (
          <GameLibrary
            onRomLoad={handleRomLoad}
            onOpenUploader={handleOpenUploader}
          />
        )}
        {view === 'upload' && (
          <RomUploader onRomLoad={handleRomLoad} />
        )}
        {view === 'player' && currentRomState && (
          <EmulatorPlayer
            core={currentRomState.core}
            romFiles={currentRomState.files}
            romOpts={currentRomState.opts}
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
