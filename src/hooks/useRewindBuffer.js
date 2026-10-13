/**
 * useRewindBuffer.js
 * Rolling 10-second rewind buffer using periodic saveState() snapshots.
 * Captures one snapshot every ~500ms into a circular array of 20 slots.
 */
import { useRef, useCallback, useEffect, useState } from 'react';

const BUFFER_SIZE = 20;       // 20 slots
const SNAPSHOT_INTERVAL = 500; // ms between snapshots

export function useRewindBuffer(nostalgistRef, isRunning) {
  const bufferRef = useRef([]); // circular array of { state, timestamp }
  const headRef = useRef(0);    // write head
  const countRef = useRef(0);   // how many valid slots
  const intervalRef = useRef(null);
  const isCapturingRef = useRef(false);

  const [isRewinding, setIsRewinding] = useState(false);
  const [rewindProgress, setRewindProgress] = useState(0); // 0–1
  const rewindIndexRef = useRef(0); // index into buffer during rewind playback

  // Start capturing snapshots
  const startCapture = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(async () => {
      if (!nostalgistRef.current || isCapturingRef.current) return;
      isCapturingRef.current = true;
      try {
        const snap = await nostalgistRef.current.saveState();
        if (snap?.state) {
          bufferRef.current[headRef.current] = {
            state: snap.state,
            timestamp: Date.now(),
          };
          headRef.current = (headRef.current + 1) % BUFFER_SIZE;
          if (countRef.current < BUFFER_SIZE) countRef.current++;
        }
      } catch {
        // Ignore capture errors (game may be loading)
      } finally {
        isCapturingRef.current = false;
      }
    }, SNAPSHOT_INTERVAL);
  }, [nostalgistRef]);

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isRunning && !isRewinding) {
      startCapture();
    } else {
      stopCapture();
    }
    return stopCapture;
  }, [isRunning, isRewinding, startCapture, stopCapture]);

  /** Enter rewind mode — pauses capture and begins stepping backward */
  const beginRewind = useCallback(async () => {
    if (!nostalgistRef.current || countRef.current === 0) return;
    stopCapture();
    try { await nostalgistRef.current.pause(); } catch {}
    // Start from the newest snapshot
    rewindIndexRef.current = countRef.current - 1;
    setIsRewinding(true);
    setRewindProgress(1);
  }, [nostalgistRef, stopCapture]);

  /** Step backward one frame during rewind */
  const stepBackward = useCallback(async () => {
    if (!nostalgistRef.current || rewindIndexRef.current < 0) return;
    const idx = (headRef.current - 1 - rewindIndexRef.current + BUFFER_SIZE * 2) % BUFFER_SIZE;
    const slot = bufferRef.current[idx];
    if (!slot) return;
    try {
      await nostalgistRef.current.loadState(slot.state);
    } catch {}
    rewindIndexRef.current = Math.max(0, rewindIndexRef.current - 1);
    setRewindProgress(rewindIndexRef.current / Math.max(1, countRef.current - 1));
  }, [nostalgistRef]);

  /** Jump to a specific progress point (0=oldest 1=newest) */
  const seekTo = useCallback(async (progress) => {
    if (!nostalgistRef.current || countRef.current === 0) return;
    const targetIdx = Math.round(progress * (countRef.current - 1));
    rewindIndexRef.current = targetIdx;
    const idx = (headRef.current - 1 - targetIdx + BUFFER_SIZE * 2) % BUFFER_SIZE;
    const slot = bufferRef.current[idx];
    if (!slot) return;
    try {
      await nostalgistRef.current.loadState(slot.state);
    } catch {}
    setRewindProgress(progress);
  }, [nostalgistRef]);

  /** Resume normal play from current rewind position */
  const resumeFromRewind = useCallback(async () => {
    setIsRewinding(false);
    // Truncate buffer at current rewind point (discard future frames)
    headRef.current = (headRef.current - rewindIndexRef.current + BUFFER_SIZE * 2) % BUFFER_SIZE;
    countRef.current = Math.max(0, countRef.current - rewindIndexRef.current);
    try { await nostalgistRef.current.resume(); } catch {}
    startCapture();
  }, [nostalgistRef, startCapture]);

  /** Clear buffer (e.g. on game change) */
  const clearBuffer = useCallback(() => {
    bufferRef.current = [];
    headRef.current = 0;
    countRef.current = 0;
    setIsRewinding(false);
    setRewindProgress(0);
  }, []);

  const hasBuffer = countRef.current > 0;

  return {
    isRewinding,
    rewindProgress,
    hasBuffer,
    beginRewind,
    stepBackward,
    seekTo,
    resumeFromRewind,
    clearBuffer,
    bufferCount: countRef.current,
  };
}
