#!/usr/bin/env bash
# ============================================================================
#  OneBet — Full Setup Script
#  Bitcoin L1 Prediction Market powered by OP_NET
#
#  Usage:
#    chmod +x setup.sh && ./setup.sh
#    ./setup.sh --deploy     # also deploy contract to BTC testnet
#    ./setup.sh --dev        # start frontend dev server only
# ============================================================================

set -e

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YEL='\033[1;33m'; GRN='\033[0;32m'
BLU='\033[0;34m'; CYN='\033[0;36m'; WHT='\033[1;37m'; RST='\033[0m'

log()   { echo -e "${BLU}[onebet]${RST} $*"; }
ok()    { echo -e "${GRN}  ✓${RST}  $*"; }
warn()  { echo -e "${YEL}  ⚠ ${RST}  $*"; }
fail()  { echo -e "${RED}  ✗${RST}  $*"; exit 1; }
title() { echo -e "\n${CYN}━━━ $* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"; }

# ── CRITICAL: Resolve script's own directory ─────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACT_DIR="$SCRIPT_DIR/smart-contract"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# ── Parse args ───────────────────────────────────────────────────────────────
DO_DEPLOY=false
DEV_MODE=false
SKIP_CONTRACT=false
SKIP_FRONTEND=false

for arg in "$@"; do
  case $arg in
    --deploy)          DO_DEPLOY=true ;;
    --dev)             DEV_MODE=true ;;
    --skip-contract)   SKIP_CONTRACT=true ;;
    --skip-frontend)   SKIP_FRONTEND=true ;;
    --help|-h)
      echo "Usage: ./setup.sh [--deploy] [--dev] [--skip-contract] [--skip-frontend]"
      exit 0 ;;
  esac
done

# ── Banner ────────────────────────────────────────────────────────────────────
cat << 'BANNER'

  ██████╗ ███╗   ██╗███████╗██████╗ ███████╗████████╗
  ██╔═══██╗████╗  ██║██╔════╝██╔══██╗██╔════╝╚══██╔══╝
  ██║   ██║██╔██╗ ██║█████╗  ██████╔╝█████╗     ██║   
  ██║   ██║██║╚██╗██║██╔══╝  ██╔══██╗██╔══╝     ██║   
  ╚██████╔╝██║ ╚████║███████╗██████╔╝███████╗   ██║   
   ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚═════╝ ╚══════╝   ╚═╝  
BANNER
echo -e "  ${WHT}Bitcoin L1 Prediction Market · Powered by OP_NET${RST}"
echo -e "  ${BLU}vibecode.finance${RST}\n"

# ── Check prerequisites ───────────────────────────────────────────────────────
title "Checking Prerequisites"

check_cmd() {
  if command -v "$1" &>/dev/null; then
    ok "$1 found ($(command -v "$1"))"; return 0
  else
    return 1
  fi
}

check_cmd node || fail "Node.js not found. Install from https://nodejs.org"
check_cmd npm  || fail "npm not found"
check_cmd git  && true || warn "git not found (optional)"

NODE_MAJOR=$(node -e "console.log(parseInt(process.versions.node))")
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node.js 18+ required. Current: $(node --version)"
fi
ok "Node.js $(node --version) — OK"

# ── Dev mode shortcut ─────────────────────────────────────────────────────────
if [ "$DEV_MODE" = true ]; then
  title "Starting Dev Server"
  cd "$FRONTEND_DIR"
  [ ! -d node_modules ] && npm install
  [ ! -f .env ] && cp .env.example .env && warn "Created .env — set VITE_CONTRACT_ADDRESS"
  log "Starting at http://localhost:5173"
  exec npm run dev
fi

# ── Step 1: Smart Contract ─────────────────────────────────────────────────────
if [ "$SKIP_CONTRACT" = false ]; then
  title "Smart Contract (AssemblyScript → WASM)"

  if [ ! -d "$CONTRACT_DIR" ]; then
    fail "smart-contract/ directory not found at: $CONTRACT_DIR"
  fi

  cd "$CONTRACT_DIR"
  log "Working directory: $(pwd)"
  log "Installing contract dependencies (this may take a moment)…"

  npm install 2>&1 | tail -5
  ok "Contract deps installed"

  log "Creating build directory…"
  mkdir -p build

  log "Compiling AssemblyScript → WebAssembly…"
  if npm run build 2>&1; then
    ok "Build successful!"
  else
    warn "Build had warnings — checking for WASM output…"
  fi

  # Find the wasm regardless of exact filename
  WASM_FILE=$(find build -name "*.wasm" 2>/dev/null | grep -v debug | head -1)
  if [ -z "$WASM_FILE" ]; then
    WASM_FILE=$(find build -name "*.wasm" 2>/dev/null | head -1)
  fi

  if [ -n "$WASM_FILE" ]; then
    [ "$WASM_FILE" != "build/OneBet.wasm" ] && cp "$WASM_FILE" build/OneBet.wasm 2>/dev/null || true
    WASM_SIZE=$(wc -c < build/OneBet.wasm 2>/dev/null || echo "?")
    ok "OneBet.wasm ready (${WASM_SIZE} bytes)"
  else
    warn "WASM not found in build/. Check AssemblyScript compile errors above."
    warn "You may need to manually run: cd smart-contract && npm run build"
  fi

  cd "$SCRIPT_DIR"
fi

# ── Step 2: Deploy Contract (optional) ────────────────────────────────────────
CONTRACT_ADDRESS=""

if [ "$DO_DEPLOY" = true ]; then
  title "Deploying Smart Contract to BTC Testnet"

  WASM_PATH="$CONTRACT_DIR/build/OneBet.wasm"
  if [ ! -f "$WASM_PATH" ]; then
    fail "OneBet.wasm not found. Build first without --deploy flag."
  fi

  echo ""
  echo -e "  ${WHT}Manual Deployment via OP_WALLET:${RST}"
  echo ""
  echo -e "  1. Open OP_WALLET extension in Chrome"
  echo -e "  2. Switch to ${YEL}Bitcoin Testnet3${RST}"
  echo -e "  3. Click ${YEL}'Deploy Contract'${RST}"
  echo -e "  4. Select: ${BLU}smart-contract/build/OneBet.wasm${RST}"
  echo -e "  5. Set gas: 50,000 sats minimum"
  echo -e "  6. Confirm & wait for confirmation"
  echo ""
  read -r -p "  Enter deployed contract address (op1...) or press Enter to skip: " CONTRACT_ADDRESS

  if [ -n "$CONTRACT_ADDRESS" ]; then
    ok "Contract address: $CONTRACT_ADDRESS"
  fi
fi

# ── Step 3: Frontend ───────────────────────────────────────────────────────────
if [ "$SKIP_FRONTEND" = false ]; then
  title "Frontend (React + Vite)"

  if [ ! -d "$FRONTEND_DIR" ]; then
    fail "frontend/ directory not found at: $FRONTEND_DIR"
  fi

  cd "$FRONTEND_DIR"
  log "Working directory: $(pwd)"

  # Set up .env
  if [ ! -f .env ]; then
    cp .env.example .env
    if [ -n "$CONTRACT_ADDRESS" ]; then
      # Replace placeholder with actual address
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|YOUR_DEPLOYED_CONTRACT_ADDRESS_HERE|${CONTRACT_ADDRESS}|" .env
      else
        sed -i "s|YOUR_DEPLOYED_CONTRACT_ADDRESS_HERE|${CONTRACT_ADDRESS}|" .env
      fi
      ok "Contract address written to .env"
    else
      warn ".env created — update VITE_CONTRACT_ADDRESS after deploying"
    fi
  fi

  log "Installing frontend dependencies…"
  npm install 2>&1 | tail -5
  ok "Frontend deps installed"

  log "Building production bundle…"
  if npm run build 2>&1; then
    DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1 || echo "?")
    ok "Frontend built → frontend/dist/ (${DIST_SIZE})"
  else
    warn "Build had issues — run manually: cd frontend && npm run build"
  fi

  cd "$SCRIPT_DIR"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
title "Setup Complete 🎉"

echo ""
echo -e "  ${WHT}Files built:${RST}"
[ -f "$CONTRACT_DIR/build/OneBet.wasm" ] && \
  echo -e "  ${GRN}✓${RST} smart-contract/build/OneBet.wasm"
[ -d "$FRONTEND_DIR/dist" ] && \
  echo -e "  ${GRN}✓${RST} frontend/dist/"
echo ""
echo -e "  ${WHT}Next steps:${RST}"
echo ""
echo -e "  ${YEL}1.${RST} Install OP_WALLET:"
echo -e "     https://chromewebstore.google.com/detail/opwallet/pmbjpcmaaladnfpacpmhmnfmpklgbdjb"
echo ""
echo -e "  ${YEL}2.${RST} Get testnet BTC:"
echo -e "     https://faucet.opnet.org"
echo ""
if [ -z "$CONTRACT_ADDRESS" ]; then
  echo -e "  ${YEL}3.${RST} Deploy contract:"
  echo -e "     ${BLU}./setup.sh --deploy${RST}"
  echo ""
fi
echo -e "  ${YEL}4.${RST} Start dev server:"
echo -e "     ${BLU}./setup.sh --dev${RST}"
echo -e "     Open http://localhost:5173"
echo ""
echo -e "  ${YEL}5.${RST} Submit to vibecode.finance:"
echo -e "     https://vibecode.finance/submit"
echo ""
[ -n "$CONTRACT_ADDRESS" ] && \
  echo -e "  ${WHT}Contract:${RST} ${YEL}$CONTRACT_ADDRESS${RST}" && echo ""
echo -e "  ${BLU}#opnetvibecode${RST}"
echo ""
