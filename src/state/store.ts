import { create, type StateCreator } from 'zustand';
import { type MixSettings, defaultMixSettings } from '@/audio';
import type { AILog } from '@/ai';
import type { SkillTreeStats } from '@/ai';

export type AppStep = 'upload' | 'prepare' | 'record' | 'mix' | 'result';
export type RecordingMode = 'main' | 'backup';
export type MobileMixPanel = 'none' | 'console' | 'ai';

export interface SessionResult {
  matchedSkillId: string | null;
  detectedGenre: string;
  vocalAnalysis: unknown;
  beatAnalysis: unknown;
  masteringNotes: string;
  crystallizedSkillId: string | null;
}

export interface HistoryItem {
  id: string;
  name: string;
  date: string;
  url: string;
}

// ── App / UI slice ───────────────────────────────────────────────────────────

interface AppSlice {
  step: AppStep;
  setStep: (step: AppStep) => void;

  hasApiKey: boolean;
  setHasApiKey: (has: boolean) => void;
  savedApiKey: string;
  setSavedApiKey: (key: string) => void;
  manualApiKey: string;
  setManualApiKey: (key: string) => void;

  isMobile: boolean;
  setIsMobile: (v: boolean) => void;
  isSmallMobile: boolean;
  setIsSmallMobile: (v: boolean) => void;
  mobileMixPanel: MobileMixPanel;
  setMobileMixPanel: (panel: MobileMixPanel) => void;

  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  showTutorial: boolean;
  setShowTutorial: (v: boolean) => void;
  tutorialStep: number;
  setTutorialStep: (step: number) => void;
  showSkillLibrary: boolean;
  setShowSkillLibrary: (v: boolean) => void;
  showKeyValue: boolean;
  setShowKeyValue: (v: boolean) => void;
}

const createAppSlice: StateCreator<StudioState, [], [], AppSlice> = (set) => ({
  step: 'upload',
  setStep: (step) => set({ step }),

  hasApiKey: false,
  setHasApiKey: (hasApiKey) => set({ hasApiKey }),
  savedApiKey: '',
  setSavedApiKey: (savedApiKey) => set({ savedApiKey }),
  manualApiKey: '',
  setManualApiKey: (manualApiKey) => set({ manualApiKey }),

  isMobile: false,
  setIsMobile: (isMobile) => set({ isMobile }),
  isSmallMobile: false,
  setIsSmallMobile: (isSmallMobile) => set({ isSmallMobile }),
  mobileMixPanel: 'none',
  setMobileMixPanel: (mobileMixPanel) => set({ mobileMixPanel }),

  showSettings: false,
  setShowSettings: (showSettings) => set({ showSettings }),
  showTutorial: false,
  setShowTutorial: (showTutorial) => set({ showTutorial }),
  tutorialStep: 0,
  setTutorialStep: (tutorialStep) => set({ tutorialStep }),
  showSkillLibrary: false,
  setShowSkillLibrary: (showSkillLibrary) => set({ showSkillLibrary }),
  showKeyValue: false,
  setShowKeyValue: (showKeyValue) => set({ showKeyValue }),
});

// ── Beat slice ───────────────────────────────────────────────────────────────

interface BeatSlice {
  originalBeatBlob: Blob | null;
  setOriginalBeatBlob: (blob: Blob | null) => void;
  beatBlob: Blob | null;
  setBeatBlob: (blob: Blob | null) => void;
  beatUrl: string | null;
  setBeatUrl: (url: string | null) => void;
  beatSpeed: number;
  setBeatSpeed: (speed: number) => void;
  beatPitch: number;
  setBeatPitch: (pitch: number) => void;
  isProcessingBeat: boolean;
  setIsProcessingBeat: (v: boolean) => void;
  detectedBpm: number | null;
  setDetectedBpm: (bpm: number | null) => void;
  isAnalyzingBpm: boolean;
  setIsAnalyzingBpm: (v: boolean) => void;
  beatBuffer: AudioBuffer | null;
  setBeatBuffer: (buf: AudioBuffer | null) => void;

  isSeparating: boolean;
  setIsSeparating: (v: boolean) => void;
  separatedStems: string[];
  setSeparatedStems: (stems: string[]) => void;
  separationJobId: string | null;
  setSeparationJobId: (id: string | null) => void;
}

const createBeatSlice: StateCreator<StudioState, [], [], BeatSlice> = (set) => ({
  originalBeatBlob: null,
  setOriginalBeatBlob: (originalBeatBlob) => set({ originalBeatBlob }),
  beatBlob: null,
  setBeatBlob: (beatBlob) => set({ beatBlob }),
  beatUrl: null,
  setBeatUrl: (beatUrl) => set({ beatUrl }),
  beatSpeed: 1.0,
  setBeatSpeed: (beatSpeed) => set({ beatSpeed }),
  beatPitch: 0,
  setBeatPitch: (beatPitch) => set({ beatPitch }),
  isProcessingBeat: false,
  setIsProcessingBeat: (isProcessingBeat) => set({ isProcessingBeat }),
  detectedBpm: null,
  setDetectedBpm: (detectedBpm) => set({ detectedBpm }),
  isAnalyzingBpm: false,
  setIsAnalyzingBpm: (isAnalyzingBpm) => set({ isAnalyzingBpm }),
  beatBuffer: null,
  setBeatBuffer: (beatBuffer) => set({ beatBuffer }),

  isSeparating: false,
  setIsSeparating: (isSeparating) => set({ isSeparating }),
  separatedStems: [],
  setSeparatedStems: (separatedStems) => set({ separatedStems }),
  separationJobId: null,
  setSeparationJobId: (separationJobId) => set({ separationJobId }),
});

// ── Vocal / recording slice ──────────────────────────────────────────────────

interface VocalSlice {
  vocalBlob: Blob | null;
  setVocalBlob: (blob: Blob | null) => void;
  vocalUrl: string | null;
  setVocalUrl: (url: string | null) => void;
  backupVocalBlob: Blob | null;
  setBackupVocalBlob: (blob: Blob | null) => void;
  backupVocalUrl: string | null;
  setBackupVocalUrl: (url: string | null) => void;
  recordingMode: RecordingMode;
  setRecordingMode: (mode: RecordingMode) => void;
  useEchoCancellation: boolean;
  setUseEchoCancellation: (v: boolean) => void;
  useMonitor: boolean;
  setUseMonitor: (v: boolean) => void;
  useMetronome: boolean;
  setUseMetronome: (v: boolean) => void;
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;
  mainVocalBuffer: AudioBuffer | null;
  setMainVocalBuffer: (buf: AudioBuffer | null) => void;

  lyrics: string;
  setLyrics: (text: string) => void;
  isGeneratingLyrics: boolean;
  setIsGeneratingLyrics: (v: boolean) => void;
  showLyrics: boolean;
  setShowLyrics: (v: boolean) => void;
}

const createVocalSlice: StateCreator<StudioState, [], [], VocalSlice> = (set) => ({
  vocalBlob: null,
  setVocalBlob: (vocalBlob) => set({ vocalBlob }),
  vocalUrl: null,
  setVocalUrl: (vocalUrl) => set({ vocalUrl }),
  backupVocalBlob: null,
  setBackupVocalBlob: (backupVocalBlob) => set({ backupVocalBlob }),
  backupVocalUrl: null,
  setBackupVocalUrl: (backupVocalUrl) => set({ backupVocalUrl }),
  recordingMode: 'main',
  setRecordingMode: (recordingMode) => set({ recordingMode }),
  useEchoCancellation: false,
  setUseEchoCancellation: (useEchoCancellation) => set({ useEchoCancellation }),
  useMonitor: false,
  setUseMonitor: (useMonitor) => set({ useMonitor }),
  useMetronome: false,
  setUseMetronome: (useMetronome) => set({ useMetronome }),
  isRecording: false,
  setIsRecording: (isRecording) => set({ isRecording }),
  mainVocalBuffer: null,
  setMainVocalBuffer: (mainVocalBuffer) => set({ mainVocalBuffer }),

  lyrics: '',
  setLyrics: (lyrics) => set({ lyrics }),
  isGeneratingLyrics: false,
  setIsGeneratingLyrics: (isGeneratingLyrics) => set({ isGeneratingLyrics }),
  showLyrics: false,
  setShowLyrics: (showLyrics) => set({ showLyrics }),
});

// ── Mix / AI slice ───────────────────────────────────────────────────────────

interface MixSlice {
  settings: MixSettings;
  setSettings: (settings: MixSettings) => void;
  mixedBlob: Blob | null;
  setMixedBlob: (blob: Blob | null) => void;
  mixedUrl: string | null;
  setMixedUrl: (url: string | null) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;

  aiIterations: number;
  setAiIterations: (n: number) => void;
  rawMixUrl: string | null;
  setRawMixUrl: (url: string | null) => void;
  isAiMixing: boolean;
  setIsAiMixing: (v: boolean) => void;
  aiLogs: AILog[];
  setAiLogs: (logs: AILog[]) => void;
  appendAiLog: (log: AILog) => void;
  aiReasoning: string;
  setAiReasoning: (text: string) => void;
  expandedLogIndex: number | null;
  setExpandedLogIndex: (idx: number | null) => void;
  activeAgentPhase: string | null;
  setActiveAgentPhase: (phase: string | null) => void;
}

const createMixSlice: StateCreator<StudioState, [], [], MixSlice> = (set) => ({
  settings: defaultMixSettings,
  setSettings: (settings) => set({ settings }),
  mixedBlob: null,
  setMixedBlob: (mixedBlob) => set({ mixedBlob }),
  mixedUrl: null,
  setMixedUrl: (mixedUrl) => set({ mixedUrl }),
  isProcessing: false,
  setIsProcessing: (isProcessing) => set({ isProcessing }),

  aiIterations: 1,
  setAiIterations: (aiIterations) => set({ aiIterations }),
  rawMixUrl: null,
  setRawMixUrl: (rawMixUrl) => set({ rawMixUrl }),
  isAiMixing: false,
  setIsAiMixing: (isAiMixing) => set({ isAiMixing }),
  aiLogs: [],
  setAiLogs: (aiLogs) => set({ aiLogs }),
  appendAiLog: (log) => set((state) => ({ aiLogs: [...state.aiLogs, { ...log, timestamp: Date.now() }] })),
  aiReasoning: '',
  setAiReasoning: (aiReasoning) => set({ aiReasoning }),
  expandedLogIndex: null,
  setExpandedLogIndex: (expandedLogIndex) => set({ expandedLogIndex }),
  activeAgentPhase: null,
  setActiveAgentPhase: (activeAgentPhase) => set({ activeAgentPhase }),
});

// ── Mastering / history / skill-tree slice ───────────────────────────────────

interface MasterSlice {
  isMastering: boolean;
  setIsMastering: (v: boolean) => void;
  masteringJobId: string | null;
  setMasteringJobId: (id: string | null) => void;
  masteredUrl: string | null;
  setMasteredUrl: (url: string | null) => void;
  referenceBlob: Blob | null;
  setReferenceBlob: (blob: Blob | null) => void;

  history: HistoryItem[];
  setHistory: (h: HistoryItem[]) => void;
  addToHistory: (url: string) => void;

  skillTreeStats: SkillTreeStats | null;
  setSkillTreeStats: (stats: SkillTreeStats | null) => void;
  lastSessionResult: SessionResult | null;
  setLastSessionResult: (result: SessionResult | null) => void;
  skillFeedbackState: 'pending' | 'rated' | 'dismissed';
  setSkillFeedbackState: (state: 'pending' | 'rated' | 'dismissed') => void;
  agentNotesText: string;
  setAgentNotesText: (text: string) => void;
}

const createMasterSlice: StateCreator<StudioState, [], [], MasterSlice> = (set) => ({
  isMastering: false,
  setIsMastering: (isMastering) => set({ isMastering }),
  masteringJobId: null,
  setMasteringJobId: (masteringJobId) => set({ masteringJobId }),
  masteredUrl: null,
  setMasteredUrl: (masteredUrl) => set({ masteredUrl }),
  referenceBlob: null,
  setReferenceBlob: (referenceBlob) => set({ referenceBlob }),

  history: [],
  setHistory: (history) => set({ history }),
  addToHistory: (url) =>
    set((state) => {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        name: `Project ${state.history.length + 1}`,
        date: new Date().toLocaleString(),
        url,
      };
      const newHistory = [newItem, ...state.history].slice(0, 10);
      try {
        localStorage.setItem('audio_history', JSON.stringify(newHistory));
      } catch { /* quota */ }
      return { history: newHistory };
    }),

  skillTreeStats: null,
  setSkillTreeStats: (skillTreeStats) => set({ skillTreeStats }),
  lastSessionResult: null,
  setLastSessionResult: (lastSessionResult) => set({ lastSessionResult }),
  skillFeedbackState: 'pending',
  setSkillFeedbackState: (skillFeedbackState) => set({ skillFeedbackState }),
  agentNotesText: '',
  setAgentNotesText: (agentNotesText) => set({ agentNotesText }),
});

// ── Combined store ───────────────────────────────────────────────────────────

export interface StudioState extends AppSlice, BeatSlice, VocalSlice, MixSlice, MasterSlice {
  reset: () => void;
}

export const useStudioStore = create<StudioState>((set, get, api) => ({
  ...createAppSlice(set, get, api),
  ...createBeatSlice(set, get, api),
  ...createVocalSlice(set, get, api),
  ...createMixSlice(set, get, api),
  ...createMasterSlice(set, get, api),

  reset: () => {
    const state = get();
    if (state.beatUrl) URL.revokeObjectURL(state.beatUrl);
    if (state.vocalUrl) URL.revokeObjectURL(state.vocalUrl);
    if (state.backupVocalUrl) URL.revokeObjectURL(state.backupVocalUrl);
    if (state.mixedUrl) URL.revokeObjectURL(state.mixedUrl);
    set({
      step: 'upload',
      originalBeatBlob: null,
      beatBlob: null,
      beatUrl: null,
      vocalBlob: null,
      vocalUrl: null,
      backupVocalBlob: null,
      backupVocalUrl: null,
      mixedBlob: null,
      mixedUrl: null,
      rawMixUrl: null,
      aiLogs: [],
      settings: defaultMixSettings,
      recordingMode: 'main',
      beatSpeed: 1.0,
      beatPitch: 0,
      detectedBpm: null,
      separatedStems: [],
      separationJobId: null,
      masteringJobId: null,
      masteredUrl: null,
      referenceBlob: null,
      lastSessionResult: null,
      skillFeedbackState: 'pending',
      isAiMixing: false,
      isProcessing: false,
      aiReasoning: '',
      mobileMixPanel: 'none',
    });
  },
}));
