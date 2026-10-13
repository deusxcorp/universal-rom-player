import React, { useRef, useCallback } from 'react';
import { RotateCcw, Play, FastForward } from 'lucide-react';

/**
 * RewindScrubber
 * VHS-style cinematic rewind overlay with a time scrubber bar.
 * Shown when isRewinding=true. Keyboard: hold Backspace to rewind, Enter to resume.
 */
export default function RewindScrubber({
  isRewinding,
  rewindProgress,
  bufferCount,
  onStepBackward,
  onSeekTo,
  onResume,
  onBeginRewind,
  hasBuffer,
  isPaused,
}) {
  const scrubberRef = useRef(null);

  const handleScrubberClick = useCallback((e) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeekTo?.(pct);
  }, [onSeekTo]);

  const handleScrubberDrag = useCallback((e) => {
    if (e.buttons !== 1) return;
    handleScrubberClick(e);
  }, [handleScrubberClick]);

  const secondsAvail = Math.round((bufferCount * 500) / 1000);

  if (!isRewinding) {
    // Compact rewind trigger button (rendered inline in the control bar)
    return (
      <button
        id="rewind-btn"
        className={`control-btn rewind-trigger ${!hasBuffer ? 'dim' : ''}`}
        onClick={onBeginRewind}
        disabled={!hasBuffer}
        title={hasBuffer ? `Rewind up to ${secondsAvail}s` : 'No rewind buffer yet'}
        aria-label="Rewind game"
      >
        <RotateCcw size={15} />
        <span>Rewind</span>
      </button>
    );
  }

  // Full rewind overlay
  return (
    <div className="rewind-overlay" role="dialog" aria-label="Rewind mode">
      {/* VHS noise grain */}
      <div className="rewind-vhs-noise" aria-hidden="true" />
      <div className="rewind-scanlines" aria-hidden="true" />

      {/* Rewind badge */}
      <div className="rewind-badge" aria-hidden="true">
        <RotateCcw size={20} className="rewind-badge-icon" />
        <span>REWIND</span>
      </div>

      {/* Time scrubber */}
      <div className="rewind-controls">
        <div className="rewind-time-label">
          {Math.round((1 - rewindProgress) * secondsAvail)}s ago &nbsp;/&nbsp; {secondsAvail}s buffer
        </div>

        <div
          className="rewind-scrubber"
          ref={scrubberRef}
          onClick={handleScrubberClick}
          onMouseMove={handleScrubberDrag}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(rewindProgress * 100)}
          aria-label="Rewind timeline"
          tabIndex={0}
        >
          <div className="rewind-track">
            <div
              className="rewind-fill"
              style={{ width: `${rewindProgress * 100}%` }}
            />
            <div
              className="rewind-thumb"
              style={{ left: `${rewindProgress * 100}%` }}
            />
          </div>
        </div>

        <div className="rewind-action-row">
          <button
            className="rewind-btn-step"
            onClick={onStepBackward}
            title="Step back one frame"
            aria-label="Step backward"
          >
            <RotateCcw size={18} />
            Step Back
          </button>

          <button
            className="rewind-btn-resume"
            onClick={onResume}
            title="Resume game from here"
            aria-label="Resume game"
          >
            <Play size={18} />
            Resume Here
          </button>

          <button
            className="rewind-btn-skip"
            onClick={() => onSeekTo?.(1)}
            title="Jump to latest"
            aria-label="Jump to latest"
          >
            <FastForward size={18} />
            Latest
          </button>
        </div>

        <div className="rewind-hint">
          Click the timeline to jump &bull; Hold Backspace to continuously rewind
        </div>
      </div>
    </div>
  );
}
