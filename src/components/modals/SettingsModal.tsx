import { motion, AnimatePresence } from 'motion/react';
import { Settings2, Key, CheckCircle2, Eye, EyeOff, HelpCircle, ChevronRight, X, Sparkles } from 'lucide-react';
import { useStudioStore } from '@/state/store';

/** Settings — manual Gemini key entry, AI Studio key picker, tutorial replay. */
export function SettingsModal() {
  const {
    showSettings, setShowSettings,
    manualApiKey, setManualApiKey,
    savedApiKey, setSavedApiKey,
    showKeyValue, setShowKeyValue,
    setHasApiKey,
    setShowTutorial, setTutorialStep,
  } = useStudioStore();

  const handleSave = () => {
    const trimmed = manualApiKey.trim();
    if (!trimmed) return;
    localStorage.setItem('gemini_api_key', trimmed);
    setSavedApiKey(trimmed);
    setHasApiKey(true);
    setShowSettings(false);
  };

  const handleClear = () => {
    localStorage.removeItem('gemini_api_key');
    setSavedApiKey('');
    setManualApiKey('');
    setHasApiKey(false);
  };

  // AI Studio key picker (available when running inside AI Studio)
  const aistudio = (window as unknown as Record<string, unknown>).aistudio as Record<string, () => Promise<void>> | undefined;
  const handleSelectKey = async () => {
    if (!aistudio?.openSelectKey) return;
    try { await aistudio.openSelectKey(); setHasApiKey(true); } catch { setHasApiKey(false); }
  };

  return (
    <AnimatePresence>
      {showSettings && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20 }}
            className="bg-zinc-950 border border-white/10 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Settings2 className="w-4 h-4 text-white/60" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-white">Settings</h2>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-white/30 hover:text-white/80 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                    Gemini API Key
                  </label>
                  {savedApiKey && (
                    <span className="ml-auto flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Saved
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/30 leading-relaxed">
                  Optional — without a key the studio uses a deterministic DSP Smart Mix. Add a free key from{' '}
                  <span className="text-amber-400/70">aistudio.google.com</span> to unlock the full Gemini agent network and AI lyrics.
                </p>
                <div className="relative">
                  <input
                    type={showKeyValue ? 'text' : 'password'}
                    value={manualApiKey}
                    onChange={(e) => setManualApiKey(e.target.value)}
                    placeholder="AIza..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-white/20 font-mono transition-all"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                  />
                  <button
                    onClick={() => setShowKeyValue(!showKeyValue)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  >
                    {showKeyValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={!manualApiKey.trim()}
                    className="flex-1 py-2.5 bg-white text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Save Key
                  </button>
                  {savedApiKey && (
                    <button
                      onClick={handleClear}
                      className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-red-500/20 transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {aistudio?.openSelectKey && (
                  <button
                    onClick={handleSelectKey}
                    className="w-full py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Select via AI Studio
                  </button>
                )}
              </div>

              <div className="border-t border-white/5" />

              <button
                onClick={() => {
                  setShowSettings(false);
                  setTutorialStep(0);
                  setShowTutorial(true);
                }}
                className="flex items-center gap-3 w-full p-4 bg-white/[0.03] hover:bg-white/5 border border-white/5 rounded-2xl transition-all group"
              >
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-violet-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-white/70">View Tutorial</p>
                  <p className="text-[10px] text-white/30">Replay the getting started guide</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 ml-auto group-hover:text-white/50 transition-colors" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
