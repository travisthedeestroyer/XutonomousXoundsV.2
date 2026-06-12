import { useRef, useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { Mic, Square, Activity, FileText, Ear } from 'lucide-react';
import { useStudioStore } from '@/state/store';
import { FluidOrb } from '../FluidOrb';

interface RecordStepProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onRecordingComplete: () => void;
}

// Live audio-graph nodes kept outside React state for the active take
interface LiveSession {
  ctx: AudioContext;
  analyser: AnalyserNode;
  beatSrc: AudioBufferSourceNode | null;
  vocalSrc: AudioBufferSourceNode | null;
}

/** Step 3 — record main/backup vocal takes over the beat. */
export function RecordStep({ canvasRef, onRecordingComplete }: RecordStepProps) {
  const {
    isMobile, isSmallMobile,
    isRecording, setIsRecording,
    recordingMode, setRecordingMode,
    useEchoCancellation, setUseEchoCancellation,
    useMonitor, setUseMonitor,
    useMetronome, setUseMetronome,
    vocalBlob,
    beatBuffer, mainVocalBuffer,
    detectedBpm,
    showLyrics, setShowLyrics,
    setVocalBlob, setVocalUrl, vocalUrl,
    setBackupVocalBlob, setBackupVocalUrl, backupVocalUrl,
  } = useStudioStore();

  const [liveAnalyser, setLiveAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sessionRef = useRef<LiveSession | null>(null);
  const animationRef = useRef<number | null>(null);
  const metronomeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Circular frequency visualizer drawn onto the shared canvas
  const drawVisualizer = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = sessionRef.current?.analyser;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2, cy = canvas.height / 2, r = 150;
      for (let i = 0; i < bufferLength; i++) {
        const pct = dataArray[i] / 255;
        const angle = (i / bufferLength) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        ctx.lineTo(cx + Math.cos(angle) * (r + pct * 100), cy + Math.sin(angle) * (r + pct * 100));
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(244,63,94,${pct + 0.2})`;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    };
    draw();
  }, [canvasRef]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: useEchoCancellation,
          noiseSuppression: useEchoCancellation,
          autoGainControl: useEchoCancellation,
        },
      });

      const AudioContextClass = (window as unknown as Record<string, unknown>).AudioContext as typeof AudioContext ||
        (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      setLiveAnalyser(analyser);

      const session: LiveSession = { ctx, analyser, beatSrc: null, vocalSrc: null };
      sessionRef.current = session;

      // Schedule beat playback with sample-accurate AudioContext timing
      if (beatBuffer) {
        const beatSrc = ctx.createBufferSource();
        beatSrc.buffer = beatBuffer;
        const beatGain = ctx.createGain();
        beatGain.gain.value = 0.8;
        beatSrc.connect(beatGain);
        beatGain.connect(ctx.destination);
        beatSrc.start(ctx.currentTime);
        session.beatSrc = beatSrc;
      }

      // In backup mode, also play the main take for the singer to layer over
      if (recordingMode === 'backup' && mainVocalBuffer) {
        const vocalSrc = ctx.createBufferSource();
        vocalSrc.buffer = mainVocalBuffer;
        const vocalGain = ctx.createGain();
        vocalGain.gain.value = 0.6;
        vocalSrc.connect(vocalGain);
        vocalGain.connect(ctx.destination);
        vocalSrc.start(ctx.currentTime);
        session.vocalSrc = vocalSrc;
      }

      if (useMonitor) {
        const monitorGain = ctx.createGain();
        monitorGain.gain.value = 0.5;
        source.connect(monitorGain);
        monitorGain.connect(ctx.destination);
      }

      if (useMetronome && detectedBpm) {
        const interval = (60 / detectedBpm) * 1000;
        metronomeRef.current = setInterval(() => {
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.frequency.value = 1000;
          env.gain.setValueAtTime(0, ctx.currentTime);
          env.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
          env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
          osc.connect(env);
          env.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
        }, interval);
      }

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current);
        if (recordingMode === 'main') {
          if (vocalUrl) URL.revokeObjectURL(vocalUrl);
          setVocalBlob(blob);
          setVocalUrl(URL.createObjectURL(blob));
        } else {
          if (backupVocalUrl) URL.revokeObjectURL(backupVocalUrl);
          setBackupVocalBlob(blob);
          setBackupVocalUrl(URL.createObjectURL(blob));
        }
        audioChunksRef.current = [];
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        onRecordingComplete();
      };

      audioChunksRef.current = [];
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setTimeout(drawVisualizer, 100);
    } catch {
      alert('Could not access microphone. Please ensure permissions are granted.');
    }
  };

  const stopRecording = () => {
    setLiveAnalyser(null);
    if (metronomeRef.current) { clearInterval(metronomeRef.current); metronomeRef.current = null; }
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    const session = sessionRef.current;
    if (session) {
      try { session.beatSrc?.stop(); } catch { /* already stopped */ }
      try { session.vocalSrc?.stop(); } catch { /* already stopped */ }
    }
  };

  return (
    <motion.div key="record" className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {/* Record button */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="absolute z-30 pointer-events-auto"
      >
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`relative ${isSmallMobile ? 'w-56 h-56' : 'w-[280px] h-[280px]'} flex flex-col items-center justify-center transition-transform duration-300 hover:scale-105`}
        >
          <FluidOrb
            size={isSmallMobile ? 224 : 280}
            analyser={liveAnalyser}
            active={isRecording}
          />
          <div className={`relative z-10 flex flex-col items-center gap-2 ${isRecording ? 'text-rose-400' : 'text-white/90'}`}>
            {isRecording ? (
              <>
                <Square className={`${isSmallMobile ? 'w-12 h-12' : 'w-16 h-16'} fill-current`} />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] animate-pulse">Recording</span>
              </>
            ) : (
              <>
                <Mic className={`${isSmallMobile ? 'w-12 h-12' : 'w-16 h-16'}`} />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Ready</span>
              </>
            )}
          </div>
        </button>
      </motion.div>

      {/* Mode controls */}
      <motion.div
        initial={{ y: 0, opacity: 0 }}
        animate={{ y: isMobile ? 180 : 220, opacity: 1 }}
        exit={{ y: 0, opacity: 0 }}
        transition={{ type: 'spring', damping: 15 }}
        className="absolute z-20 flex flex-col gap-4 pointer-events-auto"
      >
        <div className="flex bg-black/40 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/10 shadow-2xl">
          <button onClick={() => setUseEchoCancellation(false)} className={`px-4 sm:px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${!useEchoCancellation ? 'bg-violet-500 text-white shadow-lg' : 'text-white/40 hover:text-white/80'}`}>Headphones</button>
          <button onClick={() => setUseEchoCancellation(true)}  className={`px-4 sm:px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${useEchoCancellation  ? 'bg-rose-500 text-white shadow-lg'   : 'text-white/40 hover:text-white/80'}`}>Speakers</button>
        </div>
        {vocalBlob && (
          <div className="flex bg-black/40 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/10 shadow-2xl">
            <button onClick={() => setRecordingMode('main')}   className={`flex-1 px-4 sm:px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${recordingMode === 'main'   ? 'bg-blue-500 text-white shadow-lg' : 'text-white/40 hover:text-white/80'}`}>Main</button>
            <button onClick={() => setRecordingMode('backup')} className={`flex-1 px-4 sm:px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${recordingMode === 'backup' ? 'bg-pink-500 text-white shadow-lg' : 'text-white/40 hover:text-white/80'}`}>Backup</button>
          </div>
        )}
        <div className="flex bg-black/40 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/10 shadow-2xl">
          <button onClick={() => setUseMonitor(!useMonitor)}   className={`flex-1 px-4 sm:px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${useMonitor   ? 'bg-emerald-500 text-white shadow-lg' : 'text-white/40 hover:text-white/80'}`}><Ear className="w-3 h-3" />{useMonitor ? 'Monitor ON' : 'Monitor OFF'}</button>
          <button onClick={() => setUseMetronome(!useMetronome)} className={`flex-1 px-4 sm:px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${useMetronome ? 'bg-amber-500 text-white shadow-lg'   : 'text-white/40 hover:text-white/80'}`}><Activity className="w-3 h-3" />{useMetronome ? 'Click ON' : 'Click OFF'}</button>
        </div>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ y: 0, opacity: 0 }}
        animate={{ y: isMobile ? -180 : -220, opacity: 1 }}
        exit={{ y: 0, opacity: 0 }}
        transition={{ type: 'spring', damping: 15, delay: 0.1 }}
        className="absolute z-20 text-center pointer-events-auto"
      >
        <h2 className="text-2xl font-bold tracking-widest uppercase text-white/90 mb-1 font-mono">
          {recordingMode === 'main' ? 'Vocal Tracking' : 'Backup Tracking'}
        </h2>
        <div className={`text-[10px] font-mono px-4 py-1.5 rounded-full border inline-block ${isRecording ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
          {isRecording ? 'REC ● LIVE' : 'READY TO RECORD'}
        </div>
        {!showLyrics && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowLyrics(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] uppercase tracking-widest text-white/60 hover:bg-white/10 transition-colors mx-auto"
          >
            <FileText className="w-3 h-3" /> Show Teleprompter
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}
