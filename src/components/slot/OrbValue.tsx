import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const ROLL = [2, 3, 5, 10, 25, 50, 100, 250, 500, 1000];
// Mini re-giro del multiplicador: los números pasan rápido y se para en el valor final
export function OrbValue({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [rolling, setRolling] = useState(true);
  useEffect(() => {
    setRolling(true);
    let i = 0;
    const t = setInterval(() => { setShown(ROLL[Math.floor(Math.random() * ROLL.length)]!); if (++i > 10) { clearInterval(t); setShown(value); setRolling(false); } }, 55);
    return () => clearInterval(t);
  }, [value]);
  return (
    <span className={cn("font-display text-gold absolute inset-0 z-10 flex items-center justify-center font-black drop-shadow-[0_2px_6px_black]", shown >= 1000 ? "text-2xl sm:text-4xl" : "text-3xl sm:text-5xl", rolling ? "animate-orb-roll blur-[0.5px]" : "animate-big-win")}>x{shown}</span>
  );
}
