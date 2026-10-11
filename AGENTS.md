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
