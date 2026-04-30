import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Bot, FileText, X, Loader2, Activity, Music, Sliders, Ear, AlertTriangle, CheckCircle2, TreePine } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { ProSlider } from './ui/ProSlider';
import { ConfidenceBadge } from './ui/ConfidenceBadge';
import { ParameterDeltaRow, formatDeltaVal } from './ui/ParameterDeltaRow';
import { ChevronRight } from 'lucide-react';
import type { AILog } from '../lib/aiMixer';

const getAgentStyle = (agentName: string) => {
  if (agentName.includes('Skill Tree')) return { color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-400/30', icon: TreePine };
  if (agentName.includes('Analyst'))   return { color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: Activity };
  if (agentName.includes('Genre'))     return { color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    icon: Music };
  if (agentName.includes('Mix'))       return { color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  icon: Sliders };
  if (agentName.includes('Review'))    return { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: Ear };
  if (agentName.includes('Mastering')) return { color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    icon: Sparkles };
  if (agentName.includes('System Error')) return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertTriangle };
  if (agentName.includes('System'))    return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 };
  return { color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', icon: Bot };
};

interface AIAgentPanelProps {
  onDeploy: () => void;
}

export function AIAgentPanel({ onDeploy }: AIAgentPanelProps) {
  const {
    isMobile, isSmallMobile,
    mobileMixPanel, setMobileMixPanel,
    isAiMixing, aiLogs, activeAgentPhase,
    aiIterations, setAiIterations,
    isProcessing,
    expandedLogIndex, setExpandedLogIndex,
  } = useStudioStore();

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiLogs]);

  const copyLog = () => {
    const text = (aiLogs as AILog[]).map((l) =>
      `[${l.agent}]${l.confidence ? ` (${l.confidence})` : ''} ${l.message}` +
      (l.details ? `\n${l.details}` : '') +
      (l.parameterDeltas?.length ? '\nChanges: ' + l.parameterDeltas.map((d) => `${d.label}: ${formatDeltaVal(d.before, d.unit)}→${formatDeltaVal(d.after, d.unit)}${d.unit}`).join(', ') : '') +
      (l.durationMs !== undefined ? `\nDuration: ${(l.durationMs / 1000).toFixed(1)}s` : '')
    ).join('\n\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <AnimatePresence>
      {(!isMobile || mobileMixPanel === 'ai') && (
        <motion.div
          initial={{ x: isMobile ? 0 : 100, y: isMobile ? 50 : 0, opacity: 0 }}
          animate={{ x: isMobile ? 0 : 380, y: 0, scale: 1, opacity: 1 }}
          exit={{ x: isMobile ? 0 : 100, y: isMobile ? 50 : 0, opacity: 0 }}
          className={`absolute z-40 ${isMobile ? (isSmallMobile ? 'w-[92vw]' : 'w-80') : 'w-80'} bg-black/80 backdrop-blur-3xl border border-white/10 p-6 rounded-[2rem] shadow-2xl flex flex-col gap-4 max-h-[80vh] pointer-events-auto ${isMobile ? 'h-[70vh] pb-20' : ''}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold uppercase tracking-widest text-white/90 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> AI Agent
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">Autonomous multi-pass mixing</p>
            </div>
            {isMobile && (
              <button onClick={() => setMobileMixPanel('none')} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>

          {/* Agent Phase Progress Tracker */}
          {isAiMixing && (
            <div className="flex items-center gap-1 bg-white/3 rounded-xl p-2.5 border border-white/5">
              {([
                { phase: 'analysis',  label: 'Analyse', color: 'bg-blue-500',   glow: 'shadow-blue-500/50'   },
                { phase: 'genre',     label: 'Genre',   color: 'bg-teal-500',   glow: 'shadow-teal-500/50'   },
                { phase: 'mixing',    label: 'Mix',     color: 'bg-violet-500', glow: 'shadow-violet-500/50' },
                { phase: 'review',    label: 'Review',  color: 'bg-amber-500',  glow: 'shadow-amber-500/50'  },
                { phase: 'mastering', label: 'Master',  color: 'bg-rose-500',   glow: 'shadow-rose-500/50'   },
              ] as const).map(({ phase, label, color, glow }, idx, arr) => {
                const isActive = activeAgentPhase === phase;
                const isDone = (aiLogs as AILog[]).some((l) => l.phase === phase);
                return (
                  <span key={phase} className="flex items-center gap-1 flex-shrink-0">
                    <span className="flex flex-col items-center gap-1">
                      <span className={`w-2 h-2 rounded-full transition-all duration-300 ${isActive ? `${color} shadow-lg ${glow} scale-125` : isDone ? `${color} opacity-60` : 'bg-white/10'}`} />
                      <span className={`text-[6px] uppercase tracking-wider transition-colors duration-300 ${isActive ? 'text-white/80' : isDone ? 'text-white/40' : 'text-white/15'}`}>{label}</span>
                    </span>
                    {idx < arr.length - 1 && <span className={`flex-1 h-px transition-all duration-500 ${isDone ? 'bg-white/20' : 'bg-white/5'} w-4`} />}
                  </span>
                );
              })}
            </div>
          )}

          {/* Log feed */}
          <div className="flex-1 bg-[#050505] rounded-xl border border-white/10 p-4 overflow-y-auto font-mono text-[10px] shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] no-scrollbar min-h-[200px]">
            {(aiLogs as AILog[]).length === 0 && !isAiMixing ? (
              <div className="h-full flex flex-col items-center justify-center text-white/20 text-center p-2">
                <Bot className="w-8 h-8 mb-2 opacity-20" />
                <p>Agent network is standing by.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(aiLogs as AILog[]).map((log, index) => {
                  const style = getAgentStyle(log.agent);
                  const Icon = style.icon;
                  const isLast = index === (aiLogs as AILog[]).length - 1;
                  const isExpanded = expandedLogIndex === index;
                  return (
                    <motion.div key={index} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative">
                      {!isLast && <div className="absolute left-[11px] top-6 bottom-[-16px] w-[1px] bg-white/5" />}
                      <div className="flex gap-3">
                        <div className={`relative z-10 flex-shrink-0 w-6 h-6 rounded-full ${style.bg} ${style.border} border flex items-center justify-center`}>
                          <Icon className={`w-3 h-3 ${style.color}`} />
                        </div>
                        <div className="flex-1 pt-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className={`font-semibold text-[9px] uppercase tracking-wider ${style.color}`}>{log.agent}</span>
                            {log.confidence && <ConfidenceBadge level={log.confidence} />}
                            {log.durationMs !== undefined && (
                              <span className="text-[7px] text-white/20 font-mono ml-auto">{(log.durationMs / 1000).toFixed(1)}s</span>
                            )}
                          </div>
                          <div className="text-white/80 leading-relaxed mb-1">{log.message}</div>
                          {log.details && (
                            <div className="text-white/40 text-[9px] leading-relaxed whitespace-pre-line mb-1">{log.details}</div>
                          )}
                          {log.parameterDeltas && log.parameterDeltas.length > 0 && (
                            <div className="mt-1.5 bg-white/3 rounded-lg p-2 border border-white/5">
                              <div className="text-[7px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Parameter Changes</div>
                              {log.parameterDeltas.map((d, di) => (
                                <ParameterDeltaRow key={di} delta={d} />
                              ))}
                            </div>
                          )}
                          {log.thoughtProcess && (
                            <button
                              onClick={() => setExpandedLogIndex(isExpanded ? null : index)}
                              className="mt-1 flex items-center gap-1 text-[7px] text-white/25 hover:text-white/60 transition-colors"
                            >
                              <ChevronRight className={`w-2.5 h-2.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                              {isExpanded ? 'hide reasoning' : 'show reasoning'}
                            </button>
                          )}
                          <AnimatePresence>
                            {isExpanded && log.thoughtProcess && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-1 bg-black/60 rounded-lg p-2 border border-white/5 max-h-32 overflow-y-auto no-scrollbar">
                                  <pre className="text-[7px] text-white/35 whitespace-pre-wrap font-mono leading-relaxed">{log.thoughtProcess}</pre>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {isAiMixing && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                    <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <motion.div
                        className="absolute inset-0 rounded-full border border-amber-400/50"
                        animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <div className="w-2 h-2 rounded-full bg-amber-400/60" />
                    </div>
                    <div className="flex-1 pt-1.5">
                      <div className="flex items-center gap-1.5 text-white/40 text-[9px] uppercase tracking-widest">
                        <span>Processing</span>
                        {[0, 1, 2].map((i) => (
                          <motion.span key={i} className="w-1 h-1 rounded-full bg-white/30 inline-block" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <ProSlider label="AI Passes" icon={Bot} value={aiIterations} min={1} max={4} step={1} onChange={setAiIterations} formatValue={(v) => `${v}`} colorClass="bg-amber-500" glowClass="shadow-amber-500/50" />
          </div>

          {(aiLogs as AILog[]).length > 0 && !isAiMixing && (
            <button onClick={copyLog} className="w-full py-2 text-[8px] font-bold uppercase tracking-widest text-white/30 hover:text-white/60 border border-white/5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
              <FileText className="w-3 h-3" /> Copy Session Log
            </button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDeploy}
            disabled={isAiMixing || isProcessing}
            className="w-full py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-black bg-amber-400 hover:bg-amber-300 transition-colors shadow-[0_0_20px_rgba(251,191,36,0.3)] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAiMixing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Network Active...</> : <><Sparkles className="w-4 h-4 mr-2" /> Deploy AI Agent</>}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
