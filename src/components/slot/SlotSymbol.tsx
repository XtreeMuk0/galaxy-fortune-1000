import type { SymbolId } from "@/lib/slot/engine";
import { SYMBOL_IMG, SYMBOL_NAME } from "./symbols";
import { cn } from "@/lib/utils";

const LETTER_COLOR: Record<string, string> = { A: "text-accent", K: "text-secondary", Q: "text-primary", J: "text-muted-foreground" };

export function SlotSymbol({ id, win, className, value }: { id: SymbolId; win?: boolean; className?: string; value?: number }) {
  const img = SYMBOL_IMG[id];
  return (
    <div className={cn("relative flex h-full w-full items-center justify-center p-1.5", win && "animate-win", className)}>
      {value !== undefined && (
        <span className={cn("font-display text-gold absolute inset-0 z-10 flex items-center justify-center font-black drop-shadow-[0_2px_6px_black]", value >= 1000 ? "text-2xl sm:text-4xl" : "text-3xl sm:text-5xl")}>x{value}</span>
      )}
      {img ? (
        <img src={img} alt={SYMBOL_NAME[id]} draggable={false} className="h-full w-full object-contain drop-shadow-lg" />
      ) : (
        <span className={cn("font-display text-4xl font-black drop-shadow-[0_0_10px_currentColor] sm:text-5xl", LETTER_COLOR[id])}>{id}</span>
      )}
    </div>
  );
}
