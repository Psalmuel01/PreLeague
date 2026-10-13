# Solana Devnet prize escrow

The organizer deposits the mock SPL prize token before a round starts. Scoring stays offchain. After settlement the organizer commits the winning wallet and SHA-256 receipt hash; the winner signs their own claim, transferring the escrow to their associated token account. Finalization and payout cannot repeat. The organizer can cancel and recover funds before finalization.

Amounts are fixed in raw token units at funding using a fresh prize-company quote. The advertised USD prize is its value at funding, not a guarantee at settlement. Devnet mock tokens have no real monetary value. This program supports the classic SPL Token program only, intentionally excluding Token-2022 and mainnet.

## Build, test and deploy

Install Anchor 0.31.1 and a compatible Solana/Agave CLI. Never commit wallet or program keypairs. Back up the program keypair locally before deployment.

```sh
npm ci
solana config set --url devnet
solana-keygen new
solana airdrop 5
anchor build
anchor keys sync
anchor build
anchor test --provider.cluster localnet
anchor deploy --provider.cluster devnet
```

`Anchor.toml` and `declare_id!` use the deployed Devnet program ID. If generating a new program keypair, synchronize both the Devnet and localnet declarations using `anchor keys sync` for each provider cluster. Do not configure the frontend with an undeployed ID. Run tests against a local validator; the test script explicitly rejects public networks.

Set `NEXT_PUBLIC_VAULT_PROGRAM_ID` to the deployed program address, `NEXT_PUBLIC_VAULT_RPC_URL` to a Devnet RPC, and `NEXT_PUBLIC_PRIZE_NETWORK=devnet`. Set `PRIZE_AUTHORITY_ADDRESS` to the public organizer wallet address so verification and claim preparation can run without the organizer secret. Each transaction path checks the Devnet genesis hash. Keep wallet RPC on mainnet if needed for identity; prize transactions use their own Devnet connection.

```sh
npm run prize:setup
npm run db:migrate
npm run dev
npm run smoke
```

The organizer needs Devnet SOL for rent/funding/finalization plus a sufficient mock-token float. Winners need Devnet SOL to pay fees and create their token account. Airdrops can be rate-limited; use the Solana faucet if necessary.

Scheduler ticks fund the nearest upcoming round of each series and retry finalization of completed rounds. Errors are logged under `vault`; scoring results remain intact. The admin API also accepts `fund` and `finalize` with a `leagueId`. Funding and finalization are idempotent by checking onchain state. A crash after confirmation can lose the optional transaction link, but cannot duplicate funding or change the winner. The league account remains verifiable in Explorer.

The claim API prepares an unsigned transaction. The client signs and submits it, then posts its signature for confirmed transaction verification and history. If the browser closes after submission, the claimed state is still read directly from Solana. Claims do not require the organizer secret.

The results panel exposes the canonical receipt, recomputes its SHA-256 in the browser, and compares it with the commitment fetched from Devnet. This proves the receipt matches the authority's committed result; it does not prove scoring ran onchain or eliminate trust in the settlement authority.

## Demo

Fund the next league, connect and sign in, draft three companies, seed labelled demo managers if desired, start the round, show live price-driven standings, end/settle, finalize, open Verify on Solana, claim with the winning wallet, and open the claim transaction in Explorer. Demo managers are excluded from prize eligibility.

Contract tests cover initialization, funding, repeated funding, authorization, premature claims, wrong winners, successful claims, repeated claims, immutable winners, cancellation/refund and invalid mints. Existing scoring tests remain unchanged.

P2 sharing already exists in the product; additional share artwork is deferred until the full Devnet lifecycle passes.

## Verified deployment (13 October 2026)

A local program-keypair backup is in `.anchor-keys/preleague_vault-keypair.json` (gitignored), outside Cargo build artifacts. Keep it private and restore it to `target/deploy` if rebuilding after a clean. The organizer secret remains in `.env.local`.

Program: [EtZ1sKD7NJ6Gd1vs8dSBFDjwTZ66XGUwgG9dCeZpXUaq](https://explorer.solana.com/address/EtZ1sKD7NJ6Gd1vs8dSBFDjwTZ66XGUwgG9dCeZpXUaq?cluster=devnet).

[Deployment transaction](https://explorer.solana.com/tx/SwyzEDcaFATNQCQDNCujaXvivG5Ct5TnPjvGf779yxaVwT4HCLr8ZYvA4q2Are7sNXUnQdzp7Zu3tixpEttkL8z?cluster=devnet). The program account was verified executable. `devnet-deployment.json` records the binary SHA-256 and public addresses; `preleague_vault.idl.json` is the generated interface.

[Winner-signed Devnet claim](https://explorer.solana.com/tx/3NSGVRcm4dxCjenTMwyoXNDkP5tgMkoc8Tkn25A5qv1aWGi1y7WYfUBPSDgDkPLjBTnvRjgFfv6dUSxByYWh2Gnj?cluster=devnet). `devnet-vault-proof.json` records funding, finalization, canonical receipt, hash, and the verified token balance. This is an explicitly synthetic contract fixture, not live market scoring or an organic player. `npm run vault:verify` produces another fixture on Devnet.

The first full app attempt was blocked by null token prices. A later recheck returned valid live token prices for seven companies in the existing pool, while SpaceX remained absent. The AI Unicorn Sprint lifecycle then passed every smoke check using live prices and labelled automated test wallets: funded escrow before drafting, live standings, deterministic settlement, immutable winner/hash commitment, wallet-signed claim, and rejection of a second claim. The short test round had unchanged boundary prices, so returns were zero and deterministic tie-breaking selected the winner. This is integration verification, not organic participation or a human Phantom-wallet demonstration.

[Live-price app claim transaction](https://explorer.solana.com/tx/soZ23yzMds8YGJ9RjAUEufgrSKQPKwyHJG7GjDYu9Aw1UUhYe6corLwqzcuwqUoXhd3WBcxTtQP36m8NjAvVTv9?cluster=devnet). `devnet-live-smoke.json` records the actual prices, standings, canonical receipt, funding/finalization transactions, and claimed state. Run `SMOKE_SERIES=ai-unicorn-sprint npm run smoke` against the running app to repeat it. SpaceX-dependent leagues still need a usable SpaceX token price. Mark prices and fallback quotes are never substituted.
