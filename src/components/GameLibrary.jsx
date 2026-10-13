import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, Trash2, Clock, Cpu, Save, Upload,
  ChevronRight, Gamepad2, Library, Plus, X,
} from 'lucide-react';
import { getAllGames, deleteGame, getSlots, loadSlot, deleteSlot } from '../utils/gameLibrary';

/**
 * GameLibrary
 * Animated mosaic grid of previously played games with per-game save slots.
 */
export default function GameLibrary({ onRomLoad, onOpenUploader }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState(null);
  const [slots, setSlots] = useState([null, null, null]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const fileInputRef = useRef(null);

  const refreshGames = useCallback(async () => {
    setLoading(true);
    try {
      const g = await getAllGames();
      setGames(g);
    } catch (e) {
      console.error('Library load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshGames(); }, [refreshGames]);

  const openGameDetail = useCallback(async (game) => {
    setSelectedGame(game);
    setSlotsLoading(true);
    const s = await getSlots(game.id);
    setSlots(s);
    setSlotsLoading(false);
  }, []);

  const closeDetail = () => {
    setSelectedGame(null);
    setSlots([null, null, null]);
    setDeleteConfirm(null);
  };

  const handlePlayFromSlot = useCallback(async (game, slotIndex) => {
    const slotData = await loadSlot(game.id, slotIndex);
    if (!slotData) return;
    // Pass slot data via a wrapper file array — the emulator will load state after init
    onRomLoad(game.core, null, { restoreSlot: slotData });
  }, [onRomLoad]);

  const handleDeleteSlot = useCallback(async (gameId, slotIndex) => {
    await deleteSlot(gameId, slotIndex);
    const s = await getSlots(gameId);
    setSlots(s);
  }, []);

  const handleDeleteGame = useCallback(async (gameId) => {
    await deleteGame(gameId);
    setDeleteConfirm(null);
    closeDetail();
    refreshGames();
  }, [refreshGames]);

  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      onOpenUploader(e.target.files);
    }
    e.target.value = '';
  };

  const formatRelativeTime = (ts) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    const hr = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    if (hr < 24) return `${hr}h ago`;
    if (day < 7) return `${day}d ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="library-root">
      {/* Header */}
      <div className="library-header">
        <div className="library-header-left">
          <Library size={22} className="library-header-icon" />
          <h2 className="library-title">Your Library</h2>
          <span className="library-count">{games.length} game{games.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          className="library-add-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Load a new ROM"
          id="library-add-rom-btn"
        >
          <Plus size={16} />
          Load ROM
        </button>
        <input
          type="file"
          className="file-input"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".nes,.sfc,.smc,.gb,.gbc,.gba,.md,.smd,.gen,.sms,.gg,.32x,.pce,.iso,.bin,.cue,.chd,.pbp,.m3u,.a26,.a78,.lnx,.ngp,.ngc,.ws,.wsc,.vb,.col,.tic,.zip"
          multiple
        />
      </div>

      {/* Empty state */}
      {!loading && games.length === 0 && (
        <div className="library-empty">
          <Gamepad2 size={56} className="library-empty-icon" />
          <h3>No Games Yet</h3>
          <p>Load your first ROM to start building your library.</p>
          <button
            className="btn-primary"
            onClick={() => fileInputRef.current?.click()}
            id="library-empty-load-btn"
          >
            <Upload size={16} style={{ marginRight: '0.5rem' }} />
            Load a ROM
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="library-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="library-card skeleton" />
          ))}
        </div>
      )}

      {/* Mosaic grid */}
      {!loading && games.length > 0 && (
        <div className="library-grid">
          {games.map((game, i) => (
            <div
              key={game.id}
              className="library-card"
              style={{ animationDelay: `${i * 60}ms` }}
              onClick={() => openGameDetail(game)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openGameDetail(game)}
              aria-label={`Open ${game.name}`}
            >
              {/* Thumbnail */}
              <div className="library-card-thumb">
                {game.thumbnail ? (
                  <img src={game.thumbnail} alt={`${game.name} screenshot`} />
                ) : (
                  <div className="library-card-thumb-placeholder">
                    <Gamepad2 size={32} />
                  </div>
                )}
                <div className="library-card-hover-overlay">
                  <Play size={28} className="library-card-play-icon" />
                </div>
              </div>

              {/* Info */}
              <div className="library-card-info">
                <div className="library-card-name" title={game.name}>
                  {game.name}
                </div>
                <div className="library-card-meta">
                  <span className="library-card-console">{game.consoleName}</span>
                  <span className="library-card-time">
                    <Clock size={11} />
                    {formatRelativeTime(game.lastPlayed)}
                  </span>
                </div>
              </div>

              {/* Save slot indicator dots */}
              <div className="library-card-slots" aria-label="Save slots">
                {[0, 1, 2].map((s) => (
                  <span key={s} className="library-slot-dot" aria-hidden="true" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Game Detail Drawer */}
      {selectedGame && (
        <div
          className="library-drawer-backdrop"
          onClick={closeDetail}
          role="button"
          tabIndex={-1}
          aria-label="Close game details"
        >
          <div
            className="library-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`${selectedGame.name} details`}
          >
            {/* Drawer header */}
            <div className="drawer-header">
              <div className="drawer-thumb">
                {selectedGame.thumbnail ? (
                  <img src={selectedGame.thumbnail} alt={selectedGame.name} />
                ) : (
                  <div className="drawer-thumb-placeholder">
                    <Gamepad2 size={40} />
                  </div>
                )}
              </div>
              <div className="drawer-title-block">
                <h3 className="drawer-game-name">{selectedGame.name}</h3>
                <div className="drawer-meta">
                  <span className="drawer-console-badge">
                    <Cpu size={12} />
                    {selectedGame.consoleName}
                  </span>
                  <span className="drawer-played">
                    <Clock size={12} />
                    Last played {new Date(selectedGame.lastPlayed).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button className="drawer-close-btn" onClick={closeDetail} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Play from start */}
            <button
              className="drawer-play-btn"
              onClick={() => { onRomLoad(selectedGame.core, null, { gameId: selectedGame.id }); closeDetail(); }}
              id={`drawer-play-${selectedGame.id}`}
            >
              <Play size={18} />
              Play from Start
              <ChevronRight size={16} style={{ marginLeft: 'auto' }} />
            </button>

            {/* Save slots */}
            <div className="drawer-slots-section">
              <h4 className="drawer-slots-title">
                <Save size={14} />
                Save Slots
              </h4>

              {slotsLoading ? (
                <div className="drawer-slots-loading">
                  <div className="spinner" style={{ width: '24px', height: '24px', margin: 0 }} />
                </div>
              ) : (
                <div className="drawer-slots-grid">
                  {[0, 1, 2].map((slotIdx) => {
                    const slot = slots[slotIdx];
                    return (
                      <div key={slotIdx} className={`drawer-slot-card ${slot ? 'filled' : 'empty'}`}>
                        <div className="slot-index">Slot {slotIdx + 1}</div>
                        {slot ? (
                          <>
                            {slot.thumbnail && (
                              <img className="slot-thumb" src={slot.thumbnail} alt={`Slot ${slotIdx + 1}`} />
                            )}
                            <div className="slot-date">{new Date(slot.savedAt).toLocaleString()}</div>
                            <div className="slot-actions">
                              <button
                                className="slot-btn load"
                                onClick={() => { handlePlayFromSlot(selectedGame, slotIdx); closeDetail(); }}
                                title="Load this save"
                              >
                                <Play size={13} />
                                Load
                              </button>
                              <button
                                className="slot-btn del"
                                onClick={() => handleDeleteSlot(selectedGame.id, slotIdx)}
                                title="Delete this save"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="slot-empty-label">Empty</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Delete game */}
            <div className="drawer-danger-zone">
              {deleteConfirm === selectedGame.id ? (
                <div className="drawer-delete-confirm">
                  <span>Delete this game and all saves?</span>
                  <button
                    className="slot-btn del"
                    onClick={() => handleDeleteGame(selectedGame.id)}
                  >
                    <Trash2 size={13} /> Confirm Delete
                  </button>
                  <button
                    className="slot-btn"
                    onClick={() => setDeleteConfirm(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="drawer-delete-btn"
                  onClick={() => setDeleteConfirm(selectedGame.id)}
                  title="Remove from library"
                >
                  <Trash2 size={14} />
                  Remove from Library
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
