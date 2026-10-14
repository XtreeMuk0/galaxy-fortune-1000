// Valor medio (x apuesta, escala 1) de jugar N giros gratis normales o super. Sirve para BONUS_EV en engine.ts
import { startRound, finishBonus, type Volatility } from "../src/lib/slot/engine";
const [v, sup, spins, n] = [process.argv[2] as Volatility, process.argv[3] === "1", Number(process.argv[4]), Number(process.argv[5] ?? 5000)];
const st = startRound(1, "bonus", { rtp: 96, volatility: v }).pending!;
let w = 0; for (let i = 0; i < n; i++) { const r = finishBonus({ ...st, spins, isSuper: sup, base: { ...st.base, win: 0 } }, 1); w += r.freeSpins.reduce((s, f) => s + f.win, 0); }
console.log(v, sup ? "S" : "N", spins, (w / n).toFixed(3));
