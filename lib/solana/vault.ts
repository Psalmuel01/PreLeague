import { Buffer } from "buffer";
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAccount, getMint, getAssociatedTokenAddressSync } from "@solana/spl-token";

export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
let sharedConnection: Connection | undefined;
export const vaultConnection = () => {
  const endpoint = process.env.NEXT_PUBLIC_VAULT_RPC_URL || "https://api.devnet.solana.com";
  if (!sharedConnection || sharedConnection.rpcEndpoint !== endpoint) sharedConnection = new Connection(endpoint, "confirmed");
  return sharedConnection;
};
const devnetChecks = new WeakMap<Connection, { at: number; check: Promise<void> }>();
export function vaultProgram(): PublicKey {
  const id = process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID;
  if (!id) throw new Error("Solana prize escrow is not configured yet");
  return new PublicKey(id);
}
export async function assertDevnet(connection: Connection) {
  const cached = devnetChecks.get(connection);
  if (cached && Date.now() - cached.at < 60_000) return cached.check;
  const check = connection.getGenesisHash().then(hash => {
    if (hash !== DEVNET_GENESIS) throw new Error("Prize vault transactions require Solana Devnet");
  });
  devnetChecks.set(connection, { at: Date.now(), check });
  try { await check; } catch (error) { devnetChecks.delete(connection); throw error; }
}
export async function sha256(value: string): Promise<Buffer> {
  return Buffer.from(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
export async function leagueAddress(id: string, program = vaultProgram()) {
  const hash = await sha256(id);
  return { hash, address: PublicKey.findProgramAddressSync([Buffer.from("league"), hash], program)[0] };
}
const meta = (pubkey: PublicKey, isSigner = false, isWritable = false) => ({ pubkey, isSigner, isWritable });
async function instruction(name: string, keys: ReturnType<typeof meta>[], args = Buffer.alloc(0), program = vaultProgram()) {
  const discriminator = (await sha256(`global:${name}`)).subarray(0, 8);
  return new TransactionInstruction({ programId: program, keys, data: Buffer.concat([discriminator, args]) });
}
export async function initializeInstruction(id: string, authority: PublicKey, mint: PublicKey, amount: bigint, program = vaultProgram()) {
  const { hash, address } = await leagueAddress(id, program);
  const raw = Buffer.alloc(8); raw.writeBigUInt64LE(amount);
  return instruction("initialize_league", [meta(authority, true, true), meta(address, false, true), meta(mint), meta(getAssociatedTokenAddressSync(mint, address, true), false, true), meta(TOKEN_PROGRAM_ID), meta(ASSOCIATED_TOKEN_PROGRAM_ID), meta(SystemProgram.programId)], Buffer.concat([hash, raw]), program);
}
export async function fundInstruction(id: string, authority: PublicKey, mint: PublicKey, program = vaultProgram()) {
  const { address } = await leagueAddress(id, program);
  return instruction("fund_vault", [meta(authority, true), meta(address, false, true), meta(mint), meta(getAssociatedTokenAddressSync(mint, authority), false, true), meta(getAssociatedTokenAddressSync(mint, address, true), false, true), meta(TOKEN_PROGRAM_ID)], undefined, program);
}
export async function finalizeInstruction(id: string, authority: PublicKey, winner: PublicKey, hash: Buffer, program = vaultProgram()) {
  if (hash.length !== 32) throw new Error("Invalid settlement hash");
  return instruction("set_winner", [meta(authority, true), meta((await leagueAddress(id, program)).address, false, true)], Buffer.concat([winner.toBuffer(), hash]), program);
}
export async function payoutInstruction(id: string, wallet: PublicKey, mint: PublicKey, cancel = false, program = vaultProgram()) {
  const { address } = await leagueAddress(id, program);
  return instruction(cancel ? "cancel_league" : "claim_prize", [meta(wallet, true, true), meta(address, false, true), meta(mint), meta(getAssociatedTokenAddressSync(mint, address, true), false, true), meta(getAssociatedTokenAddressSync(mint, wallet), false, true), meta(TOKEN_PROGRAM_ID), meta(ASSOCIATED_TOKEN_PROGRAM_ID), meta(SystemProgram.programId)], undefined, program);
}
export type VaultState = {
  address: string; program: string; authority: string; mint: string; amount: string; winner: string;
  settlementHash: string; funded: boolean; finalized: boolean; claimed: boolean; cancelled: boolean; decimals: number;
};
export async function readVault(connection: Connection, id: string, program = vaultProgram()): Promise<VaultState | null> {
  const { address, hash } = await leagueAddress(id, program);
  const account = await connection.getAccountInfo(address, "confirmed");
  if (!account) return null;
  const b = account.data;
  if (!account.owner.equals(program) || b.length !== 181 || !b.subarray(0, 8).equals((await sha256("account:League")).subarray(0, 8)) || !b.subarray(40, 72).equals(hash)) throw new Error("Invalid league escrow account");
  const mint = new PublicKey(b.subarray(72, 104));
  const decimals = (await getMint(connection, mint)).decimals;
  const tokenAccount = await getAccount(connection, getAssociatedTokenAddressSync(mint, address, true));
  const amount = b.readBigUInt64LE(104);
  const funded = b[176] === 1;
  const paid = b[178] === 1 || b[179] === 1;
  if (!tokenAccount.owner.equals(address) || !tokenAccount.mint.equals(mint) || (funded && !paid && tokenAccount.amount < amount)) throw new Error("Escrow token balance is insufficient");
  return { decimals, address: address.toBase58(), program: program.toBase58(), authority: new PublicKey(b.subarray(8, 40)).toBase58(), mint: new PublicKey(b.subarray(72, 104)).toBase58(), amount: b.readBigUInt64LE(104).toString(), winner: new PublicKey(b.subarray(112, 144)).toBase58(), settlementHash: b.subarray(144, 176).toString("hex"), funded: b[176] === 1, finalized: b[177] === 1, claimed: b[178] === 1, cancelled: b[179] === 1 };
}
