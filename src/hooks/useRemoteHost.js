import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateRoomId, createHostSession } from '../utils/inputRemote';

const EMPTY_PLAYERS = { player1: false, player2: false, count: 0 };

/**
 * App-lifetime WebRTC host for phone controllers.
 *
 * Lives above the emulator so paired phones stay connected while users
 * load, switch, or quit games. The active emulator registers an input
 * handler and pushes its console type; phones adapt without reconnecting.
 */
export function useRemoteHost(enabled = true) {
  const [roomId] = useState(() => generateRoomId());
  const [connectedPlayers, setConnectedPlayers] = useState(EMPTY_PLAYERS);
  const sessionRef = useRef(null);
  const inputHandlerRef = useRef(null);
  const gameStateRef = useRef({ consoleType: 'snes', inGame: false });

  useEffect(() => {
    if (!enabled) return undefined;

    const session = createHostSession(
      roomId,
      {
        onPlayersChange: (status) => setConnectedPlayers(status),
        onInput: (data) => {
          const handler = inputHandlerRef.current;
          if (handler) handler(data);
        },
      },
      gameStateRef.current
    );
    sessionRef.current = session;

    // Release the room ID promptly when the tab closes or reloads
    const handlePageHide = () => session.destroy();
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      session.destroy();
      if (sessionRef.current === session) sessionRef.current = null;
      setConnectedPlayers(EMPTY_PLAYERS);
    };
  }, [enabled, roomId]);

  const setInputHandler = useCallback((handler) => {
    inputHandlerRef.current = handler || null;
  }, []);

  const setGameState = useCallback((state) => {
    gameStateRef.current = { ...gameStateRef.current, ...state };
    if (sessionRef.current) sessionRef.current.setGameState(gameStateRef.current);
  }, []);

  return useMemo(
    () => ({ roomId, connectedPlayers, setInputHandler, setGameState }),
    [roomId, connectedPlayers, setInputHandler, setGameState]
  );
}
