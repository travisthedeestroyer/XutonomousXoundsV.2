import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Key, Sparkles, Settings2, TreePine, Layers } from 'lucide-react';
import { useStudioStore } from './store/useStudioStore';
import { mixAudio } from './lib/audioUtils';
import { runAIAgentNetwork } from './lib/aiMixer';
import { getSkillTreeStats, loadSkillTree } from './lib/agentMemory';

import { UploadStep } from './components/steps/UploadStep';
import { PrepareStep } from './components/steps/PrepareStep';
import { RecordStep } from './components/steps/RecordStep';
import { MixingConsole } from './components/MixingConsole';
import { AIAgentPanel } from './components/AIAgentPanel';
import { ResultStep } from './components/steps/ResultStep';
import { TutorialModal } from './components/TutorialModal';
import { SettingsModal } from './components/SettingsModal';
import { SkillLibrary } from './components/SkillLibrary';

const stepArray = ['upload', 'prepare', 'record', 'mix', 'result'] as const;
const stepNames = { upload: 'Upload', prepare: 'Prepare', record: 'Record', mix: 'Mix', result: 'Master' };


export default function App() {
  const {
    step, setStep,
    hasApiKey, savedApiKey, setHasApiKey,
    isMobile, setIsMobile, isSmallMobile, setIsSmallMobile,
    mobileMixPanel, setMobileMixPanel,
    showSettings, setShowSettings,
    showTutorial, setShowTutorial, tutorialStep, setTutorialStep,
    showSkillLibrary, setShowSkillLibrary,
    originalBeatBlob, beatBlob, vocalBlob, mixedBlob,
    isRecording, isProcessing, isAiMixing,
    settings,
    vocalBlob: vocal, beatBlob: beat, backupVocalBlob,
    aiIterations,
    appendAiLog, setAiLogs, setAiReasoning,
    setIsAiMixing, setActiveAgentPhase,
    setSettings,
    setMixedBlob, setMixedUrl, mixedUrl, addToHistory,
    setIsProcessing,
    isMastering, setIsMastering, setMasteringJobId, setMasteredUrl,
    referenceBlob,
    setLastSessionResult, setSkillFeedbackState,
    setSkillTreeStats,
    setAgentNotesText,
    setSavedApiKey, setManualApiKey,
    setMainVocalBuffer,
  } = useStudioStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const masteringPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Responsive detection
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsSmallMobile(window.innerWidth < 400);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [setIsMobile, setIsSmallMobile]);

  // Load persisted data on mount
  useEffect(() => {
    const stored = localStorage.getItem('gemini_api_key');
    if (stored) { setSavedApiKey(stored); setManualApiKey(stored); }
    if (!localStorage.getItem('tutorial_seen')) setShowTutorial(true);
    const tree = loadSkillTree();
    if (tree.preferences.notesForAgents) setAgentNotesText(tree.preferences.notesForAgents);
    setSkillTreeStats(getSkillTreeStats());
  }, [setSavedApiKey, setManualApiKey, setShowTutorial, setAgentNotesText, setSkillTreeStats]);

  // Cleanup mastering poll on unmount
  useEffect(() => () => { if (masteringPollRef.current) clearInterval(masteringPollRef.current); }, []);

  // Decode vocal blob into AudioBuffer so backup mode can play it during recording
  useEffect(() => {
    if (!vocal) return;
    const AudioContextClass = (window as unknown as Record<string, unknown>).AudioContext as typeof AudioContext;
    const ctx = new AudioContextClass();
    vocal.arrayBuffer().then((buf) => ctx.decodeAudioData(buf)).then((ab) => {
      setMainVocalBuffer(ab);
      ctx.close();
    }).catch(() => ctx.close());
  }, [vocal, setMainVocalBuffer]);

  const handleSelectKey = async () => {
    const aistudio = (window as unknown as Record<string, unknown>).aistudio as Record<string, () => Promise<void>> | undefined;
    if (aistudio?.openSelectKey) {
      try { await aistudio.openSelectKey(); setHasApiKey(true); } catch { setHasApiKey(false); }
    }
  };

  const handleAutoMix = async () => {
    if (!vocal || !beat) return;
    setIsAiMixing(true);
    setAiLogs([]);
    setActiveAgentPhase(null);
    setLastSessionResult(null);
    setSkillFeedbackState('pending');
    try {
      const result = await runAIAgentNetwork(vocal, beat, backupVocalBlob, aiIterations, (log) => {
        appendAiLog(log);
        if (log.phase) setActiveAgentPhase(log.phase);
      });
      setSettings(result.settings);
      setAiReasoning(result.reasoning);
      setLastSessionResult({
        matchedSkillId: result.matchedSkillId,
        detectedGenre: result.detectedGenre,
        vocalAnalysis: result.vocalAnalysis,
        beatAnalysis: result.beatAnalysis,
        masteringNotes: result.reasoning,
        crystallizedSkillId: null,
      });
      appendAiLog({
        agent: 'System',
        message: 'AI Agent Network has successfully configured your mix settings.',
        details: result.matchedSkillId
          ? '✨ Session warm-started from Skill Tree — refined for your tracks.'
          : 'Rate this mix after processing to grow your Skill Tree.',
      });
    } catch (err) {
      appendAiLog({
        agent: 'System Error',
        message: 'Failed to run AI Agent Network.',
        details: err instanceof Error ? err.message : 'Unknown error occurred.',
      });
    } finally {
      setIsAiMixing(false);
      setActiveAgentPhase(null);
    }
  };

  const handleProcess = async () => {
    if (!vocal || !beat) return;
    setIsProcessing(true);
    try {
      const resultBlob = await mixAudio(vocal, beat, backupVocalBlob, settings);
      if (mixedUrl) URL.revokeObjectURL(mixedUrl);
      const url = URL.createObjectURL(resultBlob);
      setMixedBlob(resultBlob);
      setMixedUrl(url);
      addToHistory(url);
      setStep('result');
    } catch (err) {
      console.error('Error processing audio', err);
      alert('An error occurred while processing the audio.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMastering = async () => {
    if (!mixedBlob || !referenceBlob) return;
    setIsMastering(true);
    setMasteringJobId(null);
    setMasteredUrl(null);
    try {
      const formData = new FormData();
      formData.append('target', mixedBlob, 'mixed.wav');
      formData.append('reference', referenceBlob, 'reference.wav');
      const res = await fetch('/api/master', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Mastering request failed');
      const data = await res.json() as { jobId: string };
      setMasteringJobId(data.jobId);
      if (masteringPollRef.current) clearInterval(masteringPollRef.current);
      masteringPollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/master/status/${data.jobId}`);
          const statusData = await statusRes.json() as { status: string; result?: string };
          if (statusData.status === 'completed' && statusData.result) {
            if (masteringPollRef.current) clearInterval(masteringPollRef.current);
            const url = `/api/master/download/${data.jobId}/${statusData.result}`;
            setMasteredUrl(url);
            addToHistory(url);
            setIsMastering(false);
          } else if (statusData.status === 'failed' || statusData.status === 'error') {
            if (masteringPollRef.current) clearInterval(masteringPollRef.current);
            setIsMastering(false);
            alert('Mastering failed.');
          }
        } catch (e) {
          console.error('Error polling mastering status', e);
        }
      }, 2000);
    } catch (err) {
      console.error('Error starting mastering', err);
      setIsMastering(false);
      alert('Failed to start mastering.');
    }
  };

  const handleStepSwipe = (direction: -1 | 1) => {
    const currentIndex = stepArray.indexOf(step as typeof stepArray[number]);
    let newIndex = currentIndex + direction;
    while (newIndex >= 0 && newIndex < stepArray.length) {
      const s = stepArray[newIndex];
      const canNav =
        s === 'upload' ? true :
        s === 'prepare' ? !!originalBeatBlob :
        s === 'record' ? !!beatBlob :
        s === 'mix' ? !!vocalBlob && !!beatBlob :
        s === 'result' ? !!mixedBlob : false;
      if (canNav) { setStep(s); break; }
      newIndex += direction;
    }
  };

  const getOrbColor = () => {
    switch (step) {
      case 'upload':  return 'from-violet-500 via-fuchsia-600 to-indigo-900';
      case 'prepare': return 'from-blue-500 via-indigo-600 to-blue-900';
      case 'record':  return isRecording ? 'from-rose-500 via-red-600 to-rose-900' : 'from-cyan-500 via-blue-600 to-cyan-900';
      case 'mix':     return 'from-amber-500 via-violet-600 to-fuchsia-900';
      case 'result':  return 'from-emerald-500 via-teal-600 to-emerald-900';
      default:        return 'from-violet-500 via-fuchsia-600 to-indigo-900';
    }
  };

  return (
    <>
      {/* API key gate */}
      {!hasApiKey && !savedApiKey && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-md w-full shadow-2xl flex flex-col items-center text-center">
            <Sparkles className="w-12 h-12 text-amber-400 mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">API Key Required</h2>
            <p className="text-zinc-400 mb-6 leading-relaxed">To use the AI-powered mixing and mastering features, provide a Gemini API key.</p>
            <div className="w-full flex flex-col gap-3">
              <button onClick={handleSelectKey} className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors uppercase tracking-widest text-sm">Select via AI Studio</button>
              <button onClick={() => setShowSettings(true)} className="w-full py-3 bg-white/5 border border-white/10 text-white/70 font-bold rounded-xl hover:bg-white/10 transition-colors uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                <Key className="w-4 h-4" /> Enter Key Manually
              </button>
            </div>
          </div>
        </div>
      )}

      <TutorialModal />
      <SettingsModal />
      <SkillLibrary />

      {/* Lyrics teleprompter overlay */}
      <LyricsOverlay />

      <div className="min-h-screen bg-black text-white overflow-hidden relative">
        {/* Ambient orb */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            animate={{ background: `radial-gradient(ellipse at center, ${getOrbColor().split(' ').join(', ')})` }}
            transition={{ duration: 1.5 }}
            className={`w-[600px] h-[600px] rounded-full bg-gradient-radial ${getOrbColor()} opacity-20 blur-3xl`}
          />
        </div>

        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-black/20 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white/60" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-white/80">Xocal Studio</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSkillLibrary(true)} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <TreePine className="w-4 h-4 text-emerald-400" />
            </button>
            <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <Settings2 className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </header>

        {/* Main stage */}
        <motion.main className="fixed inset-0 flex items-center justify-center" style={{ perspective: '1200px' }}>
          <AnimatePresence mode="wait">
            {step === 'upload' && <UploadStep key="upload" />}
            {step === 'prepare' && <PrepareStep key="prepare" />}
            {step === 'record' && (
              <RecordStep
                key="record"
                canvasRef={canvasRef}
                onRecordingComplete={() => setStep('mix')}
              />
            )}
            {step === 'mix' && (
              <motion.div
                key="mix"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                {/* Mobile panel toggles */}
                {isMobile && mobileMixPanel === 'none' && (
                  <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: -180, opacity: 1 }}
                    className="absolute z-20 flex gap-4 pointer-events-auto"
                  >
                    <button onClick={() => setMobileMixPanel('console')} className="px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-black/40 backdrop-blur-2xl border border-white/10 text-white shadow-2xl flex items-center gap-2">
                      <Settings2 className="w-4 h-4" /> Console
                    </button>
                    <button onClick={() => setMobileMixPanel('ai')} className="px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-black/40 backdrop-blur-2xl border border-white/10 text-amber-400 shadow-2xl flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> AI Agent
                    </button>
                  </motion.div>
                )}

                <MixingConsole />

                {/* Center process button */}
                <AnimatePresence>
                  {(!isMobile || mobileMixPanel === 'none') && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute z-30 flex flex-col items-center pointer-events-auto"
                    >
                      <button
                        onClick={handleProcess}
                        disabled={isProcessing || isAiMixing}
                        className={`${isSmallMobile ? 'w-52 h-52' : 'w-64 h-64'} rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center hover:bg-black/40 hover:scale-105 transition-all shadow-2xl disabled:opacity-50 disabled:hover:scale-100`}
                      >
                        {isProcessing
                          ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Layers className={`${isSmallMobile ? 'w-10 h-10' : 'w-12 h-12'} text-white/90 mb-3`} /></motion.div>
                          : <Layers className={`${isSmallMobile ? 'w-10 h-10' : 'w-12 h-12'} text-white/90 mb-3`} />}
                        <span className={`${isSmallMobile ? 'text-[10px]' : 'text-xs'} font-bold uppercase tracking-widest text-white/90 text-center leading-tight`}>
                          {isProcessing ? 'Mastering...' : 'Process\n&\nMaster'}
                        </span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AIAgentPanel onDeploy={handleAutoMix} />
              </motion.div>
            )}
            {step === 'result' && <ResultStep key="result" onMastering={handleMastering} />}
          </AnimatePresence>
        </motion.main>

        {/* Infinity Wheel Step Navigation */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-6 pointer-events-none">
          <div className="relative flex items-center justify-center bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full h-24 shadow-2xl overflow-hidden pointer-events-auto" style={{ perspective: '1200px' }}>
            <motion.div
              className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
              style={{ transformStyle: 'preserve-3d', touchAction: 'none' }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.1}
              onDragEnd={(_, info) => {
                if (info.offset.x < -40) handleStepSwipe(1);
                if (info.offset.x > 40) handleStepSwipe(-1);
              }}
            >
              <AnimatePresence>
                {stepArray.map((s, i) => {
                  const isActive = step === s;
                  const currentIndex = stepArray.indexOf(step as typeof stepArray[number]);
                  const offset = i - currentIndex;
                  const distance = Math.abs(offset);
                  const canNav =
                    s === 'upload' ? true :
                    s === 'prepare' ? !!originalBeatBlob :
                    s === 'record' ? !!beatBlob :
                    s === 'mix' ? !!vocalBlob && !!beatBlob :
                    s === 'result' ? !!mixedBlob : false;
                  return (
                    <motion.button
                      key={s}
                      onClick={() => canNav && setStep(s)}
                      disabled={!canNav}
                      initial={false}
                      animate={{
                        x: offset * (isSmallMobile ? 90 : 110),
                        z: -distance * 60,
                        rotateY: offset * -25,
                        scale: isActive ? 1.2 : Math.max(0.7, 1 - distance * 0.15),
                        opacity: canNav ? (isActive ? 1 : Math.max(0, 0.5 - distance * 0.2)) : 0.15,
                      }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className={`absolute text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap px-4 py-2 rounded-full transition-colors ${isActive ? 'text-white bg-white/10 drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]' : 'text-white/50'} ${!canNav ? 'cursor-not-allowed' : 'hover:text-white hover:bg-white/5'}`}
                      style={{ zIndex: 10 - distance }}
                    >
                      {stepNames[s]}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}

function LyricsOverlay() {
  const { showLyrics, setShowLyrics, lyrics, isRecording } = useStudioStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRecording || !showLyrics || !scrollRef.current) return;
    const el = scrollRef.current;
    const id = setInterval(() => { el.scrollTop += 1; }, 50);
    return () => clearInterval(id);
  }, [isRecording, showLyrics]);

  if (!showLyrics) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="fixed bottom-36 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-6 pointer-events-auto"
    >
      <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Teleprompter</span>
          <button onClick={() => setShowLyrics(false)} className="text-white/30 hover:text-white/70 text-[9px] uppercase tracking-widest">Hide</button>
        </div>
        <div ref={scrollRef} className="max-h-40 overflow-y-auto no-scrollbar">
          <p className="text-white/80 text-sm leading-relaxed font-sans whitespace-pre-wrap">{lyrics || 'No lyrics yet. Add them in the Prepare step.'}</p>
        </div>
      </div>
    </motion.div>
  );
}
