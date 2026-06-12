// GenericAgent-style self-evolving skill tree, persisted to localStorage.
// Crystallizes full mix execution paths — settings, reasoning, and spectral
// fingerprints — that grow richer with every session.

import { MixSettings, FullAudioAnalysis } from '../audio';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SpectralSig {
  dominantFreq: number;
  subBassRatio: number;    // sub-bass energy relative to overall
  bassRatio: number;
  midRatio: number;
  brillianceRatio: number;
  dynamicRange: number;
  stereoWidth: number;
  estimatedLUFS: number;
  hasSibilance: boolean;
}

/** A crystallized mix execution path — the GenericAgent "skill" concept. */
export interface MixSkill {
  id: string;
  createdAt: string;
  lastUsed: string;
  invokeCount: number;       // how many times this skill was reused
  rating: number;            // 1-5 from user feedback (0 = unrated)
  genre: string;

  // Spectral fingerprint for similarity matching
  vocalSig: SpectralSig;
  beatSig: SpectralSig;

  // Crystallized execution path
  settings: MixSettings;
  masteringNotes: string;    // condensed reasoning from Mastering Engineer

  // Agent-generated key decisions (bullet list, injected as prior knowledge)
  keyDecisions: string[];

  // Optional user annotation
  userNotes: string;
}

export interface UserPreferences {
  preferredGenres: string[];
  notesForAgents: string;    // free-text the user writes; agents read this
  defaultIterations: number;
}

export interface SkillTree {
  version: number;
  totalSessions: number;     // total mix sessions ever run
  totalCrystallized: number; // total skills ever saved
  skills: MixSkill[];
  preferences: UserPreferences;
  lastUpdated: string;
}

export interface SkillMatchResult {
  skill: MixSkill;
  similarity: number;        // 0–1 cosine similarity
  matchReason: string;
}

export interface SkillTreeStats {
  totalSessions: number;
  totalSkills: number;
  genresCovered: string[];
  topGenre: string | null;
  avgRating: number;
  mostRecentSkill: MixSkill | null;
  evolutionScore: number;    // 0–100 "how evolved" the tree is
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ga_skill_tree_v1';
const MAX_SKILLS = 24;              // prune oldest/lowest-rated beyond this
const SIMILARITY_THRESHOLD = 0.78;  // minimum similarity to count as a match

// ─── Storage Helpers ─────────────────────────────────────────────────────────

export function loadSkillTree(): SkillTree {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SkillTree;
  } catch { /* ignore */ }
  return emptyTree();
}

function emptyTree(): SkillTree {
  return {
    version: 1,
    totalSessions: 0,
    totalCrystallized: 0,
    skills: [],
    preferences: {
      preferredGenres: [],
      notesForAgents: '',
      defaultIterations: 2,
    },
    lastUpdated: new Date().toISOString(),
  };
}

function saveSkillTree(tree: SkillTree): void {
  try {
    tree.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  } catch { /* ignore quota errors */ }
}

// ─── Spectral Signature Extraction ───────────────────────────────────────────

export function extractSig(analysis: FullAudioAnalysis): SpectralSig {
  const s = analysis.spectral;
  const l = analysis.loudness;
  // Convert dB to linear energy ratios (normalize around RMS floor)
  const floor = Math.max(l.rmsDB + 80, 1);
  return {
    dominantFreq: s.dominantFrequency,
    subBassRatio: (s.subBass + 80) / floor,
    bassRatio: (s.bass + 80) / floor,
    midRatio: (s.mid + 80) / floor,
    brillianceRatio: (s.brilliance + 80) / floor,
    dynamicRange: analysis.dynamicRange,
    stereoWidth: analysis.stereo.width,
    estimatedLUFS: l.estimatedLUFS,
    hasSibilance: analysis.sibilance.hasSibilance,
  };
}

// ─── Similarity / Search ─────────────────────────────────────────────────────

function sigToVector(sig: SpectralSig): number[] {
  return [
    sig.dominantFreq / 1000,
    sig.subBassRatio,
    sig.bassRatio,
    sig.midRatio,
    sig.brillianceRatio,
    sig.dynamicRange / 30,
    sig.stereoWidth,
  ];
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function skillSimilarity(skill: MixSkill, vocalSig: SpectralSig, beatSig: SpectralSig): number {
  const vs = cosineSimilarity(sigToVector(skill.vocalSig), sigToVector(vocalSig));
  const bs = cosineSimilarity(sigToVector(skill.beatSig), sigToVector(beatSig));
  // Weighted: vocals matter slightly more for mix recall
  return vs * 0.6 + bs * 0.4;
}

/** Search the skill tree for the best match above SIMILARITY_THRESHOLD. */
export function searchSkillTree(
  vocalAnalysis: FullAudioAnalysis,
  beatAnalysis: FullAudioAnalysis
): SkillMatchResult | null {
  const tree = loadSkillTree();
  if (!tree.skills.length) return null;

  const vocalSig = extractSig(vocalAnalysis);
  const beatSig = extractSig(beatAnalysis);

  let best: SkillMatchResult | null = null;

  for (const skill of tree.skills) {
    const sim = skillSimilarity(skill, vocalSig, beatSig);
    if (sim >= SIMILARITY_THRESHOLD && (!best || sim > best.similarity)) {
      const reasons: string[] = [];
      if (skill.genre) reasons.push(`Genre: ${skill.genre.toUpperCase()}`);
      if (Math.abs(skill.vocalSig.dominantFreq - vocalSig.dominantFreq) < 150)
        reasons.push(`Dominant freq match (~${Math.round(vocalSig.dominantFreq)}Hz)`);
      if (skill.rating >= 4) reasons.push(`High-rated skill (${skill.rating}★)`);
      if (skill.invokeCount > 1) reasons.push(`Used ${skill.invokeCount}× before`);

      best = {
        skill,
        similarity: sim,
        matchReason: reasons.join(' · ') || `${Math.round(sim * 100)}% spectral match`,
      };
    }
  }

  return best;
}

// ─── Skill Context Generators ────────────────────────────────────────────────

/** Format a matched skill as a prompt block for agent injection. */
export function formatSkillAsAgentContext(match: SkillMatchResult): string {
  const { skill, similarity, matchReason } = match;
  const keyDecisionsText = skill.keyDecisions.length
    ? skill.keyDecisions.map(d => `  • ${d}`).join('\n')
    : '  • (no key decisions recorded)';

  return `
╔══════════════════════════════════════════════════════════════╗
║  PRIOR KNOWLEDGE — GenericAgent Skill Tree Match            ║
║  Similarity: ${(similarity * 100).toFixed(0)}%  |  Genre: ${skill.genre.toUpperCase().padEnd(12)}  |  Rating: ${skill.rating > 0 ? `${skill.rating}★` : 'unrated'}  ║
╚══════════════════════════════════════════════════════════════╝

A highly similar mix was previously crystallized from a past session.
Match context: ${matchReason}
Sessions using this skill: ${skill.invokeCount}

KEY DECISIONS FROM PRIOR SESSION:
${keyDecisionsText}

MASTERING NOTES FROM PRIOR SESSION:
${skill.masteringNotes || '(none recorded)'}

${skill.userNotes ? `USER PREFERENCE NOTE:\n${skill.userNotes}\n` : ''}
PRIOR SETTINGS SNAPSHOT (use as warm-start prior, refine based on current analysis):
  LUFS Target: ${skill.settings.lufsTarget} LUFS
  Reverb: ${Math.round(skill.settings.reverb * 100)}%  |  Reverb Decay: ${skill.settings.reverbDecay.toFixed(1)}s
  Saturation: ${Math.round(skill.settings.saturation * 100)}%
  Sidechain Duck: ${Math.round(skill.settings.sidechainDuck * 100)}%
  Stereo Width: ${Math.round(skill.settings.stereoImaging.width * 100)}%
  Vocal Presence Boost: ${skill.settings.vocalEQ.presenceGain > 0 ? '+' : ''}${skill.settings.vocalEQ.presenceGain}dB @ ${skill.settings.vocalEQ.presenceFreq}Hz
  De-Esser: ${skill.settings.deEsser.enabled ? `enabled (${(skill.settings.deEsser.frequency / 1000).toFixed(1)}kHz)` : 'disabled'}
  Parallel Compression: ${skill.settings.parallelCompression.enabled ? `${Math.round(skill.settings.parallelCompression.wetDry * 100)}% blend` : 'disabled'}

IMPORTANT: This is prior knowledge, not a prescription. Validate against the
current analysis and override any parameters that don't match the new tracks.
`.trim();
}

/** Format user preferences as a prompt block. */
export function formatUserPrefsAsContext(prefs: UserPreferences): string {
  if (!prefs.notesForAgents && !prefs.preferredGenres.length) return '';
  const lines: string[] = ['╔══════ USER PREFERENCES (reads from Skill Tree memory) ══════╗'];
  if (prefs.preferredGenres.length)
    lines.push(`  Preferred genres: ${prefs.preferredGenres.join(', ')}`);
  if (prefs.notesForAgents)
    lines.push(`  User note to agents: "${prefs.notesForAgents}"`);
  lines.push('╚═════════════════════════════════════════════════════════════╝');
  return lines.join('\n');
}

// ─── Crystallization ─────────────────────────────────────────────────────────

/** Extract bullet-point key decisions from the mastering notes. */
function extractKeyDecisions(masteringNotes: string, genre: string): string[] {
  const decisions: string[] = [];
  const lower = masteringNotes.toLowerCase();

  if (lower.includes('de-ess')) decisions.push('De-esser engaged for sibilance control');
  if (lower.includes('parallel')) decisions.push('Parallel compression applied for body');
  if (lower.includes('lufs')) {
    const m = masteringNotes.match(/(-\d+(?:\.\d+)?)\s*lufs/i);
    if (m) decisions.push(`LUFS target: ${m[1]}`);
  }
  if (lower.includes('sidechain')) decisions.push('Sidechain ducking for vocal clarity');
  if (lower.includes('bass mono') || lower.includes('mono below'))
    decisions.push('Bass mono below ~120Hz for tight low end');
  if (lower.includes('air') || lower.includes('sparkle'))
    decisions.push('Air shelf boosted for vocal brightness');
  if (lower.includes('reverb')) {
    if (lower.includes('tight') || lower.includes('short'))
      decisions.push('Short reverb for intimacy/dry feel');
    else if (lower.includes('long') || lower.includes('lush'))
      decisions.push('Long reverb for spacious feel');
    else decisions.push('Reverb configured for spatial depth');
  }
  if (genre) decisions.push(`Genre profile: ${genre}`);
  return decisions.slice(0, 6);
}

export interface CrystallizeInput {
  vocalAnalysis: FullAudioAnalysis;
  beatAnalysis: FullAudioAnalysis;
  genre: string;
  settings: MixSettings;
  masteringNotes: string;
  rating?: number;
  userNotes?: string;
}

/** Crystallize a completed mix session into the skill tree. */
export function crystallizeSkill(input: CrystallizeInput): MixSkill {
  const tree = loadSkillTree();

  const skill: MixSkill = {
    id: `skill_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    invokeCount: 1,
    rating: input.rating ?? 0,
    genre: input.genre,
    vocalSig: extractSig(input.vocalAnalysis),
    beatSig: extractSig(input.beatAnalysis),
    settings: input.settings,
    masteringNotes: input.masteringNotes.slice(0, 800),
    keyDecisions: extractKeyDecisions(input.masteringNotes, input.genre),
    userNotes: input.userNotes ?? '',
  };

  // Prune if over limit: keep highest-rated, then most recently used
  const toKeep = [...tree.skills, skill]
    .sort((a, b) => {
      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    })
    .slice(0, MAX_SKILLS);

  tree.skills = toKeep;
  tree.totalCrystallized++;
  tree.totalSessions++;
  saveSkillTree(tree);

  return skill;
}

// ─── Session Counter ─────────────────────────────────────────────────────────

/** Increment totalSessions counter without crystallizing (for quick mixes). */
export function incrementSessionCount(): void {
  const tree = loadSkillTree();
  tree.totalSessions++;
  saveSkillTree(tree);
}

/** Mark a skill as used (update lastUsed + invokeCount). */
export function markSkillUsed(skillId: string): void {
  const tree = loadSkillTree();
  const skill = tree.skills.find(s => s.id === skillId);
  if (skill) {
    skill.invokeCount++;
    skill.lastUsed = new Date().toISOString();
    saveSkillTree(tree);
  }
}

// ─── User Feedback ───────────────────────────────────────────────────────────

export function rateSkill(skillId: string, rating: number): void {
  const tree = loadSkillTree();
  const skill = tree.skills.find(s => s.id === skillId);
  if (skill) {
    skill.rating = Math.max(1, Math.min(5, rating));
    saveSkillTree(tree);
  }
}

export function annotateSkill(skillId: string, notes: string): void {
  const tree = loadSkillTree();
  const skill = tree.skills.find(s => s.id === skillId);
  if (skill) {
    skill.userNotes = notes;
    saveSkillTree(tree);
  }
}

export function updateUserPreferences(prefs: Partial<UserPreferences>): void {
  const tree = loadSkillTree();
  tree.preferences = { ...tree.preferences, ...prefs };
  saveSkillTree(tree);
}

export function deleteSkill(skillId: string): void {
  const tree = loadSkillTree();
  tree.skills = tree.skills.filter(s => s.id !== skillId);
  saveSkillTree(tree);
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export function getSkillTreeStats(): SkillTreeStats {
  const tree = loadSkillTree();
  const skills = tree.skills;

  const genreMap: Record<string, number> = {};
  for (const s of skills) {
    if (s.genre) genreMap[s.genre] = (genreMap[s.genre] || 0) + 1;
  }

  const topGenre = Object.entries(genreMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const ratedSkills = skills.filter(s => s.rating > 0);
  const avgRating = ratedSkills.length
    ? ratedSkills.reduce((s, sk) => s + sk.rating, 0) / ratedSkills.length
    : 0;

  const sorted = [...skills].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Evolution score: 0-100 based on sessions, skills, ratings
  const evolutionScore = Math.min(
    100,
    Math.round(
      (tree.totalSessions * 3) +
      (tree.totalCrystallized * 8) +
      (avgRating * 5) +
      (Object.keys(genreMap).length * 7)
    )
  );

  return {
    totalSessions: tree.totalSessions,
    totalSkills: skills.length,
    genresCovered: Object.keys(genreMap),
    topGenre,
    avgRating,
    mostRecentSkill: sorted[0] ?? null,
    evolutionScore,
  };
}
