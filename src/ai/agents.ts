// Multi-agent mix engineering network. With a Gemini API key it runs the
// LLM-driven agent pipeline; without one it falls back to a fully
// deterministic "Smart Mix" pipeline built on the same analysis/score loop.

import { GoogleGenAI } from '@google/genai';
import {
  MixSettings,
  mixAudio,
  defaultMixSettings,
  analyzeAudio,
  FullAudioAnalysis,
  GenrePreset,
  applyGenrePreset,
  scoreMix,
  applyDspCorrections,
  formatScoreLine,
  MixScore,
  decodeAudioBlob,
  audioBufferToWavBlob,
} from '../audio';
import {
  searchSkillTree,
  formatSkillAsAgentContext,
  formatUserPrefsAsContext,
  markSkillUsed,
  incrementSessionCount,
  loadSkillTree,
} from './memory';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ParameterDelta {
  param: string;
  label: string;
  before: number;
  after: number;
  unit: string;
}

export interface AgentMemoryProfile {
  genre: string;
  spectralFingerprint: { dominantFreq: number; subBassRatio: number; brillianceRatio: number; };
  settingsSnapshot: { lufsTarget: number; reverb: number; saturation: number; sidechainDuck: number; };
  createdAt: string;
}

export interface AILog {
  agent: string;
  message: string;
  details?: string;
  confidence?: ConfidenceLevel;
  thoughtProcess?: string;
  parameterDeltas?: ParameterDelta[];
  durationMs?: number;
  phase?: 'analysis' | 'mixing' | 'review' | 'mastering' | 'genre' | 'system' | 'skill_match';
  timestamp?: number;
}

export interface AgentNetworkResult {
  settings: MixSettings;
  reasoning: string;
  matchedSkillId: string | null;
  detectedGenre: string;
  vocalAnalysis: FullAudioAnalysis;
  beatAnalysis: FullAudioAnalysis;
  finalScore: number;
}

// ─── Gemini Helpers ──────────────────────────────────────────────────────────

async function blobToGenerativePart(blob: Blob) {
  let targetBlob = blob;
  const mime = blob.type || 'audio/webm';

  // Gemini does not support webm. Convert to wav if needed.
  if (mime.includes('webm') || !blob.type) {
    const buffer = await decodeAudioBlob(blob);
    targetBlob = audioBufferToWavBlob(buffer);
  }

  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        resolve({
          inlineData: {
            data: base64,
            mimeType: targetBlob.type || 'audio/wav',
          },
        });
      } else {
        reject(new Error('Failed to read blob as base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(targetBlob);
  });
}

/** Format an audio analysis into a concise but data-rich string for AI consumption. */
function formatAnalysis(label: string, analysis: FullAudioAnalysis): string {
  const s = analysis.spectral;
  const l = analysis.loudness;
  const sib = analysis.sibilance;
  const st = analysis.stereo;

  return `
═══ ${label} Audio Analysis ═══
▸ Spectral Balance:
  Sub-Bass (20-60Hz): ${s.subBass.toFixed(1)} dB
  Bass (60-250Hz): ${s.bass.toFixed(1)} dB
  Low-Mid (250-500Hz): ${s.lowMid.toFixed(1)} dB
  Mid (500-2kHz): ${s.mid.toFixed(1)} dB
  Upper-Mid (2-4kHz): ${s.upperMid.toFixed(1)} dB
  Presence (4-6kHz): ${s.presence.toFixed(1)} dB
  Brilliance (6-20kHz): ${s.brilliance.toFixed(1)} dB
  Dominant Frequency: ${s.dominantFrequency.toFixed(0)} Hz

▸ Loudness:
  Peak: ${l.peakDB.toFixed(1)} dBFS
  RMS: ${l.rmsDB.toFixed(1)} dBFS
  Est. LUFS: ${l.estimatedLUFS.toFixed(1)} LUFS
  Crest Factor: ${l.crestFactor.toFixed(1)} dB

▸ Sibilance: ${sib.hasSibilance ? `DETECTED (severity: ${(sib.severity * 100).toFixed(0)}%, peak: ${sib.peakFrequency}Hz)` : 'Not significant'}

▸ Stereo:
  Correlation: ${st.correlation.toFixed(2)} ${st.correlation > 0.9 ? '(mostly mono)' : st.correlation > 0.5 ? '(normal stereo)' : '(wide stereo)'}
  Width: ${(st.width * 100).toFixed(0)}%
  Balance: ${st.balance.toFixed(2)} ${Math.abs(st.balance) < 0.05 ? '(centered)' : st.balance > 0 ? '(right heavy)' : '(left heavy)'}

▸ Dynamic Range: ${analysis.dynamicRange.toFixed(1)} dB
`.trim();
}

// ─── Structured Output Schemas ───────────────────────────────────────────────

const mixSettingsSchemaProperties = {
  genrePreset: { type: "STRING", description: "Genre preset: 'hip-hop', 'pop', 'electronic', 'acoustic', or 'custom'" },
  vocalVolume: { type: "NUMBER", description: "0.0 to 2.0" },
  beatVolume: { type: "NUMBER", description: "0.0 to 2.0" },
  backupVolume: { type: "NUMBER", description: "0.0 to 2.0" },

  vocalEQ: {
    type: "OBJECT",
    properties: {
      lowCutFreq: { type: "NUMBER", description: "High-pass filter frequency (60-200 Hz)" },
      lowMidFreq: { type: "NUMBER", description: "Subtractive EQ center (200-800 Hz)" },
      lowMidGain: { type: "NUMBER", description: "Subtractive cut (-8 to +4 dB, negative to cut mud)" },
      lowMidQ: { type: "NUMBER", description: "Q/bandwidth (0.5-4.0)" },
      highMidFreq: { type: "NUMBER", description: "High-mid EQ center (1000-6000 Hz)" },
      highMidGain: { type: "NUMBER", description: "Boost/cut (-6 to +6 dB)" },
      highMidQ: { type: "NUMBER", description: "Q/bandwidth (0.5-4.0)" },
      presenceFreq: { type: "NUMBER", description: "Presence band (3000-6000 Hz)" },
      presenceGain: { type: "NUMBER", description: "Boost for vocal clarity (-4 to +6 dB)" },
      presenceQ: { type: "NUMBER", description: "Q/bandwidth (0.5-3.0)" },
      airFreq: { type: "NUMBER", description: "Air shelf frequency (8000-16000 Hz)" },
      airGain: { type: "NUMBER", description: "Air boost (0 to +6 dB)" },
    }
  },

  deEsser: {
    type: "OBJECT",
    properties: {
      frequency: { type: "NUMBER", description: "De-esser center frequency (4000-10000 Hz)" },
      threshold: { type: "NUMBER", description: "De-esser threshold (-40 to -10 dB)" },
      ratio: { type: "NUMBER", description: "De-esser ratio (2-10)" },
      enabled: { type: "BOOLEAN", description: "Enable de-essing" },
    }
  },

  vocalCompressor: {
    type: "OBJECT",
    properties: {
      threshold: { type: "NUMBER", description: "-40 to -10 dB" },
      ratio: { type: "NUMBER", description: "2 to 8" },
      attack: { type: "NUMBER", description: "0.001 to 0.05 seconds" },
      release: { type: "NUMBER", description: "0.05 to 0.3 seconds" },
      knee: { type: "NUMBER", description: "0 to 30 dB" },
    }
  },

  parallelCompression: {
    type: "OBJECT",
    properties: {
      enabled: { type: "BOOLEAN", description: "Enable parallel/NY compression" },
      wetDry: { type: "NUMBER", description: "Blend amount 0.0-1.0" },
      threshold: { type: "NUMBER", description: "-40 to -20 dB" },
      ratio: { type: "NUMBER", description: "8 to 20" },
    }
  },

  saturation: { type: "NUMBER", description: "Tape saturation amount 0.0-1.0" },
  saturationDrive: { type: "NUMBER", description: "Drive intensity 0.0-1.0" },

  reverb: { type: "NUMBER", description: "Reverb send level 0.0-1.0" },
  reverbPreDelay: { type: "NUMBER", description: "Pre-delay ms 0-80" },
  reverbDecay: { type: "NUMBER", description: "Decay time 0.5-5.0 seconds" },
  reverbDamping: { type: "NUMBER", description: "HF damping 0.0-1.0" },
  echo: { type: "NUMBER", description: "Delay send level 0.0-1.0" },
  echoTime: { type: "NUMBER", description: "Delay time 0.1-1.0 seconds" },
  echoFeedback: { type: "NUMBER", description: "Delay feedback 0.0-0.7" },
  doubler: { type: "NUMBER", description: "Vocal doubler/widener 0.0-1.0" },

  beatEQ: {
    type: "OBJECT",
    properties: {
      lowFreq: { type: "NUMBER", description: "Bass shelf freq 60-200 Hz" },
      lowGain: { type: "NUMBER", description: "-6 to +6 dB" },
      lowMidFreq: { type: "NUMBER", description: "Low-mid freq 200-800 Hz" },
      lowMidGain: { type: "NUMBER", description: "-6 to +6 dB" },
      highMidFreq: { type: "NUMBER", description: "High-mid freq 800-4000 Hz" },
      highMidGain: { type: "NUMBER", description: "-6 to +6 dB, cut here to make room for vocals" },
      highFreq: { type: "NUMBER", description: "High shelf freq 4000-12000 Hz" },
      highGain: { type: "NUMBER", description: "-6 to +6 dB" },
    }
  },
  beatCompressor: {
    type: "OBJECT",
    properties: {
      threshold: { type: "NUMBER", description: "-30 to -6 dB" },
      ratio: { type: "NUMBER", description: "1.5 to 6" },
      attack: { type: "NUMBER", description: "0.003 to 0.05 s" },
      release: { type: "NUMBER", description: "0.05 to 0.3 s" },
    }
  },
  sidechainDuck: { type: "NUMBER", description: "Beat sidechain ducking amount 0.0-1.0 (subtle: 0.1-0.25)" },

  stereoImaging: {
    type: "OBJECT",
    properties: {
      width: { type: "NUMBER", description: "Stereo width 0.5-2.0 (1.0 = normal)" },
      bassMonoCutoff: { type: "NUMBER", description: "Bass mono frequency cutoff 0-300 Hz" },
    }
  },
  masterMultiband: {
    type: "OBJECT",
    properties: {
      low: {
        type: "OBJECT",
        properties: {
          threshold: { type: "NUMBER", description: "-24 to -6 dB" },
          ratio: { type: "NUMBER", description: "1.5 to 4" },
          attack: { type: "NUMBER", description: "0.01 to 0.05 s" },
          release: { type: "NUMBER", description: "0.1 to 0.4 s" },
        }
      },
      mid: {
        type: "OBJECT",
        properties: {
          threshold: { type: "NUMBER", description: "-20 to -6 dB" },
          ratio: { type: "NUMBER", description: "1.5 to 4" },
          attack: { type: "NUMBER", description: "0.005 to 0.03 s" },
          release: { type: "NUMBER", description: "0.08 to 0.3 s" },
        }
      },
      high: {
        type: "OBJECT",
        properties: {
          threshold: { type: "NUMBER", description: "-24 to -6 dB" },
          ratio: { type: "NUMBER", description: "1.5 to 4" },
          attack: { type: "NUMBER", description: "0.003 to 0.02 s" },
          release: { type: "NUMBER", description: "0.05 to 0.2 s" },
        }
      },
    }
  },
  masterEQ: {
    type: "OBJECT",
    properties: {
      lowShelfFreq: { type: "NUMBER", description: "60-200 Hz" },
      lowShelfGain: { type: "NUMBER", description: "-4 to +4 dB" },
      midFreq: { type: "NUMBER", description: "500-4000 Hz" },
      midGain: { type: "NUMBER", description: "-4 to +4 dB" },
      midQ: { type: "NUMBER", description: "0.5-4.0" },
      highShelfFreq: { type: "NUMBER", description: "6000-16000 Hz" },
      highShelfGain: { type: "NUMBER", description: "-4 to +4 dB" },
    }
  },
  masterLimiter: {
    type: "OBJECT",
    properties: {
      ceiling: { type: "NUMBER", description: "True peak ceiling -3.0 to 0 dB" },
      release: { type: "NUMBER", description: "0.01 to 0.5 s" },
    }
  },
  masterGain: { type: "NUMBER", description: "Pre-limiter gain 0.5-2.0" },
  softClipAmount: { type: "NUMBER", description: "Soft clipping 0.0-1.0" },
  lufsTarget: { type: "NUMBER", description: "Target loudness -14 to -6 LUFS" },
};

const detailedReasoningSchema = {
  type: "OBJECT",
  properties: {
    eqReasoning: { type: "STRING", description: "Why specific frequencies were cut/boosted for both vocal and beat" },
    compressionReasoning: { type: "STRING", description: "Reasoning for compressor settings including multiband and parallel compression decisions" },
    deEsserReasoning: { type: "STRING", description: "Whether de-essing was needed based on sibilance analysis" },
    spatialReasoning: { type: "STRING", description: "Reverb, delay, doubler, and stereo imaging decisions" },
    masteringReasoning: { type: "STRING", description: "Mastering chain decisions: multiband compression, EQ, limiter, LUFS target" },
    overallBalance: { type: "STRING", description: "Volume balance and genre-specific considerations" },
  }
};

const genreAnalysisSchema = {
  type: "OBJECT",
  properties: {
    detectedGenre: { type: "STRING", description: "One of: hip-hop, pop, electronic, acoustic, custom" },
    confidence: { type: "STRING", description: "One of: high, medium, low" },
    genreReasoning: { type: "STRING", description: "Brief explanation of genre detection based on spectral characteristics" },
    suggestedLUFSTarget: { type: "NUMBER", description: "Recommended LUFS target for this genre (-7 to -14)" },
  }
};

function enforceRequired(schema: any): any {
  if (schema && schema.type === "OBJECT" && schema.properties) {
    schema.required = Object.keys(schema.properties);
    for (const key in schema.properties) {
      enforceRequired(schema.properties[key]);
    }
  }
  return schema;
}

function parseSafeJSON(text: string) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    return JSON.parse(match[1]);
  }
  return JSON.parse(text.trim());
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const GENRE_LUFS_TARGETS: Record<string, number> = {
  'hip-hop': -8,
  'pop': -9,
  'electronic': -7,
  'acoustic': -12,
  'custom': -9,
};

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];
let currentModelIndex = 0;

// Round-robin across models, cycling onward when one hits a 429.
async function generateContentWithCycle(ai: any, request: any): Promise<any> {
  let attempts = 0;
  while (attempts < GEMINI_MODELS.length) {
    const model = GEMINI_MODELS[currentModelIndex];
    currentModelIndex = (currentModelIndex + 1) % GEMINI_MODELS.length;

    try {
      return await ai.models.generateContent({
        ...request,
        model,
      });
    } catch (error: any) {
      const errorMessage = error?.message || '';
      if (error?.status === 429 || errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        console.warn(`Model ${model} hit rate limit (429). Cycling to next model...`);
        attempts++;
        if (attempts >= GEMINI_MODELS.length) {
          throw error;
        }
        await delay(1000);
        continue;
      }
      throw error;
    }
  }
}

// ─── API Key Resolution ──────────────────────────────────────────────────────

function resolveApiKey(): string {
  // process.env.GEMINI_API_KEY is statically replaced by the bundler's define.
  return process.env.GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
}

// ─── Heuristic Genre Detection (deterministic fallback) ─────────────────────

type DetectableGenre = Exclude<GenrePreset, 'custom'>;

function detectGenreHeuristic(
  vocal: FullAudioAnalysis,
  beat: FullAudioAnalysis
): { genre: DetectableGenre; confidence: ConfidenceLevel; reasoning: string } {
  const b = beat.spectral;
  // Energy of low end relative to mids (dB deltas are scale-invariant).
  const subVsMid = b.subBass - b.mid;
  const bassVsMid = b.bass - b.mid;
  const brillVsMid = b.brilliance - b.mid;
  const wide = beat.stereo.width > 0.5;
  const tight = beat.loudness.crestFactor < 9;
  const dynamic = beat.dynamicRange > 14 && vocal.dynamicRange > 14;

  const scores: Record<DetectableGenre, number> = {
    'hip-hop': 0, pop: 0, electronic: 0, acoustic: 0,
  };

  // Sub-bass heavy + mid-range vocal → hip-hop
  if (subVsMid > 2) scores['hip-hop'] += 2;
  if (bassVsMid > 0) scores['hip-hop'] += 1;
  // Wide stereo + heavy sub + brilliance → electronic
  if (wide) scores.electronic += 1;
  if (subVsMid > 0 && brillVsMid > -6) scores.electronic += 2;
  // Bright highs + tight dynamics → pop
  if (brillVsMid > -3) scores.pop += 2;
  if (tight) scores.pop += 1;
  // Natural dynamics + minimal low end → acoustic
  if (dynamic) scores.acoustic += 2;
  if (subVsMid < -8) scores.acoustic += 2;

  const ranked = (Object.entries(scores) as [DetectableGenre, number][])
    .sort((a, c) => c[1] - a[1]);
  const [genre, top] = ranked[0];
  const margin = top - ranked[1][1];
  const confidence: ConfidenceLevel = margin >= 2 ? 'high' : margin >= 1 ? 'medium' : 'low';

  const reasoning = [
    `sub-bass vs mid ${subVsMid >= 0 ? '+' : ''}${subVsMid.toFixed(1)} dB`,
    `brilliance vs mid ${brillVsMid >= 0 ? '+' : ''}${brillVsMid.toFixed(1)} dB`,
    `stereo width ${(beat.stereo.width * 100).toFixed(0)}%`,
    `beat crest ${beat.loudness.crestFactor.toFixed(1)} dB`,
  ].join(' · ');

  return { genre: top > 0 ? genre : 'hip-hop', confidence, reasoning };
}

// ─── Deterministic "Smart Mix" Pipeline (no API key) ─────────────────────────

async function runSmartMix(
  vocalBlob: Blob,
  beatBlob: Blob,
  backupVocalBlob: Blob | null,
  iterations: number,
  onProgress: (log: AILog) => void
): Promise<AgentNetworkResult> {
  onProgress({
    agent: 'Analyzer',
    message: 'No Gemini API key found — running deterministic Smart Mix pipeline.',
    details: 'All decisions are computed locally from spectral, loudness, and stereo measurements.',
    phase: 'system',
  });

  const vocalBuffer = await decodeAudioBlob(vocalBlob);
  onProgress({ agent: 'Analyzer', message: `Vocal decoded — ${vocalBuffer.duration.toFixed(1)}s @ ${(vocalBuffer.sampleRate / 1000).toFixed(1)}kHz`, phase: 'analysis' });
  const beatBuffer = await decodeAudioBlob(beatBlob);
  onProgress({ agent: 'Analyzer', message: `Beat decoded — ${beatBuffer.duration.toFixed(1)}s @ ${(beatBuffer.sampleRate / 1000).toFixed(1)}kHz`, phase: 'analysis' });

  const vocalAnalysis = analyzeAudio(vocalBuffer);
  const beatAnalysis = analyzeAudio(beatBuffer);
  onProgress({
    agent: 'Analyzer',
    message: 'Audio measurements complete. Key findings:',
    details: [
      `Vocal: ${vocalAnalysis.loudness.rmsDB.toFixed(1)} dBFS RMS, ${vocalAnalysis.sibilance.hasSibilance ? 'sibilance detected' : 'no sibilance'}`,
      `Beat: ${beatAnalysis.loudness.rmsDB.toFixed(1)} dBFS RMS, stereo width ${(beatAnalysis.stereo.width * 100).toFixed(0)}%`,
      `Dynamic range: vocal ${vocalAnalysis.dynamicRange.toFixed(1)}dB, beat ${beatAnalysis.dynamicRange.toFixed(1)}dB`,
    ].join('\n'),
    phase: 'analysis',
  });

  // Skill-tree warm start, same recall mechanism as the LLM path.
  let matchedSkillId: string | null = null;
  const skillMatch = searchSkillTree(vocalAnalysis, beatAnalysis);
  if (skillMatch) {
    matchedSkillId = skillMatch.skill.id;
    markSkillUsed(skillMatch.skill.id);
    onProgress({
      agent: 'Skill Tree',
      message: `Prior skill recalled — ${Math.round(skillMatch.similarity * 100)}% spectral match`,
      details: `Match: ${skillMatch.matchReason}\n\nKey decisions from prior session:\n${skillMatch.skill.keyDecisions.map(d => `• ${d}`).join('\n')}\n\nSmart Mix will warm-start from the matched skill and refine.`,
      confidence: skillMatch.similarity > 0.88 ? 'high' : 'medium',
      phase: 'skill_match',
    });
  } else {
    incrementSessionCount();
  }

  // Heuristic genre detection from the measurements.
  const genreStart = Date.now();
  const { genre, confidence, reasoning: genreReasoning } =
    skillMatch && skillMatch.skill.genre in GENRE_LUFS_TARGETS && skillMatch.skill.genre !== 'custom'
      ? { genre: skillMatch.skill.genre as DetectableGenre, confidence: 'high' as ConfidenceLevel, reasoning: 'Inherited from matched skill' }
      : detectGenreHeuristic(vocalAnalysis, beatAnalysis);
  const detectedGenre: string = genre;

  onProgress({
    agent: 'Analyzer',
    message: `Detected genre: ${detectedGenre.toUpperCase()}`,
    details: `Target: ${GENRE_LUFS_TARGETS[detectedGenre] ?? -9} LUFS  ·  ${genreReasoning}`,
    confidence,
    phase: 'genre',
    durationMs: Date.now() - genreStart,
  });

  // Initial settings: genre preset, warm-started from a matched skill if any.
  let settings: MixSettings = applyGenrePreset(genre);
  if (skillMatch) {
    settings = deepMergeSettings(settings, skillMatch.skill.settings);
  }
  settings = deepMergeSettings(settings, {
    lufsTarget: GENRE_LUFS_TARGETS[detectedGenre] ?? settings.lufsTarget,
  });

  // Measurement-driven vocal-chain tweaks before the first render.
  if (vocalAnalysis.sibilance.hasSibilance) {
    settings = deepMergeSettings(settings, {
      deEsser: { enabled: true, frequency: vocalAnalysis.sibilance.peakFrequency },
    });
  }

  onProgress({
    agent: 'Mix Engineer (DSP)',
    message: `Initial mix strategy from ${skillMatch ? 'recalled skill + ' : ''}${detectedGenre} preset.`,
    details: [
      `EQ: HPF ${settings.vocalEQ.lowCutFreq}Hz  ·  mud ${settings.vocalEQ.lowMidGain >= 0 ? '+' : ''}${settings.vocalEQ.lowMidGain.toFixed(1)}dB`,
      `De-esser: ${settings.deEsser.enabled ? `enabled @ ${settings.deEsser.frequency}Hz` : 'disabled'}`,
      `Comp: ${settings.vocalCompressor.threshold}dB / ${settings.vocalCompressor.ratio}:1`,
      `Reverb ${Math.round(settings.reverb * 100)}%  ·  delay ${Math.round(settings.echo * 100)}%  ·  doubler ${Math.round(settings.doubler * 100)}%`,
      `LUFS target: ${settings.lufsTarget}  ·  master gain: ${settings.masterGain}`,
    ].join('\n'),
    confidence: skillMatch ? 'high' : 'medium',
    phase: 'mixing',
  });

  // Render → measure → score → correct loop.
  const EARLY_STOP_SCORE = 88;
  const MIN_IMPROVEMENT = 1.5;
  const maxPasses = Math.max(1, iterations);
  let lastScore: MixScore | null = null;
  let finalScore = 0;

  for (let pass = 1; pass <= maxPasses; pass++) {
    const passStart = Date.now();
    onProgress({
      agent: `Quality Control (Pass ${pass})`,
      message: 'Rendering current mix to measure and score...',
      phase: 'review',
    });

    const mixBlob = await mixAudio(vocalBlob, beatBlob, backupVocalBlob, settings);
    const mixBuffer = await decodeAudioBlob(mixBlob);
    const mixAnalysis = analyzeAudio(mixBuffer);
    const mixScore = scoreMix(mixAnalysis, detectedGenre);
    finalScore = mixScore.score;

    onProgress({
      agent: `Quality Control (Pass ${pass})`,
      message: formatScoreLine(mixScore),
      details: `Loudness ${mixAnalysis.loudness.estimatedLUFS.toFixed(1)} LUFS · crest ${mixAnalysis.loudness.crestFactor.toFixed(1)} dB · width ${(mixAnalysis.stereo.width * 100).toFixed(0)}%`,
      phase: 'review',
      durationMs: Date.now() - passStart,
    });

    const improvement = lastScore ? mixScore.score - lastScore.score : Infinity;
    if (mixScore.score >= EARLY_STOP_SCORE || (lastScore && improvement < MIN_IMPROVEMENT)) {
      onProgress({
        agent: `Quality Control (Pass ${pass})`,
        message: mixScore.score >= EARLY_STOP_SCORE
          ? `Mix converged (${mixScore.score}/100) — stopping early.`
          : `Diminishing returns (+${improvement.toFixed(1)} pts) — stopping early.`,
        confidence: 'high',
        phase: 'review',
      });
      lastScore = mixScore;
      break;
    }
    lastScore = mixScore;

    if (pass === maxPasses) break;

    // Deterministic DSP corrections targeted at the weakest score areas.
    const before: MixSettings = JSON.parse(JSON.stringify(settings));
    settings = deepMergeSettings(settings, applyDspCorrections(settings, mixScore));
    const deltas = computeParameterDeltas(before, settings);

    if (!deltas.length) {
      onProgress({
        agent: 'Mix Engineer (DSP)',
        message: 'No further corrections suggested — settings are stable.',
        confidence: 'high',
        phase: 'mixing',
      });
      break;
    }

    onProgress({
      agent: 'Mix Engineer (DSP)',
      message: `Applied ${deltas.length} measurement-driven correction${deltas.length === 1 ? '' : 's'}.`,
      details: `Weakest areas: ${Object.entries(mixScore.breakdown).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k, v]) => `${k} (${v}/100)`).join(', ')}`,
      parameterDeltas: deltas,
      phase: 'mixing',
    });
  }

  const reasoning = [
    `Smart Mix (deterministic) — genre ${detectedGenre} targeting ${GENRE_LUFS_TARGETS[detectedGenre] ?? -9} LUFS.`,
    skillMatch ? `Warm-started from prior skill (${Math.round(skillMatch.similarity * 100)}% match).` : 'No prior skill matched; started from genre preset.',
    vocalAnalysis.sibilance.hasSibilance ? `De-esser enabled at ${vocalAnalysis.sibilance.peakFrequency} Hz.` : 'No significant sibilance detected.',
    `Final objective score: ${finalScore}/100 after measurement-driven correction passes.`,
  ].join(' ');

  onProgress({
    agent: 'Quality Control',
    message: `Smart Mix complete. Final mix score: ${finalScore}/100.`,
    details: reasoning,
    confidence: finalScore >= 80 ? 'high' : finalScore >= 65 ? 'medium' : 'low',
    phase: 'mastering',
  });

  return {
    settings: deepMergeSettings(defaultMixSettings, settings),
    reasoning,
    matchedSkillId,
    detectedGenre,
    vocalAnalysis,
    beatAnalysis,
    finalScore,
  };
}

// ─── AI Agent Network ────────────────────────────────────────────────────────

export async function runAIAgentNetwork(
  vocalBlob: Blob,
  beatBlob: Blob,
  backupVocalBlob: Blob | null,
  iterations: number,
  onProgress: (log: AILog) => void
): Promise<AgentNetworkResult> {

  const apiKey = resolveApiKey();
  if (!apiKey) {
    // No key: never throw — fall back to the deterministic Smart Mix pipeline.
    return runSmartMix(vocalBlob, beatBlob, backupVocalBlob, iterations, onProgress);
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    let currentSettings: any = null;
    let analysisText = "";
    const vocalPart = await blobToGenerativePart(vocalBlob);
    const beatPart = await blobToGenerativePart(beatBlob);

    const contents: any[] = [];
    let promptAddon = "Track 1 is the raw main vocal recording. Track 2 is the instrumental beat.";

    if (backupVocalBlob) {
      const backupPart = await blobToGenerativePart(backupVocalBlob);
      contents.push(vocalPart, beatPart, backupPart);
      promptAddon += " Track 3 is the backup vocal recording.";
    } else {
      contents.push(vocalPart, beatPart);
    }

    // ── Pre-analysis: data-driven audio measurements ──
    const analystStartTime = Date.now();
    onProgress({
      agent: 'Acoustic Analyst',
      message: 'Running spectral analysis, loudness measurement, and sibilance detection on all tracks...',
      phase: 'analysis',
    });

    const vocalBuffer = await decodeAudioBlob(vocalBlob);
    onProgress({ agent: 'Acoustic Analyst', message: `Vocal decoded — ${vocalBuffer.duration.toFixed(1)}s @ ${(vocalBuffer.sampleRate / 1000).toFixed(1)}kHz`, phase: 'analysis' });
    const beatBuffer = await decodeAudioBlob(beatBlob);
    onProgress({ agent: 'Acoustic Analyst', message: `Beat decoded — ${beatBuffer.duration.toFixed(1)}s @ ${(beatBuffer.sampleRate / 1000).toFixed(1)}kHz`, phase: 'analysis' });

    const vocalAnalysis = analyzeAudio(vocalBuffer);
    onProgress({
      agent: 'Acoustic Analyst',
      message: `Vocal fingerprint computed`,
      details: [
        `RMS ${vocalAnalysis.loudness.rmsDB.toFixed(1)} dBFS  ·  crest ${vocalAnalysis.loudness.crestFactor.toFixed(1)} dB`,
        `Dominant freq: ${vocalAnalysis.spectral.dominantFrequency.toFixed(0)} Hz`,
        `Bass ${vocalAnalysis.spectral.bass.toFixed(1)} dB  ·  brilliance ${vocalAnalysis.spectral.brilliance.toFixed(1)} dB`,
        vocalAnalysis.sibilance.hasSibilance
          ? `⚠ Sibilance detected @ ${vocalAnalysis.sibilance.peakFrequency} Hz (${(vocalAnalysis.sibilance.severity * 100).toFixed(0)}% severity)`
          : `✓ No significant sibilance`,
        `Stereo width: ${(vocalAnalysis.stereo.width * 100).toFixed(0)}%  ·  corr: ${vocalAnalysis.stereo.correlation.toFixed(2)}`,
      ].join('\n'),
      phase: 'analysis',
    });
    const beatAnalysis = analyzeAudio(beatBuffer);
    onProgress({
      agent: 'Acoustic Analyst',
      message: `Beat fingerprint computed`,
      details: [
        `RMS ${beatAnalysis.loudness.rmsDB.toFixed(1)} dBFS  ·  crest ${beatAnalysis.loudness.crestFactor.toFixed(1)} dB`,
        `Sub-bass ${beatAnalysis.spectral.subBass.toFixed(1)} dB  ·  bass ${beatAnalysis.spectral.bass.toFixed(1)} dB`,
        `Level gap (vocal − beat): ${(vocalAnalysis.loudness.rmsDB - beatAnalysis.loudness.rmsDB).toFixed(1)} dB`,
        `Beat stereo: ${(beatAnalysis.stereo.width * 100).toFixed(0)}% wide`,
      ].join('\n'),
      phase: 'analysis',
    });

    const vocalAnalysisStr = formatAnalysis('VOCAL', vocalAnalysis);
    const beatAnalysisStr = formatAnalysis('BEAT', beatAnalysis);

    let backupAnalysisStr = "";
    if (backupVocalBlob) {
      const backupBuffer = await decodeAudioBlob(backupVocalBlob);
      const backupAnalysis = analyzeAudio(backupBuffer);
      backupAnalysisStr = formatAnalysis('BACKUP VOCAL', backupAnalysis);
    }

    onProgress({
      agent: 'Acoustic Analyst',
      message: 'Audio measurements complete. Key findings:',
      details: [
        `Vocal: ${vocalAnalysis.loudness.rmsDB.toFixed(1)} dBFS RMS, ${vocalAnalysis.sibilance.hasSibilance ? '⚠️ sibilance detected' : '✅ no sibilance'}`,
        `Beat: ${beatAnalysis.loudness.rmsDB.toFixed(1)} dBFS RMS, stereo width ${(beatAnalysis.stereo.width * 100).toFixed(0)}%`,
        `Dynamic range: vocal ${vocalAnalysis.dynamicRange.toFixed(1)}dB, beat ${beatAnalysis.dynamicRange.toFixed(1)}dB`,
      ].join('\n'),
    });

    // ── Skill tree search — direct recall on similar task ──
    let matchedSkillId: string | null = null;
    let skillPriorContext = '';
    const userPrefContext = formatUserPrefsAsContext(loadSkillTree().preferences);

    const skillMatch = searchSkillTree(vocalAnalysis, beatAnalysis);
    if (skillMatch) {
      matchedSkillId = skillMatch.skill.id;
      markSkillUsed(skillMatch.skill.id);
      skillPriorContext = formatSkillAsAgentContext(skillMatch);
      onProgress({
        agent: 'Skill Tree',
        message: `Prior skill recalled — ${Math.round(skillMatch.similarity * 100)}% spectral match`,
        details: `Match: ${skillMatch.matchReason}\n\nKey decisions from prior session:\n${skillMatch.skill.keyDecisions.map(d => `• ${d}`).join('\n')}\n\nThis session will warm-start from the matched skill and refine.`,
        confidence: skillMatch.similarity > 0.88 ? 'high' : 'medium',
        phase: 'skill_match',
      });
      await delay(1000);
    } else {
      incrementSessionCount();
    }

    let detectedGenre = 'hip-hop';

    // Objective scoring state for the iteration loop.
    let lastMixScore: MixScore | null = null;
    const EARLY_STOP_SCORE = 88;   // a mix this good needs no further passes
    const MIN_IMPROVEMENT = 1.5;   // stop if a pass barely moves the needle

    for (let i = 1; i <= 1 + iterations; i++) {
      if (i === 1) {
        // ── Agent 1: Acoustic Analyst + AI listening ──
        onProgress({
          agent: 'Acoustic Analyst',
          message: 'Combining AI listening with numerical analysis for comprehensive assessment...',
          phase: 'analysis',
        });

        const analysisPrompt = `You are an expert acoustic analyst and mix engineer. Listen to these audio tracks and analyze them in combination with the numerical measurements provided.

${promptAddon}

${skillPriorContext ? skillPriorContext + '\n\n' : ''}${userPrefContext ? userPrefContext + '\n\n' : ''}═══ NUMERICAL AUDIO MEASUREMENTS ═══

${vocalAnalysisStr}

${beatAnalysisStr}

${backupAnalysisStr ? backupAnalysisStr : ''}

═══ YOUR TASK ═══
Based on BOTH your listening AND the measurements above:
1. Identify frequency clashes between vocal and beat (especially in the 200-500Hz and 2-5kHz ranges)
2. Assess whether the vocal needs de-essing (check the sibilance analysis)
3. Determine the genre and energy level to select the right preset approach
4. Identify dynamic range issues (is the vocal too dynamic? too compressed already?)
5. Assess stereo balance (is the beat mono? does it need widening? is bass centered?)
6. Note the loudness differential between vocal and beat to set volume balance

Provide a detailed acoustic assessment with specific frequency recommendations.`;

        onProgress({ agent: 'Acoustic Analyst', message: 'Querying Gemini — AI listening pass on raw tracks...', phase: 'analysis' });
        const analysisResponse = await generateContentWithCycle(ai, {
          contents: [{ text: analysisPrompt }, ...contents]
        });

        analysisText = analysisResponse.text || "Analysis completed.";
        onProgress({
          agent: 'Acoustic Analyst',
          message: 'Comprehensive acoustic analysis complete.',
          details: analysisText,
          phase: 'analysis',
          durationMs: Date.now() - analystStartTime,
        });

        // ── Agent 1b: Genre Intelligence ──
        const genreStartTime = Date.now();
        const memoryProfiles = loadAgentMemory();
        const matchedProfile = findClosestProfile(memoryProfiles, vocalAnalysis, beatAnalysis);

        if (matchedProfile) {
          detectedGenre = matchedProfile.genre;
          onProgress({
            agent: 'Genre Intelligence',
            message: `Memory hit: loaded ${detectedGenre} profile from previous session.`,
            details: `Matched on spectral fingerprint — dominant freq ${matchedProfile.spectralFingerprint.dominantFreq.toFixed(0)}Hz. LUFS target: ${matchedProfile.settingsSnapshot.lufsTarget}`,
            confidence: 'high',
            phase: 'genre',
            durationMs: Date.now() - genreStartTime,
          });
        } else {
          onProgress({
            agent: 'Genre Intelligence',
            message: 'Analyzing spectral fingerprint to detect genre...',
            phase: 'genre',
          });

          const genrePrompt = `You are a music genre expert. Analyze the following audio measurements and acoustic analysis to determine the genre of this track.

${vocalAnalysisStr}

${beatAnalysisStr}

═══ ACOUSTIC ANALYSIS ═══
${analysisText}

Based on the spectral characteristics, dynamic range, frequency distribution, and overall sonic profile — detect the genre.
- Sub-bass heavy + mid-range vocal = hip-hop
- Bright highs + tight compression = pop
- Wide stereo + heavy sub + brilliance = electronic
- Natural dynamics + minimal low end = acoustic

Output JSON only.`;

          onProgress({ agent: 'Genre Intelligence', message: 'Querying Gemini — genre classification from fingerprint...', phase: 'genre' });
          const genreResponse = await generateContentWithCycle(ai, {
            contents: [{ text: genrePrompt }],
            config: {
              responseMimeType: "application/json",
              responseSchema: enforceRequired(genreAnalysisSchema) as any,
            }
          });

          const genreResult = parseSafeJSON(genreResponse.text || '{}');
          detectedGenre = genreResult.detectedGenre || 'hip-hop';

          onProgress({
            agent: 'Genre Intelligence',
            message: `Detected genre: ${detectedGenre.toUpperCase()}`,
            details: `Target: ${GENRE_LUFS_TARGETS[detectedGenre] ?? -9} LUFS  ·  ${genreResult.genreReasoning || ''}`,
            confidence: (genreResult.confidence as ConfidenceLevel) || 'medium',
            thoughtProcess: JSON.stringify(genreResult, null, 2),
            phase: 'genre',
            durationMs: Date.now() - genreStartTime,
          });
        }

        await delay(2500);

        // ── Agent 2: Mix Engineer (data-driven initial draft) ──
        const mixStartTime = Date.now();
        onProgress({
          agent: 'Mix Engineer',
          message: 'Drafting mix strategy using acoustic analysis and measurements...',
          phase: 'mixing',
        });

        const mixSchema = enforceRequired({
          type: "OBJECT",
          properties: {
            settings: {
              type: "OBJECT",
              properties: mixSettingsSchemaProperties
            },
            reasoning: detailedReasoningSchema,
            confidence: { type: "STRING", description: "Your overall confidence in these settings: 'high', 'medium', or 'low'" },
            confidenceReason: { type: "STRING", description: "Brief reason for your confidence level" },
          }
        });

        const mixPrompt = `You are a professional Mix Engineer creating settings for an automated mixing engine. You must produce optimal settings based on the acoustic analysis and measurements.

═══ ACOUSTIC ANALYSIS ═══
${analysisText}

═══ NUMERICAL MEASUREMENTS ═══
${vocalAnalysisStr}
${beatAnalysisStr}

═══ YOUR DECISIONS ═══

You are configuring a PROFESSIONAL mixing and mastering chain with these stages:

VOCAL CHAIN:
- High-pass filter (lowCutFreq): Set based on the vocal's sub-bass content. Typical: 80-120Hz.
- Subtractive EQ (lowMidFreq/lowMidGain): CUT problematic frequencies (mud at 200-500Hz). Always cut FIRST.
- De-Esser (frequency/threshold/ratio): Enable if sibilance was detected. Target the peak sibilance frequency.
- Compressor (threshold/ratio/attack/release/knee): 1176-style for vocal control.
- Parallel compression (enabled/wetDry/threshold/ratio): Blend in heavily compressed signal for body.
- Presence EQ (presenceFreq/presenceGain): Boost vocal clarity at 3-5kHz.
- Air EQ (airFreq/airGain): High shelf for sparkle and air, typically 10-14kHz.
- Saturation/drive: Tape warmth. Use subtly (0.1-0.3) unless the genre calls for more.
- Reverb (send level, predelay, decay, damping): Match the energy. Hip-hop = short/tight, pop = medium, acoustic = long.
- Delay/Echo: Rhythmic enhancement.
- Doubler: For width and fullness.

BEAT CHAIN:
- Beat EQ: CUT the high-mid range where the vocal sits (2-4kHz) to create SPACE for the vocal.
- Beat compressor: Control dynamics.
- Sidechain duck: Subtle ducking (0.1-0.25) when vocal is present.

MASTERING CHAIN:
- Stereo imaging (width, bassMonoCutoff): Widen for impact, mono below 100-150Hz.
- Master multiband compressor: Tighten low end, control mids, smooth highs.
- Master EQ: Sweetening. Very subtle moves (±2dB max).
- Soft clipper: Shave transient peaks before limiter (0.1-0.3).
- Limiter ceiling: -1.0 dBTP for streaming safety.
- LUFS target: ${GENRE_LUFS_TARGETS[detectedGenre] ?? -9} LUFS (${detectedGenre.toUpperCase()} genre standard)

═══ MEASURED DATA — RESPOND TO THESE SPECIFICALLY ═══
Vocal RMS: ${vocalAnalysis.loudness.rmsDB.toFixed(1)} dBFS  |  Beat RMS: ${beatAnalysis.loudness.rmsDB.toFixed(1)} dBFS
Level gap: ${(vocalAnalysis.loudness.rmsDB - beatAnalysis.loudness.rmsDB).toFixed(1)} dB (vocal vs beat) — vocal should typically sit 2–5 dB LOUDER in RMS
${vocalAnalysis.sibilance.hasSibilance
  ? `⚠️  SIBILANCE DETECTED at ${vocalAnalysis.sibilance.peakFrequency} Hz (severity ${(vocalAnalysis.sibilance.severity * 100).toFixed(0)}%) — ENABLE de-esser, set frequency to ${vocalAnalysis.sibilance.peakFrequency} Hz, threshold ≈ -20 dB`
  : `✅  No significant sibilance — de-esser can be gentle (threshold -28 to -32 dB) or disabled`}
Vocal crest factor: ${vocalAnalysis.loudness.crestFactor.toFixed(1)} dB ${vocalAnalysis.loudness.crestFactor > 20 ? '(very dynamic — use more compression)' : vocalAnalysis.loudness.crestFactor < 8 ? '(already compressed — use gentle settings)' : '(normal dynamics)'}
Vocal stereo: ${(vocalAnalysis.stereo.width * 100).toFixed(0)}% wide${vocalAnalysis.stereo.correlation > 0.95 ? ' (mono vocal — good for centering)' : ''}

CRITICAL RULES:
- If sibilance was detected, ENABLE the de-esser and set frequency to the detected peak.
- Beat high-mid gain should be NEGATIVE to carve space for vocals (cut 2–4 kHz on beat).
- Reverb pre-delay should be 15-30ms to keep vocal upfront, not buried in reverb.
- Parallel compression wetDry should be 0.15-0.35 (subtle NY-style blend).
- Bass mono cutoff should be 100-180Hz for tight, focused low end.
- Set lufsTarget to ${GENRE_LUFS_TARGETS[detectedGenre] ?? -9} LUFS for ${detectedGenre}.
- Keep all moves MUSICAL. Less is more in mastering.

Output JSON only.`;

        onProgress({ agent: 'Mix Engineer', message: 'Querying Gemini — constructing full mix strategy...', phase: 'mixing' });
        const mixResponse = await generateContentWithCycle(ai, {
          contents: [{ text: mixPrompt }],
          config: {
            responseMimeType: "application/json",
            responseSchema: mixSchema as any,
          }
        });

        const draftMix = parseSafeJSON(mixResponse.text || "{}");
        currentSettings = draftMix.settings;

        onProgress({
          agent: 'Mix Engineer',
          message: 'Initial mix strategy complete.',
          details: [
            `EQ: HPF ${currentSettings?.vocalEQ?.lowCutFreq || 100}Hz  ·  mud ${currentSettings?.vocalEQ?.lowMidGain >= 0 ? '+' : ''}${(currentSettings?.vocalEQ?.lowMidGain ?? 0).toFixed(1)}dB`,
            `De-esser: ${currentSettings?.deEsser?.enabled ? `enabled @ ${currentSettings?.deEsser?.frequency}Hz  thresh ${currentSettings?.deEsser?.threshold}dB` : 'disabled'}`,
            `Comp: ${currentSettings?.vocalCompressor?.threshold ?? -24}dB / ${currentSettings?.vocalCompressor?.ratio ?? 4}:1`,
            `Reverb ${Math.round((currentSettings?.reverb ?? 0.25) * 100)}%  ·  delay ${Math.round((currentSettings?.echo ?? 0.1) * 100)}%  ·  doubler ${Math.round((currentSettings?.doubler ?? 0.2) * 100)}%`,
            `LUFS target: ${currentSettings?.lufsTarget ?? -9}  ·  master gain: ${currentSettings?.masterGain ?? 1.0}`,
          ].join('\n'),
          confidence: (draftMix.confidence as ConfidenceLevel) || 'medium',
          thoughtProcess: JSON.stringify(draftMix.reasoning, null, 2),
          phase: 'mixing',
          durationMs: Date.now() - mixStartTime,
        });

        await delay(2500);

      } else {
        // ── Agent 4: Review Engineer (score-driven iterative refinement) ──
        const reviewStartTime = Date.now();
        onProgress({
          agent: `Review Engineer (Pass ${i})`,
          message: `Rendering current mix to measure and refine...`,
          phase: 'review',
        });

        // Render + analyze + score the current mix.
        const fullSettings: MixSettings = deepMergeSettings(defaultMixSettings, currentSettings);
        const currentMixBlob = await mixAudio(vocalBlob, beatBlob, backupVocalBlob, fullSettings);
        const mixBuffer = await decodeAudioBlob(currentMixBlob);
        const mixAnalysis = analyzeAudio(mixBuffer);
        const mixAnalysisStr = formatAnalysis('CURRENT MIX', mixAnalysis);
        const mixScore = scoreMix(mixAnalysis, detectedGenre);

        onProgress({
          agent: `Review Engineer (Pass ${i})`,
          message: formatScoreLine(mixScore),
          details: `Loudness ${mixAnalysis.loudness.estimatedLUFS.toFixed(1)} LUFS · crest ${mixAnalysis.loudness.crestFactor.toFixed(1)} dB · width ${(mixAnalysis.stereo.width * 100).toFixed(0)}%`,
          phase: 'review',
        });

        // Early stop: converged, or diminishing returns.
        const improvement = lastMixScore ? mixScore.score - lastMixScore.score : Infinity;
        if (mixScore.score >= EARLY_STOP_SCORE || (lastMixScore && improvement < MIN_IMPROVEMENT)) {
          onProgress({
            agent: `Review Engineer (Pass ${i})`,
            message: mixScore.score >= EARLY_STOP_SCORE
              ? `Mix converged (${mixScore.score}/100) — stopping early to save passes.`
              : `Diminishing returns (+${improvement.toFixed(1)} pts) — stopping early.`,
            confidence: 'high',
            phase: 'review',
            durationMs: Date.now() - reviewStartTime,
          });
          lastMixScore = mixScore;
          break;
        }

        // Deterministic DSP corrections (free — no LLM tokens).
        const beforeCorrections = JSON.parse(JSON.stringify(currentSettings));
        currentSettings = deepMergeSettings(currentSettings, applyDspCorrections(fullSettings, mixScore));

        // LLM refinement: text-only (no audio re-upload) to cut token cost.
        const reviewSchema = enforceRequired({
          type: "OBJECT",
          properties: {
            settings: { type: "OBJECT", properties: mixSettingsSchemaProperties },
            reasoning: detailedReasoningSchema,
            critique: { type: "STRING", description: "Specific critique of the current mix and what was changed." },
            confidence: { type: "STRING", description: "Confidence in these refined settings: 'high', 'medium', or 'low'" },
          }
        });

        const targetLufs = GENRE_LUFS_TARGETS[detectedGenre] ?? -9;
        const lufsGap = targetLufs - mixAnalysis.loudness.estimatedLUFS;
        const weakest = Object.entries(mixScore.breakdown)
          .sort((a, b) => a[1] - b[1]).slice(0, 2)
          .map(([k, v]) => `${k} (${v}/100)`).join(', ');

        const reviewPrompt = `You are a Senior Mix Engineer refining a mix from its OBJECTIVE MEASUREMENTS (no audio is provided this pass — reason from the numbers).

═══ OBJECTIVE MIX SCORE ═══
${formatScoreLine(mixScore)}
Prioritise the weakest areas: ${weakest}

═══ CURRENT MIX MEASUREMENTS ═══
${mixAnalysisStr}

═══ LOUDNESS TARGET ═══
Genre: ${detectedGenre.toUpperCase()}  ·  Target ${targetLufs} LUFS  ·  Current ${mixAnalysis.loudness.estimatedLUFS.toFixed(1)} LUFS  ·  Gap ${lufsGap > 0 ? '+' : ''}${lufsGap.toFixed(1)} dB

═══ ORIGINAL TRACK MEASUREMENTS ═══
${vocalAnalysisStr}
${beatAnalysisStr}

═══ CURRENT SETTINGS (deterministic auto-corrections already applied) ═══
${JSON.stringify(currentSettings, null, 2)}

═══ YOUR TASK ═══
Improve the WEAKEST scoring areas first. Adjust only what the measurements justify:
1. Loudness gap ${lufsGap > 0 ? '+' : ''}${lufsGap.toFixed(1)} dB → tune masterGain / lufsTarget.
2. Dynamics: crest ${mixAnalysis.loudness.crestFactor.toFixed(1)} dB (aim 6–10 dB) → vocal compressor.
3. Sibilance severity ${(mixAnalysis.sibilance.severity * 100).toFixed(0)}% → de-esser threshold/ratio.
4. Stereo width ${(mixAnalysis.stereo.width * 100).toFixed(0)}% → stereoImaging.width.
5. Vocal clarity vs beat: carve beat 2–4 kHz, set vocal presence.

Provide UPDATED settings. Be specific about what you changed and why.
Output JSON only.`;

        onProgress({ agent: `Review Engineer (Pass ${i})`, message: 'Querying Gemini — text-only refinement (no audio upload)...', phase: 'review' });
        const reviewResponse = await generateContentWithCycle(ai, {
          contents: [{ text: reviewPrompt }],
          config: {
            responseMimeType: "application/json",
            responseSchema: reviewSchema as any,
          }
        });

        const updatedMix = parseSafeJSON(reviewResponse.text || "{}");
        currentSettings = deepMergeSettings(currentSettings, updatedMix.settings);
        const paramDeltas = computeParameterDeltas(beforeCorrections, currentSettings);

        onProgress({
          agent: `Review Engineer (Pass ${i})`,
          message: `Mix refinement complete (score was ${mixScore.score}/100).`,
          details: `Critique: ${updatedMix.critique || '—'}`,
          confidence: (updatedMix.confidence as ConfidenceLevel) || 'medium',
          thoughtProcess: JSON.stringify(updatedMix.reasoning, null, 2),
          parameterDeltas: paramDeltas,
          phase: 'review',
          durationMs: Date.now() - reviewStartTime,
        });

        lastMixScore = mixScore;
        await delay(2000);
      }
    }

    // ── Agent 3: Mastering Engineer (final polish) ──
    const masterStartTime = Date.now();
    onProgress({
      agent: 'Mastering Engineer',
      message: 'Rendering mix for mastering review...',
      phase: 'mastering',
    });

    // Render with accumulated settings so the mastering engineer can LISTEN
    // to what they're working with, rather than deciding blind from text alone.
    const preMasterSettings: MixSettings = deepMergeSettings(defaultMixSettings, currentSettings);
    const preMasterBlob = await mixAudio(vocalBlob, beatBlob, backupVocalBlob, preMasterSettings);
    const preMasterPart = await blobToGenerativePart(preMasterBlob);
    const preMasterBuffer = await decodeAudioBlob(preMasterBlob);
    const preMasterAnalysis = analyzeAudio(preMasterBuffer);
    const preMasterAnalysisStr = formatAnalysis('PRE-MASTER MIX', preMasterAnalysis);

    const preMasterLufsGap = (GENRE_LUFS_TARGETS[detectedGenre] ?? -9) - preMasterAnalysis.loudness.estimatedLUFS;
    const preMasterScore = scoreMix(preMasterAnalysis, detectedGenre);

    onProgress({
      agent: 'Mastering Engineer',
      message: 'Applying final mastering decisions...',
      details: `${formatScoreLine(preMasterScore)}\nPre-master mix: ${preMasterAnalysis.loudness.estimatedLUFS.toFixed(1)} LUFS, crest ${preMasterAnalysis.loudness.crestFactor.toFixed(1)} dB, stereo ${(preMasterAnalysis.stereo.width * 100).toFixed(0)}%`,
      phase: 'mastering',
    });

    // Mastering-only schema so the agent cannot reset the vocal chain.
    const masteringOnlyProperties = {
      stereoImaging: mixSettingsSchemaProperties.stereoImaging,
      masterMultiband: mixSettingsSchemaProperties.masterMultiband,
      masterEQ: mixSettingsSchemaProperties.masterEQ,
      masterLimiter: mixSettingsSchemaProperties.masterLimiter,
      masterGain: mixSettingsSchemaProperties.masterGain,
      softClipAmount: mixSettingsSchemaProperties.softClipAmount,
      lufsTarget: mixSettingsSchemaProperties.lufsTarget,
    };

    const masterSchema = enforceRequired({
      type: "OBJECT",
      properties: {
        settings: {
          type: "OBJECT",
          properties: masteringOnlyProperties
        },
        masteringNotes: { type: "STRING", description: "Detailed mastering notes covering EQ, dynamics, stereo, and loudness decisions." }
      }
    });

    const masterPrompt = `You are a Grammy-winning Mastering Engineer. Listen to the pre-master mix and apply final mastering polish.

═══ PRE-MASTER MIX MEASUREMENTS ═══
${preMasterAnalysisStr}

═══ TARGET ═══
Genre: ${detectedGenre.toUpperCase()}
LUFS target: ${GENRE_LUFS_TARGETS[detectedGenre] ?? -9} LUFS
Current LUFS: ${preMasterAnalysis.loudness.estimatedLUFS.toFixed(1)} LUFS
Gap: ${preMasterLufsGap > 0 ? '+' : ''}${preMasterLufsGap.toFixed(1)} dB ${Math.abs(preMasterLufsGap) > 2 ? `⚠️ ${preMasterLufsGap > 0 ? 'increase masterGain' : 'reduce masterGain'}` : '✅ close to target'}

═══ ORIGINAL SOURCE MEASUREMENTS ═══
Vocal: RMS ${vocalAnalysis.loudness.rmsDB.toFixed(1)} dBFS, Peak ${vocalAnalysis.loudness.peakDB.toFixed(1)} dBFS
Beat: RMS ${beatAnalysis.loudness.rmsDB.toFixed(1)} dBFS, Peak ${beatAnalysis.loudness.peakDB.toFixed(1)} dBFS

═══ YOUR MASTERING DECISIONS ═══

Listen to the pre-master mix above. Your job is ONLY to tune the mastering chain — the vocal
EQ, compression, and spatial effects are already set by the Mix Engineer.

Focus on:

1. MASTER MULTIBAND COMPRESSION:
   - Low band (<250Hz): Tighten bass. Slower attack (0.02–0.04s), moderate ratio (1.5–2.5).
   - Mid band (250–4kHz): Glue vocal + beat. Moderate attack (0.008–0.02s), ratio 1.5–2.0.
   - High band (>4kHz): Smooth harshness. Fast attack (0.003–0.01s), ratio 1.5–2.0.

2. MASTER EQ (Sweetening only — ±2dB max):
   - Low shelf: Add warmth or cut mud based on what you hear.
   - High shelf: Air/sparkle or tame harshness.

3. STEREO IMAGING:
   - Width 1.0–1.3 (appropriate for ${detectedGenre}).
   - Bass mono cutoff 100–160Hz for tight low end.

4. SOFT CLIPPER: 0.1–0.3 to shave transient peaks before limiter.

5. LIMITER: Ceiling -1.0 dBTP, release 0.03–0.08s for transparency.

6. LUFS TARGET: Set to ${GENRE_LUFS_TARGETS[detectedGenre] ?? -9} LUFS.
   Adjust masterGain to compensate for the ${Math.abs(preMasterLufsGap).toFixed(1)} dB gap.

CRITICAL: Do NOT over-process. The mix engineer did the heavy lifting.
Mastering is final polish — coherence, loudness, and subtle tonal balance.

Output JSON only.`;

    onProgress({ agent: 'Mastering Engineer', message: 'Querying Gemini — listening to pre-master audio...', phase: 'mastering' });
    const masterResponse = await generateContentWithCycle(ai, {
      contents: [{ text: masterPrompt }, preMasterPart],
      config: {
        responseMimeType: "application/json",
        responseSchema: masterSchema as any,
      }
    });

    const finalResult = parseSafeJSON(masterResponse.text || "{}");
    // Merge mastering output ON TOP of accumulated Mix/Review Engineer settings.
    const finalSettings = deepMergeSettings(
      deepMergeSettings(defaultMixSettings, currentSettings),
      finalResult.settings
    );

    onProgress({
      agent: 'Mastering Engineer',
      message: `Mastering and final approval complete. Final mix score: ${preMasterScore.score}/100.`,
      details: finalResult.masteringNotes,
      confidence: preMasterScore.score >= 80 ? 'high' : preMasterScore.score >= 65 ? 'medium' : 'low',
      phase: 'mastering',
      durationMs: Date.now() - masterStartTime,
    });

    // Skill crystallization is handled by the app after user feedback.
    return {
      settings: finalSettings,
      reasoning: finalResult.masteringNotes,
      matchedSkillId,
      detectedGenre,
      vocalAnalysis,
      beatAnalysis,
      finalScore: preMasterScore.score,
    };

  } catch (error: any) {
    console.error("AI Agent Network Error:", error);

    const errorMessage = error?.message || '';
    if (error?.status === 429 || errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("API Quota Exceeded (429). All available Gemini models hit rate limits. Please try reducing the 'AI Iterations' slider to 1, or wait a minute before trying again.");
    }

    throw error;
  }
}

// ─── Agent Memory Helpers ────────────────────────────────────────────────────

function loadAgentMemory(): AgentMemoryProfile[] {
  try {
    const raw = localStorage.getItem('agent_memory_profiles');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function findClosestProfile(
  profiles: AgentMemoryProfile[],
  vocalAnalysis: FullAudioAnalysis,
  beatAnalysis: FullAudioAnalysis
): AgentMemoryProfile | null {
  if (!profiles.length) return null;
  const dominantFreq = vocalAnalysis.spectral.dominantFrequency;
  const subBassRatio = vocalAnalysis.spectral.subBass / Math.max(beatAnalysis.loudness.rmsDB + 60, 1);
  const brillianceRatio = vocalAnalysis.spectral.brilliance / Math.max(beatAnalysis.loudness.rmsDB + 60, 1);
  for (const p of profiles) {
    const freqMatch = Math.abs(p.spectralFingerprint.dominantFreq - dominantFreq) < 200;
    const bassMatch = Math.abs(p.spectralFingerprint.subBassRatio - subBassRatio) < 0.15;
    const brillMatch = Math.abs(p.spectralFingerprint.brillianceRatio - brillianceRatio) < 0.20;
    if (freqMatch && bassMatch && brillMatch) return p;
  }
  return null;
}

// ─── Parameter Delta Computation ─────────────────────────────────────────────

const PARAM_META: Record<string, { label: string; unit: string }> = {
  vocalVolume:               { label: 'Vocal Level',       unit: '%'    },
  beatVolume:                { label: 'Beat Level',        unit: '%'    },
  reverb:                    { label: 'Reverb',            unit: '%'    },
  echo:                      { label: 'Delay',             unit: '%'    },
  doubler:                   { label: 'Doubler',           unit: '%'    },
  saturation:                { label: 'Saturation',        unit: '%'    },
  masterGain:                { label: 'Master Gain',       unit: 'x'    },
  lufsTarget:                { label: 'LUFS Target',       unit: 'LUFS' },
  sidechainDuck:             { label: 'Sidechain Duck',    unit: '%'    },
  'vocalEQ.presenceGain':    { label: 'Presence',          unit: 'dB'   },
  'vocalEQ.airGain':         { label: 'Air',               unit: 'dB'   },
  'vocalEQ.lowMidGain':      { label: 'Mud Cut',           unit: 'dB'   },
  'vocalEQ.lowCutFreq':      { label: 'HPF',               unit: 'Hz'   },
  'vocalCompressor.threshold': { label: 'Comp Threshold',  unit: 'dB'   },
  'vocalCompressor.ratio':   { label: 'Comp Ratio',        unit: ':1'   },
  'stereoImaging.width':     { label: 'Stereo Width',      unit: '%'    },
};

function computeParameterDeltas(before: any, after: any): ParameterDelta[] {
  const deltas: ParameterDelta[] = [];
  for (const [key, meta] of Object.entries(PARAM_META)) {
    const parts = key.split('.');
    let bVal: any = before;
    let aVal: any = after;
    for (const p of parts) { bVal = bVal?.[p]; aVal = aVal?.[p]; }
    if (typeof bVal === 'number' && typeof aVal === 'number' && Math.abs(aVal - bVal) > 0.01) {
      deltas.push({ param: key, label: meta.label, before: bVal, after: aVal, unit: meta.unit });
    }
  }
  return deltas
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, 6);
}

/** Deep merge settings, preserving target fields and applying overrides. */
function deepMergeSettings(target: MixSettings, source: any): MixSettings {
  const result: any = { ...target };
  if (!source) return result;

  for (const key of Object.keys(source)) {
    if (source[key] !== null && source[key] !== undefined) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key]) && typeof result[key] === 'object') {
        result[key] = { ...result[key], ...source[key] };
      } else {
        result[key] = source[key];
      }
    }
  }
  return result as MixSettings;
}
