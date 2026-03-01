// ──────────────────────────────────────────────────────────────────────────
//  OneBet OP_NET Contract Utilities
//  Compatible with OP_WALLET (window.opnet)
// ──────────────────────────────────────────────────────────────────────────

export const NETWORKS = {
  testnet: {
    name: 'BTC Testnet3',
    rpc: 'https://api-testnet.opnet.org',
    chainId: 'testnet',
  },
  mainnet: {
    name: 'BTC Mainnet',
    rpc: 'https://api.opnet.org',
    chainId: 'mainnet',
  },
};

// MUST SET IN .env
export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS;

export const NETWORK =
  import.meta.env.VITE_NETWORK || 'testnet';

// ──────────────────────────────────────────────────────────────────────────
//  Provider
// ──────────────────────────────────────────────────────────────────────────

export function getProvider() {
  if (typeof window === 'undefined') return null;
  return window.opnet || null;
}

export function isWalletInstalled() {
  return !!getProvider();
}

// ──────────────────────────────────────────────────────────────────────────
//  Wallet
// ──────────────────────────────────────────────────────────────────────────

export async function connectWallet() {
  const provider = getProvider();
  if (!provider) {
    throw new Error('OP_WALLET not installed.');
  }

  const accounts = await provider.request({
    method: 'requestAccounts',
  });

  return accounts?.[0] || null;
}

export async function getAddress() {
  const provider = getProvider();
  if (!provider) return null;

  try {
    const accounts = await provider.request({
      method: 'getAccounts',
    });
    return accounts?.[0] || null;
  } catch {
    return null;
  }
}

export async function switchToTestnet() {
  const provider = getProvider();
  if (!provider) return;

  await provider.request({
    method: 'switchNetwork',
    params: { network: 'testnet' },
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  CONTRACT WRITE (TX)
// ──────────────────────────────────────────────────────────────────────────

export async function callContract({
  method,
  params = [],
  valueSats = 0,
}) {
  const provider = getProvider();
  if (!provider) throw new Error('Wallet not connected');

  if (!CONTRACT_ADDRESS) {
    throw new Error('VITE_CONTRACT_ADDRESS missing in .env');
  }

  // ensure wallet connected
  await provider.request({ method: 'requestAccounts' });

  const result = await provider.request({
    method: 'callContract',
    params: {
      to: CONTRACT_ADDRESS,
      method,
      params,
      value: valueSats,
      network: NETWORK,
    },
  });

  return result;
}

// ──────────────────────────────────────────────────────────────────────────
//  CONTRACT READ (RPC)
// ──────────────────────────────────────────────────────────────────────────

export async function readContract({ method, params = [] }) {
  const provider = getProvider();
  if (!provider) throw new Error('Wallet not connected');

  const result = await provider.request({
    method: 'callContract',
    params: {
      to: CONTRACT_ADDRESS,
      method,
      params,
      value: 0,
      network: NETWORK,
      readOnly: true
    }
  });

  return result;
}

// ──────────────────────────────────────────────────────────────────────────
//  MARKET FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────

export async function createMarket(question, durationBlocks) {
  return callContract({
    method: 'createMarket(string,u64)',
    params: [question, durationBlocks.toString()],
  });
}

export async function placeBet(marketId, side, amountSats) {
  return callContract({
    method: 'placeBet(u64,bool)',
    params: [marketId.toString(), side],
    valueSats: amountSats,
  });
}

export async function resolveMarket(marketId, outcome) {
  return callContract({
    method: 'resolveMarket(u64,bool)',
    params: [marketId.toString(), outcome],
  });
}

export async function claimWinnings(marketId) {
  return callContract({
    method: 'claimWinnings(u64)',
    params: [marketId.toString()],
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  READ HELPERS
// ──────────────────────────────────────────────────────────────────────────

export async function fetchMarketCount() {
  try {
    const result = await readContract({
      method: 'getMarketCount()',
    });
    return parseInt(result?.value || result || '0');
  } catch {
    return 0;
  }
}

export async function fetchMarket(marketId) {
  try {
    const result = await readContract({
      method: 'getMarket(u64)',
      params: [marketId.toString()],
    });

    return parseMarketResult(result, marketId);
  } catch (e) {
    console.error('fetchMarket error', e);
    return null;
  }
}

export async function fetchAllMarkets() {
  const count = await fetchMarketCount();
  const markets = [];

  for (let i = 0; i < count; i++) {
    const m = await fetchMarket(i);
    if (m) markets.push(m);
  }

  return markets;
}

// ──────────────────────────────────────────────────────────────────────────
//  PARSERS
// ──────────────────────────────────────────────────────────────────────────

function parseMarketResult(raw, id) {
  if (!raw) return null;

  return {
    id,
    question: raw.question || raw[0] || '',
    endBlock: parseInt(raw.endBlock || raw[1] || '0'),
    yesPool: raw.yesPool || raw[2] || '0',
    noPool: raw.noPool || raw[3] || '0',
    resolved: raw.resolved ?? raw[4] ?? false,
    outcome: raw.outcome ?? raw[5] ?? false,
    total: raw.total || raw[6] || '0',
  };
}

// ──────────────────────────────────────────────────────────────────────────
//  UTILITIES
// ──────────────────────────────────────────────────────────────────────────

export function satsToDisplay(sats) {
  const btc = parseInt(sats || 0) / 1e8;
  return btc.toFixed(8).replace(/\.?0+$/, '') + ' tBTC';
}

export function calcOdds(yesPool, noPool) {
  const yes = parseInt(yesPool) || 0;
  const no = parseInt(noPool) || 0;
  const total = yes + no;

  if (total === 0) {
    return { yesPct: 50, noPct: 50 };
  }

  return {
    yesPct: Math.round((yes / total) * 100),
    noPct: Math.round((no / total) * 100),
  };
}