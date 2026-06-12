import type { ConfidenceLevel } from '@/ai';

const cfg: Record<ConfidenceLevel, { color: string; bg: string; border: string; dot: string }> = {
  high:   { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  medium: { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   dot: 'bg-amber-400'   },
  low:    { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     dot: 'bg-red-400'     },
};

/** Small pill indicating agent confidence. */
export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const c = cfg[level];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-wider ${c.color} ${c.bg} border ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {level}
    </span>
  );
}
