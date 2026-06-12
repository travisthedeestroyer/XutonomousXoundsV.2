// Audio analysis: spectral balance, BS.1770 loudness, sibilance, stereo width.

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
 * Perform spectral analysis using Goertzel-based band energy measurement.
 */
export function analyzeSpectralBalance(buffer: AudioBuffer): SpectralAnalysis {
  const data = buffer.getChannelData(0);
  const fftSize = 4096;
  const sampleRate = buffer.sampleRate;

  const bands = { subBass: 0, bass: 0, lowMid: 0, mid: 0, upperMid: 0, presence: 0, brilliance: 0 };

  const bandRanges: [keyof typeof bands, number, number][] = [
    ['subBass', 20, 60],
    ['bass', 60, 250],
    ['lowMid', 250, 500],
    ['mid', 500, 2000],
    ['upperMid', 2000, 4000],
    ['presence', 4000, 6000],
    ['brilliance', 6000, 20000],
  ];

  const halfFFT = fftSize / 2;
  const binWidth = sampleRate / fftSize;

  // Hann-windowed segment from the middle of the buffer
  const startSample = Math.max(0, Math.floor(data.length / 2) - halfFFT);
  const segment = new Float32Array(fftSize);
  for (let i = 0; i < fftSize && (startSample + i) < data.length; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    segment[i] = data[startSample + i] * window;
  }

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

interface BiquadCoeffs {
  b0: number; b1: number; b2: number; a1: number; a2: number;
}

/**
 * Integrated loudness per ITU-R BS.1770 (K-weighting + gating).
 */
export function measureLUFS(channels: Float32Array[], sampleRate: number): number {
  if (!channels.length || !channels[0].length) return -70;

  // K-weighting filter coefficients (BS.1770), derived for the actual fs.
  const makeHighShelf = (fs: number): BiquadCoeffs => {
    const f0 = 1681.974450955533;
    const G = 3.999843853973347;
    const Q = 0.7071752369554196;
    const K = Math.tan((Math.PI * f0) / fs);
    const Vh = Math.pow(10, G / 20);
    const Vb = Math.pow(Vh, 0.4996667741545416);
    const a0 = 1 + K / Q + K * K;
    return {
      b0: (Vh + (Vb * K) / Q + K * K) / a0,
      b1: (2 * (K * K - Vh)) / a0,
      b2: (Vh - (Vb * K) / Q + K * K) / a0,
      a1: (2 * (K * K - 1)) / a0,
      a2: (1 - K / Q + K * K) / a0,
    };
  };
  const makeHighPass = (fs: number): BiquadCoeffs => {
    const f0 = 38.13547087602444;
    const Q = 0.5003270373238773;
    const K = Math.tan((Math.PI * f0) / fs);
    const a0 = 1 + K / Q + K * K;
    return {
      b0: 1 / a0,
      b1: -2 / a0,
      b2: 1 / a0,
      a1: (2 * (K * K - 1)) / a0,
      a2: (1 - K / Q + K * K) / a0,
    };
  };

  const hs = makeHighShelf(sampleRate);
  const hp = makeHighPass(sampleRate);

  const applyBiquad = (input: Float32Array, c: BiquadCoeffs): Float32Array => {
    const out = new Float32Array(input.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < input.length; i++) {
      const x0 = input[i];
      const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      out[i] = y0;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    }
    return out;
  };

  // K-weight each channel
  const weighted = channels.map(ch => applyBiquad(applyBiquad(ch, hs), hp));
  const len = weighted[0].length;

  // Gated loudness: 400ms blocks, 75% overlap (100ms hop)
  const blockSize = Math.floor(0.4 * sampleRate);
  const hop = Math.floor(0.1 * sampleRate);
  if (len < blockSize) {
    // Too short to gate — fall back to ungated K-weighted mean square
    let ms = 0, n = 0;
    for (const ch of weighted) for (let i = 0; i < ch.length; i++) { ms += ch[i] * ch[i]; n++; }
    return n ? -0.691 + 10 * Math.log10(ms / n + 1e-12) : -70;
  }

  const blockLoudness: number[] = [];
  for (let start = 0; start + blockSize <= len; start += hop) {
    let ms = 0;
    for (const ch of weighted) {
      for (let i = start; i < start + blockSize; i++) ms += ch[i] * ch[i];
    }
    ms /= blockSize * weighted.length;
    blockLoudness.push(-0.691 + 10 * Math.log10(ms + 1e-12));
  }

  // Absolute gate at -70 LUFS
  const absGated = blockLoudness.filter(l => l > -70);
  if (!absGated.length) return -70;

  // Relative gate at (mean - 10 LU)
  const meanEnergy = absGated.reduce((s, l) => s + Math.pow(10, l / 10), 0) / absGated.length;
  const relThreshold = -0.691 + 10 * Math.log10(meanEnergy) - 10;
  const relGated = blockLoudness.filter(l => l > relThreshold && l > -70);
  if (!relGated.length) return -0.691 + 10 * Math.log10(meanEnergy);

  const gatedEnergy = relGated.reduce((s, l) => s + Math.pow(10, l / 10), 0) / relGated.length;
  return 10 * Math.log10(gatedEnergy);
}

/**
 * Measure loudness: peak, RMS, estimated LUFS (K-weighted, BS.1770), crest factor.
 */
export function measureLoudness(buffer: AudioBuffer): LoudnessAnalysis {
  let peak = 0;
  let sumSquares = 0;
  let totalSamples = 0;

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    channels.push(data);
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

  const estimatedLUFS = measureLUFS(channels, buffer.sampleRate);

  const crestFactor = peakDB - rmsDB;

  return { peakDB, rmsDB, estimatedLUFS, crestFactor };
}

/**
 * Detect sibilance: 5–9kHz band energy vs a 1–4kHz reference band (Goertzel).
 */
export function detectSibilance(buffer: AudioBuffer): SibilanceAnalysis {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  const frameSize = 2048;
  const hopSize = 1024;

  const maxFrames = 30;
  const totalPossible = Math.floor((data.length - frameSize) / hopSize) + 1;
  if (totalPossible < 1) return { hasSibilance: false, peakFrequency: 6500, severity: 0 };

  const numFrames = Math.min(maxFrames, totalPossible);
  const step = Math.max(1, Math.floor(totalPossible / numFrames));

  // Sibilance band: 5–9 kHz; reference band: 1–4 kHz (vocals live here)
  const sibilantFreqs = [5000, 6000, 7000, 8000, 9000].filter(f => f < sampleRate / 2);
  const referenceFreqs = [1000, 2000, 3000, 4000].filter(f => f < sampleRate / 2);

  const goertzelMag = (seg: Float32Array, freq: number): number => {
    const w = (2 * Math.PI * freq) / sampleRate;
    const coeff = 2 * Math.cos(w);
    let s1 = 0, s2 = 0;
    for (let i = 0; i < seg.length; i++) {
      const s0 = seg[i] + coeff * s1 - s2;
      s2 = s1; s1 = s0;
    }
    return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
  };

  let maxRatio = 0;
  let peakFreq = 6500;

  for (let f = 0; f < numFrames; f++) {
    const startIdx = Math.min(f * step * hopSize, data.length - frameSize);
    const segment = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      const win = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
      segment[i] = data[startIdx + i] * win;
    }

    let sibilantEnergy = 0;
    let maxSibilantMag = 0;
    let framePeakFreq = sibilantFreqs[0];
    for (const freq of sibilantFreqs) {
      const mag = goertzelMag(segment, freq);
      sibilantEnergy += mag * mag;
      if (mag > maxSibilantMag) { maxSibilantMag = mag; framePeakFreq = freq; }
    }

    let refEnergy = 0;
    for (const freq of referenceFreqs) {
      refEnergy += Math.pow(goertzelMag(segment, freq), 2);
    }

    const avgSibilant = sibilantEnergy / sibilantFreqs.length;
    const avgRef = refEnergy / referenceFreqs.length;
    // Ratio > 1.5 = mild sibilance presence; > 5.5 = severe
    const ratio = avgRef > 1e-12 ? avgSibilant / avgRef : 0;

    if (ratio > maxRatio) {
      maxRatio = ratio;
      peakFreq = framePeakFreq;
    }
  }

  const severity = Math.min(1.0, Math.max(0, (maxRatio - 1.5) / 4.0));

  return {
    hasSibilance: severity > 0.2,
    peakFrequency: peakFreq,
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
