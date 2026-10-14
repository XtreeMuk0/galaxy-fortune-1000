// Ruleta de la apuesta: la zona dorada (ganar) ocupa la probabilidad real de subir.
export function GambleWheel({ chance, rotation }: { chance: number; rotation: number }) {
  const a = chance * 2 * Math.PI;
  const x = 50 + 48 * Math.sin(a), y = 50 - 48 * Math.cos(a);
  const large = chance > 0.5 ? 1 : 0;
  return (
    <div className="relative mx-auto h-56 w-56 sm:h-72 sm:w-72">
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 border-x-[12px] border-t-[22px] border-x-transparent border-t-foreground drop-shadow-lg" />
      <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_0_24px_var(--color-primary)]" style={{ transform: `rotate(${rotation}deg)`, transition: "transform 3.2s cubic-bezier(0.15, 0.85, 0.2, 1)" }}>
        <circle cx="50" cy="50" r="48" className="fill-destructive/80 stroke-border" strokeWidth="1" />
        {chance >= 0.999 ? <circle cx="50" cy="50" r="48" className="fill-accent" /> : <path d={`M50 50 L50 2 A48 48 0 ${large} 1 ${x} ${y} Z`} className="fill-accent" />}
        <circle cx="50" cy="50" r="10" className="fill-background stroke-primary" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
