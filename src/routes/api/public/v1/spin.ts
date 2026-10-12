import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Launch = z.object({
  operator: z.string().min(1).max(64), player: z.string().min(1).max(128),
  currency: z.string().regex(/^[A-Z]{3}$/), session: z.string().min(1).max(256),
  wallet: z.string().url().max(512), ts: z.string().regex(/^\d+$/), sig: z.string().regex(/^[a-f0-9]{64}$/),
});
const Body = z.object({ mode: z.enum(["demo", "real"]), bet: z.number().positive(), buy: z.enum(["bonus", "super"]).nullable().optional(), launch: Launch.optional(), config: z.object({ rtp: z.number().min(94).max(97), volatility: z.enum(["medium", "high", "extreme"]) }).optional() });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/v1/spin")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400, headers: cors });
        const { playRound } = await import("@/lib/slot/engine");
        let round;
        try { round = playRound(parsed.data.bet, parsed.data.buy ?? null, parsed.data.config ?? null); } catch { return Response.json({ error: "invalid_bet" }, { status: 400, headers: cors }); }

        if (parsed.data.mode === "demo") return Response.json({ round, balance: null }, { headers: cors });

        const secret = process.env["OPERATOR_SECRET"];
        if (!secret || !parsed.data.launch) return Response.json({ error: "real_mode_unavailable" }, { status: 403, headers: cors });
        const w = await import("@/lib/slot/wallet.server");
        if (!(await w.verifyLaunch(parsed.data.launch, secret))) return Response.json({ error: "invalid_signature" }, { status: 401, headers: cors });
        try {
          const res = await w.settleRound(parsed.data.launch, secret, round);
          return Response.json({ round, balance: res?.balance ?? null }, { headers: cors });
        } catch (e) {
          console.error("wallet error", e);
          const msg = String((e as Error).message);
          return Response.json({ error: msg.includes("insufficient") ? "insufficient_funds" : "wallet_error" }, { status: 402, headers: cors });
        }
      },
    },
  },
});
