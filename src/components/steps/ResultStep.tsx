import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Download, Settings2, RotateCcw, Activity, Sparkles, History,
  CheckCircle2, Upload, Layers, Loader2, TreePine, Star, X, FlipHorizontal2,
} from 'lucide-react';
import { useStudioStore } from '@/state/store';
import { crystallizeSkill, getSkillTreeStats } from '@/ai';
import type { FullAudioAnalysis } from '@/audio';

interface ResultStepProps {
  onMastering: () => void;
}

/** Step 5 — A/B playback, download, reference mastering, skill crystallization. */
export function ResultStep({ onMastering }: ResultStepProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  const {
    isMobile, isSmallMobile,
    mixedUrl, masteredUrl, rawMixUrl,
    settings,
    aiReasoning,
    history,
    lastSessionResult, setLastSessionResult,
    skillFeedbackState, setSkillFeedbackState,
    setSkillTreeStats,
    referenceBlob, setReferenceBlob,
    isMastering,
    setStep,
    reset,
    setShowSkillLibrary,
  } = useStudioStore();

  const refreshSkillStats = () => setSkillTreeStats(getSkillTreeStats());

  if (!mixedUrl) return null;

  return (
    <motion.div key="result" className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-8 w-full max-w-5xl px-6 relative">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`w-full bg-black/40 backdrop-blur-3xl border border-white/10 ${isSmallMobile ? 'p-4 rounded-[2rem]' : 'p-8 rounded-[3rem]'} shadow-2xl flex flex-col items-center gap-8 pointer-events-auto`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className={`${isSmallMobile ? 'w-12 h-12' : 'w-16 h-16'} rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-2`}>
              <CheckCircle2 className={`${isSmallMobile ? 'w-6 h-6' : 'w-8 h-8'} text-emerald-400`} />
            </div>
            <h2 className={`${isSmallMobile ? 'text-xl' : 'text-2xl'} font-bold uppercase tracking-[0.2em] text-white text-center`}>Master Complete</h2>
            <p className="text-[10px] uppercase tracking-widest text-white/40">High-fidelity export ready</p>
          </div>

          {/* A/B player: raw vs mixed/mastered */}
          <div className="w-full max-w-md bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col gap-3">
            {rawMixUrl && (
              <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                <button
                  onClick={() => setShowOriginal(false)}
                  className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 ${!showOriginal ? 'bg-white/10 text-white shadow-sm' : 'text-white/30 hover:text-white/50'}`}
                >
                  <Sparkles className="w-2.5 h-2.5" /> Mixed
                </button>
                <button
                  onClick={() => setShowOriginal(true)}
                  className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 ${showOriginal ? 'bg-white/10 text-white shadow-sm' : 'text-white/30 hover:text-white/50'}`}
                >
                  <FlipHorizontal2 className="w-2.5 h-2.5" /> Original
                </button>
              </div>
            )}
            <audio
              key={showOriginal ? 'original' : 'mixed'}
              src={showOriginal ? rawMixUrl! : (masteredUrl || mixedUrl)}
              controls
              playsInline
              className="w-full h-10 outline-none opacity-90 invert hue-rotate-180 grayscale contrast-150"
            />
            {rawMixUrl && (
              <p className="text-[8px] text-white/20 text-center uppercase tracking-widest">
                {showOriginal ? 'Dry signal — no EQ, compression, or effects' : 'AI mixed & mastered output'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {/* Report card */}
            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                <Activity className="w-3 h-3" /> Report
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Target LUFS', value: `${settings.lufsTarget} LUFS`, color: 'text-amber-400' },
                  { label: 'Peak Ceiling', value: `${settings.masterLimiter.ceiling.toFixed(1)} dBTP`, color: 'text-white/40' },
                  { label: 'Stereo Width', value: `${Math.round(settings.stereoImaging.width * 100)}%`, color: 'text-white/40' },
                  { label: 'Format', value: 'WAV 44.1kHz', color: 'text-emerald-400' },
                  { label: 'Genre', value: settings.genrePreset.toUpperCase(), color: 'text-violet-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center text-[10px]">
                    <span className="text-white/60">{label}</span>
                    <span className={`font-mono ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI notes */}
            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                <Sparkles className="w-3 h-3" /> AI Notes
              </h3>
              <p className="text-[10px] text-white/70 leading-relaxed italic line-clamp-4">
                "{aiReasoning || 'The AI network balanced the frequencies and applied bus compression to glue the tracks together.'}"
              </p>
            </div>

            {/* History */}
            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                <History className="w-3 h-3" /> History
              </h3>
              <div className="space-y-2 max-h-24 overflow-y-auto no-scrollbar">
                {history.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-[9px] bg-white/5 p-2 rounded-lg border border-white/5">
                    <span className="text-white/60 truncate max-w-[80px]">{item.name}</span>
                    <a href={item.url} download className="text-emerald-400 hover:text-emerald-300">
                      <Download className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Skill tree crystallization */}
          {lastSessionResult && skillFeedbackState === 'pending' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TreePine className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Crystallize to Skill Tree?</span>
                </div>
                <button onClick={() => setSkillFeedbackState('dismissed')} className="text-white/20 hover:text-white/50">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[9px] text-white/40 leading-relaxed">
                Save this mix as a skill. The AI will recall it automatically when it encounters similar tracks.
              </p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => {
                      if (!lastSessionResult) return;
                      const skill = crystallizeSkill({
                        vocalAnalysis: lastSessionResult.vocalAnalysis as FullAudioAnalysis,
                        beatAnalysis: lastSessionResult.beatAnalysis as FullAudioAnalysis,
                        genre: lastSessionResult.detectedGenre,
                        settings,
                        masteringNotes: lastSessionResult.masteringNotes,
                        rating: star,
                      });
                      setLastSessionResult({ ...lastSessionResult, crystallizedSkillId: skill.id });
                      setSkillFeedbackState('rated');
                      refreshSkillStats();
                    }}
                    className="text-amber-400/40 hover:text-amber-400 transition-colors"
                  >
                    <Star className="w-5 h-5 fill-current" />
                  </button>
                ))}
                <span className="text-[9px] text-white/20 ml-1">Rate & save</span>
              </div>
            </motion.div>
          )}

          {skillFeedbackState === 'rated' && lastSessionResult?.crystallizedSkillId && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex items-center gap-3"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex-1">
                <p className="text-[9px] text-emerald-400 font-bold">Skill crystallized</p>
                <p className="text-[8px] text-white/30">The AI will recall this mix on similar future sessions.</p>
              </div>
              <button onClick={() => setShowSkillLibrary(true)} className="text-[8px] text-emerald-400/60 hover:text-emerald-400 underline underline-offset-2">
                View library
              </button>
            </motion.div>
          )}

          <div className={`flex ${isSmallMobile ? 'flex-col' : ''} gap-4 w-full`}>
            <a
              href={masteredUrl || mixedUrl}
              download="mastered_track.wav"
              className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            >
              <Download className="w-5 h-5" /> Download
            </a>
            <div className="flex gap-4 flex-1">
              <button
                onClick={() => setStep('mix')}
                className="flex-1 px-4 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <Settings2 className="w-5 h-5" /> Tweak
              </button>
              <button
                onClick={reset}
                className="flex-1 px-4 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 font-bold uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" /> New
              </button>
            </div>
          </div>
        </motion.div>

        {/* Reference mastering panel */}
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: isMobile ? 0 : 480, y: isMobile ? 320 : 0, opacity: 1 }}
          className="absolute z-20 w-64 bg-black/40 backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] shadow-2xl pointer-events-auto flex flex-col gap-4"
        >
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/80 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> AI Mastering
          </h3>
          <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl bg-white/5 border border-white/10 border-dashed cursor-pointer hover:bg-white/10 transition-all">
            <Upload className="w-6 h-6 text-white/50 mb-2" />
            <span className="text-[10px] font-mono text-white/50">{referenceBlob ? 'Reference Loaded' : 'Upload Reference'}</span>
            <input type="file" accept="audio/*" onChange={(e) => { if (e.target.files?.[0]) setReferenceBlob(e.target.files[0]); }} className="hidden" />
          </label>
          <button
            onClick={onMastering}
            disabled={!referenceBlob || isMastering}
            className="w-full py-3 px-4 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isMastering ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Layers className="w-4 h-4 text-amber-400" />}
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              {isMastering ? 'Mastering...' : 'Match Reference'}
            </span>
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
