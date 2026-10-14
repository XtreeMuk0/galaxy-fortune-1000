import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Launch, cors } from "@/lib/slot/schemas";

// Bono pendiente: "gamble" gira la ruleta para subir de scatters; "play" juega los giros gratis y paga.
const Body = z.object({ action: z.enum(["gamble", "play"]), token: z.string().min(10).max(200_000), launch: Launch.optional() });

export const Route = createFileRoute("/api/public/v1/bonus")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400, headers: cors });
        const st = await import("@/lib/slot/state.server");
        const read = await st.readState(parsed.data.token);
        if (!read || read.payload.who !== st.whoOf(parsed.data.launch)) return Response.json({ error: "invalid_token" }, { status: 401, headers: cors });
        const { payload, sig } = read;
        const real = payload.m === "real";
        const secret = process.env["OPERATOR_SECRET"];
        if (real) {
          const w = await import("@/lib/slot/wallet.server");
          if (!secret || !parsed.data.launch || !(await w.verifyLaunch(parsed.data.launch, secret))) return Response.json({ error: "invalid_signature" }, { status: 401, headers: cors });
        }
        const { gamble, gambleChance, finishBonus } = await import("@/lib/slot/engine");

        if (parsed.data.action === "gamble") {
          if (gambleChance(payload.s) === null) return Response.json({ error: "cannot_gamble" }, { status: 400, headers: cors });
          const next = gamble(payload.s, await st.gambleRandom(sig));
          const token = await st.signState({ ...payload, s: next });
          return Response.json({ pending: next, chance: gambleChance(next), won: next.gambles.at(-1)!.won, token }, { headers: cors });
        }

        const round = finishBonus(payload.s);
        if (!real) return Response.json({ round, balance: null }, { headers: cors });
        try {
          const w = await import("@/lib/slot/wallet.server");
          const r = await w.creditRound(parsed.data.launch!, secret!, round);
          return Response.json({ round, balance: r?.balance ?? null }, { headers: cors });
        } catch (e) {
          console.error("wallet error", e);
          return Response.json({ error: "wallet_error" }, { status: 402, headers: cors });
        }
      },
    },
  },
});
