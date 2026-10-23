# NeonRoboBNB

A proof-of-work NFT collection on **BNB Chain**: 10,000 neon robotos mined
under a keccak-256 target, drawn from an on-chain seed.

- **Supply:** 10,000 (immutable ceiling in the bytecode)
- **Mint price:** 0.50 USDT for a wallet's first unit, 1.00 USDT for every
  unit after — quoted per wallet by `priceFor()`, no quantity limit
- **Proceeds** go directly to the deployer wallet inside `mine()`; the
  contract holds nothing (`saleConfig().contractHeld` must be 0)
- **Art** is rendered on-chain by the `NeonroboBNBArt` library (traits,
  rarity tiers, SVG with glow), verified byte-identical to the generator
  across 306 combinations

Site: static HTML/JS (self-hosted ethers), reads every number from the
chain — nothing is hardcoded.
