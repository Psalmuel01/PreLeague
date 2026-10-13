import { afterEach, describe, expect, it, vi } from "vitest";
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { buildClaimTransaction } from "./claim";

function connection(balance: number, accountExists = false) {
  return {
    getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 100 }),
    getAccountInfo: vi.fn().mockResolvedValue(accountExists ? { data: Buffer.alloc(165) } : null),
    getFeeForMessage: vi.fn().mockResolvedValue({ value: 10_000 }),
    getMinimumBalanceForRentExemption: vi.fn().mockResolvedValue(2_039_280),
    getBalance: vi.fn().mockResolvedValue(balance),
  };
}
afterEach(() => vi.unstubAllEnvs());
describe("Devnet claim sponsorship", () => {
  it("covers rent and fees while still requiring the zero-SOL winner's signature", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAULT_PROGRAM_ID", "EtZ1sKD7NJ6Gd1vs8dSBFDjwTZ66XGUwgG9dCeZpXUaq");
    const winner = Keypair.generate(), sponsor = Keypair.generate(), mint = Keypair.generate().publicKey;
    const rpc = connection(2_049_280);
    const result = await buildClaimTransaction(rpc as unknown as Connection, "test-r1", winner.publicKey, mint, sponsor);
    expect(result.feesSponsored).toBe(true);
    expect(result.transaction.feePayer?.equals(sponsor.publicKey)).toBe(true);
    expect(result.requiredLamports).toBe(2_049_280);
    expect(rpc.getBalance).toHaveBeenCalledWith(sponsor.publicKey, "confirmed");
    expect(result.transaction.verifySignatures()).toBe(false);
    const transported = Transaction.from(result.transaction.serialize({ requireAllSignatures: false }));
    transported.partialSign(winner);
    expect(transported.verifySignatures()).toBe(true);
  });
  it("rejects an underfunded sponsor instead of issuing an unusable claim", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAULT_PROGRAM_ID", "EtZ1sKD7NJ6Gd1vs8dSBFDjwTZ66XGUwgG9dCeZpXUaq");
    await expect(buildClaimTransaction(connection(2_049_279) as unknown as Connection, "test-r2", Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate())).rejects.toThrow("sponsorship needs replenishing");
  });
  it("does not charge rent again for an existing recipient account", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAULT_PROGRAM_ID", "EtZ1sKD7NJ6Gd1vs8dSBFDjwTZ66XGUwgG9dCeZpXUaq");
    const rpc = connection(10_000, true);
    const result = await buildClaimTransaction(rpc as unknown as Connection, "test-r3", Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate());
    expect(result.requiredLamports).toBe(10_000);
    expect(rpc.getMinimumBalanceForRentExemption).not.toHaveBeenCalled();
  });
  it("retains the wallet-funded fallback when no organizer sponsor is available", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAULT_PROGRAM_ID", "EtZ1sKD7NJ6Gd1vs8dSBFDjwTZ66XGUwgG9dCeZpXUaq");
    const winner = Keypair.generate();
    const result = await buildClaimTransaction(connection(0) as unknown as Connection, "test-r4", winner.publicKey, Keypair.generate().publicKey);
    expect(result.feesSponsored).toBe(false);
    expect(result.transaction.feePayer?.equals(winner.publicKey)).toBe(true);
    expect(result.transaction.instructions).toHaveLength(1);
  });
});
