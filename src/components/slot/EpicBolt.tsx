import { useEffect, useState } from "react";

type P = { x: number; y: number };
function path(a: P, b: P, segs: number, amp: number) {
  const pts: P[] = [];
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  for (let i = 0; i <= segs; i++) {
    const f = i / segs;
    const off = i === 0 || i === segs ? 0 : (Math.random() - 0.5) * amp * Math.sin(Math.PI * f) * 2;
    pts.push({ x: a.x + dx * f + nx * off, y: a.y + dy * f + ny * off });
  }
  return pts;
}
const str = (p: P[]) => p.map((q) => `${q.x},${q.y}`).join(" ");

/** Rayo épico: núcleo blanco, halo, ramificaciones que se regeneran cada fotograma. */
export function EpicBolt({ from, to }: { from: P; to: P }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 55); return () => clearInterval(id); }, []);
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const main = path(from, to, Math.max(10, Math.round(len / 28)), Math.min(90, len * 0.08));
  const branches = Array.from({ length: 6 }, () => {
    const s = main[1 + Math.floor(Math.random() * (main.length - 2))]!;
    const ang = Math.atan2(to.y - from.y, to.x - from.x) + (Math.random() - 0.5) * 2.2;
    const l = 40 + Math.random() * len * 0.25;
    return path(s, { x: s.x + Math.cos(ang) * l, y: s.y + Math.sin(ang) * l }, 6, 30);
  });
  return (
    <g key={tick}>
      <polyline points={str(main)} fill="none" stroke="var(--color-accent)" strokeWidth="34" strokeLinejoin="round" opacity="0.35" style={{ filter: "blur(14px)" }} />
      <polyline points={str(main)} fill="none" stroke="var(--color-primary)" strokeWidth="14" strokeLinejoin="round" opacity="0.75" style={{ filter: "blur(4px)" }} />
      {branches.map((b, i) => <polyline key={i} points={str(b)} fill="none" stroke="var(--color-secondary)" strokeWidth="3" strokeLinejoin="round" opacity="0.8" />)}
      <polyline points={str(main)} fill="none" stroke="var(--color-foreground)" strokeWidth="4" strokeLinejoin="round" />
      <circle cx={from.x} cy={from.y} r={26 + (tick % 3) * 6} fill="var(--color-foreground)" opacity="0.7" style={{ filter: "blur(8px)" }} />
      <circle cx={to.x} cy={to.y} r={40 + (tick % 4) * 10} fill="var(--color-primary)" opacity="0.55" style={{ filter: "blur(12px)" }} />
    </g>
  );
}
