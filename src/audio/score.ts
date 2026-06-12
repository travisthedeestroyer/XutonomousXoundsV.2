// Objective mix scoring & deterministic DSP corrections.
// Turns analyzeAudio() output into a single 0–100 score plus actionable gaps,
// so the AI loop can stop early, fix obvious problems in pure DSP, and reserve
// expensive LLM passes for genuine nuance.

import type { FullAudioAnalysis } from './analysis';
import type { MixSettings } from './settings';

export interface MixTargets {
  lufs: number;
  crestMin: number;
  crestMax: number;
  widthMin: number;
  widthMax: number;
}

export interface MixScore {
  score: number;                       // 0–100 overall
  breakdown: Record<string, number>;   // per-metric 0–100
  gaps: {
    lufsGap: number;   // target − current (positive ⇒ needs to be louder)
    crestGap: number;  // signed distance to nearest crest bound (0 ⇒ in range)
    sibilance: number; // 0–1 severity
    widthGap: number;  // signed distance to nearest width bound (0 ⇒ in range)
  };
}

// Genre target windows: LUFS targets plus typical commercial crest/width ranges.
const GENRE_TARGETS: Record<string, MixTargets> = {
  'hip-hop':    { lufs: -8,  crestMin: 6, crestMax: 10, widthMin: 0.10, widthMax: 0.50 },
  'pop':        { lufs: -9,  crestMin: 6, crestMax: 11, widthMin: 0.15, widthMax: 0.55 },
  'electronic': { lufs: -7,  crestMin: 5, crestMax: 10, widthMin: 0.20, widthMax: 0.70 },
  'acoustic':   { lufs: -12, crestMin: 8, crestMax: 14, widthMin: 0.05, widthMax: 0.40 },
  'custom':     { lufs: -9,  crestMin: 6, crestMax: 11, widthMin: 0.10, widthMax: 0.55 },
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function targetsForGenre(genre: string): MixTargets {
  return GENRE_TARGETS[genre] ?? GENRE_TARGETS['custom'];
}

/**
 * Score a rendered mix against genre-appropriate targets.
 */
export function scoreMix(analysis: FullAudioAnalysis, genre: string): MixScore {
  const t = targetsForGenre(genre);

  // LUFS proximity
  const lufs = analysis.loudness.estimatedLUFS;
  const lufsGap = t.lufs - lufs;
  const lufsScore = clamp(100 - Math.abs(lufsGap) * 12, 0, 100);

  // Crest factor in genre window
  const crest = analysis.loudness.crestFactor;
  let crestGap = 0;
  if (crest < t.crestMin) crestGap = t.crestMin - crest;       // +ve ⇒ too compressed
  else if (crest > t.crestMax) crestGap = t.crestMax - crest;  // −ve ⇒ too dynamic
  const crestScore = clamp(100 - Math.abs(crestGap) * 10, 0, 100);

  // Sibilance control
  const sib = analysis.sibilance.severity;
  const sibScore = clamp(100 - sib * 120, 0, 100);

  // Stereo width in genre window
  const width = analysis.stereo.width;
  let widthGap = 0;
  if (width < t.widthMin) widthGap = t.widthMin - width;       // +ve ⇒ too narrow
  else if (width > t.widthMax) widthGap = t.widthMax - width;  // −ve ⇒ too wide
  const widthScore = clamp(100 - Math.abs(widthGap) * 120, 0, 100);

  const score =
    lufsScore * 0.40 +
    crestScore * 0.25 +
    sibScore * 0.20 +
    widthScore * 0.15;

  return {
    score: Math.round(score),
    breakdown: {
      loudness: Math.round(lufsScore),
      dynamics: Math.round(crestScore),
      sibilance: Math.round(sibScore),
      width: Math.round(widthScore),
    },
    gaps: { lufsGap, crestGap, sibilance: sib, widthGap },
  };
}

/**
 * Deterministically nudge settings toward the targets based on the score gaps.
 * The "free" (no-LLM) correction step — handles the obvious problems.
 */
export function applyDspCorrections(settings: MixSettings, mixScore: MixScore): MixSettings {
  const s: MixSettings = JSON.parse(JSON.stringify(settings));
  const g = mixScore.gaps;

  // Dynamics: ease/strengthen vocal compression toward the crest window
  if (g.crestGap > 1) {
    // Too compressed → loosen
    s.vocalCompressor.ratio = Math.max(1.5, s.vocalCompressor.ratio - 0.5);
    s.vocalCompressor.threshold = Math.min(-8, s.vocalCompressor.threshold + 2);
  } else if (g.crestGap < -1) {
    // Too dynamic → tighten
    s.vocalCompressor.ratio = Math.min(8, s.vocalCompressor.ratio + 0.5);
    s.vocalCompressor.threshold = Math.max(-40, s.vocalCompressor.threshold - 2);
  }

  // Sibilance still present → strengthen the de-esser
  if (g.sibilance > 0.3) {
    s.deEsser.enabled = true;
    s.deEsser.threshold = Math.max(-40, s.deEsser.threshold - 3);
    s.deEsser.ratio = Math.min(10, s.deEsser.ratio + 1);
  }

  // Stereo width toward genre window
  if (g.widthGap > 0.02) s.stereoImaging.width = Math.min(2.0, s.stereoImaging.width + 0.1);
  else if (g.widthGap < -0.02) s.stereoImaging.width = Math.max(0.5, s.stereoImaging.width - 0.1);

  // Loudness: push harder / back off the limiter via master gain
  if (g.lufsGap > 1.5) s.masterGain = Math.min(2.0, s.masterGain + 0.15);
  else if (g.lufsGap < -1.5) s.masterGain = Math.max(0.5, s.masterGain - 0.15);

  return s;
}

/** One-line human-readable score summary for the agent log. */
export function formatScoreLine(mixScore: MixScore): string {
  const b = mixScore.breakdown;
  return `Mix score ${mixScore.score}/100  ·  loudness ${b.loudness} · dynamics ${b.dynamics} · sibilance ${b.sibilance} · width ${b.width}`;
}
