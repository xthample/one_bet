import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  connectWallet,
  getAddress,
  isWalletInstalled,
  switchToTestnet,
  getProvider,
} from '../utils/opnet';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress]       = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [network, setNetwork]       = useState('testnet');
  const [error, setError]           = useState(null);
  const [installed, setInstalled]   = useState(false);

  useEffect(() => {
    setInstalled(isWalletInstalled());
    // Auto-detect if already connected
    getAddress().then(addr => {
      if (addr) setAddress(addr);
    });

    // Listen for account changes
    const provider = getProvider();
    if (provider?.on) {
      provider.on('accountsChanged', (accounts) => {
        setAddress(accounts[0] || null);
      });
      provider.on('networkChanged', (net) => {
        setNetwork(net);
      });
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      await switchToTestnet();
      const addr = await connectWallet();
      setAddress(addr);
    } catch (e) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  return (
    <WalletContext.Provider value={{ address, connecting, network, error, installed, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
