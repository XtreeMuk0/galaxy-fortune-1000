// Integración de wallet del casino (dinero real). Solo servidor.
import type { RoundResult } from "./engine";

const enc = new TextEncoder();

export async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export interface LaunchParams {
  operator: string; player: string; currency: string; session: string; wallet: string; ts: string; sig: string;
}

/** Firma canónica del launch: operator|player|currency|session|wallet|ts */
export function launchPayload(p: Omit<LaunchParams, "sig">) {
  return [p.operator, p.player, p.currency, p.session, p.wallet, p.ts].join("|");
}

export async function verifyLaunch(p: LaunchParams, secret: string) {
  const age = Date.now() - Number(p.ts) * 1000;
  if (!Number.isFinite(age) || age > 12 * 3600_000 || age < -300_000) return false;
  if (!p.wallet.startsWith("https://")) return false;
  return safeEqual(await hmac(secret, launchPayload(p)), p.sig);
}

async function call(p: LaunchParams, secret: string, action: string, body: Record<string, unknown>) {
  const payload = JSON.stringify({ action, operator: p.operator, player: p.player, session: p.session, currency: p.currency, ...body });
  const res = await fetch(`${p.wallet.replace(/\/$/, "")}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": await hmac(secret, payload) },
    body: payload,
  });
  if (!res.ok) throw new Error(`wallet_${action}_${res.status}`);
  const json = (await res.json()) as { balance?: number; error?: string };
  if (json.error) throw new Error(json.error);
  return json;
}

export const walletBalance = (p: LaunchParams, s: string) => call(p, s, "balance", {});

export async function settleRound(p: LaunchParams, secret: string, round: RoundResult) {
  const debit = await call(p, secret, "debit", { roundId: round.roundId, transactionId: `${round.roundId}-D`, amount: round.bet, gameId: round.gameId });
  try {
    return await call(p, secret, "credit", {
      roundId: round.roundId, transactionId: `${round.roundId}-C`, amount: round.totalWin, gameId: round.gameId,
      roundClosed: true,
      details: { base: round.base, freeSpins: round.freeSpins, version: round.version, timestamp: round.timestamp },
    });
  } catch (e) {
    await call(p, secret, "rollback", { roundId: round.roundId, transactionId: `${round.roundId}-D`, amount: round.bet }).catch(() => {});
    throw e;
  }
  void debit;
}
