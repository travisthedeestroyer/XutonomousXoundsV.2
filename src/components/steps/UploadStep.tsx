import { useState } from 'react';
import { motion } from 'motion/react';
import { Upload } from 'lucide-react';
import { analyzeFullBuffer } from 'realtime-bpm-analyzer';
import { useStudioStore } from '@/state/store';
import { FluidOrb } from '../FluidOrb';

/** Step 1 — upload a beat (file picker or drag-drop) and detect its BPM. */
export function UploadStep() {
  const {
    isSmallMobile,
    beatUrl, setBeatUrl,
    setOriginalBeatBlob, setBeatBlob,
    setStep,
    setIsAnalyzingBpm, setDetectedBpm, setBeatBuffer,
  } = useStudioStore();

  const [hovered, setHovered] = useState(false);
  const size = isSmallMobile ? 224 : 280;

  const acceptBeatFile = async (file: File) => {
    if (beatUrl) URL.revokeObjectURL(beatUrl);
    setOriginalBeatBlob(file);
    setBeatBlob(file);
    setBeatUrl(URL.createObjectURL(file));
    setStep('prepare');

    // BPM detection runs in the background while the user prepares the beat
    setIsAnalyzingBpm(true);
    let bpmCtx: AudioContext | null = null;
    try {
      const AudioContextClass =
        (window as unknown as Record<string, unknown>).AudioContext as typeof AudioContext ||
        (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext;
      bpmCtx = new AudioContextClass();
      const audioBuffer = await bpmCtx.decodeAudioData(await file.arrayBuffer());
      setBeatBuffer(audioBuffer);
      const candidates = await analyzeFullBuffer(audioBuffer);
      setDetectedBpm(candidates?.length ? Math.round(candidates[0].tempo) : null);
    } catch {
      setDetectedBpm(null);
    } finally {
      setIsAnalyzingBpm(false);
      bpmCtx?.close();
    }
  };

  const handleBeatUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void acceptBeatFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setHovered(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio')) void acceptBeatFile(file);
  };

  return (
    <motion.div
      key="upload"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center z-30"
    >
      <label
        className="relative flex items-center justify-center cursor-pointer select-none"
        style={{ width: size, height: size }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDragOver={(e) => { e.preventDefault(); setHovered(true); }}
        onDragLeave={() => setHovered(false)}
        onDrop={handleDrop}
      >
        <FluidOrb size={size} active={hovered} />

        <motion.div
          className="relative z-10 flex flex-col items-center justify-center gap-3"
          animate={{ y: hovered ? -4 : 0 }}
          transition={{ type: 'spring', damping: 12 }}
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Upload className={`${isSmallMobile ? 'w-10 h-10' : 'w-12 h-12'} text-white/80`} />
          </motion.div>
          <span className={`${isSmallMobile ? 'text-[10px]' : 'text-xs'} font-bold uppercase tracking-widest text-white/90`}>
            Tap Orb to Upload
          </span>
          <span className="text-[10px] font-mono text-white/40">Drop beat here</span>
        </motion.div>

        <input type="file" accept="audio/*" onChange={handleBeatUpload} className="hidden" />
      </label>
    </motion.div>
  );
}
