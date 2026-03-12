

# Generate Aegis On-Chain Keypair — No CLI Required

## What I'll Do

Since you can't run the Solana CLI, I'll handle this entirely within the project by creating a temporary edge function that generates a Solana keypair for you.

## Steps

1. **Create a temporary edge function** (`generate-aegis-keypair`) that uses `@solana/web3.js` (already in the project) to generate a fresh Solana keypair and return the public address + secret key bytes.

2. **Call the function once** to get the keypair.

3. **Store the secret key** as `AEGIS_ONCHAIN_KEYPAIR` using the secrets manager — you'll just click "Save" when prompted.

4. **Give you the public address** — you'll need to send 0.1–0.5 SOL to it (from Phantom or any wallet) so the alert-router can pay for Memo transaction fees.

5. **Delete the temporary function** — it's a one-time utility, no reason to keep it.

## What You'll Need To Do

- Approve the plan
- Click "Save" when the secret prompt appears
- Send a small amount of SOL (0.1–0.5) to the public address I'll give you

## Security Note

The secret key never touches the frontend or gets committed to code. It's generated server-side and stored exclusively as an encrypted secret accessible only by edge functions.

