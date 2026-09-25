# API reference

All endpoints return JSON. Signed-in endpoints use the httpOnly session cookie that `/api/auth/verify` sets.

## Public

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/prices` | The latest stored price for each company. `?since=<ms>` adds the snapshots since then, for charts. |
| GET | `/api/leagues` | Every league series with its live, next and last round summaries |
| GET | `/api/series/:slug?which=current\|next\|live\|last\|<roundId>` | One round of a series, full view: standings, popularity, your entry and claim |
| GET | `/api/leagues/:id` | One round by id, same shape |

## Sign-in

| Method | Path | Body | |
| --- | --- | --- | --- |
| POST | `/api/auth/nonce` | `{ wallet }` | Returns the message to sign |
| POST | `/api/auth/verify` | `{ wallet, nonce, signature }` | Verifies the ed25519 signature (base58) and sets the session cookie |
| POST | `/api/auth/logout` | — | Clears the session |

## Signed in

| Method | Path | Body | |
| --- | --- | --- | --- |
| GET | `/api/me` | — | Wallet, display name and round history |
| POST | `/api/me` | `{ displayName }` | Sets your display name |
| POST | `/api/leagues/:id/lineup` | `{ picks: [id, id, id] }` | Creates or edits your lineup. Errors: `409` after kick-off or when full, `400` for invalid picks. |
| POST | `/api/leagues/:id/claim` | — | Winner only. Returns `200 {status:"sent", tx}`, `202 {status:"pending", tx}` or `400 {status:"failed", error}`. |

## Jobs (`Authorization: Bearer <CRON_SECRET>`)

| Method | Path | |
| --- | --- | --- |
| GET | `/api/cron/tick` | Ensure rounds, snapshot prices, advance and settle. Call it every minute. |
| GET | `/api/cron/prices` | Snapshot prices only |
| GET | `/api/cron/settle` | Advance and settle rounds only |

## Admin (`x-admin-secret: <ADMIN_SECRET>`)

| Method | Path | |
| --- | --- | --- |
| GET | `/api/admin` | Rounds, latest snapshot, recent job runs |
| POST | `/api/admin` | `{ action, leagueId? }`, where `action` is one of: `snapshot`, `tick`, `start` (kick off now), `end` (end now and settle), `settle` (retry, including `review_required`), `cancel`, `bots` (add demo managers) |
