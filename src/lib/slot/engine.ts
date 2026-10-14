// Galaxias — motor matemático puro. Se ejecuta en el servidor (autoritativo).
// 7 rodillos x 5 filas, 50 líneas fijas, WILD sustituye, SCATTER x3+ = giros gratis con orbes multiplicadores.

export type SymbolId =
  | "WILD" | "SCATTER" | "ASTRO" | "PLANET" | "UFO" | "COMET" | "CRYSTAL"
  | "A" | "K" | "Q" | "J" | "ORB";

export const ROWS = 5;
export const REELS = 7;
export const GAME_ID = "galaxy-fortune-1000";
export const GAME_VERSION = "1.0.0";

// Pesos por rodillo (tira virtual)
const WEIGHTS: Record<Exclude<SymbolId, "ORB">, number> = {
  WILD: 2, SCATTER: 1, ASTRO: 4, PLANET: 6, UFO: 7, COMET: 8, CRYSTAL: 9,
  A: 12, K: 13, Q: 14, J: 15,
};

// Pagos en multiplicador de la apuesta por línea (3,4,5 iguales)
export const PAYTABLE: Partial<Record<SymbolId, number[]>> = {
  WILD: [50, 250, 1000, 2500, 5000],
  ASTRO: [25, 100, 500, 1000, 2000],
  PLANET: [15, 60, 250, 500, 1000],
  UFO: [10, 40, 150, 300, 600],
  COMET: [8, 25, 100, 200, 400],
  CRYSTAL: [6, 20, 80, 160, 300],
  A: [4, 12, 40, 80, 150],
  K: [3, 10, 30, 60, 120],
  Q: [2, 8, 25, 50, 100],
  J: [2, 6, 20, 40, 80],
};
// Pago de scatter: multiplicador de la apuesta TOTAL
export const SCATTER_PAY: Record<number, number> = { 3: 2, 4: 10, 5: 50, 6: 100, 7: 200 };
export const FREE_SPINS: Record<number, number> = { 3: 10, 4: 15, 5: 20, 6: 25, 7: 30 };

// 50 líneas para 6x5: formas base desplazadas a todas las filas posibles
const SHAPES: number[][] = [
  [0,0,0,0,0,0],[0,1,2,2,1,0],[2,1,0,0,1,2],[0,1,0,1,0,1],[1,0,1,0,1,0],
  [0,0,1,1,2,2],[2,2,1,1,0,0],[0,1,1,1,1,0],[1,0,0,0,0,1],[0,0,1,1,0,0],[1,1,0,0,1,1],
  [0,1,2,1,0,1],[2,1,0,1,2,1],[0,0,0,1,1,1],[1,1,1,0,0,0],
];
export const PAYLINES: number[][] = (() => {
  const out: number[][] = []; const seen = new Set<string>();
  for (let off = 0; off < 5; off++) for (const sh of SHAPES) {
    const l = [...sh, sh[0]!].map((d) => d + off); if (Math.max(...l) > 4) continue;
    const k = l.join(); if (!seen.has(k)) { seen.add(k); out.push(l); }
  }
  out.sort((a, b) => Number(new Set(a).size > 1) - Number(new Set(b).size > 1));
  return out.slice(0, 50);
})();
export const LINES = PAYLINES.length;
export const BET_LEVELS = [0.2, 0.4, 1, 2, 4, 10, 20, 50, 100];

const ENTRIES = Object.entries(WEIGHTS) as [SymbolId, number][];
const TOTAL = ENTRIES.reduce((s, [, w]) => s + w, 0);

function rand(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0]! / 0x100000000;
}
function pick(): SymbolId {
  let r = rand() * TOTAL;
  for (const [s, w] of ENTRIES) { if ((r -= w) < 0) return s; }
  return "J";
}

export type Grid = SymbolId[][]; // grid[reel][row]
export interface LineWin { line: number; symbol: SymbolId; count: number; win: number; positions: [number, number][] }
export interface Orb { reel: number; row: number; value: number }
export interface SpinStep {
  grid: Grid; lineWins: LineWin[]; scatterCount: number; scatterWin: number;
  win: number; multiplier: number; freeSpinsAwarded: number; orbs: Orb[];
  stickyWilds?: StickyWild[];
  tumbles?: SpinStep[]; // cascadas posteriores (solo Super Bonus); win del paso ya las incluye
}
// Wild expansivo y pegajoso de los giros gratis; al caer libra una batalla entre dos multiplicadores
export interface StickyWild { reel: number; value: number; isNew: boolean; battle: [number, number] }
export type BuyType = "bonus" | "super";
export interface RoundResult {
  config: GameConfig; roundId: string; gameId: string; version: string; bet: number; cost: number; buy: BuyType | null;
  base: SpinStep; freeSpins: SpinStep[]; totalWin: number; capped: boolean; timestamp: string;
}

// ---- Función bonus: orbes multiplicadores (solo en giros gratis) ----
// Valores ajustados por simulación (scripts/rtp-sim.ts) para controlar el RTP.
export const TUNING = { PAY_SCALE: 4.08, ORB_CHANCE: 0.1, SUPER_ORB_CHANCE: 0.1, SUPER_X1000_CHANCE: 0.765 }; // ajustado por simulación
export const ORB_TABLE: [number, number][] = [
  [2, 80], [3, 120], [5, 150], [10, 80], [25, 35], [50, 15], [100, 6], [250, 2], [500, 0.6], [1000, 0.15],
];
// En la super compra los orbes normales no traen x1000; se garantizan 2 x1000 en tiradas aleatorias
const ORB_TABLE_SUPER = ORB_TABLE.filter(([v]) => v < 1000);
export const BUY_COST: Record<BuyType, number> = { bonus: 100, super: 500 };
export const SUPER_X1000_COUNT = 2;
// Batalla del wild: un multiplicador bajo contra uno alto, gana uno al azar (50/50)
export const BATTLE_LOW = [2, 3];
// Multiplicador alto de la batalla: hasta x1000 (muy raro)
export const BATTLE_HIGH: [number, number][] = [[5, 400], [10, 250], [25, 120], [50, 60], [100, 25], [250, 8], [500, 3], [1000, 1]];
export const MAX_STICKY = 3; // máximo de rodillos wild pegajosos por bono
export const WILD_FS_KEEP = 0.07; // probabilidad de que un wild caído en giros gratis cuente (controla frecuencia)
export const MAX_WIN_X = 10000; // premio máximo por ronda (x apuesta)

export type Volatility = "medium" | "high" | "extreme";
export const VOLATILITIES: Volatility[] = ["medium", "high", "extreme"];
export const RTP_OPTIONS = [94, 95, 96, 97];
export interface GameConfig { rtp: number; volatility: Volatility }
export const DEFAULT_CONFIG: GameConfig = { rtp: 96, volatility: "high" };
// Volatilidad: inclina el peso de los orbes grandes (>=25)
const VOL_TILT: Record<Volatility, number> = { medium: 0.4, high: 1, extreme: 2.5 };
// Compensación calibrada por simulación para que cada modo dé el RTP objetivo
export const VOL_CAL: Record<Volatility, Record<"base" | BuyType, number>> = {
  medium: { base: 0.3709, bonus: 0.3006, super: 0.3801 }, high: { base: 0.2413, bonus: 0.2413, super: 0.3672 }, extreme: { base: 0.2032, bonus: 0.177, super: 0.3323 },
};
function tilt(table: [number, number][], v: Volatility): [number, number][] {
  return table.map(([x, w]) => [x, x >= 25 ? w * VOL_TILT[v] : w]);
}
export function normalizeConfig(c?: Partial<GameConfig> | null): GameConfig {
  const rtp = RTP_OPTIONS.includes(Number(c?.rtp)) ? Number(c!.rtp) : DEFAULT_CONFIG.rtp;
  const volatility = VOLATILITIES.includes(c?.volatility as Volatility) ? (c!.volatility as Volatility) : DEFAULT_CONFIG.volatility;
  return { rtp, volatility };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

function pickWeighted(table: [number, number][]): number {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of table) { if ((r -= w) < 0) return v; }
  return table[0]![0];
}

function evaluate(grid: Grid, bet: number, orbs: Orb[], scale: number, wildMult: Map<number, number> = new Map()): SpinStep {
  const lineBet = bet / LINES;
  const lineWins: LineWin[] = [];
  const orbSum = orbs.reduce((s, o) => s + o.value, 0);
  PAYLINES.forEach((pl, li) => {
    const syms = pl.map((row, reel) => grid[reel]![row]!);
    if (syms[0] === "SCATTER" || syms[0] === "ORB") return;
    let target: SymbolId | null = null;
    let count = 0;
    for (const s of syms) {
      if (s === "SCATTER" || s === "ORB") break;
      if (s === "WILD") { count++; continue; }
      if (target === null) { target = s; count++; continue; }
      if (s === target) { count++; continue; }
      break;
    }
    let wildRun = 0;
    for (const s of syms) { if (s === "WILD") wildRun++; else break; }
    const sym = target ?? "WILD";
    const pay = count >= 3 ? PAYTABLE[sym]?.[count - 3] ?? 0 : 0;
    const wildPay = wildRun >= 3 ? PAYTABLE.WILD![wildRun - 3]! : 0;
    const [finalSym, finalCount, finalPay]: [SymbolId, number, number] = wildPay > pay ? ["WILD" as SymbolId, wildRun, wildPay] : [sym, count, pay];
    if (finalPay > 0) {
      let wm = orbSum;
      for (let r = 0; r < finalCount; r++) wm += wildMult.get(r) ?? 0;
      lineWins.push({
        line: li, symbol: finalSym, count: finalCount, win: round2(finalPay * lineBet * scale * (wm || 1)),
        positions: pl.slice(0, finalCount).map((row, reel) => [reel, row]),
      });
    }
  });
  const scatterCount = grid.flat().filter((s) => s === "SCATTER").length;
  const sc = Math.min(scatterCount, 7);
  const multiplier = orbSum || 1;
  // Orbes y wilds pegajosos se suman (no se multiplican entre sí) en cada línea; el scatter solo lleva orbes
  const scatterWin = round2((SCATTER_PAY[sc] ?? 0) * bet * scale * multiplier);
  const raw = lineWins.reduce((s, l) => s + l.win, 0) + scatterWin;
  return { grid, lineWins, scatterCount, scatterWin, win: round2(raw), multiplier, freeSpinsAwarded: FREE_SPINS[sc] ?? 0, orbs };
}

function spinGrid(): Grid {
  return Array.from({ length: REELS }, () => Array.from({ length: ROWS }, pick));
}

function freeSpin(bet: number, table: [number, number][], forceX1000: boolean, orbChance: number, scale: number, sticky: Map<number, number>, tumble = false): SpinStep {
  const grid = spinGrid();
  const fresh = new Set<number>();
  const battles = new Map<number, [number, number]>();
  grid.forEach((col, reel) => {
    if (sticky.has(reel)) return;
    if (col.includes("WILD") && sticky.size < MAX_STICKY && rand() < WILD_FS_KEEP) {
      const low = BATTLE_LOW[Math.floor(rand() * BATTLE_LOW.length)]!;
      const high = pickWeighted(BATTLE_HIGH);
      sticky.set(reel, rand() < 0.5 ? low : high); fresh.add(reel); battles.set(reel, [low, high]);
    } else col.forEach((s, row) => { if (s === "WILD") col[row] = "J"; });
  });
  for (const reel of sticky.keys()) grid[reel] = Array(ROWS).fill("WILD");
  const orbs: Orb[] = [];
  grid.forEach((col, reel) => col.forEach((s, row) => {
    if (s !== "SCATTER" && s !== "WILD" && rand() < orbChance) {
      col[row] = "ORB"; orbs.push({ reel, row, value: pickWeighted(table) });
    }
  }));
  if (forceX1000) {
    const free: [number, number][] = [];
    grid.forEach((col, reel) => col.forEach((s, row) => { if (s !== "SCATTER" && s !== "WILD" && s !== "ORB") free.push([reel, row]); }));
    const spot = free[Math.floor(rand() * free.length)];
    if (spot) { const [reel, row] = spot; grid[reel]![row] = "ORB"; orbs.push({ reel, row, value: 1000 }); }
  }
  const step = evaluate(grid, bet, orbs, scale, sticky);
  step.stickyWilds = [...sticky].sort((a, b) => a[0] - b[0]).map(([reel, value]) => ({ reel, value, isNew: fresh.has(reel), battle: battles.get(reel) ?? [value, value] }));
  if (tumble) {
    step.tumbles = [];
    let cur = step;
    while (cur.lineWins.length && step.tumbles.length < MAX_TUMBLES) {
      cur = tumbleOnce(cur, bet, scale, sticky);
      step.tumbles.push(cur);
      step.win = round2(step.win + cur.win);
    }
  }
  return step;
}

// Cascada (Super Bonus): los símbolos premiados desaparecen y caen nuevos desde arriba.
// Wilds pegajosos y orbes se quedan; los símbolos nuevos no traen wilds ni scatters.
export const MAX_TUMBLES = 20;
function tumbleOnce(prev: SpinStep, bet: number, scale: number, sticky: Map<number, number>): SpinStep {
  const remove = new Set<string>();
  prev.lineWins.forEach((l) => l.positions.forEach(([a, b]) => remove.add(`${a}-${b}`)));
  const orbAt = new Map(prev.orbs.map((o) => [`${o.reel}-${o.row}`, o.value]));
  const grid: Grid = []; const orbs: Orb[] = [];
  prev.grid.forEach((col, reel) => {
    if (sticky.has(reel)) { grid.push([...col]); return; }
    const kept: { s: SymbolId; v?: number }[] = [];
    col.forEach((s, row) => {
      const k = `${reel}-${row}`;
      if (remove.has(k) && s !== "ORB" && s !== "WILD") return;
      kept.push(orbAt.has(k) ? { s, v: orbAt.get(k)! } : { s });
    });
    const fresh: { s: SymbolId }[] = Array.from({ length: ROWS - kept.length }, () => {
      const s = pick(); return { s: s === "WILD" || s === "SCATTER" ? "J" : s };
    });
    const next = [...fresh, ...kept];
    next.forEach((c, row) => { if (c.s === "ORB" && "v" in c && c.v !== undefined) orbs.push({ reel, row, value: c.v }); });
    grid.push(next.map((c) => c.s));
  });
  const st = evaluate(grid, bet, orbs, scale, sticky);
  st.scatterWin = 0; st.freeSpinsAwarded = 0;
  st.win = round2(st.lineWins.reduce((s, l) => s + l.win, 0));
  return st;
}

function forcedTriggerGrid(): Grid {
  const grid = spinGrid().map((col) => col.map((s) => (s === "SCATTER" ? "J" : s)) as SymbolId[]);
  const reels = Array.from({ length: REELS }, (_, i) => i).sort(() => rand() - 0.5).slice(0, 3);
  for (const r of reels) grid[r]![Math.floor(rand() * ROWS)] = "SCATTER";
  return grid;
}

export function playRound(bet: number, buy: BuyType | null = null, cfg?: Partial<GameConfig> | null): RoundResult {
  if (!BET_LEVELS.includes(bet)) throw new Error("Apuesta no válida");
  const config = normalizeConfig(cfg);
  const scale = TUNING.PAY_SCALE * (config.rtp / 96) * VOL_CAL[config.volatility][buy ?? "base"];
  const base = evaluate(buy ? forcedTriggerGrid() : spinGrid(), bet, [], scale);
  const freeSpins: SpinStep[] = [];
  const table = tilt(buy === "super" ? ORB_TABLE_SUPER : ORB_TABLE, config.volatility);
  const x1000At = new Set<number>();
  // Super: 2 x1000 en tiradas aleatorias; cada uno aparece solo con cierta probabilidad (no siempre toca)
  if (buy === "super") {
    const spots = new Set<number>();
    while (spots.size < SUPER_X1000_COUNT) spots.add(Math.floor(rand() * base.freeSpinsAwarded));
    spots.forEach((i) => { if (rand() < TUNING.SUPER_X1000_CHANCE) x1000At.add(i); });
  }
  const sticky = new Map<number, number>();
  let remaining = base.freeSpinsAwarded;
  while (remaining > 0 && freeSpins.length < 100) {
    const step = freeSpin(bet, table, x1000At.has(freeSpins.length), buy === "super" ? TUNING.SUPER_ORB_CHANCE : TUNING.ORB_CHANCE, scale, sticky, buy === "super");
    freeSpins.push(step);
    remaining += step.freeSpinsAwarded - 1; // reactivación
  }
  let totalWin = round2(base.win + freeSpins.reduce((s, f) => s + f.win, 0));
  const capped = totalWin > bet * MAX_WIN_X;
  if (capped) totalWin = round2(bet * MAX_WIN_X);
  return {
    roundId: globalThis.crypto.randomUUID(), gameId: GAME_ID, version: GAME_VERSION,
    bet, cost: round2(bet * (buy ? BUY_COST[buy] : 1)), buy,
    base, freeSpins, totalWin, capped, config, timestamp: new Date().toISOString(),
  };
}
