<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Slot results are computed only server-side (src/lib/slot/engine.ts via /api/public/v1/spin); the client only animates. Why: real-money play must be server-authoritative.
- Real-money mode uses a seamless operator wallet (debit/credit/rollback) signed with HMAC via OPERATOR_SECRET; round details are sent in credit for operator history. Why: balance lives at the casino.
- Payout tuning lives in TUNING/ORB_TABLE in engine.ts; after any math change re-run `bun scripts/rtp-sim.ts` (base, bonus buy and super buy must each stay near target RTP). Why: RTP must be controlled per mode.
- RTP (94-97%) and volatility (medium/high/extreme) are per-round GameConfig passed to playRound; VOL_CAL per mode is calibrated with `bun scripts/rtp-cal.ts`. Why: each config must hit its RTP.

- Bonus gamble (ruleta) is stateless: pending BonusState is HMAC-signed with GAME_STATE_SECRET and the gamble outcome derives from the token signature, so replaying a token repeats the result. Odds come from BONUS_EV (scripts/ev-table.ts) times GAMBLE_HARDNESS (gambling lowers RTP by design); check with scripts/rtp-gamble.ts. Why: server-authoritative without a database. Before real money a single-use store for tokens is needed (an old pre-loss token can still be played).
