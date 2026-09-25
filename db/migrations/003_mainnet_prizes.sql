-- Prizes are paid on Solana mainnet; remember each claim's blockhash expiry so
-- a retry can tell "still in flight" from "expired, safe to resend".
alter table prize_claims alter column network set default 'mainnet';
alter table prize_claims add column if not exists last_valid_block_height bigint;
