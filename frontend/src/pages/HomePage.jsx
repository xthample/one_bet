import { useState, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useMarkets } from '../hooks/useMarkets';
import {
  placeBet, createMarket, claimWinnings, resolveMarket,
  calcOdds, satsToDisplay, CONTRACT_ADDRESS
} from '../utils/opnet';

// ─── Toast hook ──────────────────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return { toasts, addToast };
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header({ onCreateClick }) {
  const { address, connecting, installed, connect, disconnect } = useWallet();

  const short = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  return (
    <header className="header">
      <div className="header-inner">
        <a className="logo" href="#">
          <div className="logo-icon">₿</div>
          One<span>Bet</span>
        </a>
        <nav className="header-nav">
          {address && (
            <button className="btn btn-outline-btc btn-sm" onClick={onCreateClick}>
              + Create Market
            </button>
          )}
          <button
            className="wallet-btn"
            onClick={address ? disconnect : connect}
            disabled={connecting}
          >
            <span className={`wallet-dot ${address ? 'connected' : ''}`} />
            {connecting ? 'Connecting…' : short || (installed ? 'Connect Wallet' : 'Install OP_WALLET')}
          </button>
        </nav>
      </div>
    </header>
  );
}

// ─── Odds Bar ─────────────────────────────────────────────────────────────────
function OddsBar({ yesPool, noPool }) {
  const { yesPct, noPct } = calcOdds(yesPool, noPool);
  return (
    <div className="odds-bar-wrap">
      <div className="odds-labels">
        <span className="odds-yes">YES {yesPct}%</span>
        <span className="odds-no">{noPct}% NO</span>
      </div>
      <div className="odds-bar">
        <div className="odds-bar-yes" style={{ width: `${yesPct}%` }} />
        <div className="odds-bar-no" style={{ width: `${noPct}%` }} />
      </div>
    </div>
  );
}

// ─── Market Card ──────────────────────────────────────────────────────────────
function MarketCard({ market, onBet, onClaim }) {
  const { address } = useWallet();
  const isResolved = market.resolved;
  const wonYes = isResolved && market.outcome;
  const wonNo  = isResolved && !market.outcome;

  return (
    <div className={`market-card fade-in ${isResolved ? 'resolved' : ''}`}>
      <div className={`card-badge ${isResolved
        ? (wonYes ? 'badge-resolved badge-yes-won' : 'badge-resolved badge-no-won')
        : 'badge-live'}`}>
        {isResolved ? (wonYes ? '✓ YES Won' : '✓ NO Won') : 'Live'}
      </div>

      <p className="card-question">{market.question}</p>

      <OddsBar yesPool={market.yesPool} noPool={market.noPool} />

      <div className="card-meta">
        <span className="meta-item">
          <span className="meta-icon">💰</span>
          <span>{satsToDisplay(market.total)}</span>
        </span>
        <span className="meta-item">
          <span className="meta-icon">⛓</span>
          <span className="mono">#{market.id}</span>
        </span>
        {market.demo && (
          <span className="meta-item">
            <span className="meta-icon">🔧</span>
            <span>Demo</span>
          </span>
        )}
      </div>

      {!isResolved && (
        <div className="card-actions">
          <button
            className="btn btn-yes btn-sm"
            onClick={() => onBet(market, true)}
            disabled={!address}
          >
            👍 Bet YES
          </button>
          <button
            className="btn btn-no btn-sm"
            onClick={() => onBet(market, false)}
            disabled={!address}
          >
            👎 Bet NO
          </button>
        </div>
      )}

      {isResolved && address && (
        <button
          className="btn btn-outline-btc btn-sm btn-full"
          onClick={() => onClaim(market)}
        >
          🏆 Claim Winnings
        </button>
      )}

      {!address && !isResolved && (
        <p style={{ fontSize:'0.74rem', color:'var(--text3)', marginTop:'4px', textAlign:'center' }}>
          Connect wallet to bet
        </p>
      )}
    </div>
  );
}

// ─── Bet Modal ────────────────────────────────────────────────────────────────
function BetModal({ market, initialSide, onClose, onSuccess }) {
  const { address } = useWallet();
  const [side, setSide]       = useState(initialSide ?? true);
  const [amount, setAmount]   = useState('1000');
  const [status, setStatus]   = useState(null); // null | 'loading' | 'success' | 'error'
  const [msg, setMsg]         = useState('');

  const { yesPct, noPct } = calcOdds(market.yesPool, market.noPool);

  async function handleBet() {
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      setMsg('Enter a valid amount in satoshis'); setStatus('error'); return;
    }
    setStatus('loading'); setMsg('Waiting for wallet confirmation…');
    try {
      const tx = await placeBet(market.id, side, parseInt(amount));
      setStatus('success');
      setMsg(`Tx sent! ${tx?.txId ? `TxID: ${tx.txId.slice(0,16)}…` : 'Pending confirmation.'}`);
      onSuccess?.();
    } catch (e) {
      setStatus('error');
      setMsg(e.message || 'Transaction failed');
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Place Bet</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize:'0.85rem', color:'var(--text2)', marginBottom:'16px', lineHeight:1.4 }}>
            {market.question}
          </p>

          {status && (
            <div className={`tx-status ${status}`}>
              {status === 'loading' && <span className="spinner" />}
              <span>{msg}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Your Position</label>
            <div className="side-selector">
              <button
                className={`side-btn ${side ? 'yes-active' : ''}`}
                onClick={() => setSide(true)}
              >
                <span className="side-emoji">🟢</span>
                <span className="side-label">YES</span>
                <span className="side-pct">{yesPct}% odds</span>
              </button>
              <button
                className={`side-btn ${!side ? 'no-active' : ''}`}
                onClick={() => setSide(false)}
              >
                <span className="side-emoji">🔴</span>
                <span className="side-label">NO</span>
                <span className="side-pct">{noPct}% odds</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Amount (satoshis)</label>
            <div className="amount-input-wrap">
              <input
                type="number"
                className="form-input amount-input"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="1000" step="1000"
                placeholder="1000"
              />
              <span className="amount-unit">SATS</span>
            </div>
            <p className="form-hint">
              ≈ {(parseInt(amount) / 1e8).toFixed(8)} tBTC
              {' · '}Min 1,000 sats
            </p>
          </div>

          <div style={{ background:'var(--bg3)', borderRadius:'var(--radius)', padding:'12px', marginBottom:'16px', fontSize:'0.78rem', fontFamily:'var(--font-mono)', color:'var(--text2)' }}>
            <div style={{ marginBottom:'6px' }}>
              📊 Pool: YES {satsToDisplay(market.yesPool)} / NO {satsToDisplay(market.noPool)}
            </div>
            <div>🏆 Potential payout ≈ proportional to pool size</div>
          </div>

          <button
            className={`btn ${side ? 'btn-yes' : 'btn-no'} btn-full btn-lg`}
            onClick={handleBet}
            disabled={status === 'loading' || status === 'success' || !address}
          >
            {status === 'loading' ? (
              <><span className="spinner" /> Processing…</>
            ) : status === 'success' ? (
              '✓ Bet Placed!'
            ) : (
              `Place ${side ? 'YES' : 'NO'} Bet`
            )}
          </button>

          {!address && (
            <p style={{ textAlign:'center', fontSize:'0.75rem', color:'var(--text3)', marginTop:'10px' }}>
              Connect your OP_WALLET to place bets
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Market Modal ──────────────────────────────────────────────────────
function CreateMarketModal({ onClose, onSuccess }) {
  const [question, setQuestion]   = useState('');
  const [duration, setDuration]   = useState('144');  // blocks (~1 day)
  const [status, setStatus]       = useState(null);
  const [msg, setMsg]             = useState('');

  async function handleCreate() {
    if (!question.trim()) { setMsg('Enter a question'); setStatus('error'); return; }
    setStatus('loading'); setMsg('Creating market on Bitcoin L1…');
    try {
      const tx = await createMarket(question.trim(), parseInt(duration));
      setStatus('success');
      setMsg(`Market created! ${tx?.txId ? `TxID: ${tx.txId.slice(0,12)}…` : 'Awaiting block.'}`);
      onSuccess?.({ question: question.trim(), duration: parseInt(duration) });
    } catch (e) {
      setStatus('error');
      setMsg(e.message || 'Failed to create market');
    }
  }

  const presets = [
    { label: '1 Day', blocks: 144 },
    { label: '3 Days', blocks: 432 },
    { label: '1 Week', blocks: 1008 },
    { label: '1 Month', blocks: 4320 },
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Create Market</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {status && (
            <div className={`tx-status ${status}`}>
              {status === 'loading' && <span className="spinner" />}
              <span>{msg}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Question</label>
            <textarea
              className="form-textarea"
              placeholder="Will Bitcoin reach $200k in 2026?"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              maxLength={200}
            />
            <p className="form-hint">{question.length}/200 characters</p>
          </div>

          <div className="form-group">
            <label className="form-label">Duration</label>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'8px' }}>
              {presets.map(p => (
                <button
                  key={p.blocks}
                  className={`btn btn-sm ${parseInt(duration) === p.blocks ? 'btn-outline-btc' : 'btn-ghost'}`}
                  onClick={() => setDuration(p.blocks.toString())}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="amount-input-wrap">
              <input
                type="number"
                className="form-input"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                min="10" step="1"
              />
              <span className="amount-unit" style={{ right:'12px', fontSize:'0.7rem' }}>BLK</span>
            </div>
            <p className="form-hint">≈ {Math.round(parseInt(duration) * 10 / 60)}h at 10 min/block</p>
          </div>

          <button
            className="btn btn-btc btn-full btn-lg"
            onClick={handleCreate}
            disabled={status === 'loading' || status === 'success'}
          >
            {status === 'loading' ? (
              <><span className="spinner" /> Creating…</>
            ) : status === 'success' ? (
              '✓ Created!'
            ) : (
              '⚡ Deploy Market on Bitcoin'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Wallet Guide Modal ───────────────────────────────────────────────────────
function WalletGuideModal({ onClose, onConnect }) {
  const { connecting, connect } = useWallet();

  async function handleConnect() {
    await connect();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Connect OP_WALLET</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize:'0.85rem', color:'var(--text2)', marginBottom:'16px', lineHeight:1.5 }}>
            OneBet runs on <strong style={{color:'var(--btc)'}}>Bitcoin Layer 1</strong> via OP_NET.
            You need the OP_WALLET browser extension to interact.
          </p>

          <div className="wallet-modal-steps">
            <div className="wallet-step">
              <span className="step-num">1</span>
              <span className="step-text">
                <strong>Install OP_WALLET</strong> from Chrome Web Store
                {' '}
                <a href="https://chromewebstore.google.com/detail/opwallet/pmbjpcmaaladnfpacpmhmnfmpklgbdjb" target="_blank" rel="noopener" style={{color:'var(--btc)'}}>→ Install</a>
              </span>
            </div>
            <div className="wallet-step">
              <span className="step-num">2</span>
              <span className="step-text">
                <strong>Create account</strong> — choose <em>Taproot</em> address type
              </span>
            </div>
            <div className="wallet-step">
              <span className="step-num">3</span>
              <span className="step-text">
                <strong>Switch to Testnet3</strong> (top-right Bitcoin logo in wallet)
              </span>
            </div>
            <div className="wallet-step">
              <span className="step-num">4</span>
              <span className="step-text">
                <strong>Get tBTC</strong> from{' '}
                <a href="https://faucet.opnet.org" target="_blank" rel="noopener" style={{color:'var(--btc)'}}>faucet.opnet.org</a>
              </span>
            </div>
          </div>

          <button
            className="btn btn-btc btn-full btn-lg"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? <><span className="spinner" /> Connecting…</> : '₿ Connect Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HomePage ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { address, connect, installed } = useWallet();
  const { markets, loading, isDemo, reload, addLocalMarket } = useMarkets();
  const { toasts, addToast } = useToasts();

  const [tab, setTab]                   = useState('all');
  const [betTarget, setBetTarget]       = useState(null);
  const [betSide, setBetSide]           = useState(true);
  const [showCreate, setShowCreate]     = useState(false);
  const [showWalletGuide, setShowWalletGuide] = useState(false);

  const filtered = markets.filter(m => {
    if (tab === 'live')     return !m.resolved;
    if (tab === 'resolved') return m.resolved;
    return true;
  });

  function handleBetClick(market, side) {
    if (!address) { setShowWalletGuide(true); return; }
    setBetTarget(market);
    setBetSide(side);
  }

  async function handleClaim(market) {
    if (!address) { setShowWalletGuide(true); return; }
    try {
      await claimWinnings(market.id);
      addToast('Winnings claimed!', 'success');
      reload();
    } catch (e) {
      addToast(e.message || 'Claim failed', 'error');
    }
  }

  function handleBetSuccess() {
    addToast('Bet placed on Bitcoin L1! 🎯', 'success');
    setTimeout(reload, 3000);
  }

  function handleCreateSuccess(data) {
    setShowCreate(false);
    addToast(`Market created: "${data.question.slice(0,40)}…"`, 'success');
    // Optimistically add to list
    addLocalMarket({
      id: markets.length,
      question: data.question,
      endBlock: 999999,
      yesPool: '0',
      noPool: '0',
      resolved: false,
      outcome: false,
      total: '0',
    });
  }

  const liveCount = markets.filter(m => !m.resolved).length;
  const totalVol  = markets.reduce((s, m) => s + parseInt(m.total || 0), 0);

  return (
    <div className="page">
      <Header onCreateClick={() => setShowCreate(true)} />

      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow">
          <span>⚡</span>
          Built on Bitcoin Layer 1 · Powered by OP_NET
        </div>
        <h1 className="hero-title">
          Predict.<br />
          <em>Win on Bitcoin.</em>
        </h1>
        <p className="hero-sub">
          OneBet is a decentralized prediction market on Bitcoin L1.
          Bet tBTC on real-world outcomes — fully on-chain, no middleman.
        </p>
        <div className="hero-actions">
          {!address ? (
            <button className="btn btn-btc btn-lg" onClick={() => setShowWalletGuide(true)}>
              ₿ Connect Wallet
            </button>
          ) : (
            <button className="btn btn-btc btn-lg" onClick={() => setShowCreate(true)}>
              ⚡ Create Market
            </button>
          )}
          <a
            href="https://faucet.opnet.org"
            target="_blank"
            rel="noopener"
            className="btn btn-outline-btc btn-lg"
          >
            🚰 Get tBTC
          </a>
        </div>

        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-value">{markets.length}</div>
            <div className="stat-label">Markets</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{liveCount}</div>
            <div className="stat-label">Live</div>
          </div>
          <div className="stat-item">
            <div className="stat-value mono">{satsToDisplay(totalVol)}</div>
            <div className="stat-label">Total Volume</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">BTC L1</div>
            <div className="stat-label">Network</div>
          </div>
        </div>
      </section>

      {/* Markets */}
      <section className="markets-section">
        <div className="section-header">
          <span className="section-title">
            {loading ? 'Loading…' : `${filtered.length} Market${filtered.length !== 1 ? 's' : ''}`}
          </span>
          <div className="tabs">
            {['all','live','resolved'].map(t => (
              <button
                key={t} className={`tab ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {isDemo && (
          <div className="demo-banner">
            <span>⚠</span>
            Demo mode — deploy contract first (see setup.sh). Wallet interactions will target testnet.
            {' '}Contract: <code style={{marginLeft:'4px'}}>{CONTRACT_ADDRESS.slice(0,20)}…</code>
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <span className="empty-icon">⛓</span>
            <p className="empty-title">Loading markets from Bitcoin…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🎯</span>
            <p className="empty-title">No markets yet</p>
            <p className="empty-sub">Be the first to create a prediction market on Bitcoin L1!</p>
            {address && (
              <button className="btn btn-btc" style={{marginTop:'16px'}} onClick={() => setShowCreate(true)}>
                + Create First Market
              </button>
            )}
          </div>
        ) : (
          <div className="markets-grid stagger">
            {filtered.map(m => (
              <MarketCard
                key={m.id}
                market={m}
                onBet={handleBetClick}
                onClaim={handleClaim}
              />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="footer">
        OneBet · Bitcoin L1 Prediction Market ·{' '}
        <a href="https://opnet.org" target="_blank" rel="noopener">Powered by OP_NET</a>
        {' · '}
        <a href="https://vibecode.finance" target="_blank" rel="noopener">vibecode.finance</a>
        {' · '}Testnet Only
      </footer>

      {/* Modals */}
      {betTarget && (
        <BetModal
          market={betTarget}
          initialSide={betSide}
          onClose={() => setBetTarget(null)}
          onSuccess={() => { handleBetSuccess(); setBetTarget(null); }}
        />
      )}

      {showCreate && (
        <CreateMarketModal
          onClose={() => setShowCreate(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {showWalletGuide && (
        <WalletGuideModal
          onClose={() => setShowWalletGuide(false)}
          onConnect={() => setShowWalletGuide(false)}
        />
      )}

      {/* Toast */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
          ))}
        </div>
      )}
    </div>
  );
}
