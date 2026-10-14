// Estado firmado del bono pendiente (apuesta con ruleta). Solo servidor.
import type { BonusState } from "./engine";
import { hmac, safeEqual } from "./wallet.server";

interface Payload { s: BonusState; m: "demo" | "real"; who: string }

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

function secret(): string {
  const s = process.env["GAME_STATE_SECRET"];
  if (!s) throw new Error("state_secret_missing");
  return s;
}

export async function signState(p: Payload): Promise<string> {
  const body = b64(JSON.stringify(p));
  return `${body}.${await hmac(secret(), body)}`;
}

export async function readState(token: string): Promise<{ payload: Payload; sig: string } | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(await hmac(secret(), body), sig)) return null;
  const payload = JSON.parse(unb64(body)) as Payload;
  // Caduca a las 2 h
  if (Date.now() - Date.parse(payload.s.timestamp) > 2 * 3600_000) return null;
  return { payload, sig };
}

/** Número aleatorio fijo para cada estado: repetir la misma petición siempre da el mismo resultado. */
export async function gambleRandom(sig: string): Promise<number> {
  const h = await hmac(secret(), `gamble|${sig}`);
  return parseInt(h.slice(0, 8), 16) / 0x100000000;
}

export const whoOf = (l?: { operator: string; player: string; session: string }) => (l ? `${l.operator}|${l.player}|${l.session}` : "");
