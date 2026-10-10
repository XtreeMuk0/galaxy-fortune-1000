import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/balance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["OPERATOR_SECRET"];
        const body = (await request.json().catch(() => null)) as { launch?: Record<string, string> } | null;
        if (!secret || !body?.launch) return Response.json({ error: "real_mode_unavailable" }, { status: 403 });
        const w = await import("@/lib/slot/wallet.server");
        const l = body.launch as unknown as import("@/lib/slot/wallet.server").LaunchParams;
        if (typeof l.sig !== "string" || !(await w.verifyLaunch(l, secret))) return Response.json({ error: "invalid_signature" }, { status: 401 });
        try { return Response.json(await w.walletBalance(l, secret)); }
        catch { return Response.json({ error: "wallet_error" }, { status: 502 }); }
      },
    },
  },
});
