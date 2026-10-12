import { playRound, VOLATILITIES } from "../src/lib/slot/engine";
const N = Number(process.argv[2] ?? 300000);
for (const v of VOLATILITIES) for (const buy of [null, "bonus", "super"] as const) {
  const n = buy ? Math.floor(N / 5) : N; let c = 0, w = 0;
  for (let i = 0; i < n; i++) { const r = playRound(1, buy, { rtp: 96, volatility: v }); c += r.cost; w += r.totalWin; }
  console.log(v, buy ?? "base", (w / c * 100).toFixed(2));
}
