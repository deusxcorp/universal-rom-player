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
 * Initializes the Host session on the laptop emulator.
 * Supports up to 2 simultaneous phone controllers (Player 1 and Player 2).
 */
export function createHostSession(roomId, callbacks = {}) {
  const { onReady, onPlayersChange, onInput, onError } = callbacks;

  const playerConnections = {
    1: null,
    2: null,
  };

  const peer = new Peer(roomId, {
    debug: 1,
  });

  const notifyPlayersChange = () => {
    if (onPlayersChange) {
      onPlayersChange({
        player1: !!playerConnections[1] && playerConnections[1].open,
        player2: !!playerConnections[2] && playerConnections[2].open,
        count: (playerConnections[1]?.open ? 1 : 0) + (playerConnections[2]?.open ? 1 : 0),
      });
    }
  };

  peer.on('open', (id) => {
    if (onReady) onReady(id);
  });

  peer.on('connection', (conn) => {
    // Find first available slot (1 then 2)
    let assignedSlot = null;
    if (!playerConnections[1] || !playerConnections[1].open) {
      assignedSlot = 1;
    } else if (!playerConnections[2] || !playerConnections[2].open) {
      assignedSlot = 2;
    }

    if (!assignedSlot) {
      // Both slots occupied
      console.warn('Room full: Maximum 2 phone controllers allowed');
      conn.on('open', () => {
        conn.send({ type: 'room_full', message: 'Room is full (2 players connected)' });
        setTimeout(() => {
          try { conn.close(); } catch (e) {}
        }, 500);
      });
      return;
    }

    conn.playerNumber = assignedSlot;
    playerConnections[assignedSlot] = conn;

    conn.on('open', () => {
      // Send handshake identifying assigned player slot
      conn.send({
        type: 'handshake',
        player: assignedSlot,
        roomId,
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
  });

  peer.on('error', (err) => {
    console.error('PeerJS Host Error:', err);
    if (onError) onError(err);
  });

  return {
    destroy: () => {
      [1, 2].forEach((slot) => {
        if (playerConnections[slot]) {
          try { playerConnections[slot].close(); } catch (e) {}
          playerConnections[slot] = null;
        }
      });
      try { peer.destroy(); } catch (e) {}
    },
    getConnectedPlayers: () => ({
      player1: !!playerConnections[1]?.open,
      player2: !!playerConnections[2]?.open,
      count: (playerConnections[1]?.open ? 1 : 0) + (playerConnections[2]?.open ? 1 : 0),
    }),
  };
}

/**
 * Initializes the Client controller session on the mobile device.
 */
export function createClientSession(roomId, callbacks = {}) {
  const { onConnected, onDisconnected, onPlayerAssigned, onError } = callbacks;

  let conn = null;
  const peer = new Peer({
    debug: 1,
  });

  peer.on('open', () => {
    conn = peer.connect(roomId, {
      reliable: false, // Low-latency UDP data channel
    });

    conn.on('open', () => {
      if (onConnected) onConnected();
    });

    conn.on('data', (data) => {
      if (data && data.type === 'handshake' && data.player) {
        if (onPlayerAssigned) onPlayerAssigned(data.player);
      } else if (data && data.type === 'room_full') {
        if (onError) onError(new Error(data.message || 'Room is full'));
      }
    });

    conn.on('close', () => {
      if (onDisconnected) onDisconnected();
    });

    conn.on('error', (err) => {
      console.error('Controller connection error:', err);
      if (onError) onError(err);
    });
  });

  peer.on('error', (err) => {
    console.error('PeerJS Client Error:', err);
    if (onError) onError(err);
  });

  return {
    sendInput: (button, type) => {
      if (conn && conn.open) {
        conn.send({ button, type });
      }
    },
    disconnect: () => {
      if (conn) {
        try { conn.close(); } catch (e) {}
      }
      try { peer.destroy(); } catch (e) {}
    },
  };
}
