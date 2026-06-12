// Mix settings types, defaults, and genre presets for the mixing/mastering engine.

export type GenrePreset = 'hip-hop' | 'pop' | 'electronic' | 'acoustic' | 'custom';

export interface DeEsserSettings {
  frequency: number;   // Center frequency for sibilance (4000–10000 Hz)
  threshold: number;   // dB threshold (-40 to -10)
  ratio: number;       // Compression ratio for sibilant band (2–10)
  enabled: boolean;
}

export interface MultibandVocalCompressor {
  low: { threshold: number; ratio: number; attack: number; release: number };     // 0–250 Hz
  lowMid: { threshold: number; ratio: number; attack: number; release: number };  // 250–2000 Hz
  highMid: { threshold: number; ratio: number; attack: number; release: number }; // 2000–6000 Hz
  high: { threshold: number; ratio: number; attack: number; release: number };    // 6000+ Hz
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
  width: number;          // 0.0 (mono) to 2.0 (extra wide), 1.0 = normal
  bassMonoCutoff: number; // Frequency below which the signal is summed to mono (0–300 Hz)
}

export interface MasterMultibandCompressor {
  low: { threshold: number; ratio: number; attack: number; release: number };  // < 250 Hz
  mid: { threshold: number; ratio: number; attack: number; release: number };  // 250–4000 Hz
  high: { threshold: number; ratio: number; attack: number; release: number }; // > 4000 Hz
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
  return deepMerge(base, overrides) as unknown as MixSettings;
}

type AnyRecord = Record<string, unknown>;

function deepMerge(target: AnyRecord, source: AnyRecord): AnyRecord {
  const result: AnyRecord = { ...target };
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepMerge(
        (target[key] as AnyRecord | undefined) ?? {},
        value as AnyRecord
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}
