import { useState, useEffect, useCallback } from 'react';
import { fetchAllMarkets, fetchMarket } from '../utils/opnet';

// Demo/mock markets shown when contract isn't deployed yet
const DEMO_MARKETS = [
  {
    id: 0,
    question: 'Will Bitcoin hit $150,000 before April 2026?',
    endBlock: 999999,
    yesPool: '250000000',
    noPool: '180000000',
    resolved: false,
    outcome: false,
    total: '430000000',
    demo: true,
  },
  {
    id: 1,
    question: 'Will OP_NET mainnet exceed 1000 daily active contracts?',
    endBlock: 888888,
    yesPool: '100000000',
    noPool: '300000000',
    resolved: false,
    outcome: false,
    total: '400000000',
    demo: true,
  },
  {
    id: 2,
    question: 'Will Bitcoin Halving 2028 happen before block 840,000?',
    endBlock: 777777,
    yesPool: '500000000',
    noPool: '50000000',
    resolved: true,
    outcome: true,
    total: '550000000',
    demo: true,
  },
];

export function useMarkets() {
  const [markets, setMarkets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [isDemo, setIsDemo]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllMarkets();
      if (data && data.length > 0) {
        setMarkets(data);
        setIsDemo(false);
      } else {
        setMarkets(DEMO_MARKETS);
        setIsDemo(true);
      }
    } catch {
      setMarkets(DEMO_MARKETS);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshMarket = useCallback(async (id) => {
    try {
      const m = await fetchMarket(id);
      if (m) {
        setMarkets(prev => prev.map(x => x.id === id ? m : x));
      }
    } catch {}
  }, []);

  const addLocalMarket = useCallback((market) => {
    setMarkets(prev => [market, ...prev]);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { markets, loading, isDemo, reload: load, refreshMarket, addLocalMarket };
}
