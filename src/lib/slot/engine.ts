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
  base: SpinStep; freeSpins: SpinStep[]; superBonus: boolean;
  bonusLevel: number; bonusSpins?: number; minPaid?: boolean; gambles: GambleStep[]; reveal?: Grid; totalWin: number; capped: boolean; timestamp: string;
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
  medium: { base: 0.6575, bonus: 0.02889, super: 0.002071 }, high: { base: 0.6418, bonus: 0.02155, super: 0.001656 }, extreme: { base: 0.6406, bonus: 0.01446, super: 0.001170 },
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
    if (syms[0] === "SCATTER") return;
    let target: SymbolId | null = null;
    let count = 0;
    for (const s of syms) {
      if (s === "SCATTER") break;
      if (s === "WILD" || s === "ORB") { count++; continue; } // en los bonos el orbe también hace de wild
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
      cur = tumbleOnce(cur, bet, scale, sticky, table);
      step.tumbles.push(cur);
      step.win = round2(step.win + cur.win);
    }
  }
  return step;
}

// Cascada (Super Bonus): los símbolos premiados desaparecen y re-giran en su mismo hueco.
// Wilds pegajosos y orbes se quedan; los símbolos nuevos no traen wilds ni scatters.
export const MAX_TUMBLES = 20;
function tumbleOnce(prev: SpinStep, bet: number, scale: number, sticky: Map<number, number>, table: [number, number][]): SpinStep {
  const remove = new Set<string>();
  prev.lineWins.forEach((l) => l.positions.forEach(([a, b]) => remove.add(`${a}-${b}`)));
  const orbAt = new Map(prev.orbs.map((o) => [`${o.reel}-${o.row}`, o.value]));
  const grid: Grid = []; const orbs: Orb[] = [];
  prev.grid.forEach((col, reel) => {
    if (sticky.has(reel)) { grid.push([...col]); return; }
    // Re-giro en el mismo hueco: nada se mueve, solo se reemplazan los premiados
    grid.push(col.map((s, row) => {
      const k = `${reel}-${row}`;
      // Los orbes se quedan pero su multiplicador vuelve a girar en cada re-giro
      if (orbAt.has(k)) { orbs.push({ reel, row, value: pickWeighted(table) }); return s; }
      if (!remove.has(k) || s === "WILD") return s;
      const n = pick(); return n === "WILD" || n === "SCATTER" ? "J" : n;
    }));
  });
  const st = evaluate(grid, bet, orbs, scale, sticky);
  st.scatterWin = 0; st.freeSpinsAwarded = 0;
  st.win = round2(st.lineWins.reduce((s, l) => s + l.win, 0));
  return st;
}

function forcedTriggerGrid(n = 3): Grid {
  const grid = spinGrid().map((col) => col.map((s) => (s === "SCATTER" ? "J" : s)) as SymbolId[]);
  const reels = Array.from({ length: REELS }, (_, i) => i).sort(() => rand() - 0.5).slice(0, n);
  for (const r of reels) grid[r]![Math.floor(rand() * ROWS)] = "SCATTER";
  return grid;
}

// ---- Apuesta para subir el bono (ruleta) ----
export interface GambleStep { from: number; to: number; won: boolean; chance: number; spins: number }
export interface BonusState {
  roundId: string; bet: number; buy: BuyType | null; config: GameConfig; cost: number; scaleKey: "base" | BuyType;
  base: SpinStep; level: number; spins: number; isSuper: boolean; canGamble: boolean; gambles: GambleStep[]; timestamp: string;
}
const SUPER_LEVEL = 5;
const levelSpins = (l: number) => FREE_SPINS[Math.min(l, 7)] ?? 0;
// Valor medio de un bono (x apuesta a escala 1) ≈ A · giros^K. Medido con scripts/ev-table.ts (crece más que lineal por los wilds pegajosos)
export const BONUS_EV: Record<Volatility, { N: number; S: number }> = { medium: { N: 0.78, S: 18.9 }, high: { N: 0.985, S: 20.5 }, extreme: { N: 1.37, S: 24.7 } };
const EV_K = { N: 2, S: 1.8 };
// Los giros super pagan con la escala del bono reducida por SUPER_DAMP (así valen lo mismo vengan de donde vengan)
const superDamp = (v: Volatility) => VOL_CAL[v].super / VOL_CAL[v].bonus;
const bonusEV = (v: Volatility, sup: boolean, spins: number) => (sup ? superDamp(v) * BONUS_EV[v].S * spins ** EV_K.S : BONUS_EV[v].N * spins ** EV_K.N);
/** Probabilidad de ganar la apuesta: neutral en RTP (valor esperado igual al de no apostar). */
export const GAMBLE_HARDNESS = 0.55;
// Las compras siempre devuelven como mínimo este % de su precio
export const BUY_MIN_RETURN = 0.6;
export function gambleChance(st: BonusState): number | null {
  if (!st.canGamble || st.level >= 7) return null;
  const v = st.config.volatility;
  const next = st.level + 1;
  const cur = bonusEV(v, st.isSuper, st.spins);
  const lose = bonusEV(v, st.isSuper, Math.max(1, Math.floor(st.spins / 2)));
  const win = bonusEV(v, st.isSuper || next >= SUPER_LEVEL, levelSpins(next));
  // Neutral en RTP multiplicado por GAMBLE_HARDNESS (<1 = más difícil; apostar baja el RTP)
  const crossToSuper = !st.isSuper && next >= SUPER_LEVEL;
  const p = GAMBLE_HARDNESS * (crossToSuper ? 0.5 : 1) * (cur - lose) / (win - lose);
  return Math.min(0.95, Math.max(0.01, Math.round(p * 10000) / 10000));
}
/** r: número aleatorio [0,1) generado por el servidor. Si se pierde, la apuesta termina con la mitad de giros. */
export function gamble(st: BonusState, r: number): BonusState {
  const p = gambleChance(st);
  if (p === null) throw new Error("No se puede apostar");
  const won = r < p;
  const to = won ? st.level + 1 : st.level;
  const spins = won ? levelSpins(to) : Math.max(1, Math.floor(st.spins / 2));
  return {
    ...st, level: to, spins, isSuper: st.isSuper || to >= SUPER_LEVEL, canGamble: won && to < 7,
    gambles: [...st.gambles, { from: st.level, to, won, chance: p, spins }],
  };
}

function scaleFor(config: GameConfig, key: "base" | BuyType) {
  return TUNING.PAY_SCALE * (config.rtp / 96) * VOL_CAL[config.volatility][key];
}

/** Primera tirada. Si activa bono devuelve el estado pendiente (para apostar o jugar). */
export function startRound(bet: number, buy: BuyType | null = null, cfg?: Partial<GameConfig> | null): { round?: RoundResult; pending?: BonusState } {
  if (!BET_LEVELS.includes(bet)) throw new Error("Apuesta no válida");
  const config = normalizeConfig(cfg);
  const scaleKey = buy ?? "base";
  const base = evaluate(buy ? forcedTriggerGrid(buy === "super" ? SUPER_LEVEL : 3) : spinGrid(), bet, [], scaleFor(config, scaleKey));
  const roundId = globalThis.crypto.randomUUID();
  const cost = round2(bet * (buy ? BUY_COST[buy] : 1));
  const timestamp = new Date().toISOString();
  if (base.scatterCount < 3) {
    const totalWin = Math.min(base.win, round2(bet * MAX_WIN_X));
    return { round: { roundId, gameId: GAME_ID, version: GAME_VERSION, bet, cost, buy, base, freeSpins: [], superBonus: false, totalWin, capped: base.win > bet * MAX_WIN_X, config, timestamp, bonusLevel: 0, gambles: [] } };
  }
  const level = Math.min(base.scatterCount, 7);
  return { pending: { roundId, bet, buy, config, cost, scaleKey, base, level, spins: levelSpins(level), isSuper: level >= SUPER_LEVEL, canGamble: level < 7, gambles: [], timestamp } };
}

/** Rejilla de presentación (sin premio) con los scatters conseguidos antes de empezar el bono. */
function revealGrid(n: number): Grid { return forcedTriggerGrid(n); }

export function finishBonus(st: BonusState, scaleOverride?: number): RoundResult {
  const { bet, config, isSuper } = st;
  const scale = scaleOverride ?? scaleFor(config, "bonus") * (isSuper ? superDamp(config.volatility) : 1);
  const table = tilt(isSuper ? ORB_TABLE_SUPER : ORB_TABLE, config.volatility);
  // Las compras siempre devuelven al menos BUY_MIN_RETURN en premios reales: se repite el bono hasta lograrlo
  const min = st.buy !== null ? st.cost * BUY_MIN_RETURN : 0;
  let freeSpins: SpinStep[] = []; let totalWin = 0; let capped = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    const x1000At = new Set<number>();
    // Super: 2 x1000 en tiradas aleatorias; cada uno aparece solo con cierta probabilidad (no siempre toca)
    if (isSuper) {
      const spots = new Set<number>();
      while (spots.size < Math.min(SUPER_X1000_COUNT, st.spins)) spots.add(Math.floor(rand() * st.spins));
      spots.forEach((i) => { if (rand() < TUNING.SUPER_X1000_CHANCE) x1000At.add(i); });
    }
    freeSpins = [];
    const sticky = new Map<number, number>();
    let remaining = st.spins;
    while (remaining > 0 && freeSpins.length < 100) {
      const step = freeSpin(bet, table, x1000At.has(freeSpins.length), isSuper ? TUNING.SUPER_ORB_CHANCE : TUNING.ORB_CHANCE, scale, sticky, isSuper);
      freeSpins.push(step);
      remaining += step.freeSpinsAwarded - 1; // reactivación
    }
    totalWin = round2(st.base.win + freeSpins.reduce((s, f) => s + f.win, 0));
    capped = totalWin > bet * MAX_WIN_X;
    if (capped) totalWin = round2(bet * MAX_WIN_X);
    if (totalWin > 0 || min === 0) break;
  }
  // Si no llega al mínimo, se suben proporcionalmente los premios del bono (se ven como premios normales)
  const fsWin = round2(totalWin - st.base.win);
  if (totalWin < min && fsWin > 0) {
    const f = (min - st.base.win) / fsWin;
    const bump = (x: SpinStep) => { x.win = round2(x.win * f); x.scatterWin = round2(x.scatterWin * f); x.lineWins.forEach((l) => { l.win = round2(l.win * f); }); x.tumbles?.forEach(bump); };
    freeSpins.forEach(bump);
    totalWin = round2(st.base.win + freeSpins.reduce((s, x) => s + x.win, 0));
  }
  const minPaid = false;
  return {
    minPaid, roundId: st.roundId, gameId: GAME_ID, version: GAME_VERSION, bet, cost: st.cost, buy: st.buy,
    base: st.base, freeSpins, superBonus: isSuper, totalWin, capped, config, timestamp: st.timestamp,
    bonusLevel: st.level, bonusSpins: st.spins, gambles: st.gambles, reveal: revealGrid(st.level),
  };
}

/** Ronda completa (simulaciones). gambleUpTo: nivel hasta el que se apuesta (0 = nunca). */
export function playRound(bet: number, buy: BuyType | null = null, cfg?: Partial<GameConfig> | null, gambleUpTo = 0): RoundResult {
  const r = startRound(bet, buy, cfg);
  if (r.round) return r.round;
  let st = r.pending!;
  while (st.canGamble && st.level < gambleUpTo) st = gamble(st, rand());
  return finishBonus(st);
}
