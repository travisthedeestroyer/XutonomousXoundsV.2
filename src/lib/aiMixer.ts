// ═══════════════════════════════════════════════════════════════════════════════
// XutonomousXound — AI Agent Network for Intelligent Mix Engineering
// ═══════════════════════════════════════════════════════════════════════════════
// Multi-agent system using Gemini AI with data-driven audio analysis to
// produce professional mixing and mastering decisions.
// ═══════════════════════════════════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';
import {
  MixSettings,
  mixAudio,
  defaultMixSettings,
  analyzeAudio,
  FullAudioAnalysis,
  GenrePreset,
  applyGenrePreset,
} from './audioUtils';
import {
  searchSkillTree,
  formatSkillAsAgentContext,
  formatUserPrefsAsContext,
  extractSig,
  markSkillUsed,
  incrementSessionCount,
  loadSkillTree,
  SkillMatchResult,
} from './agentMemory';

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
}

async function audioBufferToWavBlob(buffer: AudioBuffer): Promise<Blob> {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const bufferSize = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  const writeString = (v: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) v.setUint8(offset + i, string.charCodeAt(i));
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const offset = 44;
  const channels = [];
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));
  
  let pos = offset;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = Math.max(-1, Math.min(1, channels[channel][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function blobToGenerativePart(blob: Blob) {
  let targetBlob = blob;
  const mime = blob.type || 'audio/webm';
  
  // Gemini does not support webm. Convert to wav if needed.
  if (mime.includes('webm') || !blob.type) {
    const buffer = await decodeBlob(blob);
    targetBlob = await audioBufferToWavBlob(buffer);
  }

  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        resolve({
          inlineData: {
            data: base64,
            mimeType: targetBlob.type || 'audio/wav'
          }
        });
      } else {
        reject(new Error("Failed to read blob as base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(targetBlob);
  });
}

/**
 * Decode a Blob to an AudioBuffer for analysis.
 */
async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) throw new Error("AudioContext not supported");
  const ctx = new AudioContextClass();
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  ctx.close();
  return buffer;
}

/**
 * Format an audio analysis into a concise but data-rich string for AI consumption.
 */
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

  // Vocal EQ
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

  // De-Esser
  deEsser: {
    type: "OBJECT",
    properties: {
      frequency: { type: "NUMBER", description: "De-esser center frequency (4000-10000 Hz)" },
      threshold: { type: "NUMBER", description: "De-esser threshold (-40 to -10 dB)" },
      ratio: { type: "NUMBER", description: "De-esser ratio (2-10)" },
      enabled: { type: "BOOLEAN", description: "Enable de-essing" },
    }
  },

  // Vocal Compressor
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

  // Parallel Compression
  parallelCompression: {
    type: "OBJECT",
    properties: {
      enabled: { type: "BOOLEAN", description: "Enable parallel/NY compression" },
      wetDry: { type: "NUMBER", description: "Blend amount 0.0-1.0" },
      threshold: { type: "NUMBER", description: "-40 to -20 dB" },
      ratio: { type: "NUMBER", description: "8 to 20" },
    }
  },

  // Saturation
  saturation: { type: "NUMBER", description: "Tape saturation amount 0.0-1.0" },
  saturationDrive: { type: "NUMBER", description: "Drive intensity 0.0-1.0" },

  // Spatial
  reverb: { type: "NUMBER", description: "Reverb send level 0.0-1.0" },
  reverbPreDelay: { type: "NUMBER", description: "Pre-delay ms 0-80" },
  reverbDecay: { type: "NUMBER", description: "Decay time 0.5-5.0 seconds" },
  reverbDamping: { type: "NUMBER", description: "HF damping 0.0-1.0" },
  echo: { type: "NUMBER", description: "Delay send level 0.0-1.0" },
  echoTime: { type: "NUMBER", description: "Delay time 0.1-1.0 seconds" },
  echoFeedback: { type: "NUMBER", description: "Delay feedback 0.0-0.7" },
  doubler: { type: "NUMBER", description: "Vocal doubler/widener 0.0-1.0" },

  // Beat Chain
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

  // Mastering
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

export async function runAIAgentNetwork(
  vocalBlob: Blob,
  beatBlob: Blob,
  backupVocalBlob: Blob | null,
  iterations: number,
  onProgress: (log: AILog) => void
): Promise<{ settings: MixSettings, reasoning: string, matchedSkillId: string | null, detectedGenre: string, vocalAnalysis: FullAudioAnalysis, beatAnalysis: FullAudioAnalysis }> {

  const apiKey = process.env.GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
  if (!apiKey) {
    throw new Error("API Key is missing. Add your Gemini API key in Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.0-flash';

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

    // ═══════════════════════════════════════════════════════════════
    // PRE-ANALYSIS: Data-Driven Audio Measurements
    // ═══════════════════════════════════════════════════════════════

    const analystStartTime = Date.now();
    onProgress({
      agent: 'Acoustic Analyst',
      message: 'Running spectral analysis, loudness measurement, and sibilance detection on all tracks...',
      phase: 'analysis',
    });

    const vocalBuffer = await decodeBlob(vocalBlob);
    const beatBuffer = await decodeBlob(beatBlob);

    const vocalAnalysis = analyzeAudio(vocalBuffer);
    const beatAnalysis = analyzeAudio(beatBuffer);

    const vocalAnalysisStr = formatAnalysis('VOCAL', vocalAnalysis);
    const beatAnalysisStr = formatAnalysis('BEAT', beatAnalysis);

    let backupAnalysisStr = "";
    if (backupVocalBlob) {
      const backupBuffer = await decodeBlob(backupVocalBlob);
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

    // ═══════════════════════════════════════════════════════════════
    // SKILL TREE SEARCH — GenericAgent "direct recall on similar task"
    // ═══════════════════════════════════════════════════════════════

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

    for (let i = 1; i <= iterations; i++) {
      if (i === 1) {
        // ═══════════════════════════════════════════════════════════════
        // AGENT 1: Acoustic Analyst + AI Listening
        // ═══════════════════════════════════════════════════════════════
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

        const analysisResponse = await ai.models.generateContent({
          model,
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

        // ═══════════════════════════════════════════════════════════════
        // AGENT 1b: Genre Intelligence Agent
        // ═══════════════════════════════════════════════════════════════
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

          const genreResponse = await ai.models.generateContent({
            model,
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
            details: genreResult.genreReasoning || '',
            confidence: (genreResult.confidence as ConfidenceLevel) || 'medium',
            thoughtProcess: JSON.stringify(genreResult, null, 2),
            phase: 'genre',
            durationMs: Date.now() - genreStartTime,
          });
        }

        await delay(2500);

        // ═══════════════════════════════════════════════════════════════
        // AGENT 2: Mix Engineer (Data-Driven Initial Draft)
        // ═══════════════════════════════════════════════════════════════
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
- LUFS target: ${vocalAnalysis.loudness.estimatedLUFS < -18 ? '-10 (needs significant gain)' : '-9 (standard competitive loudness)'} — detected genre: ${detectedGenre}

CRITICAL RULES:
- If sibilance was detected, ENABLE the de-esser and set frequency to the detected peak.
- Beat high-mid gain should be NEGATIVE to carve space for vocals.
- Reverb pre-delay should be 15-30ms to keep vocal upfront.
- Parallel compression wetDry should be 0.15-0.35 (subtle blend).
- Bass mono cutoff should be 100-180Hz for tight low end.
- Keep all moves MUSICAL. Less is more in mastering.

Output JSON only.`;

        const mixResponse = await ai.models.generateContent({
          model,
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
            `EQ: ${draftMix.reasoning?.eqReasoning || 'Applied'}`,
            `Compression: ${draftMix.reasoning?.compressionReasoning || 'Applied'}`,
            `De-Esser: ${draftMix.reasoning?.deEsserReasoning || 'Checked'}`,
            `Spatial: ${draftMix.reasoning?.spatialReasoning || 'Configured'}`,
          ].join('\n'),
          confidence: (draftMix.confidence as ConfidenceLevel) || 'medium',
          thoughtProcess: JSON.stringify(draftMix.reasoning, null, 2),
          phase: 'mixing',
          durationMs: Date.now() - mixStartTime,
        });

        await delay(2500);

      } else {
        // ═══════════════════════════════════════════════════════════════
        // AGENT 4: Review Engineer (Iterative Refinement)
        // ═══════════════════════════════════════════════════════════════
        const reviewStartTime = Date.now();
        onProgress({
          agent: `Review Engineer (Pass ${i})`,
          message: `Rendering current mix to analyze and refine...`,
          phase: 'review',
        });

        // Render the current mix with current settings
        const fullSettings: MixSettings = deepMergeSettings(defaultMixSettings, currentSettings);
        const currentMixBlob = await mixAudio(vocalBlob, beatBlob, backupVocalBlob, fullSettings);
        const currentMixPart = await blobToGenerativePart(currentMixBlob);

        // Analyze the rendered mix
        const mixBuffer = await decodeBlob(currentMixBlob);
        const mixAnalysis = analyzeAudio(mixBuffer);
        const mixAnalysisStr = formatAnalysis('CURRENT MIX', mixAnalysis);

        onProgress({
          agent: `Review Engineer (Pass ${i})`,
          message: `Listening to rendered mix and analyzing results...`,
          details: `Mix loudness: ${mixAnalysis.loudness.estimatedLUFS.toFixed(1)} LUFS, stereo width: ${(mixAnalysis.stereo.width * 100).toFixed(0)}%`
        });

        const reviewSchema = enforceRequired({
          type: "OBJECT",
          properties: {
            settings: {
              type: "OBJECT",
              properties: mixSettingsSchemaProperties
            },
            reasoning: detailedReasoningSchema,
            critique: { type: "STRING", description: "Specific critique of the current mix and what was changed." },
            confidence: { type: "STRING", description: "Confidence in these refined settings: 'high', 'medium', or 'low'" },
          }
        });

        const reviewPrompt = `You are a Senior Mix Engineer reviewing a rendered mix. Listen to the audio and compare it with the numerical measurements.

═══ CURRENT MIX MEASUREMENTS ═══
${mixAnalysisStr}

═══ ORIGINAL TRACK MEASUREMENTS ═══
${vocalAnalysisStr}
${beatAnalysisStr}

═══ CURRENT SETTINGS ═══
${JSON.stringify(currentSettings, null, 2)}

═══ YOUR TASK ═══
Critique this mix based on BOTH your listening AND the measurements:

1. Vocal presence: Is the vocal clear and upfront, or buried? Check mid/presence energy.
2. Frequency balance: Compare the mix's spectral balance to professional standards.
3. Dynamic control: Is the crest factor appropriate? (Typically 6-10dB for mastered music)
4. Stereo field: Is the width appropriate? Is the bass properly centered?
5. Loudness: Is the estimated LUFS close to the target? Adjust masterGain if needed.
6. De-essing: Is sibilance controlled?
7. Spatial effects: Are reverb/delay appropriate? Too much = washy, too little = dry.

Provide UPDATED settings to fix any remaining issues. Be specific about what you changed and why.
Output JSON only.`;

        const reviewResponse = await ai.models.generateContent({
          model,
          contents: [{ text: reviewPrompt }, currentMixPart],
          config: {
            responseMimeType: "application/json",
            responseSchema: reviewSchema as any,
          }
        });

        const updatedMix = parseSafeJSON(reviewResponse.text || "{}");
        const previousSettings = JSON.parse(JSON.stringify(currentSettings));
        currentSettings = deepMergeSettings(defaultMixSettings, updatedMix.settings);
        const paramDeltas = computeParameterDeltas(previousSettings, currentSettings);

        onProgress({
          agent: `Review Engineer (Pass ${i})`,
          message: `Mix refinement complete.`,
          details: `Critique: ${updatedMix.critique}\nMastering: ${updatedMix.reasoning?.masteringReasoning || 'Adjusted'}`,
          confidence: (updatedMix.confidence as ConfidenceLevel) || 'medium',
          thoughtProcess: JSON.stringify(updatedMix.reasoning, null, 2),
          parameterDeltas: paramDeltas,
          phase: 'review',
          durationMs: Date.now() - reviewStartTime,
        });

        await delay(3000);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // AGENT 3: Mastering Engineer (Final Polish)
    // ═══════════════════════════════════════════════════════════════
    const masterStartTime = Date.now();
    onProgress({
      agent: 'Mastering Engineer',
      message: 'Applying final mastering checks with loudness and spectral analysis...',
      phase: 'mastering',
    });

    const masterSchema = enforceRequired({
      type: "OBJECT",
      properties: {
        settings: {
          type: "OBJECT",
          properties: mixSettingsSchemaProperties
        },
        masteringNotes: { type: "STRING", description: "Detailed mastering notes covering EQ, dynamics, stereo, and loudness decisions." }
      }
    });

    const masterPrompt = `You are a Grammy-winning Mastering Engineer applying final polish to a mix. You have access to the full signal chain.

═══ ACOUSTIC ANALYSIS ═══
${analysisText}

═══ NUMERICAL MEASUREMENTS ═══
Vocal: RMS ${vocalAnalysis.loudness.rmsDB.toFixed(1)} dBFS, Peak ${vocalAnalysis.loudness.peakDB.toFixed(1)} dBFS
Beat: RMS ${beatAnalysis.loudness.rmsDB.toFixed(1)} dBFS, Peak ${beatAnalysis.loudness.peakDB.toFixed(1)} dBFS

═══ MIX ENGINEER'S SETTINGS ═══
${JSON.stringify(currentSettings, null, 2)}

═══ YOUR MASTERING DECISIONS ═══

As the mastering engineer, focus on these final elements:

1. MASTER MULTIBAND COMPRESSION:
   - Low band (<250Hz): Tighten the bass. Slower attack, moderate ratio.
   - Mid band (250-4kHz): Glue the vocal and beat. Moderate attack and ratio.
   - High band (>4kHz): Smooth harshness. Moderate settings.

2. MASTER EQ (Sweetening):
   - Very subtle moves only (±2dB). This is mastering — surgical precision.
   - Low shelf: Warmth or clarity.
   - High shelf: Air and sparkle.

3. STEREO IMAGING:
   - Width: 1.0-1.3 (don't over-widen).
   - Bass mono cutoff: 100-180Hz (tight, punchy bass).

4. SOFT CLIPPER: Shave 1-3dB of transient peaks before the limiter (0.1-0.3).

5. LIMITER:
   - Ceiling: -1.0 dBTP (streaming safe).
   - Release: Fast enough to be transparent (0.03-0.08s).

6. LUFS TARGET: Choose genre-appropriate loudness.
   - Hip-hop/Pop: -8 to -10 LUFS
   - Electronic: -7 to -9 LUFS
   - Acoustic: -11 to -14 LUFS

7. MASTER GAIN: Adjust to drive the limiter appropriately.

CRITICAL: Do NOT over-process. Mastering is about polish, not surgery.
The mix engineer has already done most of the heavy lifting.
Your job is to ensure commercial-ready loudness, tonal balance, and stereo coherence.

Output JSON only.`;

    const masterResponse = await ai.models.generateContent({
      model,
      contents: [{ text: masterPrompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: masterSchema as any,
      }
    });

    const finalResult = parseSafeJSON(masterResponse.text || "{}");
    const finalSettings = deepMergeSettings(defaultMixSettings, finalResult.settings);

    onProgress({
      agent: 'Mastering Engineer',
      message: 'Mastering and final approval complete.',
      details: finalResult.masteringNotes,
      phase: 'mastering',
      durationMs: Date.now() - masterStartTime,
    });

    // Skill crystallization is now handled by the App after user feedback
    // (via agentMemory.ts crystallizeSkill)

    return {
      settings: finalSettings,
      reasoning: finalResult.masteringNotes,
      matchedSkillId,
      detectedGenre,
      vocalAnalysis,
      beatAnalysis,
    };

  } catch (error: any) {
    console.error("AI Agent Network Error:", error);

    const errorMessage = error?.message || '';
    if (error?.status === 429 || errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("API Quota Exceeded (429). The Gemini API rate limit was reached. Please try reducing the 'AI Iterations' slider to 1, or wait a minute before trying again. If you are on a free tier, you may have exhausted your daily quota.");
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

function saveAgentMemory(profile: AgentMemoryProfile): void {
  try {
    const profiles = loadAgentMemory();
    const updated = [profile, ...profiles.filter(p => p.genre !== profile.genre)].slice(0, 8);
    localStorage.setItem('agent_memory_profiles', JSON.stringify(updated));
  } catch { /* ignore localStorage errors */ }
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

// ─── Genre Intelligence Schema ────────────────────────────────────────────────

const genreAnalysisSchema = {
  type: "OBJECT",
  properties: {
    detectedGenre: { type: "STRING", description: "One of: hip-hop, pop, electronic, acoustic, custom" },
    confidence: { type: "STRING", description: "One of: high, medium, low" },
    genreReasoning: { type: "STRING", description: "Brief explanation of genre detection based on spectral characteristics" },
    suggestedLUFSTarget: { type: "NUMBER", description: "Recommended LUFS target for this genre (-7 to -14)" },
  }
};

/**
 * Deep merge settings, preserving all fields from target and applying overrides from source.
 */
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
