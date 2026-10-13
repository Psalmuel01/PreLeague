alter table leagues add column settlement_payload jsonb;
alter table leagues add column settlement_hash text;
alter table leagues add column vault_funding_tx text;
alter table leagues add column vault_finalization_tx text;
