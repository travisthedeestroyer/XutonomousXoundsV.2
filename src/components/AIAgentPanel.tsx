import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Bot, FileText, X, Loader2, Terminal, Cpu } from 'lucide-react';
import { useStudioStore } from '@/state/store';
import type { AILog } from '@/ai';
import { ProSlider } from './ui/ProSlider';
import { formatDeltaVal } from './ui/ParameterDeltaRow';

const PHASES = [
  { key: 'analysis',  label: 'ANALYSE' },
  { key: 'genre',     label: 'GENRE'   },
  { key: 'mixing',    label: 'MIX'     },
  { key: 'review',    label: 'REVIEW'  },
  { key: 'mastering', label: 'MASTER'  },
] as const;

const AGENT_META: Record<string, { prefix: string; color: string; dim: string }> = {
  analyst:   { prefix: 'ANALYST', color: '#60a5fa', dim: '#1d4ed8' },
  skill:     { prefix: 'SKILL',   color: '#34d399', dim: '#065f46' },
  genre:     { prefix: 'GENRE',   color: '#2dd4bf', dim: '#0f766e' },
  mix:       { prefix: 'MIX',     color: '#a78bfa', dim: '#5b21b6' },
  review:    { prefix: 'REVIEW',  color: '#fbbf24', dim: '#92400e' },
  mastering: { prefix: 'MASTER',  color: '#fb7185', dim: '#9f1239' },
  error:     { prefix: 'ERROR',   color: '#f87171', dim: '#7f1d1d' },
  system:    { prefix: 'SYS',     color: '#34d399', dim: '#065f46' },
};

function getAgentMeta(agent: string) {
  if (agent.includes('Analyst'))   return AGENT_META.analyst;
  if (agent.includes('Skill'))     return AGENT_META.skill;
  if (agent.includes('Genre'))     return AGENT_META.genre;
  if (agent.includes('Mix'))       return AGENT_META.mix;
  if (agent.includes('Review')) {
    const m = agent.match(/\d+/);
    return { ...AGENT_META.review, prefix: m ? `REV:${m[0]}` : 'REVIEW' };
  }
  if (agent.includes('Mastering')) return AGENT_META.mastering;
  if (agent.includes('Error'))     return AGENT_META.error;
  return AGENT_META.system;
}

interface AIAgentPanelProps { onDeploy: () => void; }

/** Terminal-style live feed of the multi-agent mixing network. */
export function AIAgentPanel({ onDeploy }: AIAgentPanelProps) {
  const {
    isMobile, isSmallMobile,
    mobileMixPanel, setMobileMixPanel,
    isAiMixing, aiLogs, activeAgentPhase,
    aiIterations, setAiIterations,
    isProcessing,
    expandedLogIndex, setExpandedLogIndex,
    savedApiKey, hasApiKey,
    setShowSettings,
  } = useStudioStore();

  const logs = aiLogs as AILog[];

  // Deterministic DSP fallback notice (no Gemini key configured)
  const envKey = typeof process !== 'undefined' ? (process.env.GEMINI_API_KEY || '') : '';
  const noKey = !savedApiKey && !hasApiKey && !envKey;
  const [pillDismissed, setPillDismissed] = useState(false);

  // Typed text for latest entry
  const [typedText, setTypedText]   = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const typingRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStart   = useRef<number | null>(null);
  const logsEndRef     = useRef<HTMLDivElement>(null);

  // Track session start
  useEffect(() => {
    if (isAiMixing) { sessionStart.current = Date.now(); setElapsedSecs(0); }
  }, [isAiMixing]);

  // Elapsed counter
  useEffect(() => {
    if (!isAiMixing) return;
    const id = setInterval(() => {
      if (sessionStart.current) setElapsedSecs(Math.floor((Date.now() - sessionStart.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [isAiMixing]);

  // Cursor blink
  useEffect(() => {
    if (!isAiMixing) { setShowCursor(false); return; }
    setShowCursor(true);
    const id = setInterval(() => setShowCursor(v => !v), 560);
    return () => clearInterval(id);
  }, [isAiMixing]);

  // Typing animation for latest log
  useEffect(() => {
    if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; }
    if (logs.length === 0) { setTypedText(''); return; }
    const msg = logs[logs.length - 1].message;
    let i = 0;
    setTypedText('');
    typingRef.current = setInterval(() => {
      i++;
      setTypedText(msg.slice(0, i));
      if (i >= msg.length) { clearInterval(typingRef.current!); typingRef.current = null; }
    }, 11);
    return () => { if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; } };
  }, [logs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs.length, typedText]);

  const fmtTs = (ts?: number) => {
    if (!ts || !sessionStart.current) return '??:??.?';
    const e = Math.max(0, ts - sessionStart.current);
    const s = Math.floor(e / 1000); const t = Math.floor((e % 1000) / 100);
    return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}.${t}`;
  };

  const fmtElapsed = (s: number) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  const copyLog = () => {
    const text = logs.map(l =>
      `[${l.agent}] ${l.message}` +
      (l.details ? '\n  ' + l.details.replace(/\n/g, '\n  ') : '') +
      (l.parameterDeltas?.length ? '\n  Changes: ' + l.parameterDeltas.map(d => `${d.label}: ${formatDeltaVal(d.before, d.unit)}→${formatDeltaVal(d.after, d.unit)}`).join(', ') : '')
    ).join('\n\n');
    navigator.clipboard.writeText(text);
  };

  const lastIdx = logs.length - 1;

  return (
    <AnimatePresence>
      {(!isMobile || mobileMixPanel === 'ai') && (
        <motion.div
          initial={{ x: isMobile ? 0 : 120, y: isMobile ? 60 : 0, opacity: 0 }}
          animate={{ x: isMobile ? 0 : 388, y: 0, opacity: 1 }}
          exit={{ x: isMobile ? 0 : 120, y: isMobile ? 60 : 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className={`absolute z-40 ${isMobile ? (isSmallMobile ? 'w-[92vw]' : 'w-80') : 'w-[340px]'} flex flex-col overflow-hidden pointer-events-auto rounded-[1.75rem] shadow-2xl`}
          style={{
            background: 'linear-gradient(160deg, rgba(10,10,14,0.97) 0%, rgba(6,6,10,0.99) 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            maxHeight: isMobile ? '75vh' : '84vh',
            ...(isMobile ? { marginBottom: '5rem' } : {}),
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2.5">
              <div className="relative w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}>
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                {isAiMixing && (
                  <motion.div className="absolute inset-[-3px] rounded-[10px]" style={{ border: '1px solid rgba(251,191,36,0.35)' }}
                    animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.3, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/85 font-mono">Agent Studio</div>
                <div className="text-[7px] uppercase tracking-widest text-white/25 font-mono">
                  {noKey ? 'Deterministic DSP engine' : 'Gemini multi-agent network'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAiMixing ? (
                <>
                  <span className="font-mono text-[9px] text-white/25">{fmtElapsed(elapsedSecs)}</span>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <motion.div className="w-1.5 h-1.5 rounded-full bg-red-400"
                      animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                    <span className="text-[6px] font-bold uppercase tracking-widest text-red-400 font-mono">LIVE</span>
                  </div>
                </>
              ) : logs.length > 0 ? (
                <button onClick={copyLog} title="Copy session log"
                  className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  <FileText className="w-3 h-3 text-white/25" />
                </button>
              ) : null}
              {isMobile && (
                <button onClick={() => setMobileMixPanel('none')} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <X className="w-3.5 h-3.5 text-white/70" />
                </button>
              )}
            </div>
          </div>

          {/* No-key notice: deterministic Smart Mix fallback */}
          {noKey && !pillDismissed && (
            <div className="mx-4 mt-3 flex items-start gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.2)' }}>
              <Cpu className="w-3 h-3 text-teal-400 shrink-0 mt-0.5" />
              <p className="flex-1 text-[8px] leading-relaxed text-teal-300/80">
                Deterministic DSP mode — add a{' '}
                <button onClick={() => setShowSettings(true)} className="underline underline-offset-2 text-teal-300 hover:text-teal-200">
                  Gemini key in Settings
                </button>{' '}
                for the full agent network
              </p>
              <button onClick={() => setPillDismissed(true)} className="text-teal-400/40 hover:text-teal-300 shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Phase pipeline */}
          {(isAiMixing || logs.length > 0) && (
            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center">
                {PHASES.map(({ key, label }, idx) => {
                  const isActive = activeAgentPhase === key;
                  const isDone   = !isActive && logs.some(l => l.phase === key);
                  return (
                    <div key={key} className="flex items-center flex-1">
                      <div className="flex flex-col items-center gap-[3px]">
                        <div className="w-2 h-2 rounded-full transition-all duration-400"
                          style={{
                            background: isActive ? '#fbbf24' : isDone ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.07)',
                            boxShadow: isActive ? '0 0 8px 2px rgba(251,191,36,0.5)' : 'none',
                            transform: isActive ? 'scale(1.25)' : 'scale(1)',
                          }} />
                        <span className="text-[5.5px] font-bold uppercase tracking-wider font-mono"
                          style={{ color: isActive ? '#fbbf24' : isDone ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)' }}>
                          {label}
                        </span>
                      </div>
                      {idx < PHASES.length - 1 && (
                        <div className="flex-1 h-px mx-1 transition-all duration-500"
                          style={{ background: isDone ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Terminal log */}
          <div className="flex-1 overflow-hidden relative min-h-0">
            <div
              className="h-full overflow-y-auto p-4 font-mono no-scrollbar"
              style={{ background: '#020204', fontSize: '9px', lineHeight: '1.55' }}
            >
              {logs.length === 0 && !isAiMixing ? (
                <div className="h-full flex flex-col justify-center items-center text-center p-6">
                  <div className="mb-5 text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.12)' }}>
                    {PHASES.map(({ label }) => (
                      <div key={label} className="flex items-center gap-2 mb-1">
                        <span style={{ color: 'rgba(255,255,255,0.08)' }}>{'>'}</span>
                        <span style={{ color: 'rgba(255,255,255,0.15)' }}>{label}</span>
                        <span style={{ color: 'rgba(255,255,255,0.05)' }}>{'─────────'}</span>
                        <span style={{ color: 'rgba(255,255,255,0.08)' }}>STANDBY</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[7px] font-mono" style={{ color: 'rgba(255,255,255,0.12)' }}>
                    Deploy to begin autonomous mixing
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {logs.map((log, index) => {
                    const isLast = index === lastIdx;
                    const meta = getAgentMeta(log.agent);
                    const message = isLast ? typedText : log.message;
                    return (
                      <div key={index}>
                        {/* Main line */}
                        <div className="flex items-start gap-2" style={{ minHeight: '13px' }}>
                          <span className="flex-shrink-0 font-mono" style={{ color: 'rgba(255,255,255,0.15)', fontSize: '7.5px', minWidth: '44px', paddingTop: '1px' }}>
                            {fmtTs(log.timestamp)}
                          </span>
                          <span className="flex-shrink-0 font-bold font-mono" style={{ color: meta.color, fontSize: '8px', paddingTop: '1px', minWidth: '54px' }}>
                            [{meta.prefix}]
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.78)', wordBreak: 'break-word' }}>
                            {message}
                            {isLast && isAiMixing && showCursor && (
                              <span className="inline-block align-middle ml-px" style={{ width: '6px', height: '10px', background: meta.color, opacity: 0.8, verticalAlign: 'text-bottom' }} />
                            )}
                          </span>
                        </div>

                        {/* Details */}
                        {log.details && (
                          <div className="ml-[102px] mt-0.5" style={{ color: 'rgba(255,255,255,0.32)', fontSize: '8px' }}>
                            {log.details.split('\n').filter(Boolean).map((line, li) => (
                              <div key={li} className="flex gap-1.5">
                                <span style={{ color: 'rgba(255,255,255,0.14)', flexShrink: 0 }}>↳</span>
                                <span>{line}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Parameter deltas */}
                        {log.parameterDeltas && log.parameterDeltas.length > 0 && (
                          <div className="ml-[102px] mt-1" style={{ fontSize: '7.5px' }}>
                            {log.parameterDeltas.map((d, di) => (
                              <div key={di} className="flex items-center gap-1 font-mono">
                                <span style={{ color: 'rgba(255,255,255,0.12)' }}>↳</span>
                                <span style={{ color: 'rgba(255,255,255,0.28)' }}>{d.label}:</span>
                                <span style={{ color: 'rgba(255,255,255,0.22)' }}>{formatDeltaVal(d.before, d.unit)}</span>
                                <span style={{ color: 'rgba(255,255,255,0.12)' }}>→</span>
                                <span style={{ color: d.after > d.before ? '#34d399' : '#fbbf24', opacity: 0.7 }}>
                                  {formatDeltaVal(d.after, d.unit)}{!['%','x','LUFS',':1','Hz','dB','s'].includes(d.unit) ? d.unit : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Confidence badge */}
                        {log.confidence && (
                          <div className="ml-[102px] mt-0.5" style={{ fontSize: '7px' }}>
                            <span style={{
                              color: log.confidence === 'high' ? '#34d399' : log.confidence === 'medium' ? '#fbbf24' : '#f87171',
                              opacity: 0.6,
                              fontWeight: 700,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                            }}>► {log.confidence} confidence</span>
                          </div>
                        )}

                        {/* Thought process expand */}
                        {log.thoughtProcess && (
                          <>
                            <button
                              onClick={() => setExpandedLogIndex(expandedLogIndex === index ? null : index)}
                              className="ml-[102px] mt-0.5 flex items-center gap-1 transition-opacity hover:opacity-60"
                              style={{ color: 'rgba(255,255,255,0.15)', fontSize: '7px' }}
                            >
                              <span>{expandedLogIndex === index ? '▼' : '▶'}</span>
                              <span>reasoning</span>
                            </button>
                            <AnimatePresence>
                              {expandedLogIndex === index && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="ml-[102px] mt-1 p-2 max-h-28 overflow-y-auto no-scrollbar rounded"
                                    style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '2px solid rgba(255,255,255,0.07)' }}>
                                    <pre className="whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.22)', fontSize: '7px' }}>
                                      {log.thoughtProcess}
                                    </pre>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* Processing dots */}
                  {isAiMixing && (
                    <div className="flex items-center gap-1.5 pl-[102px] pt-1">
                      {[0, 1, 2].map(i => (
                        <motion.span key={i}
                          className="inline-block rounded-full"
                          style={{ width: '4px', height: '4px', background: 'rgba(251,191,36,0.35)' }}
                          animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.8, 1, 0.8] }}
                          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
                        />
                      ))}
                    </div>
                  )}

                  <div ref={logsEndRef} />
                </div>
              )}
            </div>

            {/* Fade at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
              style={{ background: 'linear-gradient(to top, #020204, transparent)' }} />
          </div>

          {/* Controls */}
          <div className="px-4 py-4 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <ProSlider
              label="Review Passes"
              icon={Bot}
              value={aiIterations}
              min={0} max={3} step={1}
              onChange={setAiIterations}
              formatValue={(v) => v === 0 ? 'off' : `${v}`}
              colorClass="bg-amber-500"
              glowClass="shadow-amber-500/50"
            />

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={onDeploy}
              disabled={isAiMixing || isProcessing}
              className="w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.14em] text-black flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
              style={{ background: '#fbbf24', boxShadow: '0 0 24px rgba(251,191,36,0.2)' }}
            >
              {isAiMixing && (
                <motion.div className="absolute inset-0"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                />
              )}
              {isAiMixing
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Network Active</>
                : <><Sparkles className="w-3.5 h-3.5" /> Deploy Agent Network</>}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
