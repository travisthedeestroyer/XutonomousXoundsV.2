import { motion } from 'motion/react';

interface ProSliderProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatValue: (v: number) => string;
  colorClass?: string;
  glowClass?: string;
}

/** Horizontal slider with animated fill + glowing thumb. */
export function ProSlider({
  label,
  icon: Icon,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  colorClass = 'bg-violet-500',
  glowClass = 'shadow-violet-500/50',
}: ProSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
          <Icon className="w-3 h-3" /> {label}
        </label>
        <span className="font-mono text-xs text-white/70 bg-white/5 px-2 py-0.5 rounded-md">
          {formatValue(value)}
        </span>
      </div>
      <div className="relative h-8 flex items-center">
        <div className="absolute w-full h-1.5 bg-white/5 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
          <motion.div
            className={`h-full ${colorClass}`}
            initial={false}
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute w-full h-full opacity-0 cursor-pointer z-20 m-0 p-0"
          style={{ touchAction: 'none' }}
        />
        <motion.div
          className={`absolute w-4 h-4 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.8)] z-10 pointer-events-none ${glowClass}`}
          initial={false}
          animate={{ left: `calc(${percentage}% - 8px)` }}
          transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        />
      </div>
    </div>
  );
}
