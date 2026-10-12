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
 */
export function createHostSession(roomId, callbacks = {}) {
  const { onReady, onConnected, onDisconnected, onInput, onError } = callbacks;

  let activeConn = null;
  const peer = new Peer(roomId, {
    debug: 1,
  });

  peer.on('open', (id) => {
    if (onReady) onReady(id);
  });

  peer.on('connection', (conn) => {
    // If another phone connects, replace or accept connection
    if (activeConn) {
      try { activeConn.close(); } catch (e) {}
    }
    activeConn = conn;

    conn.on('open', () => {
      if (onConnected) onConnected(conn);
    });

    conn.on('data', (data) => {
      if (onInput && data && data.button) {
        onInput(data);
      }
    });

    conn.on('close', () => {
      activeConn = null;
      if (onDisconnected) onDisconnected();
    });

    conn.on('error', (err) => {
      console.warn('Peer connection error:', err);
    });
  });

  peer.on('error', (err) => {
    console.error('PeerJS Host Error:', err);
    if (onError) onError(err);
  });

  return {
    destroy: () => {
      if (activeConn) {
        try { activeConn.close(); } catch (e) {}
      }
      try { peer.destroy(); } catch (e) {}
    },
    isConnected: () => !!activeConn && activeConn.open,
  };
}

/**
 * Initializes the Client controller session on the mobile device.
 */
export function createClientSession(roomId, callbacks = {}) {
  const { onConnected, onDisconnected, onError } = callbacks;

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
