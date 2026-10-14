import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/integracion")({
  head: () => ({
    meta: [
      { title: "Integración de Galaxy Fortune 1000 para casinos" },
      { name: "description", content: "Cómo lanzar Galaxy Fortune 1000 e integrar la wallet del casino para jugar con dinero real." },
      { property: "og:title", content: "Integración de Galaxy Fortune 1000 para casinos" },
      { property: "og:description", content: "Lanzamiento firmado, wallet seamless e historial de rondas." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Docs,
});

const Code = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-xl border border-border bg-muted p-4 text-xs leading-relaxed"><code>{children}</code></pre>
);

function Docs() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Link to="/" className="text-sm text-secondary underline">← Volver al juego</Link>
      <h1 className="font-display text-gold text-4xl font-black">Integración para casinos</h1>
      <p className="text-muted-foreground">Galaxy Fortune 1000 funciona con wallet "seamless": el saldo vive en el casino. Nuestro servidor calcula cada resultado y llama a la wallet del casino para cobrar y pagar.</p>

      <h2 className="font-display text-xl text-primary">1. Lanzar el juego</h2>
      <p>El casino genera una URL firmada con HMAC-SHA256 usando el secreto compartido:</p>
      <Code>{`https://TU-SERVIDOR/?mode=real&operator=casino1&player=12345&currency=EUR
  &session=TOKEN_SESION&wallet=https://casino.com/galaxias-wallet&ts=UNIX_SEGUNDOS&sig=FIRMA

sig = hex(HMAC_SHA256(secreto, "operator|player|currency|session|wallet|ts"))`}</Code>
      <p className="text-sm text-muted-foreground">Sin estos parámetros el juego arranca en modo demo (saldo FUN). La URL caduca a las 12 h.</p>

      <h2 className="font-display text-xl text-primary">2. Endpoints que implementa el casino</h2>
      <p>Llamamos por POST JSON a <code>{"{wallet}/balance"}</code>, <code>/debit</code>, <code>/credit</code> y <code>/rollback</code>, con cabecera <code>X-Signature</code> = HMAC del cuerpo.</p>
      <Code>{`POST /debit
{ "action":"debit","operator":"casino1","player":"12345","session":"...","currency":"EUR",
  "roundId":"uuid","transactionId":"uuid-D","amount":1.00,"gameId":"galaxy-fortune-1000" }
→ { "balance": 99.00 }   |  { "error": "insufficient_funds" }

POST /credit
{ ..., "roundId":"uuid","transactionId":"uuid-C","amount":3.40,"roundClosed":true,
  "details": { "base": {...rejilla y líneas...}, "freeSpins": [...], "version":"1.0.0" } }
→ { "balance": 102.40 }

POST /rollback  (si el crédito falla, se devuelve la apuesta)
POST /balance   → { "balance": 100.00 }`}</Code>
      <p className="text-sm text-muted-foreground">Las transacciones deben ser idempotentes por <code>transactionId</code>.</p>

      <h2 className="font-display text-xl text-primary">3. Historial y auditoría</h2>
      <p>Cada <code>/credit</code> incluye el detalle completo de la ronda (rejilla, líneas premiadas, giros gratis, versión del juego). El casino guarda este registro para atención al cliente, reclamaciones e informes regulatorios. El jugador ve su historial de sesión desde el botón de reloj.</p>

      <h2 className="font-display text-xl text-primary">4. Datos del juego</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>6×5, 50 líneas fijas, apuestas de 0,20 a 100</li>
        <li>Wild sustituye; Scatter 3/4/5 = 10/15/20 giros gratis con orbes multiplicadores x2 a x1000 (reactivables)</li>
        <li>Compra de bonus: 100× la apuesta. Super Bonus: 500× con 2 orbes x1000 aleatorios. En el <code>/debit</code> se envía el coste real y el campo <code>buy</code>.</li>
        <li>RTP configurable por el casino: 94%, 95%, 96% o 97% (por defecto 96%), igual en juego normal y en ambas compras; premio máximo 10.000× la apuesta.</li>
        <li>Volatilidad configurable por el casino: media, alta o extrema (por defecto alta). En dinero real el jugador no puede cambiarlos; se fijan en nuestro servidor para cada casino.</li>
        <li>Modo demo: 100.000 FUN con recarga automática al agotarse.</li>
        <li>Generador aleatorio criptográfico en servidor. Requiere certificación (GLI/eCOGRA) antes de dinero real.</li>
      </ul>
    </main>
  );
}
