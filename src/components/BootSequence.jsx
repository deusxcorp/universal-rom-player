import React, { useEffect, useState } from 'react';
import { getBootTheme } from '../utils/consoleBootThemes';

/**
 * BootSequence
 * Cinematic full-screen boot overlay tailored to each console.
 * Phases: STARTUP (0-400ms) → LOGO (400-1600ms) → DISSOLVE (1600ms → done)
 */
export default function BootSequence({ core, onComplete }) {
  const theme = getBootTheme(core);
  const [phase, setPhase] = useState('startup'); // startup | logo | dissolve | done
  const [ledOn, setLedOn] = useState(false);

  useEffect(() => {
    // Power LED flicker on
    const ledTimer = setTimeout(() => setLedOn(true), 200);

    // Advance to logo phase
    const logoTimer = setTimeout(() => setPhase('logo'), 400);

    // Dissolve out
    const dissolveTimer = setTimeout(() => setPhase('dissolve'), theme.bootDuration - 600);

    // Complete — unmount overlay
    const doneTimer = setTimeout(() => {
      setPhase('done');
      onComplete?.();
    }, theme.bootDuration);

    return () => {
      clearTimeout(ledTimer);
      clearTimeout(logoTimer);
      clearTimeout(dissolveTimer);
      clearTimeout(doneTimer);
    };
  }, [theme.bootDuration, onComplete]);

  if (phase === 'done') return null;

  const isLogo = phase === 'logo' || phase === 'dissolve';

  return (
    <div
      className={`boot-overlay ${phase}`}
      style={{
        '--boot-accent': theme.accentColor,
        '--boot-glow': theme.glowColor,
        '--boot-bg': theme.bgColor,
        '--boot-led': theme.powerLedColor,
        '--scanline-opacity': theme.scanlineIntensity,
      }}
      aria-label="Console booting"
      aria-live="polite"
    >
      {/* Scanline texture */}
      <div className="boot-scanlines" />

      {/* CRT vignette */}
      <div className="boot-vignette" />

      {/* Power LED */}
      <div className={`boot-power-led ${ledOn ? 'on' : ''}`} aria-hidden="true" />

      {/* Console logo */}
      <div className={`boot-logo-wrap ${isLogo ? 'visible' : ''} style-${theme.logoStyle}`}>
        {theme.logoStyle === 'ps' ? (
          <PSLogo accentColor={theme.accentColor} />
        ) : (
          <div className="boot-logo-text">{theme.logoChar}</div>
        )}
        <div className="boot-console-name">{theme.consoleName}</div>
        {theme.subName && (
          <div className="boot-console-sub">{theme.subName}</div>
        )}
        <div className="boot-progress-bar">
          <div
            className="boot-progress-fill"
            style={{ animationDuration: `${theme.bootDuration - 800}ms` }}
          />
        </div>
      </div>
    </div>
  );
}

/** PlayStation-style geometric logo mark */
function PSLogo({ accentColor }) {
  return (
    <div className="ps-logo" aria-hidden="true">
      <div className="ps-logo-shape ps-p" style={{ color: accentColor }}>P</div>
      <div className="ps-logo-shape ps-s">S</div>
    </div>
  );
}
