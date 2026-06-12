import { motion, AnimatePresence } from 'motion/react';
import { Settings2, Mic, Music, Sparkles, ChevronRight, Layers, X, Activity, Waves, Flame, Volume2, SplitSquareHorizontal } from 'lucide-react';
import { useStudioStore } from '@/state/store';
import { applyGenrePreset } from '@/audio';
import { ProSlider } from './ui/ProSlider';

/** Manual mixing console — every MixSettings parameter exposed as a slider. */
export function MixingConsole() {
  const {
    isMobile, isSmallMobile,
    mobileMixPanel, setMobileMixPanel,
    settings, setSettings,
    backupVocalBlob,
  } = useStudioStore();

  return (
    <AnimatePresence>
      {(!isMobile || mobileMixPanel === 'console') && (
        <motion.div
          initial={{ x: isMobile ? 0 : -100, y: isMobile ? 50 : 0, opacity: 0 }}
          animate={{ x: isMobile ? 0 : -380, y: 0, scale: 1, opacity: 1 }}
          exit={{ x: isMobile ? 0 : -100, y: isMobile ? 50 : 0, opacity: 0 }}
          className={`absolute z-40 ${isMobile ? (isSmallMobile ? 'w-[92vw]' : 'w-80') : 'w-80'} bg-black/80 backdrop-blur-3xl border border-white/10 p-5 rounded-[2rem] shadow-2xl flex flex-col gap-3 max-h-[80vh] overflow-y-auto no-scrollbar pointer-events-auto ${isMobile ? 'h-[70vh] pb-20' : ''}`}
        >
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-lg font-bold uppercase tracking-widest text-white/90 flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Console
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">Production-grade DSP engine</p>
            </div>
            {isMobile && (
              <button onClick={() => setMobileMixPanel('none')} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>

          {/* Genre presets */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-3">
            <label className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Genre Preset</label>
            <div className="grid grid-cols-4 gap-1">
              {(['hip-hop', 'pop', 'electronic', 'acoustic'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setSettings(applyGenrePreset(g))}
                  className={`px-2 py-2 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all ${settings.genrePreset === g ? 'bg-violet-500 text-white shadow-lg' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'}`}
                >
                  {g === 'hip-hop' ? 'HIP HOP' : g === 'electronic' ? 'EDM' : g.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Vocal chain */}
          <details open className="group">
            <summary className="flex items-center gap-2 cursor-pointer select-none py-2 px-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
              <Mic className="w-3 h-3 text-violet-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400 flex-1">Vocal Chain</span>
              <ChevronRight className="w-3 h-3 text-violet-400/50 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-2 flex flex-col gap-3 pl-1">
              <ProSlider label="Vocal Level" icon={Mic} value={settings.vocalVolume} min={0} max={2} step={0.05} onChange={(v) => setSettings({ ...settings, vocalVolume: v })} formatValue={(v) => `${Math.round(v * 100)}%`} colorClass="bg-violet-500" glowClass="shadow-violet-500/50" />
              {backupVocalBlob && (
                <ProSlider label="Backup Level" icon={Layers} value={settings.backupVolume} min={0} max={2} step={0.05} onChange={(v) => setSettings({ ...settings, backupVolume: v })} formatValue={(v) => `${Math.round(v * 100)}%`} colorClass="bg-pink-500" glowClass="shadow-pink-500/50" />
              )}
              <div className="bg-white/3 rounded-lg p-2 border border-white/5">
                <span className="text-[8px] font-bold uppercase tracking-widest text-white/30 block mb-2">EQ</span>
                <div className="flex flex-col gap-2">
                  <ProSlider label="HPF Cutoff" icon={Activity} value={settings.vocalEQ.lowCutFreq} min={60} max={200} step={5} onChange={(v) => setSettings({ ...settings, vocalEQ: { ...settings.vocalEQ, lowCutFreq: v } })} formatValue={(v) => `${v}Hz`} colorClass="bg-violet-400" glowClass="shadow-violet-400/50" />
                  <ProSlider label="Mud Cut" icon={Activity} value={settings.vocalEQ.lowMidGain} min={-8} max={4} step={0.5} onChange={(v) => setSettings({ ...settings, vocalEQ: { ...settings.vocalEQ, lowMidGain: v } })} formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`} colorClass="bg-violet-400" glowClass="shadow-violet-400/50" />
                  <ProSlider label="Presence" icon={Activity} value={settings.vocalEQ.presenceGain} min={-4} max={6} step={0.5} onChange={(v) => setSettings({ ...settings, vocalEQ: { ...settings.vocalEQ, presenceGain: v } })} formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`} colorClass="bg-violet-400" glowClass="shadow-violet-400/50" />
                  <ProSlider label="Air" icon={Activity} value={settings.vocalEQ.airGain} min={0} max={6} step={0.5} onChange={(v) => setSettings({ ...settings, vocalEQ: { ...settings.vocalEQ, airGain: v } })} formatValue={(v) => `+${v}dB`} colorClass="bg-violet-400" glowClass="shadow-violet-400/50" />
                </div>
              </div>
              <div className="bg-white/3 rounded-lg p-2 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">De-Esser</span>
                  <button onClick={() => setSettings({ ...settings, deEsser: { ...settings.deEsser, enabled: !settings.deEsser.enabled } })} className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${settings.deEsser.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-white/30 border border-white/10'}`}>
                    {settings.deEsser.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {settings.deEsser.enabled && (
                  <div className="flex flex-col gap-2">
                    <ProSlider label="Frequency" icon={Activity} value={settings.deEsser.frequency} min={4000} max={10000} step={100} onChange={(v) => setSettings({ ...settings, deEsser: { ...settings.deEsser, frequency: v } })} formatValue={(v) => `${(v / 1000).toFixed(1)}kHz`} colorClass="bg-amber-500" glowClass="shadow-amber-500/50" />
                    <ProSlider label="Threshold" icon={Activity} value={settings.deEsser.threshold} min={-40} max={-10} step={1} onChange={(v) => setSettings({ ...settings, deEsser: { ...settings.deEsser, threshold: v } })} formatValue={(v) => `${v}dB`} colorClass="bg-amber-500" glowClass="shadow-amber-500/50" />
                  </div>
                )}
              </div>
              <div className="bg-white/3 rounded-lg p-2 border border-white/5">
                <span className="text-[8px] font-bold uppercase tracking-widest text-white/30 block mb-2">Compressor</span>
                <div className="flex flex-col gap-2">
                  <ProSlider label="Threshold" icon={Activity} value={settings.vocalCompressor.threshold} min={-40} max={-10} step={1} onChange={(v) => setSettings({ ...settings, vocalCompressor: { ...settings.vocalCompressor, threshold: v } })} formatValue={(v) => `${v}dB`} colorClass="bg-rose-500" glowClass="shadow-rose-500/50" />
                  <ProSlider label="Ratio" icon={Activity} value={settings.vocalCompressor.ratio} min={2} max={8} step={0.5} onChange={(v) => setSettings({ ...settings, vocalCompressor: { ...settings.vocalCompressor, ratio: v } })} formatValue={(v) => `${v}:1`} colorClass="bg-rose-500" glowClass="shadow-rose-500/50" />
                </div>
              </div>
              <div className="bg-white/3 rounded-lg p-2 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Parallel Comp (NY)</span>
                  <button onClick={() => setSettings({ ...settings, parallelCompression: { ...settings.parallelCompression, enabled: !settings.parallelCompression.enabled } })} className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${settings.parallelCompression.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-white/30 border border-white/10'}`}>
                    {settings.parallelCompression.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {settings.parallelCompression.enabled && (
                  <ProSlider label="Blend" icon={Activity} value={settings.parallelCompression.wetDry} min={0} max={1} step={0.05} onChange={(v) => setSettings({ ...settings, parallelCompression: { ...settings.parallelCompression, wetDry: v } })} formatValue={(v) => `${Math.round(v * 100)}%`} colorClass="bg-rose-400" glowClass="shadow-rose-400/50" />
                )}
              </div>
              <ProSlider label="Saturation" icon={Flame} value={settings.saturation} min={0} max={1} step={0.05} onChange={(v) => setSettings({ ...settings, saturation: v })} formatValue={(v) => `${Math.round(v * 100)}%`} colorClass="bg-orange-500" glowClass="shadow-orange-500/50" />
              <ProSlider label="Reverb" icon={Waves} value={settings.reverb} min={0} max={1} step={0.05} onChange={(v) => setSettings({ ...settings, reverb: v })} formatValue={(v) => `${Math.round(v * 100)}%`} colorClass="bg-cyan-500" glowClass="shadow-cyan-500/50" />
              <ProSlider label="Reverb Decay" icon={Waves} value={settings.reverbDecay} min={0.5} max={5} step={0.1} onChange={(v) => setSettings({ ...settings, reverbDecay: v })} formatValue={(v) => `${v.toFixed(1)}s`} colorClass="bg-cyan-400" glowClass="shadow-cyan-400/50" />
              <ProSlider label="Delay" icon={Volume2} value={settings.echo} min={0} max={1} step={0.05} onChange={(v) => setSettings({ ...settings, echo: v })} formatValue={(v) => `${Math.round(v * 100)}%`} colorClass="bg-emerald-500" glowClass="shadow-emerald-500/50" />
              <ProSlider label="Doubler" icon={SplitSquareHorizontal} value={settings.doubler} min={0} max={1} step={0.05} onChange={(v) => setSettings({ ...settings, doubler: v })} formatValue={(v) => `${Math.round(v * 100)}%`} colorClass="bg-indigo-500" glowClass="shadow-indigo-500/50" />
            </div>
          </details>

          {/* Beat chain */}
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer select-none py-2 px-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <Music className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 flex-1">Beat Chain</span>
              <ChevronRight className="w-3 h-3 text-blue-400/50 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-2 flex flex-col gap-3 pl-1">
              <ProSlider label="Beat Level" icon={Music} value={settings.beatVolume} min={0} max={2} step={0.05} onChange={(v) => setSettings({ ...settings, beatVolume: v })} formatValue={(v) => `${Math.round(v * 100)}%`} colorClass="bg-blue-500" glowClass="shadow-blue-500/50" />
              <div className="bg-white/3 rounded-lg p-2 border border-white/5">
                <span className="text-[8px] font-bold uppercase tracking-widest text-white/30 block mb-2">Beat EQ</span>
                <div className="flex flex-col gap-2">
                  <ProSlider label="Bass" icon={Activity} value={settings.beatEQ.lowGain} min={-6} max={6} step={0.5} onChange={(v) => setSettings({ ...settings, beatEQ: { ...settings.beatEQ, lowGain: v } })} formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`} colorClass="bg-blue-400" glowClass="shadow-blue-400/50" />
                  <ProSlider label="Low-Mid" icon={Activity} value={settings.beatEQ.lowMidGain} min={-6} max={6} step={0.5} onChange={(v) => setSettings({ ...settings, beatEQ: { ...settings.beatEQ, lowMidGain: v } })} formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`} colorClass="bg-blue-400" glowClass="shadow-blue-400/50" />
                  <ProSlider label="Vocal Space Cut" icon={Activity} value={settings.beatEQ.highMidGain} min={-6} max={6} step={0.5} onChange={(v) => setSettings({ ...settings, beatEQ: { ...settings.beatEQ, highMidGain: v } })} formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`} colorClass="bg-blue-400" glowClass="shadow-blue-400/50" />
                  <ProSlider label="Highs" icon={Activity} value={settings.beatEQ.highGain} min={-6} max={6} step={0.5} onChange={(v) => setSettings({ ...settings, beatEQ: { ...settings.beatEQ, highGain: v } })} formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`} colorClass="bg-blue-400" glowClass="shadow-blue-400/50" />
                </div>
              </div>
              <ProSlider label="Sidechain Duck" icon={Activity} value={settings.sidechainDuck} min={0} max={1} step={0.05} onChange={(v) => setSettings({ ...settings, sidechainDuck: v })} formatValue={(v) => `${Math.round(v * 100)}%`} colorClass="bg-blue-300" glowClass="shadow-blue-300/50" />
            </div>
          </details>

          {/* Mastering chain */}
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer select-none py-2 px-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <Sparkles className="w-3 h-3 text-rose-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400 flex-1">Mastering</span>
              <ChevronRight className="w-3 h-3 text-rose-400/50 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-2 flex flex-col gap-3 pl-1">
              <ProSlider label="Stereo Width" icon={SplitSquareHorizontal} value={settings.stereoImaging.width} min={0.5} max={2} step={0.05} onChange={(v) => setSettings({ ...settings, stereoImaging: { ...settings.stereoImaging, width: v } })} formatValue={(v) => `${Math.round(v * 100)}%`} colorClass="bg-rose-500" glowClass="shadow-rose-500/50" />
              <ProSlider label="Bass Mono" icon={Activity} value={settings.stereoImaging.bassMonoCutoff} min={0} max={300} step={10} onChange={(v) => setSettings({ ...settings, stereoImaging: { ...settings.stereoImaging, bassMonoCutoff: v } })} formatValue={(v) => `${v}Hz`} colorClass="bg-rose-400" glowClass="shadow-rose-400/50" />
              <ProSlider label="Soft Clip" icon={Activity} value={settings.softClipAmount} min={0} max={1} step={0.05} onChange={(v) => setSettings({ ...settings, softClipAmount: v })} formatValue={(v) => `${Math.round(v * 100)}%`} colorClass="bg-rose-400" glowClass="shadow-rose-400/50" />
              <ProSlider label="Master Gain" icon={Volume2} value={settings.masterGain} min={0.5} max={2} step={0.05} onChange={(v) => setSettings({ ...settings, masterGain: v })} formatValue={(v) => `${Math.round(v * 100)}%`} colorClass="bg-rose-500" glowClass="shadow-rose-500/50" />
              <div className="bg-white/3 rounded-lg p-2 border border-white/5">
                <span className="text-[8px] font-bold uppercase tracking-widest text-white/30 block mb-2">Limiter</span>
                <ProSlider label="Ceiling" icon={Activity} value={settings.masterLimiter.ceiling} min={-3} max={0} step={0.1} onChange={(v) => setSettings({ ...settings, masterLimiter: { ...settings.masterLimiter, ceiling: v } })} formatValue={(v) => `${v.toFixed(1)} dBTP`} colorClass="bg-red-500" glowClass="shadow-red-500/50" />
              </div>
              <div className="bg-gradient-to-r from-amber-500/10 to-rose-500/10 rounded-lg p-3 border border-amber-500/20">
                <ProSlider label="LUFS Target" icon={Activity} value={settings.lufsTarget} min={-14} max={-6} step={0.5} onChange={(v) => setSettings({ ...settings, lufsTarget: v })} formatValue={(v) => `${v} LUFS`} colorClass="bg-amber-500" glowClass="shadow-amber-500/50" />
              </div>
            </div>
          </details>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
