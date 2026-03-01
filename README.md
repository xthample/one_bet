# 🎯 OneBet — Bitcoin L1 Prediction Market

**Decentralized prediction market on Bitcoin Layer 1, powered by OP_NET**

> Built for the [vibecode.finance](https://vibecode.finance) challenge — **DeFi category**  
> #opnetvibecode

---

## What is OneBet?

OneBet lets anyone create and bet on real-world outcome markets using **native BTC (satoshis)** on Bitcoin Layer 1. No bridges, no wrapped tokens, no sidechains — real Bitcoin transactions via OP_NET smart contracts.

- 🟢 **YES / NO** binary prediction markets
- ⚡ Real on-chain transactions via OP_NET / OP_WALLET
- 💰 Proportional payout from prize pool
- 📱 Responsive — works on desktop & mobile

---

## Quick Start

```bash
# 1. Clone / download and enter project
cd onebet

# 2. Build everything (contract + frontend)
chmod +x setup.sh
./setup.sh

# 3. Deploy contract to BTC testnet
./setup.sh --skip-frontend --deploy

# 4. Start dev server
./setup.sh --dev
```

---

## Project Structure

```
onebet/
├── setup.sh                    ← 🚀 One-command setup & deploy
│
├── smart-contract/             ← AssemblyScript OP_NET contract
│   ├── src/
│   │   ├── index.ts
│   │   └── contracts/
│   │       └── OneBet.ts      ← Main prediction market contract
│   ├── package.json
│   └── asconfig.json
│
└── frontend/                   ← React + Vite dApp
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── styles.css
    │   ├── hooks/
    │   │   ├── useWallet.jsx   ← OP_WALLET connection
    │   │   └── useMarkets.js   ← Market data fetching
    │   ├── pages/
    │   │   └── HomePage.jsx    ← Main UI
    │   └── utils/
    │       └── opnet.js        ← OP_NET contract calls
    ├── index.html
    ├── vite.config.js
    └── .env.example
```

---

## Smart Contract — OneBet.ts

The OP_NET contract (AssemblyScript → WASM) exposes these on-chain functions:

| Method | Description | On-chain TX? |
|--------|-------------|-------------|
| `createMarket(question, durationBlocks)` | Create binary prediction market | ✅ Yes |
| `placeBet(marketId, side)` | Bet YES/NO with native BTC | ✅ Yes |
| `resolveMarket(marketId, outcome)` | Owner resolves outcome | ✅ Yes |
| `claimWinnings(marketId)` | Winners claim proportional BTC | ✅ Yes |
| `getMarket(marketId)` | Read market data | 📖 Read |
| `getUserBet(marketId, address)` | Read user bet | 📖 Read |
| `getMarketCount()` | Total markets created | 📖 Read |

---

## How Payouts Work

```
payout = (userBet / winningPool) × totalPool × (1 - fee)
fee = 2% (200 bps)
```

Winners split the **entire prize pool** proportionally to their stake.

---

## Prerequisites

- Node.js 18+
- [OP_WALLET](https://chromewebstore.google.com/detail/opwallet/pmbjpcmaaladnfpacpmhmnfmpklgbdjb) browser extension
- Bitcoin Testnet3 selected in wallet
- tBTC from [faucet.opnet.org](https://faucet.opnet.org)

---

## Tech Stack

- **Smart Contract**: AssemblyScript → WebAssembly → OP_NET Bitcoin L1
- **Frontend**: React 18, Vite, CSS (no UI library — custom design)
- **Wallet**: OP_WALLET extension (`window.opnet` provider)
- **Chain**: Bitcoin Testnet3

---

## Submitting to vibecode.finance

1. Deploy contract (get your `op1...` address)
2. Build frontend (`./setup.sh`)
3. Host on Vercel / Netlify / GitHub Pages
4. Submit at [vibecode.finance/submit](https://vibecode.finance/submit)

---

*#opnetvibecode · Built on Bitcoin Layer 1*
