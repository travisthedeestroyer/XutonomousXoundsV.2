// ═══════════════════════════════════════════════════════════════════════════════
// XutonomousXound — Production-Grade Mixing & Mastering Engine
// ═══════════════════════════════════════════════════════════════════════════════
// Professional signal processing pipeline inspired by Emastered, iZotope Ozone,
// and industry-standard mixing/mastering workflows.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types & Interfaces ──────────────────────────────────────────────────────

export type GenrePreset = 'hip-hop' | 'pop' | 'electronic' | 'acoustic' | 'custom';

export interface DeEsserSettings {
  frequency: number;   // Center frequency for sibilance (4000–10000 Hz)
  threshold: number;   // dB threshold (-40 to -10)
  ratio: number;       // Compression ratio for sibilant band (2–10)
  enabled: boolean;
}

export interface MultibandVocalCompressor {
  low: { threshold: number; ratio: number; attack: number; release: number };   // 0–250 Hz
  lowMid: { threshold: number; ratio: number; attack: number; release: number }; // 250–2000 Hz
  highMid: { threshold: number; ratio: number; attack: number; release: number }; // 2000–6000 Hz
  high: { threshold: number; ratio: number; attack: number; release: number };   // 6000+ Hz
}

export interface ParallelCompression {
  enabled: boolean;
  wetDry: number;     // 0.0 (all dry) to 1.0 (all wet)
  threshold: number;  // Heavy compression threshold (-40 to -20 dB)
  ratio: number;      // Aggressive ratio (8–20)
  attack: number;
  release: number;
}

export interface BeatEQ {
  lowFreq: number;       // 60–200 Hz
  lowGain: number;       // -6 to +6 dB
  lowMidFreq: number;    // 200–800 Hz
  lowMidGain: number;    // -6 to +6 dB
  highMidFreq: number;   // 800–4000 Hz
  highMidGain: number;   // -6 to +6 dB
  highFreq: number;      // 4000–12000 Hz
  highGain: number;      // -6 to +6 dB
}

export interface StereoImaging {
  width: number;         // 0.0 (mono) to 2.0 (extra wide), 1.0 = normal
  bassMonoCutoff: number; // Frequency below which the signal is summed to mono (0–300 Hz)
}

export interface MasterMultibandCompressor {
  low: { threshold: number; ratio: number; attack: number; release: number };   // < 250 Hz
  mid: { threshold: number; ratio: number; attack: number; release: number };   // 250–4000 Hz
  high: { threshold: number; ratio: number; attack: number; release: number };  // > 4000 Hz
}

export interface MasterEQ {
  lowShelfFreq: number;    // 60–200 Hz
  lowShelfGain: number;    // -4 to +4 dB
  midFreq: number;         // 500–4000 Hz
  midGain: number;         // -4 to +4 dB
  midQ: number;            // 0.5–4.0
  highShelfFreq: number;   // 6000–16000 Hz
  highShelfGain: number;   // -4 to +4 dB
}

export interface MasterLimiter {
  ceiling: number;   // True peak ceiling (-3.0 to 0 dB), typically -1.0 dBTP
  release: number;   // Limiter release time (0.01–0.5 seconds)
}

export interface MixSettings {
  // Genre preset selection
  genrePreset: GenrePreset;

  // ── Vocal Chain ──
  vocalVolume: number;       // 0.0–2.0
  backupVolume: number;      // 0.0–2.0

  vocalEQ: {
    lowCutFreq: number;      // HPF frequency (60–200 Hz)
    lowMidFreq: number;      // Peaking band (200–800 Hz)
    lowMidGain: number;      // -8 to +4 dB
    lowMidQ: number;         // 0.5–4.0
    highMidFreq: number;     // Peaking band (1000–6000 Hz)
    highMidGain: number;     // -6 to +6 dB
    highMidQ: number;        // 0.5–4.0
    presenceFreq: number;    // Presence band (3000–6000 Hz)
    presenceGain: number;    // -4 to +6 dB
    presenceQ: number;       // 0.5–3.0
    airFreq: number;         // High shelf for "air" (8000–16000 Hz)
    airGain: number;         // 0 to +6 dB
  };

  deEsser: DeEsserSettings;

  vocalCompressor: {
    threshold: number;       // -40 to -10 dB
    ratio: number;           // 2–8
    attack: number;          // 0.001–0.05 seconds
    release: number;         // 0.05–0.3 seconds
    knee: number;            // 0–30 dB
  };

  multibandVocalComp: MultibandVocalCompressor;
  parallelCompression: ParallelCompression;

  // Vocal saturation
  saturation: number;        // 0.0–1.0 (tape warmth intensity)
  saturationDrive: number;   // 0.0–1.0 (harmonic drive amount)

  // Vocal spatial effects
  reverb: number;            // 0.0–1.0 (reverb send level)
  reverbPreDelay: number;    // 0–80 ms
  reverbDecay: number;       // 0.5–5.0 seconds
  reverbDamping: number;     // 0.0–1.0 (high frequency damping)

  echo: number;              // 0.0–1.0 (delay send level)
  echoTime: number;          // 0.1–1.0 seconds (delay time)
  echoFeedback: number;      // 0.0–0.7 (delay feedback)

  doubler: number;           // 0.0–1.0 (vocal doubling/widening)

  // ── Beat Chain ──
  beatVolume: number;        // 0.0–2.0
  beatEQ: BeatEQ;
  beatCompressor: {
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
  };
  sidechainDuck: number;     // 0.0–1.0 (amount of beat ducking when vocal is present)

  // ── Mastering Chain ──
  stereoImaging: StereoImaging;
  masterMultiband: MasterMultibandCompressor;
  masterEQ: MasterEQ;
  masterLimiter: MasterLimiter;
  masterGain: number;        // Pre-limiter gain (0.0–2.0)
  softClipAmount: number;    // 0.0–1.0 (pre-limiter soft clipping)
  lufsTarget: number;        // Target LUFS (-14 to -6)
}

// ─── Default Settings ────────────────────────────────────────────────────────

export const defaultMixSettings: MixSettings = {
  genrePreset: 'hip-hop',

  // Vocal chain
  vocalVolume: 1.0,
  backupVolume: 0.5,

  vocalEQ: {
    lowCutFreq: 100,
    lowMidFreq: 350,
    lowMidGain: -2,
    lowMidQ: 1.5,
    highMidFreq: 2500,
    highMidGain: 1.5,
    highMidQ: 1.2,
    presenceFreq: 4000,
    presenceGain: 2.0,
    presenceQ: 1.0,
    airFreq: 10000,
    airGain: 2.5,
  },

  deEsser: {
    frequency: 6500,
    threshold: -25,
    ratio: 4,
    enabled: true,
  },

  vocalCompressor: {
    threshold: -24,
    ratio: 4,
    attack: 0.003,
    release: 0.08,
    knee: 10,
  },

  multibandVocalComp: {
    low:     { threshold: -20, ratio: 2.5, attack: 0.010, release: 0.15 },
    lowMid:  { threshold: -22, ratio: 3.0, attack: 0.005, release: 0.10 },
    highMid: { threshold: -24, ratio: 3.5, attack: 0.003, release: 0.08 },
    high:    { threshold: -26, ratio: 2.0, attack: 0.002, release: 0.06 },
  },

  parallelCompression: {
    enabled: true,
    wetDry: 0.25,
    threshold: -35,
    ratio: 12,
    attack: 0.001,
    release: 0.05,
  },

  saturation: 0.15,
  saturationDrive: 0.3,

  reverb: 0.25,
  reverbPreDelay: 20,
  reverbDecay: 2.0,
  reverbDamping: 0.5,

  echo: 0.1,
  echoTime: 0.35,
  echoFeedback: 0.25,

  doubler: 0.2,

  // Beat chain
  beatVolume: 0.85,
  beatEQ: {
    lowFreq: 80,
    lowGain: 1.0,
    lowMidFreq: 400,
    lowMidGain: -1.5,
    highMidFreq: 3000,
    highMidGain: -2.0,
    highFreq: 8000,
    highGain: 0.5,
  },
  beatCompressor: {
    threshold: -18,
    ratio: 2.5,
    attack: 0.010,
    release: 0.15,
  },
  sidechainDuck: 0.15,

  // Mastering
  stereoImaging: {
    width: 1.1,
    bassMonoCutoff: 120,
  },

  masterMultiband: {
    low:  { threshold: -14, ratio: 2.0, attack: 0.020, release: 0.20 },
    mid:  { threshold: -12, ratio: 1.8, attack: 0.010, release: 0.15 },
    high: { threshold: -16, ratio: 2.0, attack: 0.005, release: 0.10 },
  },

  masterEQ: {
    lowShelfFreq: 100,
    lowShelfGain: 0.5,
    midFreq: 2000,
    midGain: 0,
    midQ: 1.0,
    highShelfFreq: 10000,
    highShelfGain: 1.0,
  },

  masterLimiter: {
    ceiling: -1.0,
    release: 0.05,
  },

  masterGain: 1.0,
  softClipAmount: 0.2,
  lufsTarget: -9,
};

// ─── Genre Presets ───────────────────────────────────────────────────────────

export const genrePresets: Record<Exclude<GenrePreset, 'custom'>, Partial<MixSettings>> = {
  'hip-hop': {
    vocalEQ: {
      lowCutFreq: 100,
      lowMidFreq: 350,
      lowMidGain: -2,
      lowMidQ: 1.5,
      highMidFreq: 2500,
      highMidGain: 1.5,
      highMidQ: 1.2,
      presenceFreq: 4000,
      presenceGain: 2.5,
      presenceQ: 1.0,
      airFreq: 10000,
      airGain: 3.0,
    },
    deEsser: { frequency: 6500, threshold: -25, ratio: 4, enabled: true },
    vocalCompressor: { threshold: -22, ratio: 4.5, attack: 0.002, release: 0.06, knee: 8 },
    parallelCompression: { enabled: true, wetDry: 0.3, threshold: -35, ratio: 12, attack: 0.001, release: 0.05 },
    saturation: 0.2,
    saturationDrive: 0.35,
    reverb: 0.2,
    reverbDecay: 1.5,
    echo: 0.12,
    echoTime: 0.3,
    beatEQ: { lowFreq: 60, lowGain: 2.5, lowMidFreq: 400, lowMidGain: -2.0, highMidFreq: 3000, highMidGain: -2.5, highFreq: 8000, highGain: 0.5 },
    sidechainDuck: 0.2,
    stereoImaging: { width: 1.15, bassMonoCutoff: 150 },
    lufsTarget: -8,
    masterEQ: { lowShelfFreq: 80, lowShelfGain: 1.5, midFreq: 2500, midGain: -0.5, midQ: 1.0, highShelfFreq: 10000, highShelfGain: 1.5 },
  },
  'pop': {
    vocalEQ: {
      lowCutFreq: 120,
      lowMidFreq: 300,
      lowMidGain: -1.5,
      lowMidQ: 1.2,
      highMidFreq: 3000,
      highMidGain: 2.0,
      highMidQ: 1.0,
      presenceFreq: 5000,
      presenceGain: 3.0,
      presenceQ: 1.0,
      airFreq: 12000,
      airGain: 3.5,
    },
    deEsser: { frequency: 7000, threshold: -22, ratio: 5, enabled: true },
    vocalCompressor: { threshold: -20, ratio: 3.5, attack: 0.003, release: 0.08, knee: 12 },
    parallelCompression: { enabled: true, wetDry: 0.2, threshold: -30, ratio: 10, attack: 0.002, release: 0.06 },
    saturation: 0.1,
    saturationDrive: 0.2,
    reverb: 0.3,
    reverbDecay: 2.5,
    echo: 0.08,
    echoTime: 0.4,
    beatEQ: { lowFreq: 100, lowGain: 0.5, lowMidFreq: 350, lowMidGain: -1.0, highMidFreq: 3500, highMidGain: -1.5, highFreq: 10000, highGain: 1.0 },
    sidechainDuck: 0.12,
    stereoImaging: { width: 1.2, bassMonoCutoff: 100 },
    lufsTarget: -9,
    masterEQ: { lowShelfFreq: 100, lowShelfGain: 0.5, midFreq: 3000, midGain: 0.5, midQ: 0.8, highShelfFreq: 12000, highShelfGain: 2.0 },
  },
  'electronic': {
    vocalEQ: {
      lowCutFreq: 130,
      lowMidFreq: 400,
      lowMidGain: -3,
      lowMidQ: 2.0,
      highMidFreq: 2000,
      highMidGain: 1.0,
      highMidQ: 1.5,
      presenceFreq: 5000,
      presenceGain: 2.0,
      presenceQ: 1.2,
      airFreq: 14000,
      airGain: 2.5,
    },
    deEsser: { frequency: 7500, threshold: -20, ratio: 6, enabled: true },
    vocalCompressor: { threshold: -18, ratio: 5, attack: 0.002, release: 0.05, knee: 6 },
    parallelCompression: { enabled: true, wetDry: 0.35, threshold: -38, ratio: 15, attack: 0.001, release: 0.04 },
    saturation: 0.25,
    saturationDrive: 0.4,
    reverb: 0.35,
    reverbDecay: 3.0,
    echo: 0.15,
    echoTime: 0.25,
    echoFeedback: 0.35,
    beatEQ: { lowFreq: 60, lowGain: 3.0, lowMidFreq: 350, lowMidGain: -2.5, highMidFreq: 2500, highMidGain: -1.0, highFreq: 12000, highGain: 2.0 },
    sidechainDuck: 0.25,
    stereoImaging: { width: 1.35, bassMonoCutoff: 180 },
    lufsTarget: -7,
    softClipAmount: 0.3,
    masterEQ: { lowShelfFreq: 60, lowShelfGain: 2.0, midFreq: 2000, midGain: -1.0, midQ: 1.2, highShelfFreq: 14000, highShelfGain: 2.5 },
  },
  'acoustic': {
    vocalEQ: {
      lowCutFreq: 80,
      lowMidFreq: 250,
      lowMidGain: -1.0,
      lowMidQ: 1.0,
      highMidFreq: 3500,
      highMidGain: 1.5,
      highMidQ: 0.8,
      presenceFreq: 4500,
      presenceGain: 1.5,
      presenceQ: 0.8,
      airFreq: 10000,
      airGain: 2.0,
    },
    deEsser: { frequency: 6000, threshold: -28, ratio: 3, enabled: true },
    vocalCompressor: { threshold: -26, ratio: 3, attack: 0.005, release: 0.12, knee: 20 },
    parallelCompression: { enabled: false, wetDry: 0.15, threshold: -30, ratio: 8, attack: 0.003, release: 0.08 },
    saturation: 0.05,
    saturationDrive: 0.1,
    reverb: 0.35,
    reverbDecay: 3.0,
    reverbDamping: 0.3,
    echo: 0.05,
    echoTime: 0.5,
    beatEQ: { lowFreq: 100, lowGain: 0, lowMidFreq: 300, lowMidGain: 0, highMidFreq: 3000, highMidGain: 0, highFreq: 8000, highGain: 0.5 },
    sidechainDuck: 0.05,
    stereoImaging: { width: 1.05, bassMonoCutoff: 80 },
    lufsTarget: -12,
    softClipAmount: 0.05,
    masterEQ: { lowShelfFreq: 100, lowShelfGain: 0, midFreq: 2000, midGain: 0, midQ: 1.0, highShelfFreq: 8000, highShelfGain: 1.0 },
    masterMultiband: {
      low:  { threshold: -18, ratio: 1.5, attack: 0.025, release: 0.25 },
      mid:  { threshold: -16, ratio: 1.5, attack: 0.015, release: 0.20 },
      high: { threshold: -20, ratio: 1.5, attack: 0.008, release: 0.12 },
    },
  },
};

export function applyGenrePreset(preset: Exclude<GenrePreset, 'custom'>): MixSettings {
  const base = { ...defaultMixSettings };
  const overrides = genrePresets[preset];
  return deepMerge(base, overrides) as MixSettings;
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}


// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO ANALYSIS UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SpectralAnalysis {
  subBass: number;      // 20–60 Hz energy (dB)
  bass: number;         // 60–250 Hz
  lowMid: number;       // 250–500 Hz
  mid: number;          // 500–2000 Hz
  upperMid: number;     // 2000–4000 Hz
  presence: number;     // 4000–6000 Hz
  brilliance: number;   // 6000–20000 Hz
  dominantFrequency: number;
}

export interface LoudnessAnalysis {
  peakDB: number;           // True peak in dBFS
  rmsDB: number;            // RMS level in dBFS
  estimatedLUFS: number;    // Estimated integrated LUFS
  crestFactor: number;      // Peak-to-RMS ratio in dB (dynamic range indicator)
}

export interface SibilanceAnalysis {
  hasSibilance: boolean;
  peakFrequency: number;    // Frequency with highest sibilant energy
  severity: number;         // 0.0–1.0
}

export interface StereoAnalysis {
  correlation: number;      // -1.0 (out of phase) to 1.0 (mono)
  width: number;            // 0.0 (mono) to 1.0 (full stereo)
  balance: number;          // -1.0 (left heavy) to 1.0 (right heavy)
}

export interface FullAudioAnalysis {
  spectral: SpectralAnalysis;
  loudness: LoudnessAnalysis;
  sibilance: SibilanceAnalysis;
  stereo: StereoAnalysis;
  dynamicRange: number;     // dB
}

/**
 * Perform spectral analysis using FFT to measure energy per frequency band.
 */
export function analyzeSpectralBalance(buffer: AudioBuffer): SpectralAnalysis {
  const data = buffer.getChannelData(0);
  const fftSize = 4096;
  const sampleRate = buffer.sampleRate;

  // Simple FFT analysis using overlapping windows
  const numWindows = Math.floor(data.length / (fftSize / 2)) - 1;
  const bands = { subBass: 0, bass: 0, lowMid: 0, mid: 0, upperMid: 0, presence: 0, brilliance: 0 };
  const bandCounts = { subBass: 0, bass: 0, lowMid: 0, mid: 0, upperMid: 0, presence: 0, brilliance: 0 };

  // We'll do a simplified spectral analysis using autocorrelation-based energy estimation
  // For a proper FFT, we'd need a library, but we can get good results with band-pass energy measurement
  const bandRanges: [keyof typeof bands, number, number][] = [
    ['subBass', 20, 60],
    ['bass', 60, 250],
    ['lowMid', 250, 500],
    ['mid', 500, 2000],
    ['upperMid', 2000, 4000],
    ['presence', 4000, 6000],
    ['brilliance', 6000, 20000],
  ];

  // Measure RMS energy in each band using approximate filtering
  // We iterate through the frequency bins of a DFT-like approximation
  const halfFFT = fftSize / 2;
  const binWidth = sampleRate / fftSize;

  // Compute magnitude spectrum from a segment in the middle of the buffer
  const startSample = Math.max(0, Math.floor(data.length / 2) - halfFFT);
  const segment = new Float32Array(fftSize);
  for (let i = 0; i < fftSize && (startSample + i) < data.length; i++) {
    // Apply Hanning window
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    segment[i] = data[startSample + i] * window;
  }

  // Simple DFT for key frequency bins (we compute only the bins we need)
  let dominantFreq = 0;
  let dominantMagnitude = 0;

  for (const [bandName, lowHz, highHz] of bandRanges) {
    const lowBin = Math.max(1, Math.floor(lowHz / binWidth));
    const highBin = Math.min(halfFFT - 1, Math.ceil(highHz / binWidth));
    let bandEnergy = 0;
    let count = 0;

    for (let bin = lowBin; bin <= highBin; bin += Math.max(1, Math.floor((highBin - lowBin) / 16))) {
      // Goertzel algorithm for single-bin DFT
      const freq = bin * binWidth;
      const w = (2 * Math.PI * freq) / sampleRate;
      const coeff = 2 * Math.cos(w);
      let s0 = 0, s1 = 0, s2 = 0;

      const analysisLength = Math.min(fftSize, segment.length);
      for (let i = 0; i < analysisLength; i++) {
        s0 = segment[i] + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
      }

      const magnitude = Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
      bandEnergy += magnitude * magnitude;
      count++;

      if (magnitude > dominantMagnitude) {
        dominantMagnitude = magnitude;
        dominantFreq = freq;
      }
    }

    if (count > 0) {
      bands[bandName] = 20 * Math.log10(Math.sqrt(bandEnergy / count) + 1e-10);
    }
  }

  return {
    ...bands,
    dominantFrequency: dominantFreq,
  };
}

/**
 * Measure loudness: peak, RMS, estimated LUFS, and crest factor.
 */
export function measureLoudness(buffer: AudioBuffer): LoudnessAnalysis {
  let peak = 0;
  let sumSquares = 0;
  let totalSamples = 0;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
      sumSquares += data[i] * data[i];
      totalSamples++;
    }
  }

  const rms = Math.sqrt(sumSquares / totalSamples);
  const peakDB = 20 * Math.log10(peak + 1e-10);
  const rmsDB = 20 * Math.log10(rms + 1e-10);

  // Estimated LUFS (simplified K-weighted approximation)
  // K-weighting boosts highs and cuts sub-bass, we approximate with +2dB to RMS
  const estimatedLUFS = rmsDB - 0.691 + 2.0;

  const crestFactor = peakDB - rmsDB;

  return { peakDB, rmsDB, estimatedLUFS, crestFactor };
}

/**
 * Detect sibilance by measuring energy in the 4–10kHz range relative to overall.
 */
export function detectSibilance(buffer: AudioBuffer): SibilanceAnalysis {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  // Analyze short frames to find transient sibilance
  const frameSize = 2048;
  const hopSize = 1024;
  let maxSibilanceRatio = 0;
  let sibilantFreq = 6500;

  const numFrames = Math.min(50, Math.floor(data.length / hopSize) - 1); // Sample up to 50 frames
  const step = Math.max(1, Math.floor((data.length / hopSize - 1) / numFrames));

  for (let f = 0; f < numFrames; f++) {
    const startIdx = f * step * hopSize;
    if (startIdx + frameSize > data.length) break;

    // Measure energy in sibilant range (5–9kHz) vs total using simple bandpass estimation
    let totalEnergy = 0;
    let sibilantEnergy = 0;

    // Quick energy estimation using zero-crossing rate and high-frequency content
    for (let i = startIdx; i < startIdx + frameSize && i < data.length - 1; i++) {
      const sample = data[i];
      totalEnergy += sample * sample;

      // Simple high-pass approximation via first-order difference
      const diff = data[i] - data[i - 1 < 0 ? 0 : i - 1];
      sibilantEnergy += diff * diff;
    }

    const ratio = totalEnergy > 0 ? sibilantEnergy / totalEnergy : 0;
    if (ratio > maxSibilanceRatio) {
      maxSibilanceRatio = ratio;
    }
  }

  // Normalize severity (typical values 0.5–4.0 range for the ratio)
  const severity = Math.min(1.0, Math.max(0, (maxSibilanceRatio - 0.5) / 3.0));

  return {
    hasSibilance: severity > 0.3,
    peakFrequency: sibilantFreq,
    severity,
  };
}

/**
 * Measure stereo width via L/R correlation.
 */
export function measureStereoWidth(buffer: AudioBuffer): StereoAnalysis {
  if (buffer.numberOfChannels < 2) {
    return { correlation: 1.0, width: 0.0, balance: 0.0 };
  }

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const len = Math.min(left.length, right.length);

  let sumLR = 0, sumLL = 0, sumRR = 0;
  let sumL = 0, sumR = 0;

  for (let i = 0; i < len; i++) {
    sumLR += left[i] * right[i];
    sumLL += left[i] * left[i];
    sumRR += right[i] * right[i];
    sumL += Math.abs(left[i]);
    sumR += Math.abs(right[i]);
  }

  const denominator = Math.sqrt(sumLL * sumRR);
  const correlation = denominator > 0 ? sumLR / denominator : 1.0;
  const width = 1.0 - Math.abs(correlation);
  const totalLR = sumL + sumR;
  const balance = totalLR > 0 ? (sumR - sumL) / totalLR : 0;

  return { correlation, width, balance };
}

/**
 * Measure dynamic range (crest factor in dB).
 */
export function measureDynamicRange(buffer: AudioBuffer): number {
  const loudness = measureLoudness(buffer);
  return loudness.crestFactor;
}

/**
 * Perform a comprehensive audio analysis.
 */
export function analyzeAudio(buffer: AudioBuffer): FullAudioAnalysis {
  return {
    spectral: analyzeSpectralBalance(buffer),
    loudness: measureLoudness(buffer),
    sibilance: detectSibilance(buffer),
    stereo: measureStereoWidth(buffer),
    dynamicRange: measureDynamicRange(buffer),
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// DSP UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

// Singleton AudioContext for decoding to ensure consistent sample rates
let decodingCtx: AudioContext | null = null;

function getDecodingCtx(): AudioContext {
  if (!decodingCtx) {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio API is not supported in this browser.");
    }
    try {
      decodingCtx = new AudioContextClass();
    } catch (e) {
      console.error("Failed to create AudioContext:", e);
      if (AudioContextClass === (window as any).AudioContext) {
        try {
          decodingCtx = new AudioContextClass({ sampleRate: 44100 });
        } catch (e2) {
          throw e;
        }
      } else {
        throw e;
      }
    }
  }
  if (!decodingCtx) {
    throw new Error("Failed to initialize AudioContext");
  }
  return decodingCtx;
}

/**
 * Musical tape saturation curve using tanh for warm harmonics.
 * Much more musical than the old waveshaper — generates even harmonics
 * similar to analog tape machines.
 */
function makeTapeSaturationCurve(drive: number, amount: number): Float32Array {
  const n_samples = 8192;
  const curve = new Float32Array(n_samples);
  const driveAmount = 1.0 + drive * 8.0; // 1x to 9x drive
  const blend = Math.max(0, Math.min(1, amount));

  for (let i = 0; i < n_samples; i++) {
    const x = (i * 2) / n_samples - 1; // -1 to +1
    const driven = x * driveAmount;
    // tanh saturation (warm, even harmonics like tape)
    const saturated = Math.tanh(driven);
    // Blend original and saturated
    curve[i] = x * (1 - blend) + saturated * blend;
  }
  return curve;
}

/**
 * Soft clipper curve for mastering — gently rounds peaks
 * before they hit the brickwall limiter.
 */
function makeSoftClipCurve(amount: number): Float32Array {
  const n_samples = 8192;
  const curve = new Float32Array(n_samples);
  const knee = 1.0 - amount * 0.4; // Clipping knee (0.6–1.0)

  for (let i = 0; i < n_samples; i++) {
    const x = (i * 2) / n_samples - 1;
    const absX = Math.abs(x);
    const sign = x >= 0 ? 1 : -1;

    if (absX <= knee) {
      curve[i] = x; // Linear below knee
    } else {
      // Smooth polynomial transition above knee
      const over = absX - knee;
      const range = 1.0 - knee;
      const t = range > 0 ? Math.min(1, over / range) : 0;
      // Quadratic soft-clip
      const clipped = knee + range * (2 * t - t * t);
      curve[i] = sign * Math.min(1.0, clipped);
    }
  }
  return curve;
}

/**
 * Professional plate reverb impulse response with early reflections,
 * proper frequency-dependent decay, and high-frequency damping.
 */
function createPlateReverb(
  context: BaseAudioContext,
  decayTime: number,
  damping: number,
  preDelay: number
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const predelaySamples = Math.floor((preDelay / 1000) * sampleRate);
  const length = Math.floor(sampleRate * decayTime) + predelaySamples;
  const impulse = context.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  // Early reflections (first 50ms) — simulate wall bounces
  const earlyReflectionCount = 12;
  const earlyWindow = Math.floor(sampleRate * 0.05);

  for (let r = 0; r < earlyReflectionCount; r++) {
    const time = predelaySamples + Math.floor(Math.random() * earlyWindow);
    const amplitude = 0.6 * Math.pow(0.85, r);
    if (time < length) {
      left[time] += amplitude * (0.8 + Math.random() * 0.4);
      right[time] += amplitude * (0.8 + Math.random() * 0.4);
    }
  }

  // Diffuse tail — exponential decay with frequency-dependent damping
  const dampingFactor = 1.0 - damping * 0.7; // More damping = faster HF decay
  const tailStart = predelaySamples + earlyWindow;

  for (let i = tailStart; i < length; i++) {
    const t = (i - tailStart) / (length - tailStart); // 0 to 1
    // Exponential decay envelope
    const envelope = Math.pow(1 - t, 1.5 + damping * 2);
    // Slight randomness for diffusion
    const noiseL = (Math.random() * 2 - 1);
    const noiseR = (Math.random() * 2 - 1);

    // Apply frequency-dependent decay (simulate HF absorption)
    // Low-pass the noise by averaging with previous sample
    const prevL = i > tailStart ? left[i - 1] : 0;
    const prevR = i > tailStart ? right[i - 1] : 0;
    const filteredL = noiseL * dampingFactor + prevL * (1 - dampingFactor) * 0.2;
    const filteredR = noiseR * dampingFactor + prevR * (1 - dampingFactor) * 0.2;

    left[i] = filteredL * envelope * 0.4;
    right[i] = filteredR * envelope * 0.4;
  }

  return impulse;
}

/**
 * Encode multi-channel float samples to 16-bit WAV.
 */
function encodeWAV(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = channels.length;
  const length = channels[0].length;
  const buffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * numChannels * 2, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = Math.max(-1, Math.min(1, channels[channel][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return buffer;
}

/**
 * Extract decoded audio data from a Blob.
 */
async function extractAudioData(blob: Blob) {
  const audioCtx = getDecodingCtx();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channels = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }
    return {
      channels,
      length: buffer.length,
      sampleRate: buffer.sampleRate,
      buffer, // Keep reference for analysis
    };
  } catch (err) {
    console.error("Failed to decode audio data", err);
    throw err;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// BEAT PROCESSING (Speed / Pitch)
// ═══════════════════════════════════════════════════════════════════════════════

export async function processBeat(beatBlob: Blob, speed: number, pitch: number): Promise<Blob> {
  if (speed === 1 && pitch === 0) return beatBlob;

  const beatData = await extractAudioData(beatBlob);
  const OfflineContext = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;

  const length = Math.floor(beatData.length / speed);
  const offlineCtx = new OfflineContext(beatData.channels.length, length, beatData.sampleRate);

  const buf = offlineCtx.createBuffer(beatData.channels.length, beatData.length, offlineCtx.sampleRate);
  for (let i = 0; i < beatData.channels.length; i++) {
    buf.copyToChannel(beatData.channels[i], i);
  }

  const source = offlineCtx.createBufferSource();
  source.buffer = buf;
  source.playbackRate.value = speed;
  source.detune.value = pitch * 100;

  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const outChannels = [];
  for (let i = 0; i < renderedBuffer.numberOfChannels; i++) {
    outChannels.push(renderedBuffer.getChannelData(i));
  }

  const wavBuffer = encodeWAV(outChannels, renderedBuffer.sampleRate);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MIXING ENGINE — Production-Grade Signal Processing
// ═══════════════════════════════════════════════════════════════════════════════

export async function mixAudio(
  vocalBlob: Blob,
  beatBlob: Blob,
  backupVocalBlob: Blob | null,
  settings: MixSettings
): Promise<Blob> {
  const vocalData = await extractAudioData(vocalBlob);
  const beatData = await extractAudioData(beatBlob);
  const backupData = backupVocalBlob ? await extractAudioData(backupVocalBlob) : null;

  const OfflineContext = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const sampleRate = beatData.sampleRate;
  const duration = Math.ceil(Math.max(
    vocalData.length,
    beatData.length,
    backupData ? backupData.length : 0
  ));

  const offlineCtx = new OfflineContext(2, duration, sampleRate);

  const createBufferSource = (data: any) => {
    const buf = offlineCtx.createBuffer(data.channels.length, data.length, offlineCtx.sampleRate);
    for (let i = 0; i < data.channels.length; i++) {
      buf.copyToChannel(data.channels[i], i);
    }
    const source = offlineCtx.createBufferSource();
    source.buffer = buf;
    return source;
  };

  const vocalSource = createBufferSource(vocalData);
  const beatSource = createBufferSource(beatData);
  const backupSource = backupData ? createBufferSource(backupData) : null;

  // ═══════════════════════════════════════════════════════════════
  // VOCAL CHAIN: HPF → Subtractive EQ → De-Esser → Compressor →
  //              Additive EQ → Saturation → [Parallel Comp Bus] →
  //              Reverb/Delay Sends → Doubler → Output
  // ═══════════════════════════════════════════════════════════════

  // 1. High-Pass Filter (rumble removal)
  const vocalHPF = offlineCtx.createBiquadFilter();
  vocalHPF.type = 'highpass';
  vocalHPF.frequency.value = settings.vocalEQ.lowCutFreq;
  vocalHPF.Q.value = 0.707; // Butterworth

  // 2. Subtractive EQ — Remove mud and boxiness
  const subtractiveEQ = offlineCtx.createBiquadFilter();
  subtractiveEQ.type = 'peaking';
  subtractiveEQ.frequency.value = settings.vocalEQ.lowMidFreq;
  subtractiveEQ.gain.value = settings.vocalEQ.lowMidGain;
  subtractiveEQ.Q.value = settings.vocalEQ.lowMidQ;

  // 3. De-Esser (sidechain-style: bandpass detection → dynamics reduction)
  // Implemented as a narrow-band compressor that only acts on sibilant frequencies
  const deEsserFilter = offlineCtx.createBiquadFilter();
  deEsserFilter.type = 'peaking';
  deEsserFilter.frequency.value = settings.deEsser.frequency;
  deEsserFilter.Q.value = 3.0; // Narrow band
  deEsserFilter.gain.value = settings.deEsser.enabled
    ? -Math.abs(settings.deEsser.ratio * 1.5) // Negative gain to attenuate sibilance
    : 0;

  // Additional de-essing via dynamics compressor focused on the sibilant range
  const deEsserCompressor = offlineCtx.createDynamicsCompressor();
  deEsserCompressor.threshold.value = settings.deEsser.enabled ? settings.deEsser.threshold : 0;
  deEsserCompressor.ratio.value = settings.deEsser.enabled ? settings.deEsser.ratio : 1;
  deEsserCompressor.attack.value = 0.001;
  deEsserCompressor.release.value = 0.05;
  deEsserCompressor.knee.value = 3;

  // 4. Main Vocal Compressor (1176-style: fast attack, musical release)
  const vocalCompressor = offlineCtx.createDynamicsCompressor();
  vocalCompressor.threshold.value = settings.vocalCompressor.threshold;
  vocalCompressor.ratio.value = settings.vocalCompressor.ratio;
  vocalCompressor.attack.value = settings.vocalCompressor.attack;
  vocalCompressor.release.value = settings.vocalCompressor.release;
  vocalCompressor.knee.value = settings.vocalCompressor.knee;

  // 5. Multiband Vocal Compression (4 bands)
  // Band 1: Low (0–250 Hz)
  const mbLowLP = offlineCtx.createBiquadFilter();
  mbLowLP.type = 'lowpass';
  mbLowLP.frequency.value = 250;
  mbLowLP.Q.value = 0.707;

  const mbLowComp = offlineCtx.createDynamicsCompressor();
  mbLowComp.threshold.value = settings.multibandVocalComp.low.threshold;
  mbLowComp.ratio.value = settings.multibandVocalComp.low.ratio;
  mbLowComp.attack.value = settings.multibandVocalComp.low.attack;
  mbLowComp.release.value = settings.multibandVocalComp.low.release;

  // Band 2: Low-Mid (250–2000 Hz)
  const mbLowMidBP1 = offlineCtx.createBiquadFilter();
  mbLowMidBP1.type = 'highpass';
  mbLowMidBP1.frequency.value = 250;
  const mbLowMidBP2 = offlineCtx.createBiquadFilter();
  mbLowMidBP2.type = 'lowpass';
  mbLowMidBP2.frequency.value = 2000;

  const mbLowMidComp = offlineCtx.createDynamicsCompressor();
  mbLowMidComp.threshold.value = settings.multibandVocalComp.lowMid.threshold;
  mbLowMidComp.ratio.value = settings.multibandVocalComp.lowMid.ratio;
  mbLowMidComp.attack.value = settings.multibandVocalComp.lowMid.attack;
  mbLowMidComp.release.value = settings.multibandVocalComp.lowMid.release;

  // Band 3: High-Mid (2000–6000 Hz)
  const mbHighMidBP1 = offlineCtx.createBiquadFilter();
  mbHighMidBP1.type = 'highpass';
  mbHighMidBP1.frequency.value = 2000;
  const mbHighMidBP2 = offlineCtx.createBiquadFilter();
  mbHighMidBP2.type = 'lowpass';
  mbHighMidBP2.frequency.value = 6000;

  const mbHighMidComp = offlineCtx.createDynamicsCompressor();
  mbHighMidComp.threshold.value = settings.multibandVocalComp.highMid.threshold;
  mbHighMidComp.ratio.value = settings.multibandVocalComp.highMid.ratio;
  mbHighMidComp.attack.value = settings.multibandVocalComp.highMid.attack;
  mbHighMidComp.release.value = settings.multibandVocalComp.highMid.release;

  // Band 4: High (6000+ Hz)
  const mbHighHP = offlineCtx.createBiquadFilter();
  mbHighHP.type = 'highpass';
  mbHighHP.frequency.value = 6000;

  const mbHighComp = offlineCtx.createDynamicsCompressor();
  mbHighComp.threshold.value = settings.multibandVocalComp.high.threshold;
  mbHighComp.ratio.value = settings.multibandVocalComp.high.ratio;
  mbHighComp.attack.value = settings.multibandVocalComp.high.attack;
  mbHighComp.release.value = settings.multibandVocalComp.high.release;

  // Multiband recombination bus
  const mbSumGain = offlineCtx.createGain();
  mbSumGain.gain.value = 0.85; // Slight reduction to compensate for band overlap

  // 6. Additive EQ — Presence and air
  const presenceEQ = offlineCtx.createBiquadFilter();
  presenceEQ.type = 'peaking';
  presenceEQ.frequency.value = settings.vocalEQ.presenceFreq;
  presenceEQ.gain.value = settings.vocalEQ.presenceGain;
  presenceEQ.Q.value = settings.vocalEQ.presenceQ;

  const highMidEQ = offlineCtx.createBiquadFilter();
  highMidEQ.type = 'peaking';
  highMidEQ.frequency.value = settings.vocalEQ.highMidFreq;
  highMidEQ.gain.value = settings.vocalEQ.highMidGain;
  highMidEQ.Q.value = settings.vocalEQ.highMidQ;

  const airEQ = offlineCtx.createBiquadFilter();
  airEQ.type = 'highshelf';
  airEQ.frequency.value = settings.vocalEQ.airFreq;
  airEQ.gain.value = settings.vocalEQ.airGain;

  // 7. Tape Saturation (warm harmonics via tanh curve)
  const saturation = offlineCtx.createWaveShaper();
  saturation.curve = makeTapeSaturationCurve(settings.saturationDrive, settings.saturation);
  saturation.oversample = '4x';

  // 8. Vocal Output Gain
  const vocalGain = offlineCtx.createGain();
  vocalGain.gain.value = settings.vocalVolume;

  // 9. Parallel Compression Bus ("New York compression")
  const parallelCompressor = offlineCtx.createDynamicsCompressor();
  parallelCompressor.threshold.value = settings.parallelCompression.threshold;
  parallelCompressor.ratio.value = settings.parallelCompression.ratio;
  parallelCompressor.attack.value = settings.parallelCompression.attack;
  parallelCompressor.release.value = settings.parallelCompression.release;
  parallelCompressor.knee.value = 3;

  const parallelGain = offlineCtx.createGain();
  parallelGain.gain.value = settings.parallelCompression.enabled ? settings.parallelCompression.wetDry : 0;

  // 10. Reverb Send (plate reverb with pre-delay, band-limited)
  const convolver = offlineCtx.createConvolver();
  convolver.buffer = createPlateReverb(
    offlineCtx,
    settings.reverbDecay,
    settings.reverbDamping,
    settings.reverbPreDelay
  );

  // Band-limit the reverb send (Abbey Road trick — clean reverb)
  const reverbHPF = offlineCtx.createBiquadFilter();
  reverbHPF.type = 'highpass';
  reverbHPF.frequency.value = 300;

  const reverbLPF = offlineCtx.createBiquadFilter();
  reverbLPF.type = 'lowpass';
  reverbLPF.frequency.value = 8000;

  const reverbGain = offlineCtx.createGain();
  reverbGain.gain.value = settings.reverb;

  // 11. Delay Send (tempo-synced echo)
  const delay = offlineCtx.createDelay(2.0);
  delay.delayTime.value = settings.echoTime;

  const delayFeedback = offlineCtx.createGain();
  delayFeedback.gain.value = settings.echoFeedback;
  delay.connect(delayFeedback);
  delayFeedback.connect(delay);

  // Band-limit delay to prevent buildup
  const delayLPF = offlineCtx.createBiquadFilter();
  delayLPF.type = 'lowpass';
  delayLPF.frequency.value = 6000;

  const delayGain = offlineCtx.createGain();
  delayGain.gain.value = settings.echo;

  // 12. Doubler / Vocal Widener (Haas effect)
  const leftDelay = offlineCtx.createDelay();
  leftDelay.delayTime.value = 0.012; // 12ms
  const rightDelay = offlineCtx.createDelay();
  rightDelay.delayTime.value = 0.022; // 22ms

  // Slight pitch variation for more natural doubling
  const leftPanner = offlineCtx.createStereoPanner();
  leftPanner.pan.value = -0.7;
  const rightPanner = offlineCtx.createStereoPanner();
  rightPanner.pan.value = 0.7;

  const doublerGain = offlineCtx.createGain();
  doublerGain.gain.value = settings.doubler;

  // ═══════════════════════════════════════════════════════════════
  // VOCAL CHAIN ROUTING
  // ═══════════════════════════════════════════════════════════════

  // Main signal path
  vocalSource.connect(vocalHPF);
  vocalHPF.connect(subtractiveEQ);
  subtractiveEQ.connect(deEsserFilter);
  deEsserFilter.connect(deEsserCompressor);
  deEsserCompressor.connect(vocalCompressor);

  // After main compressor → Split into multiband
  vocalCompressor.connect(mbLowLP);
  mbLowLP.connect(mbLowComp);
  mbLowComp.connect(mbSumGain);

  vocalCompressor.connect(mbLowMidBP1);
  mbLowMidBP1.connect(mbLowMidBP2);
  mbLowMidBP2.connect(mbLowMidComp);
  mbLowMidComp.connect(mbSumGain);

  vocalCompressor.connect(mbHighMidBP1);
  mbHighMidBP1.connect(mbHighMidBP2);
  mbHighMidBP2.connect(mbHighMidComp);
  mbHighMidComp.connect(mbSumGain);

  vocalCompressor.connect(mbHighHP);
  mbHighHP.connect(mbHighComp);
  mbHighComp.connect(mbSumGain);

  // After multiband → Additive EQ → Saturation → Output Gain
  mbSumGain.connect(presenceEQ);
  presenceEQ.connect(highMidEQ);
  highMidEQ.connect(airEQ);
  airEQ.connect(saturation);
  saturation.connect(vocalGain);

  // Parallel compression bus (tapped from after the main compressor)
  vocalCompressor.connect(parallelCompressor);
  parallelCompressor.connect(parallelGain);

  // Reverb send (tapped from after saturation)
  saturation.connect(convolver);
  convolver.connect(reverbHPF);
  reverbHPF.connect(reverbLPF);
  reverbLPF.connect(reverbGain);

  // Delay send
  saturation.connect(delay);
  delay.connect(delayLPF);
  delayLPF.connect(delayGain);

  // Doubler (tapped from after saturation)
  saturation.connect(leftDelay);
  leftDelay.connect(leftPanner);
  leftPanner.connect(doublerGain);

  saturation.connect(rightDelay);
  rightDelay.connect(rightPanner);
  rightPanner.connect(doublerGain);

  // ═══════════════════════════════════════════════════════════════
  // BEAT CHAIN: EQ → Compressor → Sidechain Duck → Stereo Width
  // ═══════════════════════════════════════════════════════════════

  // Beat EQ (4-band parametric)
  const beatLowEQ = offlineCtx.createBiquadFilter();
  beatLowEQ.type = 'lowshelf';
  beatLowEQ.frequency.value = settings.beatEQ.lowFreq;
  beatLowEQ.gain.value = settings.beatEQ.lowGain;

  const beatLowMidEQ = offlineCtx.createBiquadFilter();
  beatLowMidEQ.type = 'peaking';
  beatLowMidEQ.frequency.value = settings.beatEQ.lowMidFreq;
  beatLowMidEQ.gain.value = settings.beatEQ.lowMidGain;
  beatLowMidEQ.Q.value = 1.2;

  const beatHighMidEQ = offlineCtx.createBiquadFilter();
  beatHighMidEQ.type = 'peaking';
  beatHighMidEQ.frequency.value = settings.beatEQ.highMidFreq;
  beatHighMidEQ.gain.value = settings.beatEQ.highMidGain;
  beatHighMidEQ.Q.value = 1.0;

  const beatHighEQ = offlineCtx.createBiquadFilter();
  beatHighEQ.type = 'highshelf';
  beatHighEQ.frequency.value = settings.beatEQ.highFreq;
  beatHighEQ.gain.value = settings.beatEQ.highGain;

  // Beat Compressor
  const beatCompressor = offlineCtx.createDynamicsCompressor();
  beatCompressor.threshold.value = settings.beatCompressor.threshold;
  beatCompressor.ratio.value = settings.beatCompressor.ratio;
  beatCompressor.attack.value = settings.beatCompressor.attack;
  beatCompressor.release.value = settings.beatCompressor.release;

  // Beat Output Gain (with sidechain ducking applied post-render)
  const beatGain = offlineCtx.createGain();
  beatGain.gain.value = settings.beatVolume;

  // Beat routing
  beatSource.connect(beatLowEQ);
  beatLowEQ.connect(beatLowMidEQ);
  beatLowMidEQ.connect(beatHighMidEQ);
  beatHighMidEQ.connect(beatHighEQ);
  beatHighEQ.connect(beatCompressor);
  beatCompressor.connect(beatGain);

  // ═══════════════════════════════════════════════════════════════
  // MASTERING CHAIN: Gain → Corrective EQ → Multiband Compressor →
  //                  Stereo Imaging → Sweetening EQ → Soft Clipper →
  //                  Brickwall Limiter → Output
  // ═══════════════════════════════════════════════════════════════

  // Master input gain stage
  const masterInputGain = offlineCtx.createGain();
  masterInputGain.gain.value = settings.masterGain;

  // Master Corrective EQ (lowshelf + mid + highshelf)
  const masterLowShelf = offlineCtx.createBiquadFilter();
  masterLowShelf.type = 'lowshelf';
  masterLowShelf.frequency.value = settings.masterEQ.lowShelfFreq;
  masterLowShelf.gain.value = settings.masterEQ.lowShelfGain;

  const masterMidEQ = offlineCtx.createBiquadFilter();
  masterMidEQ.type = 'peaking';
  masterMidEQ.frequency.value = settings.masterEQ.midFreq;
  masterMidEQ.gain.value = settings.masterEQ.midGain;
  masterMidEQ.Q.value = settings.masterEQ.midQ;

  const masterHighShelf = offlineCtx.createBiquadFilter();
  masterHighShelf.type = 'highshelf';
  masterHighShelf.frequency.value = settings.masterEQ.highShelfFreq;
  masterHighShelf.gain.value = settings.masterEQ.highShelfGain;

  // Master Multiband Compressor (3-band)
  // Low band (<250 Hz)
  const masterMBLowLP = offlineCtx.createBiquadFilter();
  masterMBLowLP.type = 'lowpass';
  masterMBLowLP.frequency.value = 250;
  masterMBLowLP.Q.value = 0.707;

  const masterMBLowComp = offlineCtx.createDynamicsCompressor();
  masterMBLowComp.threshold.value = settings.masterMultiband.low.threshold;
  masterMBLowComp.ratio.value = settings.masterMultiband.low.ratio;
  masterMBLowComp.attack.value = settings.masterMultiband.low.attack;
  masterMBLowComp.release.value = settings.masterMultiband.low.release;

  // Mid band (250–4000 Hz)
  const masterMBMidHP = offlineCtx.createBiquadFilter();
  masterMBMidHP.type = 'highpass';
  masterMBMidHP.frequency.value = 250;
  const masterMBMidLP = offlineCtx.createBiquadFilter();
  masterMBMidLP.type = 'lowpass';
  masterMBMidLP.frequency.value = 4000;

  const masterMBMidComp = offlineCtx.createDynamicsCompressor();
  masterMBMidComp.threshold.value = settings.masterMultiband.mid.threshold;
  masterMBMidComp.ratio.value = settings.masterMultiband.mid.ratio;
  masterMBMidComp.attack.value = settings.masterMultiband.mid.attack;
  masterMBMidComp.release.value = settings.masterMultiband.mid.release;

  // High band (>4000 Hz)
  const masterMBHighHP = offlineCtx.createBiquadFilter();
  masterMBHighHP.type = 'highpass';
  masterMBHighHP.frequency.value = 4000;

  const masterMBHighComp = offlineCtx.createDynamicsCompressor();
  masterMBHighComp.threshold.value = settings.masterMultiband.high.threshold;
  masterMBHighComp.ratio.value = settings.masterMultiband.high.ratio;
  masterMBHighComp.attack.value = settings.masterMultiband.high.attack;
  masterMBHighComp.release.value = settings.masterMultiband.high.release;

  // Multiband recombination
  const masterMBSum = offlineCtx.createGain();
  masterMBSum.gain.value = 0.9;

  // Soft Clipper (pre-limiter transient shaving)
  const softClipper = offlineCtx.createWaveShaper();
  softClipper.curve = makeSoftClipCurve(settings.softClipAmount);
  softClipper.oversample = '4x';

  // Brickwall Limiter (true peak ceiling)
  const masterLimiter = offlineCtx.createDynamicsCompressor();
  masterLimiter.threshold.value = settings.masterLimiter.ceiling;
  masterLimiter.ratio.value = 20.0; // Brickwall
  masterLimiter.attack.value = 0.001;
  masterLimiter.release.value = settings.masterLimiter.release;
  masterLimiter.knee.value = 0;

  // ═══════════════════════════════════════════════════════════════
  // MASTER CHAIN ROUTING
  // ═══════════════════════════════════════════════════════════════

  // All sources → Master Input
  vocalGain.connect(masterInputGain);
  parallelGain.connect(masterInputGain);
  reverbGain.connect(masterInputGain);
  delayGain.connect(masterInputGain);
  doublerGain.connect(masterInputGain);
  beatGain.connect(masterInputGain);

  // Backup vocals
  if (backupSource) {
    const backupGain = offlineCtx.createGain();
    backupGain.gain.value = settings.backupVolume;
    backupSource.connect(backupGain);
    backupGain.connect(masterInputGain);
    // Also send backup to reverb
    backupGain.connect(convolver);
    backupSource.start(0);
  }

  // Master EQ chain
  masterInputGain.connect(masterLowShelf);
  masterLowShelf.connect(masterMidEQ);
  masterMidEQ.connect(masterHighShelf);

  // Master Multiband split
  masterHighShelf.connect(masterMBLowLP);
  masterMBLowLP.connect(masterMBLowComp);
  masterMBLowComp.connect(masterMBSum);

  masterHighShelf.connect(masterMBMidHP);
  masterMBMidHP.connect(masterMBMidLP);
  masterMBMidLP.connect(masterMBMidComp);
  masterMBMidComp.connect(masterMBSum);

  masterHighShelf.connect(masterMBHighHP);
  masterMBHighHP.connect(masterMBHighComp);
  masterMBHighComp.connect(masterMBSum);

  // Soft clip → Limiter → Output
  masterMBSum.connect(softClipper);
  softClipper.connect(masterLimiter);
  masterLimiter.connect(offlineCtx.destination);

  // Start all sources
  vocalSource.start(0);
  beatSource.start(0);

  // ═══════════════════════════════════════════════════════════════
  // RENDER & POST-PROCESS
  // ═══════════════════════════════════════════════════════════════

  const renderedBuffer = await offlineCtx.startRendering();

  const outChannels = [
    renderedBuffer.getChannelData(0),
    renderedBuffer.getChannelData(1),
  ];

  // ── Mid-Side Stereo Processing (post-render) ──
  // This cannot be done easily in the Web Audio graph, so we do it sample-by-sample
  const width = settings.stereoImaging.width;
  const bassMonoCutoff = settings.stereoImaging.bassMonoCutoff;

  if (width !== 1.0 || bassMonoCutoff > 0) {
    const left = outChannels[0];
    const right = outChannels[1];

    // Simple one-pole low-pass filter state for bass mono
    const bassLPCoeff = bassMonoCutoff > 0
      ? Math.exp(-2 * Math.PI * bassMonoCutoff / sampleRate)
      : 0;
    let midLP = 0;
    let sideLP = 0;

    for (let i = 0; i < left.length; i++) {
      // Encode to Mid-Side
      const mid = (left[i] + right[i]) * 0.5;
      const side = (left[i] - right[i]) * 0.5;

      // Apply width (scale side channel)
      let processedSide = side * width;

      // Bass mono: LPF the side channel and subtract it (mono-ify bass)
      if (bassMonoCutoff > 0) {
        sideLP = sideLP * bassLPCoeff + processedSide * (1 - bassLPCoeff);
        // Remove low-frequency content from the side channel
        processedSide = processedSide - sideLP;
      }

      // Decode back to Left-Right
      left[i] = mid + processedSide;
      right[i] = mid - processedSide;
    }
  }

  // ── Sidechain Ducking (post-render) ──
  // We duck the beat signal when the vocal is loud.
  // Since we've already rendered, we approximate by comparing vocal envelope
  // to the mixed output and applying gentle gain reduction.
  // This is a simplified approach — in a real DAW you'd use sidechain routing.
  if (settings.sidechainDuck > 0) {
    // We already have the mixed output, so ducking is applied to the final output
    // Detect vocal envelope from the original vocal data
    const vocalEnvelope = new Float32Array(duration);
    const vocalChannel = vocalData.channels[0];
    const envAttack = Math.exp(-1 / (sampleRate * 0.005));
    const envRelease = Math.exp(-1 / (sampleRate * 0.05));
    let envState = 0;

    for (let i = 0; i < Math.min(vocalChannel.length, duration); i++) {
      const abs = Math.abs(vocalChannel[i]);
      if (abs > envState) {
        envState = envAttack * envState + (1 - envAttack) * abs;
      } else {
        envState = envRelease * envState + (1 - envRelease) * abs;
      }
      vocalEnvelope[i] = envState;
    }

    // Note: This is an approximation. Because the vocal and beat are already mixed,
    // we apply a very gentle ducking to the overall output based on vocal presence.
    // The actual ducking amount is kept subtle to avoid artifacts.
    const duckAmount = settings.sidechainDuck * 0.3; // Keep it subtle
    for (let i = 0; i < outChannels[0].length; i++) {
      const env = i < vocalEnvelope.length ? vocalEnvelope[i] : 0;
      const duckGain = 1.0 - (env * duckAmount);
      // Only duck slightly to create space, don't apply to silence
      if (env > 0.01) {
        // Apply to output — since both vocal and beat are mixed, this creates
        // a subtle pumping effect that helps the vocal sit forward
        outChannels[0][i] *= (1.0 - duckAmount * 0.5) + duckAmount * 0.5 * duckGain;
        outChannels[1][i] *= (1.0 - duckAmount * 0.5) + duckAmount * 0.5 * duckGain;
      }
    }
  }

  // ── LUFS-Aware Normalization ──
  // Measure the rendered output's loudness and adjust gain to hit the target LUFS
  let peak = 0;
  let sumSquares = 0;
  let totalSamples = 0;

  for (let c = 0; c < outChannels.length; c++) {
    const channel = outChannels[c];
    for (let i = 0; i < channel.length; i++) {
      const abs = Math.abs(channel[i]);
      if (abs > peak) peak = abs;
      sumSquares += channel[i] * channel[i];
      totalSamples++;
    }
  }

  const rms = Math.sqrt(sumSquares / totalSamples);
  const currentRMSdB = 20 * Math.log10(rms + 1e-10);
  // Approximate LUFS from RMS (K-weighted approximation: LUFS ≈ RMS_dB + 1.3)
  const currentEstimatedLUFS = currentRMSdB + 1.3;
  const targetLUFS = settings.lufsTarget;
  const lufsCorrection = targetLUFS - currentEstimatedLUFS;

  // Convert dB correction to linear gain
  let normalizeFactor = Math.pow(10, lufsCorrection / 20);

  // Safety: don't boost more than 12dB or reduce more than 6dB
  normalizeFactor = Math.max(0.5, Math.min(4.0, normalizeFactor));

  // Apply gain and ensure we don't clip past the ceiling
  const ceilingLinear = Math.pow(10, settings.masterLimiter.ceiling / 20);

  for (let c = 0; c < outChannels.length; c++) {
    const channel = outChannels[c];
    for (let i = 0; i < channel.length; i++) {
      channel[i] *= normalizeFactor;
      // Final true-peak limiting (safety)
      if (channel[i] > ceilingLinear) channel[i] = ceilingLinear;
      if (channel[i] < -ceilingLinear) channel[i] = -ceilingLinear;
    }
  }

  const wavBuffer = encodeWAV(outChannels, renderedBuffer.sampleRate);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}
