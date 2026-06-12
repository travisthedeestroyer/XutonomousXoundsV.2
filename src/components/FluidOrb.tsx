import { useRef, useEffect } from 'react';

interface FluidOrbProps {
  analyser?: AnalyserNode | null;
  size?: number;
  active?: boolean;
}

/** Canvas-rendered fluid orb that reacts to an optional live analyser. */
export function FluidOrb({ analyser, size = 280, active = false }: FluidOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    let tick = 0;

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      tick++;
      ctx.clearRect(0, 0, W, H);

      // Audio energy (live or idle pulse)
      let energy = 0;
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        energy = data.reduce((s, v) => s + v, 0) / data.length / 255;
      } else {
        energy = 0.15 + Math.sin(tick * 0.025) * 0.09 + Math.sin(tick * 0.063) * 0.04;
      }

      const boost = active ? 0.15 : 0;
      const r = size * 0.38 + energy * 28 + boost * 16;

      // Outer glow rings
      for (let ring = 3; ring >= 1; ring--) {
        const ringR = r + ring * (12 + energy * 16);
        const alpha = (energy * 0.28 + 0.04) / ring;
        ctx.beginPath();
        for (let i = 0; i <= 96; i++) {
          const angle = (i / 96) * Math.PI * 2;
          const noise =
            Math.sin(angle * 3 + tick * 0.04) * 7 +
            Math.sin(angle * 5 - tick * 0.03) * 4 +
            energy * 10;
          const rr = ringR + noise;
          const x = cx + Math.cos(angle) * rr;
          const y = cy + Math.sin(angle) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringR + 20);
        grad.addColorStop(0, 'rgba(139,92,246,0)');
        grad.addColorStop(1, `rgba(139,92,246,${alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Fluid body
      ctx.beginPath();
      for (let i = 0; i <= 128; i++) {
        const angle = (i / 128) * Math.PI * 2;
        const noise =
          Math.sin(angle * 2 + tick * 0.022) * (9 + energy * 18) +
          Math.sin(angle * 4 - tick * 0.038) * (5 + energy * 12) +
          Math.sin(angle * 7 + tick * 0.055) * (2.5 + energy * 7);
        const rr = r + noise;
        const x = cx + Math.cos(angle) * rr;
        const y = cy + Math.sin(angle) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const bodyGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r + 28);
      bodyGrad.addColorStop(0, `rgba(167,139,250,${0.22 + energy * 0.28})`);
      bodyGrad.addColorStop(0.5, `rgba(139,92,246,${0.14 + energy * 0.2})`);
      bodyGrad.addColorStop(1, `rgba(79,70,229,${0.07 + energy * 0.12})`);
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.strokeStyle = `rgba(196,181,253,${0.4 + energy * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Frequency spikes when analyser is live
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < data.length; i++) {
          const pct = data[i] / 255;
          if (pct < 0.05) continue;
          const angle = (i / data.length) * Math.PI * 2;
          const noise =
            Math.sin(angle * 2 + tick * 0.022) * (9 + energy * 18) +
            Math.sin(angle * 4 - tick * 0.038) * (5 + energy * 12);
          const inner = r + noise;
          const outer = inner + pct * 38;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
          ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
          ctx.strokeStyle = `rgba(244,114,182,${pct * 0.75})`;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }
    };

    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [analyser, size, active]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="absolute pointer-events-none"
      style={{ width: size, height: size }}
    />
  );
}
