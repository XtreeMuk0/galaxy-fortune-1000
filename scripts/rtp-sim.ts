import { playRound } from "../src/lib/slot/engine";
const N = Number(process.argv[2] ?? 200000);
for (const buy of [null, "bonus", "super"] as const) {
  const n = buy ? Math.floor(N / 5) : N;
  let cost = 0, win = 0, trig = 0, max = 0, capped = 0;
  for (let i = 0; i < n; i++) { const r = playRound(1, buy); cost += r.cost; win += r.totalWin; if (r.freeSpins.length) trig++; max = Math.max(max, r.totalWin); if (r.capped) capped++; }
  console.log(buy ?? "base", "RTP", (win / cost * 100).toFixed(2) + "%", "trigger 1/" + (n / trig).toFixed(0), "max", max, "capped", capped);
}
