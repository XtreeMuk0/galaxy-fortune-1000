import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Launch, cors, operatorConfig } from "@/lib/slot/schemas";

const Body = z.object({ mode: z.enum(["demo", "real"]), bet: z.number().positive(), buy: z.enum(["bonus", "super"]).nullable().optional(), launch: Launch.optional(), config: z.object({ rtp: z.number().min(94).max(97), volatility: z.enum(["medium", "high", "extreme"]) }).optional() });

export const Route = createFileRoute("/api/public/v1/spin")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400, headers: cors });
        const { startRound, gambleChance } = await import("@/lib/slot/engine");
        const st = await import("@/lib/slot/state.server");
        const real = parsed.data.mode === "real";
        // En dinero real el RTP/volatilidad los fija el casino (variables del servidor), nunca el jugador
        const cfg = real ? operatorConfig() : parsed.data.config ?? null;
        let res;
        try { res = startRound(parsed.data.bet, parsed.data.buy ?? null, cfg); } catch { return Response.json({ error: "invalid_bet" }, { status: 400, headers: cors }); }
        const pendingOut = async () => res.pending
          ? { pending: res.pending, chance: gambleChance(res.pending), token: await st.signState({ s: res.pending, m: parsed.data.mode, who: st.whoOf(parsed.data.launch) }) }
          : {};

        if (!real) return Response.json({ round: res.round ?? null, ...(await pendingOut()), balance: null }, { headers: cors });

        const secret = process.env["OPERATOR_SECRET"];
        if (!secret || !parsed.data.launch) return Response.json({ error: "real_mode_unavailable" }, { status: 403, headers: cors });
        const w = await import("@/lib/slot/wallet.server");
        if (!(await w.verifyLaunch(parsed.data.launch, secret))) return Response.json({ error: "invalid_signature" }, { status: 401, headers: cors });
        try {
          if (res.round) {
            const r = await w.settleRound(parsed.data.launch, secret, res.round);
            return Response.json({ round: res.round, balance: r?.balance ?? null }, { headers: cors });
          }
          const p = res.pending!;
          const d = await w.debitRound(parsed.data.launch, secret, { roundId: p.roundId, cost: p.cost, buy: p.buy, gameId: "galaxy-fortune-1000" });
          return Response.json({ round: null, ...(await pendingOut()), balance: d?.balance ?? null }, { headers: cors });
        } catch (e) {
          console.error("wallet error", e);
          const msg = String((e as Error).message);
          return Response.json({ error: msg.includes("insufficient") ? "insufficient_funds" : "wallet_error" }, { status: 402, headers: cors });
        }
      },
    },
  },
});
