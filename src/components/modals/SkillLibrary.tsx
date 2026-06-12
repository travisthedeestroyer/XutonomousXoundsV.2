import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TreePine, X, BookOpen, Star } from 'lucide-react';
import { useStudioStore } from '@/state/store';
import {
  loadSkillTree,
  rateSkill,
  annotateSkill,
  deleteSkill,
  updateUserPreferences,
  getSkillTreeStats,
} from '@/ai';

/** Skill Tree browser — rate, annotate, and delete crystallized mix skills. */
export function SkillLibrary() {
  const {
    showSkillLibrary, setShowSkillLibrary,
    skillTreeStats,
    setSkillTreeStats,
    agentNotesText, setAgentNotesText,
  } = useStudioStore();

  // Local draft annotations per skill, committed on blur
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);

  const refresh = () => { setSkillTreeStats(getSkillTreeStats()); setVersion(version + 1); };

  return (
    <AnimatePresence>
      {showSkillLibrary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-2xl flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSkillLibrary(false); }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 22 }}
            className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                  <TreePine className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white">Skill Tree</h2>
                  <p className="text-[9px] text-white/30">Self-evolving agent memory</p>
                </div>
              </div>
              <button onClick={() => setShowSkillLibrary(false)} className="text-white/30 hover:text-white/80 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats bar */}
            {skillTreeStats && (
              <div className="grid grid-cols-4 gap-0 border-b border-white/5 shrink-0">
                {[
                  { label: 'Sessions',  value: skillTreeStats.totalSessions,        color: 'text-white/70'    },
                  { label: 'Skills',    value: skillTreeStats.totalSkills,          color: 'text-emerald-400' },
                  { label: 'Genres',    value: skillTreeStats.genresCovered.length, color: 'text-violet-400'  },
                  { label: 'Evolution', value: `${skillTreeStats.evolutionScore}%`, color: 'text-amber-400'   },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col items-center justify-center py-4 border-r border-white/5 last:border-r-0">
                    <span className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</span>
                    <span className="text-[9px] text-white/30 uppercase tracking-widest">{stat.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Evolution bar */}
            {skillTreeStats && (
              <div className="px-6 py-3 border-b border-white/5 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] text-white/30 uppercase tracking-widest">Tree Evolution</span>
                  <span className="text-[9px] text-emerald-400 font-mono">{skillTreeStats.evolutionScore}/100</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${skillTreeStats.evolutionScore}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                  />
                </div>
                <p className="text-[8px] text-white/20 mt-1.5">
                  {skillTreeStats.totalSkills === 0
                    ? 'Run your first AI mix and rate it to grow your skill tree.'
                    : skillTreeStats.evolutionScore < 30
                    ? 'Early growth — the AI is learning your preferences.'
                    : skillTreeStats.evolutionScore < 60
                    ? 'Growing fast — agents are recalling your past sessions.'
                    : 'Mature skill tree — agents warm-start from your history automatically.'}
                </p>
              </div>
            )}

            {/* Agent notes */}
            <div className="px-6 py-4 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-3 h-3 text-amber-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400/70">Notes for Agents</span>
              </div>
              <textarea
                value={agentNotesText}
                onChange={(e) => setAgentNotesText(e.target.value)}
                onBlur={() => updateUserPreferences({ notesForAgents: agentNotesText })}
                placeholder="e.g. 'I prefer tight reverb, -9 LUFS, hip-hop focus.' Agents read this every session."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white/70 placeholder-white/20 focus:outline-none focus:border-amber-500/30 transition-all resize-none h-16 font-mono"
              />
            </div>

            {/* Skill list */}
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const tree = loadSkillTree();
                if (!tree.skills.length) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                      <TreePine className="w-12 h-12 text-white/10 mb-4" />
                      <p className="text-white/40 text-sm font-bold mb-2">No skills yet</p>
                      <p className="text-white/20 text-[10px] leading-relaxed">
                        Run the AI Agent Network, process your mix, then rate it to crystallize your first skill.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="p-4 flex flex-col gap-3">
                    {tree.skills.map((skill) => (
                      <div key={skill.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                              skill.genre === 'hip-hop'    ? 'bg-violet-500/15 border-violet-500/25 text-violet-400' :
                              skill.genre === 'pop'        ? 'bg-pink-500/15 border-pink-500/25 text-pink-400' :
                              skill.genre === 'electronic' ? 'bg-cyan-500/15 border-cyan-500/25 text-cyan-400' :
                                                             'bg-amber-500/15 border-amber-500/25 text-amber-400'
                            }`}>{skill.genre}</span>
                            {skill.invokeCount > 1 && (
                              <span className="text-[8px] text-white/25 font-mono">{skill.invokeCount}× used</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                  key={s}
                                  onClick={() => { rateSkill(skill.id, s); refresh(); }}
                                  className={`transition-colors ${s <= skill.rating ? 'text-amber-400' : 'text-white/10 hover:text-amber-400/50'}`}
                                >
                                  <Star className="w-3 h-3 fill-current" />
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => { deleteSkill(skill.id); refresh(); }}
                              className="text-white/15 hover:text-red-400 transition-colors ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[8px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-white/25 uppercase tracking-wider">LUFS</span>
                            <span className="font-mono text-white/60">{skill.settings.lufsTarget}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-white/25 uppercase tracking-wider">Reverb</span>
                            <span className="font-mono text-white/60">{Math.round(skill.settings.reverb * 100)}%</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-white/25 uppercase tracking-wider">Width</span>
                            <span className="font-mono text-white/60">{Math.round(skill.settings.stereoImaging.width * 100)}%</span>
                          </div>
                        </div>
                        {skill.keyDecisions.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {skill.keyDecisions.map((d, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-[8px] text-white/30">
                                <span className="text-emerald-500/60 shrink-0 mt-0.5">•</span>
                                <span>{d}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* User annotation — agents read this when recalling the skill */}
                        <input
                          value={noteDrafts[skill.id] ?? skill.userNotes}
                          onChange={(e) => setNoteDrafts({ ...noteDrafts, [skill.id]: e.target.value })}
                          onBlur={() => {
                            if (noteDrafts[skill.id] !== undefined) {
                              annotateSkill(skill.id, noteDrafts[skill.id]);
                              refresh();
                            }
                          }}
                          placeholder="Add a note about this skill..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[8px] text-white/60 placeholder-white/15 focus:outline-none focus:border-emerald-500/30 font-mono transition-all"
                        />
                        <span className="text-[7px] text-white/15 font-mono">
                          {new Date(skill.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
