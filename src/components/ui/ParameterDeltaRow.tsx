import type { ParameterDelta } from '@/ai';

/** Format a delta value according to its unit. */
export function formatDeltaVal(val: number, unit: string): string {
  if (unit === '%') return `${Math.round(val * 100)}%`;
  if (unit === 'dB' || unit === 'LUFS') return `${val.toFixed(1)}`;
  if (unit === 'Hz') return `${Math.round(val)}`;
  if (unit === ':1') return `${val.toFixed(1)}`;
  return `${val.toFixed(2)}`;
}

/** Before/after row for a single mix-parameter change. */
export function ParameterDeltaRow({ delta }: { delta: ParameterDelta }) {
  const change = delta.after - delta.before;
  const isIncrease = change > 0;
  const absDiff = Math.abs(change);
  const diffStr =
    delta.unit === '%'
      ? `${Math.round(absDiff * 100)}%`
      : delta.unit === 'dB' || delta.unit === 'LUFS'
      ? `${absDiff.toFixed(1)}${delta.unit}`
      : `${absDiff.toFixed(2)} ${delta.unit}`;

  return (
    <div className="flex items-center justify-between text-[8px] py-0.5">
      <span className="text-white/40">{delta.label}</span>
      <div className="flex items-center gap-1.5 font-mono">
        <span className="text-white/25">{formatDeltaVal(delta.before, delta.unit)}</span>
        <span className={`font-bold ${isIncrease ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isIncrease ? '↑' : '↓'}{diffStr}
        </span>
        <span className="text-white/60">{formatDeltaVal(delta.after, delta.unit)}</span>
      </div>
    </div>
  );
}
