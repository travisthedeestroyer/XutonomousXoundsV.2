// Render pipeline: beat speed/pitch processing and the main mixing engine.
// DSP math, default values, filter frequencies and node graphs are preserved
// exactly from the reference implementation.

import type { MixSettings } from './settings';
import { measureLUFS } from './analysis';
import {
  DecodedAudio,
  createOfflineContext,
  extractAudioData,
  channelsToWavBlob,
} from './wav';

// ─── Deterministic PRNG ──────────────────────────────────────────────────────
// Seeded random generator (mulberry32). Makes randomness-dependent DSP (e.g.
// reverb impulse generation) fully reproducible.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a list of numbers into a 32-bit integer seed. */
function hashSeed(...values: number[]): number {
  let h = 2166136261 >>> 0;
  for (const v of values) {
    const n = Math.round(v * 1000) >>> 0;
    h ^= n;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Musical tape saturation curve: asymmetric tanh (even + odd harmonics),
 * DC-compensated, blended with the dry signal.
 */
function makeTapeSaturationCurve(drive: number, amount: number): Float32Array {
  const n_samples = 8192;
  const curve = new Float32Array(n_samples);
  const driveAmount = 1.0 + drive * 8.0; // 1x to 9x drive
  const blend = Math.max(0, Math.min(1, amount));
  const bias = 0.12 * driveAmount * 0.1; // subtle asymmetry → even harmonics
  const dcOffset = Math.tanh(bias);       // remove the DC the bias introduces

  for (let i = 0; i < n_samples; i++) {
    const x = (i * 2) / n_samples - 1; // -1 to +1
    const driven = x * driveAmount + bias;
    const saturated = Math.tanh(driven) - dcOffset;
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
      // Smooth quadratic transition above knee
      const over = absX - knee;
      const range = 1.0 - knee;
      const t = range > 0 ? Math.min(1, over / range) : 0;
      const clipped = knee + range * (2 * t - t * t);
      curve[i] = sign * Math.min(1.0, clipped);
    }
  }
  return curve;
}

/**
 * Deterministic plate reverb impulse response: early reflections, exponential
 * decay tail with frequency-dependent damping, seeded by the reverb parameters.
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

  const rng = mulberry32(hashSeed(decayTime, damping, preDelay, sampleRate));

  // Early reflections (first 50ms) — simulate wall bounces
  const earlyReflectionCount = 12;
  const earlyWindow = Math.floor(sampleRate * 0.05);

  for (let r = 0; r < earlyReflectionCount; r++) {
    const time = predelaySamples + Math.floor(rng() * earlyWindow);
    const amplitude = 0.6 * Math.pow(0.85, r);
    if (time < length) {
      left[time] += amplitude * (0.8 + rng() * 0.4);
      right[time] += amplitude * (0.8 + rng() * 0.4);
    }
  }

  // Diffuse tail — exponential decay with frequency-dependent damping
  const dampingFactor = 1.0 - damping * 0.7; // More damping = faster HF decay
  const tailStart = predelaySamples + earlyWindow;

  for (let i = tailStart; i < length; i++) {
    const t = (i - tailStart) / (length - tailStart); // 0 to 1
    const envelope = Math.pow(1 - t, 1.5 + damping * 2);
    const noiseL = (rng() * 2 - 1);
    const noiseR = (rng() * 2 - 1);

    // Low-pass the noise by averaging with the previous sample (HF absorption)
    const prevL = i > tailStart ? left[i - 1] : 0;
    const prevR = i > tailStart ? right[i - 1] : 0;
    const filteredL = noiseL * dampingFactor + prevL * (1 - dampingFactor) * 0.2;
    const filteredR = noiseR * dampingFactor + prevR * (1 - dampingFactor) * 0.2;

    left[i] = filteredL * envelope * 0.4;
    right[i] = filteredR * envelope * 0.4;
  }

  return impulse;
}

// ─── Beat Processing (Speed / Pitch) ─────────────────────────────────────────

export async function processBeat(beatBlob: Blob, speed: number, pitch: number): Promise<Blob> {
  if (speed === 1 && pitch === 0) return beatBlob;

  const beatData = await extractAudioData(beatBlob);

  const length = Math.floor(beatData.length / speed);
  const offlineCtx = createOfflineContext(beatData.channels.length, length, beatData.sampleRate);

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
  const outChannels: Float32Array[] = [];
  for (let i = 0; i < renderedBuffer.numberOfChannels; i++) {
    outChannels.push(renderedBuffer.getChannelData(i));
  }

  return channelsToWavBlob(outChannels, renderedBuffer.sampleRate);
}

/**
 * Look-ahead brickwall true-peak limiter (final mastering stage, in-place).
 * Windowed-minimum gain provides look-ahead; one-pole release smooths recovery.
 * The ceiling is mathematically guaranteed — no hard clipping needed.
 */
function applyLookaheadLimiter(
  channels: Float32Array[],
  sampleRate: number,
  ceilingDb: number,
  releaseS: number
): void {
  const ceiling = Math.pow(10, ceilingDb / 20);
  const n = channels[0].length;
  if (!n) return;
  const look = Math.max(1, Math.floor(0.0015 * sampleRate)); // 1.5ms look-ahead
  const rel = Math.exp(-1 / (Math.max(0.01, releaseS) * sampleRate));

  // Required gain per sample (peak across channels)
  const reqG = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let peak = 0;
    for (let c = 0; c < channels.length; c++) {
      const a = Math.abs(channels[c][i]);
      if (a > peak) peak = a;
    }
    reqG[i] = peak > ceiling ? ceiling / peak : 1;
  }

  // Windowed minimum over [i, i+look] via monotonic deque (O(n))
  const ctrl = new Float32Array(n);
  const dq: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    while (dq.length && reqG[dq[dq.length - 1]] >= reqG[i]) dq.pop();
    dq.push(i);
    while (dq[0] > i + look) dq.shift();
    ctrl[i] = reqG[dq[0]];
  }

  // Apply: instant attack (clamp to ctrl), smooth release toward unity
  let g = 1;
  for (let i = 0; i < n; i++) {
    g = g * rel + (1 - rel);          // release toward 1.0
    if (g > ctrl[i]) g = ctrl[i];     // never exceed the guaranteed-ceiling gain
    for (let c = 0; c < channels.length; c++) channels[c][i] *= g;
  }
}

// ─── Main Mixing Engine — Production-Grade Signal Processing ─────────────────

export async function mixAudio(
  vocalBlob: Blob,
  beatBlob: Blob,
  backupVocalBlob: Blob | null,
  settings: MixSettings
): Promise<Blob> {
  const vocalData = await extractAudioData(vocalBlob);
  const beatData = await extractAudioData(beatBlob);
  const backupData = backupVocalBlob ? await extractAudioData(backupVocalBlob) : null;

  const sampleRate = beatData.sampleRate;
  const duration = Math.ceil(Math.max(
    vocalData.length,
    beatData.length,
    backupData ? backupData.length : 0
  ));

  const offlineCtx = createOfflineContext(2, duration, sampleRate);

  const createBufferSource = (data: DecodedAudio) => {
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

  // 3. De-Esser — split-band dynamic de-esser.
  // output = dry + (compressed_band − band): zero correction when there is no
  // sibilance, a dynamic cut only during "s/sh" transients.
  const deEsserBP = offlineCtx.createBiquadFilter();
  deEsserBP.type = 'bandpass';
  deEsserBP.frequency.value = settings.deEsser.frequency;
  deEsserBP.Q.value = 2.0;

  const deEsserBandComp = offlineCtx.createDynamicsCompressor();
  deEsserBandComp.threshold.value = settings.deEsser.threshold;
  deEsserBandComp.ratio.value = settings.deEsser.ratio;
  deEsserBandComp.attack.value = 0.0005; // very fast — catch transients
  deEsserBandComp.release.value = 0.04;
  deEsserBandComp.knee.value = 2;

  const deEsserBandNeg = offlineCtx.createGain();
  deEsserBandNeg.gain.value = -1; // subtract the dry sibilant band

  const deEsserOut = offlineCtx.createGain();
  deEsserOut.gain.value = 1.0;

  // 4. Main Vocal Compressor (1176-style: fast attack, musical release)
  const vocalCompressor = offlineCtx.createDynamicsCompressor();
  vocalCompressor.threshold.value = settings.vocalCompressor.threshold;
  vocalCompressor.ratio.value = settings.vocalCompressor.ratio;
  vocalCompressor.attack.value = settings.vocalCompressor.attack;
  vocalCompressor.release.value = settings.vocalCompressor.release;
  vocalCompressor.knee.value = settings.vocalCompressor.knee;

  // 5. Multiband Vocal Compression (4 bands) — Linkwitz-Riley 4th-order
  // crossovers (two cascaded Butterworth Q=0.7071 biquads): phase-coherent
  // at crossover points and sums back to a flat response.
  const lr = (type: BiquadFilterType, freq: number) => {
    const f1 = offlineCtx.createBiquadFilter();
    f1.type = type; f1.frequency.value = freq; f1.Q.value = 0.7071;
    const f2 = offlineCtx.createBiquadFilter();
    f2.type = type; f2.frequency.value = freq; f2.Q.value = 0.7071;
    f1.connect(f2);
    return { input: f1, output: f2 };
  };

  // Band 1: Low (0–250 Hz)
  const mbLow = lr('lowpass', 250);
  const mbLowComp = offlineCtx.createDynamicsCompressor();
  mbLowComp.threshold.value = settings.multibandVocalComp.low.threshold;
  mbLowComp.ratio.value = settings.multibandVocalComp.low.ratio;
  mbLowComp.attack.value = settings.multibandVocalComp.low.attack;
  mbLowComp.release.value = settings.multibandVocalComp.low.release;

  // Band 2: Low-Mid (250–2000 Hz)
  const mbLowMidHP = lr('highpass', 250);
  const mbLowMidLP = lr('lowpass', 2000);
  mbLowMidHP.output.connect(mbLowMidLP.input);
  const mbLowMidComp = offlineCtx.createDynamicsCompressor();
  mbLowMidComp.threshold.value = settings.multibandVocalComp.lowMid.threshold;
  mbLowMidComp.ratio.value = settings.multibandVocalComp.lowMid.ratio;
  mbLowMidComp.attack.value = settings.multibandVocalComp.lowMid.attack;
  mbLowMidComp.release.value = settings.multibandVocalComp.lowMid.release;

  // Band 3: High-Mid (2000–6000 Hz)
  const mbHighMidHP = lr('highpass', 2000);
  const mbHighMidLP = lr('lowpass', 6000);
  mbHighMidHP.output.connect(mbHighMidLP.input);
  const mbHighMidComp = offlineCtx.createDynamicsCompressor();
  mbHighMidComp.threshold.value = settings.multibandVocalComp.highMid.threshold;
  mbHighMidComp.ratio.value = settings.multibandVocalComp.highMid.ratio;
  mbHighMidComp.attack.value = settings.multibandVocalComp.highMid.attack;
  mbHighMidComp.release.value = settings.multibandVocalComp.highMid.release;

  // Band 4: High (6000+ Hz)
  const mbHigh = lr('highpass', 6000);
  const mbHighComp = offlineCtx.createDynamicsCompressor();
  mbHighComp.threshold.value = settings.multibandVocalComp.high.threshold;
  mbHighComp.ratio.value = settings.multibandVocalComp.high.ratio;
  mbHighComp.attack.value = settings.multibandVocalComp.high.attack;
  mbHighComp.release.value = settings.multibandVocalComp.high.release;

  // Multiband recombination bus — LR crossovers sum flat, so unity gain.
  const mbSumGain = offlineCtx.createGain();
  mbSumGain.gain.value = 1.0;

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

  // Dynamic de-esser: dry + (compressed_band − band)
  subtractiveEQ.connect(deEsserOut); // dry full-band signal
  if (settings.deEsser.enabled) {
    subtractiveEQ.connect(deEsserBP);
    deEsserBP.connect(deEsserBandNeg);
    deEsserBandNeg.connect(deEsserOut);  // − dry sibilant band
    deEsserBP.connect(deEsserBandComp);
    deEsserBandComp.connect(deEsserOut); // + compressed sibilant band
  }
  deEsserOut.connect(vocalCompressor);

  // After main compressor → Split into multiband (Linkwitz-Riley bands)
  vocalCompressor.connect(mbLow.input);
  mbLow.output.connect(mbLowComp);
  mbLowComp.connect(mbSumGain);

  vocalCompressor.connect(mbLowMidHP.input);
  mbLowMidLP.output.connect(mbLowMidComp);
  mbLowMidComp.connect(mbSumGain);

  vocalCompressor.connect(mbHighMidHP.input);
  mbHighMidLP.output.connect(mbHighMidComp);
  mbHighMidComp.connect(mbSumGain);

  vocalCompressor.connect(mbHigh.input);
  mbHigh.output.connect(mbHighComp);
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

  // Beat Output Gain
  const beatGain = offlineCtx.createGain();
  beatGain.gain.value = settings.beatVolume;

  // Sidechain ducking — applied to the BEAT only, BEFORE it is summed with the
  // vocal. A control curve derived from the vocal envelope automates this gain.
  const beatDuckGain = offlineCtx.createGain();
  if (settings.sidechainDuck > 0) {
    const vocalCh = vocalData.channels[0];
    const envAttack = Math.exp(-1 / (sampleRate * 0.005));   // 5ms attack
    const envRelease = Math.exp(-1 / (sampleRate * 0.12));   // 120ms release
    let envState = 0;
    let maxEnv = 1e-6;
    const env = new Float32Array(duration);
    for (let i = 0; i < duration; i++) {
      const abs = i < vocalCh.length ? Math.abs(vocalCh[i]) : 0;
      if (abs > envState) envState = envAttack * envState + (1 - envAttack) * abs;
      else envState = envRelease * envState + (1 - envRelease) * abs;
      env[i] = envState;
      if (envState > maxEnv) maxEnv = envState;
    }
    // Downsample to a control-rate curve for setValueCurveAtTime (≈1 point/256 samples)
    const points = Math.max(2, Math.min(8192, Math.floor(duration / 256)));
    const curve = new Float32Array(points);
    for (let p = 0; p < points; p++) {
      const idx = Math.floor((p / (points - 1)) * (duration - 1));
      const norm = Math.min(1, env[idx] / maxEnv);
      curve[p] = 1 - settings.sidechainDuck * norm; // full duck depth at loudest vocal
    }
    beatDuckGain.gain.setValueCurveAtTime(curve, 0, duration / sampleRate);
  } else {
    beatDuckGain.gain.value = 1.0;
  }

  // Beat routing
  beatSource.connect(beatLowEQ);
  beatLowEQ.connect(beatLowMidEQ);
  beatLowMidEQ.connect(beatHighMidEQ);
  beatHighMidEQ.connect(beatHighEQ);
  beatHighEQ.connect(beatCompressor);
  beatCompressor.connect(beatGain);
  beatGain.connect(beatDuckGain);

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

  // Master Multiband Compressor (3-band) — Linkwitz-Riley 4th-order crossovers
  // Low band (<250 Hz)
  const masterMBLow = lr('lowpass', 250);
  const masterMBLowComp = offlineCtx.createDynamicsCompressor();
  masterMBLowComp.threshold.value = settings.masterMultiband.low.threshold;
  masterMBLowComp.ratio.value = settings.masterMultiband.low.ratio;
  masterMBLowComp.attack.value = settings.masterMultiband.low.attack;
  masterMBLowComp.release.value = settings.masterMultiband.low.release;

  // Mid band (250–4000 Hz)
  const masterMBMidHP = lr('highpass', 250);
  const masterMBMidLP = lr('lowpass', 4000);
  masterMBMidHP.output.connect(masterMBMidLP.input);
  const masterMBMidComp = offlineCtx.createDynamicsCompressor();
  masterMBMidComp.threshold.value = settings.masterMultiband.mid.threshold;
  masterMBMidComp.ratio.value = settings.masterMultiband.mid.ratio;
  masterMBMidComp.attack.value = settings.masterMultiband.mid.attack;
  masterMBMidComp.release.value = settings.masterMultiband.mid.release;

  // High band (>4000 Hz)
  const masterMBHigh = lr('highpass', 4000);
  const masterMBHighComp = offlineCtx.createDynamicsCompressor();
  masterMBHighComp.threshold.value = settings.masterMultiband.high.threshold;
  masterMBHighComp.ratio.value = settings.masterMultiband.high.ratio;
  masterMBHighComp.attack.value = settings.masterMultiband.high.attack;
  masterMBHighComp.release.value = settings.masterMultiband.high.release;

  // Multiband recombination — LR crossovers sum flat, so unity gain.
  const masterMBSum = offlineCtx.createGain();
  masterMBSum.gain.value = 1.0;

  // Soft Clipper (pre-limiter transient shaving)
  const softClipper = offlineCtx.createWaveShaper();
  softClipper.curve = makeSoftClipCurve(settings.softClipAmount);
  softClipper.oversample = '4x';

  // NOTE: The brickwall limiter is applied POST-render as a proper look-ahead
  // true-peak limiter (see applyLookaheadLimiter), so it is genuinely the LAST
  // stage.

  // ═══════════════════════════════════════════════════════════════
  // MASTER CHAIN ROUTING
  // ═══════════════════════════════════════════════════════════════

  // All sources → Master Input
  vocalGain.connect(masterInputGain);
  parallelGain.connect(masterInputGain);
  reverbGain.connect(masterInputGain);
  delayGain.connect(masterInputGain);
  doublerGain.connect(masterInputGain);
  beatDuckGain.connect(masterInputGain); // beat (post sidechain duck)

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

  // Master Multiband split (Linkwitz-Riley bands)
  masterHighShelf.connect(masterMBLow.input);
  masterMBLow.output.connect(masterMBLowComp);
  masterMBLowComp.connect(masterMBSum);

  masterHighShelf.connect(masterMBMidHP.input);
  masterMBMidLP.output.connect(masterMBMidComp);
  masterMBMidComp.connect(masterMBSum);

  masterHighShelf.connect(masterMBHigh.input);
  masterMBHigh.output.connect(masterMBHighComp);
  masterMBHighComp.connect(masterMBSum);

  // Soft clip → Output. The brickwall limiter runs post-render (final stage).
  masterMBSum.connect(softClipper);
  softClipper.connect(offlineCtx.destination);

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
  const width = settings.stereoImaging.width;
  const bassMonoCutoff = settings.stereoImaging.bassMonoCutoff;

  if (width !== 1.0 || bassMonoCutoff > 0) {
    const left = outChannels[0];
    const right = outChannels[1];

    // Simple one-pole low-pass filter state for bass mono
    const bassLPCoeff = bassMonoCutoff > 0
      ? Math.exp(-2 * Math.PI * bassMonoCutoff / sampleRate)
      : 0;
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
        processedSide = processedSide - sideLP;
      }

      // Decode back to Left-Right
      left[i] = mid + processedSide;
      right[i] = mid - processedSide;
    }
  }

  // ── LUFS-Aware Makeup Gain (K-weighted, applied BEFORE the limiter) ──
  const currentLUFS = measureLUFS(outChannels, sampleRate);
  const lufsCorrection = settings.lufsTarget - currentLUFS;

  // Convert dB correction to linear gain; safe range thanks to the true
  // brickwall limiter that runs afterwards.
  let normalizeFactor = Math.pow(10, lufsCorrection / 20);
  normalizeFactor = Math.max(0.25, Math.min(8.0, normalizeFactor));

  for (let c = 0; c < outChannels.length; c++) {
    const channel = outChannels[c];
    for (let i = 0; i < channel.length; i++) channel[i] *= normalizeFactor;
  }

  // ── Final Brickwall Look-Ahead Limiter (true last stage) ──
  applyLookaheadLimiter(
    outChannels,
    sampleRate,
    settings.masterLimiter.ceiling,
    settings.masterLimiter.release
  );

  return channelsToWavBlob(outChannels, renderedBuffer.sampleRate);
}
