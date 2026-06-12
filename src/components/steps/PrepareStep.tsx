import { motion } from 'motion/react';
import {
  FastForward, Activity, Loader2, SplitSquareHorizontal, Download, FileText, Wand2, RotateCcw,
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useStudioStore } from '@/state/store';
import { processBeat } from '@/audio';
import { FluidOrb } from '../FluidOrb';
import { ProSlider } from '../ui/ProSlider';

/** Step 2 — tweak speed/pitch, extract stems, write lyrics. */
export function PrepareStep() {
  const {
    isMobile, isSmallMobile,
    originalBeatBlob,
    beatUrl, setBeatUrl,
    beatSpeed, setBeatSpeed,
    beatPitch, setBeatPitch,
    isProcessingBeat, setIsProcessingBeat,
    isAnalyzingBpm, detectedBpm,
    setBeatBlob, setBeatBuffer, setStep,
    isSeparating, setIsSeparating,
    separatedStems, setSeparatedStems,
    separationJobId, setSeparationJobId,
    beatBlob,
    lyrics, setLyrics,
    isGeneratingLyrics, setIsGeneratingLyrics,
    savedApiKey,
  } = useStudioStore();

  // Render speed/pitch into the beat, then advance to recording
  const handlePrepareBeat = async () => {
    if (!originalBeatBlob) return;
    setIsProcessingBeat(true);
    try {
      const processed = await processBeat(originalBeatBlob, beatSpeed, beatPitch);
      if (beatUrl) URL.revokeObjectURL(beatUrl);
      setBeatBlob(processed);
      setBeatUrl(URL.createObjectURL(processed));

      const AudioContextClass = (window as unknown as Record<string, unknown>).AudioContext as typeof AudioContext;
      const ctx = new AudioContextClass();
      const buf = await ctx.decodeAudioData(await processed.arrayBuffer());
      setBeatBuffer(buf);
      ctx.close();

      setStep('record');
    } catch (err) {
      console.error('Error processing beat', err);
      alert('Failed to process beat.');
    } finally {
      setIsProcessingBeat(false);
    }
  };

  // Server-side stem separation with SSE status stream
  const handleSeparateStems = async () => {
    if (!beatBlob) return;
    setIsSeparating(true);
    setSeparationJobId(null);
    setSeparatedStems([]);
    try {
      const formData = new FormData();
      formData.append('audio', beatBlob, 'beat.wav');
      const res = await fetch('/api/separate', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Separation request failed');
      const data = await res.json() as { jobId: string };
      setSeparationJobId(data.jobId);

      const evtSource = new EventSource(`/api/separate/status-stream/${data.jobId}`);
      evtSource.onmessage = (e) => {
        const status = JSON.parse(e.data) as { status: string; stems?: string[] };
        if (status.status === 'completed') {
          evtSource.close();
          setSeparatedStems(status.stems ?? []);
          setIsSeparating(false);
        } else if (status.status === 'error' || status.status === 'failed') {
          evtSource.close();
          setIsSeparating(false);
          alert('Stem separation failed.');
        }
      };
      evtSource.onerror = () => {
        evtSource.close();
        setIsSeparating(false);
      };
    } catch {
      setIsSeparating(false);
      alert('Failed to start stem separation.');
    }
  };

  const generateLyrics = async () => {
    setIsGeneratingLyrics(true);
    try {
      const apiKey = savedApiKey || localStorage.getItem('gemini_api_key') || '';
      if (!apiKey) throw new Error('API Key is missing.');
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a professional songwriter. Generate lyrics for a song. The user has provided: "${lyrics}". If empty, generate a full song (Verse, Chorus, Verse, Chorus, Bridge, Chorus). Return only the lyrics text.`;
      const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      if (response.text) setLyrics(lyrics ? `${lyrics}\n\n${response.text}` : response.text);
    } catch (err) {
      console.error('Error generating lyrics:', err);
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  return (
    <motion.div key="prepare" className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {/* Center orb */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="absolute z-30 flex flex-col items-center pointer-events-auto"
      >
        <button
          onClick={handlePrepareBeat}
          disabled={isProcessingBeat}
          className={`relative ${isSmallMobile ? 'w-56 h-56' : 'w-[280px] h-[280px]'} flex flex-col items-center justify-center hover:scale-105 transition-transform duration-300 disabled:opacity-50 disabled:hover:scale-100`}
        >
          <FluidOrb size={isSmallMobile ? 224 : 280} active={!isProcessingBeat} />
          <div className="relative z-10 flex flex-col items-center gap-3">
            {isProcessingBeat
              ? <Loader2 className={`${isSmallMobile ? 'w-10 h-10' : 'w-12 h-12'} animate-spin text-white`} />
              : <FastForward className={`${isSmallMobile ? 'w-10 h-10' : 'w-12 h-12'} text-white`} />}
            <span className={`${isSmallMobile ? 'text-[10px]' : 'text-xs'} font-bold uppercase tracking-widest text-white text-center leading-tight`}>
              {isProcessingBeat ? 'Processing' : 'Continue\nto Record'}
            </span>
          </div>
        </button>
      </motion.div>

      {/* Left panel: BPM + speed (+ pitch on mobile) */}
      <motion.div
        initial={{ x: 0, y: 0, opacity: 0 }}
        animate={{ x: isMobile ? 0 : -280, y: isMobile ? (isSmallMobile ? -160 : -180) : 0, opacity: 1 }}
        exit={{ x: 0, y: 0, opacity: 0 }}
        transition={{ type: 'spring', damping: 15 }}
        className={`absolute z-20 ${isMobile ? (isSmallMobile ? 'w-[90vw]' : 'w-72') : 'w-64'} flex flex-col gap-4 bg-black/40 backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] shadow-2xl pointer-events-auto`}
      >
        <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono text-white/70">BPM</span>
          </div>
          <span className="text-sm font-bold text-white">
            {isAnalyzingBpm ? <Loader2 className="w-4 h-4 animate-spin" /> : (detectedBpm ?? '--')}
          </span>
        </div>
        <ProSlider label="Speed" icon={FastForward} value={beatSpeed} min={0.5} max={2.0} step={0.05} onChange={setBeatSpeed} formatValue={(v) => `${v.toFixed(2)}x`} colorClass="bg-blue-500" glowClass="shadow-blue-500/50" />
        {isMobile && (
          <ProSlider label="Pitch" icon={Activity} value={beatPitch} min={-12} max={12} step={1} onChange={setBeatPitch} formatValue={(v) => v > 0 ? `+${v}` : `${v}`} colorClass="bg-indigo-500" glowClass="shadow-indigo-500/50" />
        )}
      </motion.div>

      {/* Right panel: pitch + stems (desktop only) */}
      {!isMobile && (
        <motion.div
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: 280, y: 0, opacity: 1 }}
          exit={{ x: 0, y: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 15, delay: 0.1 }}
          className="absolute z-20 w-64 bg-black/40 backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] shadow-2xl pointer-events-auto flex flex-col gap-6"
        >
          <ProSlider label="Pitch" icon={Activity} value={beatPitch} min={-12} max={12} step={1} onChange={setBeatPitch} formatValue={(v) => v > 0 ? `+${v}` : `${v}`} colorClass="bg-indigo-500" glowClass="shadow-indigo-500/50" />
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={handleSeparateStems}
              disabled={isSeparating}
              className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSeparating
                ? <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                : <SplitSquareHorizontal className="w-4 h-4 text-purple-400" />}
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                {isSeparating ? 'Separating...' : 'Extract Stems'}
              </span>
            </button>
            {separatedStems.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {separatedStems.map((stem, i) => (
                  <a
                    key={i}
                    href={`/api/separate/download/${separationJobId}/${stem}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-mono text-purple-300 hover:text-purple-100 flex items-center gap-1 bg-purple-500/10 p-2 rounded-lg"
                  >
                    <Download className="w-3 h-3" /> {stem}
                  </a>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Lyrics panel */}
      <motion.div
        initial={{ y: 300, opacity: 0 }}
        animate={{ y: isMobile ? (isSmallMobile ? 240 : 280) : 320, opacity: 1 }}
        exit={{ y: 300, opacity: 0 }}
        transition={{ type: 'spring', damping: 15, delay: 0.2 }}
        className={`absolute z-20 ${isMobile ? (isSmallMobile ? 'w-[90vw]' : 'w-80') : 'w-96'} bg-black/40 backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] shadow-2xl pointer-events-auto flex flex-col gap-4`}
      >
        <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
          <FileText className="w-3 h-3" /> Lyrics / Songwriting
        </label>
        <div className="relative group">
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Write your lyrics here or use AI to generate some..."
            className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white/80 focus:outline-none focus:border-white/20 transition-all resize-none font-sans leading-relaxed"
          />
          <div className="absolute bottom-3 right-3 flex gap-2">
            <button
              onClick={generateLyrics}
              disabled={isGeneratingLyrics}
              className="flex items-center gap-2 px-3 py-1.5 bg-white text-black rounded-full text-[10px] font-bold hover:scale-105 transition-transform disabled:opacity-50"
            >
              {isGeneratingLyrics ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              {lyrics ? 'Finish Verse' : 'AI Lyrics'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
