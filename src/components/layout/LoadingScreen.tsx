'use client';

// ============================================================
// LOADING SCREEN
// Full-page animated splash shown on first data load
// Uses the same brand identity as the navbar logo
// ============================================================

import { Activity } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, #0d1018 0%, #0a0a0f 70%)',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* ── Orbital logo assembly ───────────────────── */}
      <div className="relative flex items-center justify-center mb-8" style={{ width: 112, height: 112 }}>

        {/* Outermost ring — very slow CCW spin */}
        <div
          className="absolute inset-0 rounded-full border border-emerald-500/10"
          style={{ animation: 'spin 12s linear infinite reverse' }}
        />

        {/* Outer dashed ring — slow CW spin */}
        <div
          className="absolute rounded-full border border-dashed border-emerald-500/15"
          style={{
            inset: 10,
            animation: 'spin 8s linear infinite',
          }}
        />

        {/* Middle solid ring — medium CCW */}
        <div
          className="absolute rounded-full border border-emerald-500/25"
          style={{
            inset: 20,
            animation: 'spin 5s linear infinite reverse',
          }}
        />

        {/* Inner pulse ring */}
        <div
          className="absolute rounded-full border border-emerald-400/30 animate-pulse"
          style={{ inset: 30 }}
        />

        {/* Glow blob */}
        <div
          className="absolute rounded-full"
          style={{
            inset: 36,
            background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)',
            filter: 'blur(4px)',
          }}
        />

        {/* Logo box */}
        <div
          className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.22) 0%, rgba(20,184,166,0.08) 100%)',
            border: '1px solid rgba(16,185,129,0.45)',
            boxShadow: '0 0 32px rgba(16,185,129,0.18), 0 0 64px rgba(16,185,129,0.07), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <Activity size={22} className="text-emerald-400" />
        </div>

        {/* Orbiting dot 1 */}
        <div
          className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400/70"
          style={{ animation: 'orbit1 4s linear infinite', top: 18, left: '50%', transformOrigin: '-10px 0' }}
        />

        {/* Orbiting dot 2 */}
        <div
          className="absolute w-1 h-1 rounded-full bg-teal-400/50"
          style={{ animation: 'orbit2 6s linear infinite reverse', top: 10, left: '50%', transformOrigin: '-20px 0' }}
        />
      </div>

      {/* ── Brand text ──────────────────────────────── */}
      <p className="text-[15px] font-bold tracking-tight"
        style={{ background: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
        FX Analyzer
      </p>
      <p className="text-[9px] text-emerald-500/50 tracking-[0.25em] uppercase mt-0.5 font-medium">
        Fundamental
      </p>

      {/* ── Scanning line ────────────────────────────── */}
      <div className="relative mt-8 w-36 h-px bg-slate-800 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 w-20 rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.7), transparent)',
            animation: 'scan 1.8s ease-in-out infinite',
          }}
        />
      </div>

      <p className="text-[10px] text-slate-600 mt-3 tracking-wide">Analyzing markets…</p>
    </div>
  );
}

// ── Keyframe injection (CSS-in-JS via style tag) ───────────────
// We inject these once; they complement Tailwind's built-in @keyframes spin
export function LoadingScreenKeyframes() {
  return (
    <style>{`
      @keyframes orbit1 {
        from { transform: rotate(0deg) translateX(28px) rotate(0deg); }
        to   { transform: rotate(360deg) translateX(28px) rotate(-360deg); }
      }
      @keyframes orbit2 {
        from { transform: rotate(0deg) translateX(40px) rotate(0deg); }
        to   { transform: rotate(360deg) translateX(40px) rotate(-360deg); }
      }
      @keyframes scan {
        0%   { left: -56px; }
        100% { left: 144px; }
      }
    `}</style>
  );
}
