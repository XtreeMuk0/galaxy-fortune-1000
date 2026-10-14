import { z } from "zod";

export const Launch = z.object({
  operator: z.string().min(1).max(64), player: z.string().min(1).max(128),
  currency: z.string().regex(/^[A-Z]{3}$/), session: z.string().min(1).max(256),
  wallet: z.string().url().max(512), ts: z.string().regex(/^\d+$/), sig: z.string().regex(/^[a-f0-9]{64}$/),
});

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function operatorConfig() {
  return { rtp: Number(process.env["OPERATOR_RTP"] ?? 96), volatility: (process.env["OPERATOR_VOLATILITY"] ?? "high") as "medium" | "high" | "extreme" };
}
