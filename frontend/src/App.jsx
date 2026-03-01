import { useState } from 'react';
import { WalletProvider } from './hooks/useWallet';
import HomePage from './pages/HomePage';
import './styles.css';

export default function App() {
  return (
    <WalletProvider>
      <div className="app">
        <HomePage />
      </div>
    </WalletProvider>
  );
}
