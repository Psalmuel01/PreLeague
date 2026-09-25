# Prizes

The winner of each round claims a prize: the league's prize company, worth the prize amount in USD at the settlement price. It's paid from a server-held **prize wallet** (`PRIZE_AUTHORITY_SECRET`) straight to the wallet they played with.

`NEXT_PUBLIC_PRIZE_NETWORK` picks the network. The claim page, footer and explorer links all follow it, so the UI never says "mainnet" when it isn't.

## Devnet (default)

This is free and good for demos and judging. Prizes are paid in a mock prize token, and the UI labels them "devnet mock".

```bash
npm run prize:setup
```

This creates the prize wallet and a mock prize token (`PRIZE_MINT`), mints 1,000 tokens to the wallet, and writes both to `.env.local`. It requests a devnet SOL airdrop. If the faucet is rate-limited, send devnet SOL to the printed address from <https://faucet.solana.com> and run it again. Re-running is safe: it reuses the wallet and the mint.

## Mainnet

Prizes are real PreStocks.

1. Set `NEXT_PUBLIC_PRIZE_NETWORK=mainnet` and `PRIZE_AUTHORITY_SECRET`. If you don't have a secret yet, `npm run prize:wallet` generates one.
2. Fund the wallet address:
   - **SOL:** at least 0.0025 per claim. This covers the network fee and the winner's token account (~0.002 SOL rent) if they don't hold that PreStock yet.
   - **Each prize PreStock**, worth at least the prize amount, for every round you expect to pay out.
3. Check it (example output):

   ```bash
   npm run prize:wallet
   ```

   ```
   Prize wallet (mainnet): DaCf…REkve
   SOL: 0.01
     ANTHROPIC   0.001000  ≈ $1.07
   League prizes (one winner each round):
     Stocklana Sprint         $25 in SpaceX  → NOT covered (hold $0.00)
   ```

4. Redeploy. `NEXT_PUBLIC_*` values are baked into the client at build time.

To keep the float small, lower the `prize.usd` amounts in [`lib/leagues.ts`](../lib/leagues.ts).

## How a payout works

[`lib/server/prize.ts`](../lib/server/prize.ts):

1. Only the recorded winner of a `completed` round can claim.
2. **Amount:** prize USD ÷ the settlement price gives displayed tokens. Dividing by the mint's display multiplier and scaling by its decimals gives raw units. PreStocks can carry a display multiplier; SpaceX shows ×5 after its split.
3. **Checks:** the prize wallet must hold the full amount and enough SOL. Otherwise the claim fails with a clear message and nothing is sent. A partial prize is never paid.
4. **One transaction:** create the winner's token account if it's missing, then do the transfer. For Token-2022 PreStocks this is `TransferCheckedWithFee`. PreStocks withhold a 1–3% transfer fee, so the winner receives slightly less than the headline value.
5. **No double payouts:** the transaction is signed and its signature saved to `prize_claims` *before* it's sent. If confirmation is slow or the server dies mid-send, the claim stays `pending`. The next claim call looks that signature up on-chain:
   - landed → marked `sent` and the same transaction is returned;
   - failed on-chain → marked `failed` and can be retried;
   - not landed and its blockhash has expired → it can never land, so it's safe to send a fresh one;
   - otherwise → still `pending` ("on its way").

   A claim left pending on one network is never resolved or resent on the other.

Use a private RPC (`PRIZE_RPC_URL`) in production. The public endpoints rate-limit and confirm slowly.

## Testing

`npm run smoke` plays a full round against a running server and claims the prize:
- on **devnet**, it claims when `PRIZE_MINT` is set;
- on **mainnet**, it only claims with `SMOKE_CLAIM=1`, because that spends real tokens.

It also checks that a second claim returns the same transaction.

Run it against a local database, not production: `DATABASE_URL=postgres://…/preleague npm run smoke`.
