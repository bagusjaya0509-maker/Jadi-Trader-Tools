import React, { useCallback, useMemo, useState } from 'react';
import './bell-notify.css';

/* ════════════════════════════════════════════════════════════════════════
   LONCENG PEMBERITAHUAN
   ════════════════════════════════════════════════════════════════════════
   Markup dan propsnya persis seperti yang dikirim. Dua hal yang diubah,
   keduanya karena proyek ini bukan Next.js:

   1. Tidak ada 'use client'. Vite tidak mengenal direktif itu; semuanya
      memang sudah berjalan di sisi klien.

   2. <style jsx global> diganti impor ./bell-notify.css. Atribut `jsx`
      milik styled-jsx dan tidak dikenal React di sini. Yang lebih penting,
      CSS-nya global dengan nama-nama yang sangat umum -- .button, .glow,
      .grain -- jadi kalau dilepas apa adanya, aturan seperti
      `.button { font-size: 6em }` akan menabrak tombol di seluruh
      aplikasi. Di berkas CSS-nya tiap selektor sudah dikurung di bawah
      .bell-root. Tampilannya tidak berubah sedikit pun.
   ════════════════════════════════════════════════════════════════════════ */

type BellNotifyProps = {
  /** Controlled on/off (true = glowing/ringing). If omitted, component is uncontrolled. */
  isOn?: boolean;
  /** Called when user toggles the bell (click/tap). */
  onToggle?: (next: boolean) => void;
  /** Base size in px; all pieces scale from this. Default 520. */
  size?: number;
  /** Metal base color. */
  baseColor?: string;
  /** Sway amplitude used in CSS animation (affects bell + button glow). */
  rotationAmplitude?: number;
  /** Show/Hide CTA button under the bell. */
  showButton?: boolean;
  /** CTA button text. */
  buttonLabel?: string;
  /** Click handler for CTA button. */
  onButtonClick?: () => void;
  /** Disable clicking the bell to toggle. */
  disableToggle?: boolean;
  /** Extra class on wrapper. */
  className?: string;
};

function BellNotify({
  isOn,
  onToggle,
  size = 520,
  baseColor = '#b7b5b4',
  rotationAmplitude = 0.8,
  showButton = true,
  buttonLabel = 'Notify Me',
  onButtonClick,
  disableToggle = false,
  className = '',
}: BellNotifyProps) {
  // Uncontrolled fallback
  const [internalOn, setInternalOn] = useState(true);
  const onState = isOn ?? internalOn;

  const rootStyle = useMemo<React.CSSProperties>(() => {
    return {
      // font-size drives the scene (1em = size/100)
      fontSize: `calc(${size}px * 0.01)`,
      // expose size for potential downstream tweaks (kept from original var name)
      ['--_size' as string]: `${size}px`,
      ['--base-clr' as string]: baseColor,
      ['--degofrot' as string]: rotationAmplitude,
    } as React.CSSProperties;
  }, [size, baseColor, rotationAmplitude]);

  const bellClass = useMemo(
    () => `bell-container ${onState ? '' : 'off'}`,
    [onState]
  );

  const handleToggle = useCallback(() => {
    if (disableToggle) return;
    const next = !onState;
    if (isOn === undefined) setInternalOn(next);
    onToggle?.(next);
  }, [disableToggle, onState, isOn, onToggle]);

  return (
    <div className={`bell-root ${className}`} style={rootStyle}>
      {/* Bell (acts like a button for accessibility) */}
      <div
        className={bellClass}
        role="button"
        aria-pressed={onState}
        aria-label={onState ? 'Matikan lonceng' : 'Nyalakan lonceng'}
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className="rope" />
        <div className="bell-top" />

        <div className="bell-base" />
        <div className="bell-base" />
        <div className="shadow-l1" />
        <div className="shadow-l2" />
        <div className="left-glow" />
        <div className="left-glow2" />
        <div className="r-glow" />
        <div className="r-glow2" />
        <div className="mid-ring" />
        <div className="mid-ring small" />

        <div className="glow" />
        <div className="glow2" />

        <div className="bell-buff-t" />
        <div className="bell-buff" />

        <div className="bell-btm" />
        <div className="bell-btm2" />

        <div className="bell-ring-container">
          <div className="bell-ring" />
          <div className="bell-rays" />
        </div>

        <div className="volumetric">
          <div className="vl" />
          <div className="vr" />
        </div>
      </div>

      {showButton && (
        <button
          type="button"
          className={`button ${onState ? '' : 'hidden-button'}`}
          onClick={onButtonClick}
        >
          {buttonLabel}
        </button>
      )}

      <div className="grain" />
    </div>
  );
}

export { BellNotify };
