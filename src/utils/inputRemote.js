import { Peer } from 'peerjs';

export function generateRoomId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ROM-${code}`;
}

/**
 * Stable per-device identifier so the host can hand a reconnecting phone
 * back the same player slot (P1 stays P1, P2 stays P2).
 */
function getClientId() {
  const KEY = 'romplayer_controller_client_id';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `c-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch (e) {
    return `c-${Math.random().toString(36).slice(2, 10)}`;
  }
}

const RECOVERABLE_PEER_ERRORS = new Set([
  'network',
  'server-error',
  'socket-error',
  'socket-closed',
  'disconnected',
  'webrtc',
]);

/**
 * Initializes the Host session on the laptop emulator.
 *
 * The host session is app-lifetime: it is created once when the app mounts and
 * survives loading, switching and quitting games. Game changes are pushed to
 * connected phones via `setGameState` instead of tearing the session down.
 *
 * Supports up to 2 simultaneous phone controllers (Player 1 and Player 2).
 */
export function createHostSession(roomId, callbacks = {}, initialState = {}) {
  const { onReady, onPlayersChange, onInput, onError } = callbacks;
  let currentConsoleType = initialState.consoleType || 'snes';
  let inGame = !!initialState.inGame;
  let destroyed = false;
  let peer = null;
  let idRetryCount = 0;
  let reconnectTimer = null;

  const playerConnections = { 1: null, 2: null };
  // clientId -> last assigned slot, used to restore slots on reconnect
  const slotByClient = new Map();

  const isOpen = (slot) => !!playerConnections[slot] && playerConnections[slot].open;

  const getConnectedPlayers = () => ({
    player1: isOpen(1),
    player2: isOpen(2),
    count: (isOpen(1) ? 1 : 0) + (isOpen(2) ? 1 : 0),
  });

  const notifyPlayersChange = () => {
    if (onPlayersChange) onPlayersChange(getConnectedPlayers());
  };

  const broadcast = (message) => {
    [1, 2].forEach((slot) => {
      if (isOpen(slot)) {
        try { playerConnections[slot].send(message); } catch (e) {}
      }
    });
  };

  const assignSlot = (conn) => {
    const clientId = conn.metadata?.clientId || null;

    // 1. Returning phone reclaims its previous slot, replacing any stale connection
    if (clientId && slotByClient.has(clientId)) {
      const prevSlot = slotByClient.get(clientId);
      const existing = playerConnections[prevSlot];
      const existingIsSameDevice = existing && existing.metadata?.clientId === clientId;
      if (!existing || !existing.open || existingIsSameDevice) {
        if (existing && existing !== conn) {
          playerConnections[prevSlot] = null;
          try { existing.close(); } catch (e) {}
        }
        return prevSlot;
      }
    }

    // 2. Otherwise take the first free slot
    if (!isOpen(1)) return 1;
    if (!isOpen(2)) return 2;
    return null;
  };

  const handleConnection = (conn) => {
    const assignedSlot = assignSlot(conn);

    if (!assignedSlot) {
      console.warn('Room full: Maximum 2 phone controllers allowed');
      conn.on('open', () => {
        conn.send({ type: 'room_full', message: 'Room is full (2 players connected)' });
        setTimeout(() => {
          try { conn.close(); } catch (e) {}
        }, 500);
      });
      return;
    }

    const clientId = conn.metadata?.clientId;
    if (clientId) slotByClient.set(clientId, assignedSlot);

    conn.playerNumber = assignedSlot;
    playerConnections[assignedSlot] = conn;

    conn.on('open', () => {
      conn.send({
        type: 'handshake',
        player: assignedSlot,
        roomId,
        consoleType: currentConsoleType,
        inGame,
      });
      notifyPlayersChange();
    });

    conn.on('data', (data) => {
      if (onInput && data && data.button) {
        onInput({
          button: data.button,
          type: data.type,
          player: conn.playerNumber || 1,
        });
      }
    });

    conn.on('close', () => {
      if (playerConnections[assignedSlot] === conn) {
        playerConnections[assignedSlot] = null;
      }
      notifyPlayersChange();
    });

    conn.on('error', (err) => {
      console.warn(`Peer connection error for Player ${assignedSlot}:`, err);
    });
  };

  const scheduleSignalingReconnect = () => {
    if (destroyed || reconnectTimer || !peer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (destroyed || !peer || peer.destroyed) return;
      if (peer.disconnected) {
        try { peer.reconnect(); } catch (e) {}
      }
    }, 1500);
  };

  const startPeer = () => {
    if (destroyed) return;
    peer = new Peer(roomId, { debug: 1 });

    peer.on('open', (id) => {
      idRetryCount = 0;
      if (onReady) onReady(id);
    });

    peer.on('connection', handleConnection);

    // Lost the signaling server. Existing phone data channels stay alive;
    // reconnecting keeps the same room ID so new/returning phones can join.
    peer.on('disconnected', () => {
      scheduleSignalingReconnect();
    });

    peer.on('error', (err) => {
      if (destroyed) return;
      const type = err && err.type;

      // Room ID still held by a previous instance (e.g. fast remount): retry shortly
      if (type === 'unavailable-id' && idRetryCount < 6) {
        idRetryCount += 1;
        try { peer.destroy(); } catch (e) {}
        setTimeout(startPeer, 1000 * idRetryCount);
        return;
      }

      if (RECOVERABLE_PEER_ERRORS.has(type)) {
        console.warn('PeerJS Host recoverable error, reconnecting:', type);
        scheduleSignalingReconnect();
        return;
      }

      // A phone that left before connecting is not a host failure
      if (type === 'peer-unavailable') return;

      console.error('PeerJS Host Error:', err);
      if (onError) onError(err);
    });
  };

  startPeer();

  return {
    /**
     * Push the currently loaded game to every connected phone without
     * interrupting their connection.
     */
    setGameState: ({ consoleType, inGame: nextInGame } = {}) => {
      if (consoleType) currentConsoleType = consoleType;
      if (typeof nextInGame === 'boolean') inGame = nextInGame;
      broadcast({ type: 'console_change', consoleType: currentConsoleType, inGame });
    },
    setConsoleType: (newType) => {
      currentConsoleType = newType;
      broadcast({ type: 'console_change', consoleType: newType, inGame });
    },
    destroy: () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      [1, 2].forEach((slot) => {
        if (playerConnections[slot]) {
          try { playerConnections[slot].close(); } catch (e) {}
          playerConnections[slot] = null;
        }
      });
      try { peer && peer.destroy(); } catch (e) {}
    },
    getConnectedPlayers,
  };
}

/**
 * Initializes the Client controller session on the mobile device.
 *
 * Automatically reconnects (with backoff) if the link drops, so brief network
 * hiccups, screen locks, or host-side signaling blips never strand the phone.
 */
export function createClientSession(roomId, callbacks = {}) {
  const {
    onConnected,
    onDisconnected,
    onReconnecting,
    onPlayerAssigned,
    onConsoleChange,
    onHostStatus,
    onError,
  } = callbacks;

  const clientId = getClientId();
  const MAX_ATTEMPTS = 40;
  const OPEN_TIMEOUT_MS = 8000;

  let peer = null;
  let conn = null;
  let destroyed = false;
  let fatal = false;
  let attempts = 0;
  let retryTimer = null;
  let openTimer = null;
  let hasConnectedOnce = false;

  const clearOpenTimer = () => {
    if (openTimer) {
      clearTimeout(openTimer);
      openTimer = null;
    }
  };

  const dropConnection = () => {
    clearOpenTimer();
    const old = conn;
    conn = null; // detach first so the old close handler is ignored
    if (old) {
      try { old.close(); } catch (e) {}
    }
  };

  const scheduleReconnect = () => {
    if (destroyed || fatal || retryTimer) return;
    attempts += 1;
    if (attempts > MAX_ATTEMPTS) {
      if (onError) onError(new Error('Unable to reach the laptop. Check that the game tab is still open.'));
      return;
    }
    if (onReconnecting) onReconnecting(attempts);
    const delay = Math.min(750 * attempts, 5000);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  };

  const handleData = (data) => {
    if (!data) return;
    if (data.type === 'handshake') {
      if (data.player && onPlayerAssigned) onPlayerAssigned(data.player);
      if (data.consoleType && onConsoleChange) onConsoleChange(data.consoleType);
      if (typeof data.inGame === 'boolean' && onHostStatus) onHostStatus({ inGame: data.inGame });
    } else if (data.type === 'console_change') {
      if (data.consoleType && onConsoleChange) onConsoleChange(data.consoleType);
      if (typeof data.inGame === 'boolean' && onHostStatus) onHostStatus({ inGame: data.inGame });
    } else if (data.type === 'room_full') {
      fatal = true;
      if (onError) onError(new Error(data.message || 'Room is full'));
    }
  };

  const openConnection = () => {
    if (destroyed || fatal) return;
    if (conn && conn.open) return;
    dropConnection();

    const c = peer.connect(roomId, {
      reliable: false, // Low-latency UDP data channel
      metadata: { clientId },
    });
    conn = c;

    openTimer = setTimeout(() => {
      if (conn === c && !c.open) {
        dropConnection();
        scheduleReconnect();
      }
    }, OPEN_TIMEOUT_MS);

    c.on('open', () => {
      if (conn !== c) return;
      clearOpenTimer();
      attempts = 0;
      hasConnectedOnce = true;
      if (onConnected) onConnected();
    });

    c.on('data', (data) => {
      if (conn === c) handleData(data);
    });

    c.on('close', () => {
      if (conn !== c) return;
      conn = null;
      clearOpenTimer();
      if (destroyed || fatal) {
        if (onDisconnected) onDisconnected();
        return;
      }
      scheduleReconnect();
    });

    c.on('error', (err) => {
      if (conn !== c) return;
      console.warn('Controller connection error:', err);
      dropConnection();
      scheduleReconnect();
    });
  };

  const connect = () => {
    if (destroyed || fatal) return;

    if (!peer || peer.destroyed) {
      peer = new Peer({ debug: 1 });

      peer.on('open', () => openConnection());

      peer.on('disconnected', () => {
        if (destroyed || !peer || peer.destroyed) return;
        try { peer.reconnect(); } catch (e) {}
      });

      peer.on('error', (err) => {
        if (destroyed || fatal) return;
        console.warn('PeerJS Client error:', err && err.type, err);
        if (err && err.type === 'browser-incompatible') {
          fatal = true;
          if (onError) onError(err);
          return;
        }
        // peer-unavailable (host briefly away), network, server errors: retry
        dropConnection();
        if (peer && !peer.destroyed && !peer.open && !peer.disconnected) {
          try { peer.destroy(); } catch (e) {}
        }
        scheduleReconnect();
      });
      return;
    }

    if (peer.open) {
      openConnection();
    } else if (peer.disconnected) {
      try { peer.reconnect(); } catch (e) {
        try { peer.destroy(); } catch (e2) {}
        peer = null;
        scheduleReconnect();
      }
    }
  };

  connect();

  return {
    sendInput: (button, type) => {
      if (conn && conn.open) {
        try { conn.send({ button, type }); } catch (e) {}
      }
    },
    /** Force an immediate reconnect attempt (e.g. when the phone screen wakes). */
    reconnectNow: () => {
      if (destroyed || fatal) return;
      if (conn && conn.open) return;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      attempts = 0;
      if (hasConnectedOnce && onReconnecting) onReconnecting(0);
      connect();
    },
    isConnected: () => !!(conn && conn.open),
    disconnect: () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      dropConnection();
      try { peer && peer.destroy(); } catch (e) {}
    },
  };
}
