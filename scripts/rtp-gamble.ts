// RTP de las compras sin apostar vs apostando siempre hasta 7 scatters (debe ser igual)
import { playRound, VOLATILITIES } from "../src/lib/slot/engine";
const N = Number(process.argv[2] ?? 20000); const only = process.argv[3];
for (const v of VOLATILITIES) { if (only && v !== only) continue; for (const buy of ["bonus", "super"] as const) for (const g of [0, 7]) {
  let c = 0, w = 0; for (let i = 0; i < N; i++) { const r = playRound(1, buy, { rtp: 96, volatility: v }, g); c += r.cost; w += r.totalWin; }
  console.log(v, buy, g ? "apostando" : "sin apostar", (w / c * 100).toFixed(1));
} }
