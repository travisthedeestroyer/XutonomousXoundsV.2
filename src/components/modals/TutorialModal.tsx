import { motion, AnimatePresence } from 'motion/react';
import { Upload, FastForward, Mic, Sliders, Download, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStudioStore } from '@/state/store';

const TUTORIAL_STEPS = [
  {
    icon: Upload,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    title: 'Upload Your Beat',
    description:
      'Start by tapping the glowing orb or dropping any audio file (MP3, WAV, etc.) onto it. This becomes the instrumental backing track for your recording.',
  },
  {
    icon: FastForward,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    title: 'Prepare the Beat',
    description:
      "Fine-tune the beat's speed and pitch before recording. The BPM is detected automatically. You can also extract individual stems using the AI separator.",
  },
  {
    icon: Mic,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    title: 'Record Your Vocals',
    description:
      'Hit the microphone button to record over the beat. Enable the metronome for timing help, or the monitor to hear yourself in real time.',
  },
  {
    icon: Sliders,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    title: 'Mix & Master with AI',
    description:
      'Manually tweak EQ, compression, reverb and more — or deploy the AI Agent Network for automatic professional mix settings.',
  },
  {
    icon: Download,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    title: 'Download Your Track',
    description:
      'Your finished mix is exported as a high-quality WAV. Optionally upload a reference track to match its loudness and tone before downloading.',
  },
];

/** Five-step onboarding walkthrough. */
export function TutorialModal() {
  const { showTutorial, setShowTutorial, tutorialStep, setTutorialStep } = useStudioStore();

  const close = () => {
    setShowTutorial(false);
    localStorage.setItem('tutorial_seen', '1');
  };

  return (
    <AnimatePresence>
      {showTutorial && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20 }}
            className="bg-zinc-950 border border-white/10 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden"
          >
            <div className="h-0.5 bg-white/5 w-full">
              <motion.div
                className="h-full bg-white/30"
                animate={{ width: `${((tutorialStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>

            <div className="p-8 flex flex-col gap-6">
              <div className="flex gap-1.5 justify-center">
                {TUTORIAL_STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setTutorialStep(i)}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === tutorialStep ? 'w-6 bg-white' : 'w-1.5 bg-white/20'
                    }`}
                  />
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tutorialStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col items-center text-center gap-5"
                >
                  {(() => {
                    const s = TUTORIAL_STEPS[tutorialStep];
                    const Icon = s.icon;
                    return (
                      <>
                        <div className={`w-16 h-16 rounded-2xl ${s.bg} border ${s.border} flex items-center justify-center`}>
                          <Icon className={`w-8 h-8 ${s.color}`} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">
                            Step {tutorialStep + 1} of {TUTORIAL_STEPS.length}
                          </p>
                          <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                          <p className="text-sm text-white/60 leading-relaxed">{s.description}</p>
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>

              <div className="flex gap-3">
                {tutorialStep > 0 && (
                  <button
                    onClick={() => setTutorialStep(tutorialStep - 1)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/60 font-bold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                )}
                {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                  <button
                    onClick={() => setTutorialStep(tutorialStep + 1)}
                    className="flex-1 py-3 bg-white text-black rounded-2xl font-bold text-sm hover:bg-white/90 transition-all flex items-center justify-center gap-2"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={close}
                    className="flex-1 py-3 bg-white text-black rounded-2xl font-bold text-sm hover:bg-white/90 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Let's Go
                  </button>
                )}
              </div>

              {tutorialStep < TUTORIAL_STEPS.length - 1 && (
                <button
                  onClick={close}
                  className="text-[10px] text-white/20 hover:text-white/50 transition-colors uppercase tracking-widest text-center"
                >
                  Skip tutorial
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
