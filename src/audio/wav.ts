// Audio decoding (Blob → AudioBuffer) and 16-bit PCM WAV encoding helpers.
// Shared by the render pipeline so decode/offline-context/WAV boilerplate
// lives in exactly one place.

/** Decoded audio data extracted from a Blob. */
export interface DecodedAudio {
  channels: Float32Array[];
  length: number;
  sampleRate: number;
  buffer: AudioBuffer; // Keep reference for analysis
}

type AudioContextCtor = typeof AudioContext;
type OfflineAudioContextCtor = typeof OfflineAudioContext;

function getAudioContextClass(): AudioContextCtor {
  const w = window as Window & { webkitAudioContext?: AudioContextCtor };
  const Ctor = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) {
    throw new Error('Web Audio API is not supported in this browser.');
  }
  return Ctor;
}

// Singleton AudioContext for decoding to ensure consistent sample rates
let decodingCtx: AudioContext | null = null;

function getDecodingCtx(): AudioContext {
  if (!decodingCtx) {
    const AudioContextClass = getAudioContextClass();
    try {
      decodingCtx = new AudioContextClass();
    } catch (e) {
      console.error('Failed to create AudioContext:', e);
      if (AudioContextClass === window.AudioContext) {
        try {
          decodingCtx = new AudioContextClass({ sampleRate: 44100 });
        } catch {
          throw e;
        }
      } else {
        throw e;
      }
    }
  }
  if (!decodingCtx) {
    throw new Error('Failed to initialize AudioContext');
  }
  return decodingCtx;
}

/** Create an OfflineAudioContext (with webkit fallback). */
export function createOfflineContext(
  numberOfChannels: number,
  length: number,
  sampleRate: number
): OfflineAudioContext {
  const w = window as Window & { webkitOfflineAudioContext?: OfflineAudioContextCtor };
  const Ctor = window.OfflineAudioContext ?? w.webkitOfflineAudioContext;
  if (!Ctor) {
    throw new Error('OfflineAudioContext is not supported in this browser.');
  }
  return new Ctor(numberOfChannels, length, sampleRate);
}

/** Decode any audio Blob to an AudioBuffer. */
export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return getDecodingCtx().decodeAudioData(arrayBuffer);
}

/** Decode a Blob and extract its raw channel data. */
export async function extractAudioData(blob: Blob): Promise<DecodedAudio> {
  try {
    const buffer = await decodeAudioBlob(blob);
    const channels: Float32Array[] = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }
    return { channels, length: buffer.length, sampleRate: buffer.sampleRate, buffer };
  } catch (err) {
    console.error('Failed to decode audio data', err);
    throw err;
  }
}

/** Encode multi-channel float samples to 16-bit PCM WAV. */
export function encodeWAV(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = channels.length;
  const length = channels[0].length;
  const buffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
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
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return buffer;
}

/** Encode raw channel data to a WAV (PCM16) Blob. */
export function channelsToWavBlob(channels: Float32Array[], sampleRate: number): Blob {
  return new Blob([encodeWAV(channels, sampleRate)], { type: 'audio/wav' });
}

/** Encode an AudioBuffer to a WAV (PCM16) Blob. */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const channels: Float32Array[] = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  return channelsToWavBlob(channels, buffer.sampleRate);
}
