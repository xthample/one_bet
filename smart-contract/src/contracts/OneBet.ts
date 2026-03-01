import {
  Address,
  Blockchain,
  BytesWriter,
  Calldata,
  encodeSelector,
  Selector,
  StoredU256,
  StoredString,
  StoredBoolean,
  StoredU64,
  OP_NET,
  NetEvent,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

const PTR_OWNER: u16     = 1;
const PTR_COUNT: u16     = 2;
const PTR_FEE: u16       = 3;
const PTR_QUESTION: u16  = 10;
const PTR_ENDBLOCK: u16  = 11;
const PTR_YES: u16       = 12;
const PTR_NO: u16        = 13;
const PTR_RESOLVED: u16  = 14;
const PTR_OUTCOME: u16   = 15;
const PTR_TOTAL: u16     = 16;
const PTR_BETYES: u16    = 20;
const PTR_BETNO: u16     = 21;
const PTR_CLAIMED: u16   = 22;

class MarketCreatedEvent extends NetEvent {
  constructor(id: u64, question: string, endBlock: u64) {
    const w = new BytesWriter(256);
    w.writeU64(id);
    w.writeU64(endBlock);
    w.writeStringWithLength(question);
    super('MarketCreated', w);
  }
}

class BetPlacedEvent extends NetEvent {
  constructor(id: u64, side: bool, amount: u256) {
    const w = new BytesWriter(64);
    w.writeU64(id);
    w.writeBoolean(side);
    w.writeU256(amount);
    super('BetPlaced', w);
  }
}

class ResolvedEvent extends NetEvent {
  constructor(id: u64, outcome: bool) {
    const w = new BytesWriter(32);
    w.writeU64(id);
    w.writeBoolean(outcome);
    super('MarketResolved', w);
  }
}

class ClaimedEvent extends NetEvent {
  constructor(id: u64, amount: u256) {
    const w = new BytesWriter(64);
    w.writeU64(id);
    w.writeU256(amount);
    super('Claimed', w);
  }
}

const ROOT: u256 = u256.Zero;

function getU256(ptr: u16, sub: u256): u256 { return new StoredU256(ptr, u256.Zero).getWithSub(sub); }
function setU256(ptr: u16, sub: u256, v: u256): void { new StoredU256(ptr, u256.Zero).setWithSub(sub, v); }
function getU64(ptr: u16, sub: u256): u64 { return new StoredU64(ptr, 0).getWithSub(sub); }
function setU64(ptr: u16, sub: u256, v: u64): void { new StoredU64(ptr, 0).setWithSub(sub, v); }
function getBool(ptr: u16, sub: u256): bool { return new StoredBoolean(ptr, false).getWithSub(sub); }
function setBool(ptr: u16, sub: u256, v: bool): void { new StoredBoolean(ptr, false).setWithSub(sub, v); }
function getStr(ptr: u16, sub: u256): string { return new StoredString(ptr, '').getWithSub(sub); }
function setStr(ptr: u16, sub: u256, v: string): void { new StoredString(ptr, '').setWithSub(sub, v); }

@final
export class OneBet extends OP_NET {

  public constructor() { super(); }

  public override onDeployment(_calldata: Calldata): void {
    const owner = Blockchain.tx.sender.p2tr(Blockchain.network);
    setStr(PTR_OWNER, ROOT, owner);
    setU256(PTR_FEE, ROOT, u256.fromU64(200));
    setU64(PTR_COUNT, ROOT, 0);
  }

  public override execute(method: Selector, calldata: Calldata): BytesWriter {
    switch (method) {
      case encodeSelector('createMarket(string,u64)'): return this.createMarket(calldata);
      case encodeSelector('placeBet(u64,bool)'):       return this.placeBet(calldata);
      case encodeSelector('resolveMarket(u64,bool)'):  return this.resolveMarket(calldata);
      case encodeSelector('claimWinnings(u64)'):       return this.claimWinnings(calldata);
      case encodeSelector('getMarket(u64)'):           return this.getMarket(calldata);
      case encodeSelector('getUserBet(u64)'):          return this.getUserBet(calldata);
      case encodeSelector('getMarketCount()'):         return this.getMarketCount();
      default: return super.execute(method, calldata);
    }
  }

  private createMarket(calldata: Calldata): BytesWriter {
    const question = calldata.readStringWithLength();
    const dur: u64 = calldata.readU64();

    const id: u64 = getU64(PTR_COUNT, ROOT);
    const end: u64 = Blockchain.blockNumber + dur;
    const sub = u256.fromU64(id);

    setStr(PTR_QUESTION, sub, question);
    setU64(PTR_ENDBLOCK, sub, end);
    setU256(PTR_YES, sub, u256.Zero);
    setU256(PTR_NO, sub, u256.Zero);
    setBool(PTR_RESOLVED, sub, false);
    setBool(PTR_OUTCOME, sub, false);
    setU256(PTR_TOTAL, sub, u256.Zero);

    setU64(PTR_COUNT, ROOT, id + 1);

    this.emitEvent(new MarketCreatedEvent(id, question, end));

    const w = new BytesWriter(8);
    w.writeU64(id);
    return w;
  }

  private placeBet(calldata: Calldata): BytesWriter {
    const id: u64 = calldata.readU64();
    const side: bool = calldata.readBoolean();
    const amt: u256 = Blockchain.tx.callValue;

    if (u256.eq(amt, u256.Zero)) throw new Error('Send BTC');

    const sub = u256.fromU64(id);

    if (id >= getU64(PTR_COUNT, ROOT)) throw new Error("Market not found");
    if (Blockchain.blockNumber >= getU64(PTR_ENDBLOCK, sub)) throw new Error('Closed');
    if (getBool(PTR_RESOLVED, sub)) throw new Error('Resolved');

    const usub = this.userSub(id);

    if (side) {
      setU256(PTR_YES, sub, u256.add(getU256(PTR_YES, sub), amt));
      setU256(PTR_BETYES, usub, u256.add(getU256(PTR_BETYES, usub), amt));
    } else {
      setU256(PTR_NO, sub, u256.add(getU256(PTR_NO, sub), amt));
      setU256(PTR_BETNO, usub, u256.add(getU256(PTR_BETNO, usub), amt));
    }

    setU256(PTR_TOTAL, sub, u256.add(getU256(PTR_TOTAL, sub), amt));

    this.emitEvent(new BetPlacedEvent(id, side, amt));

    const w = new BytesWriter(1);
    w.writeBoolean(true);
    return w;
  }

  private resolveMarket(calldata: Calldata): BytesWriter {
    if (Blockchain.tx.sender.p2tr(Blockchain.network) !== getStr(PTR_OWNER, ROOT))
      throw new Error('Not owner');

    const id: u64 = calldata.readU64();
    const outcome = calldata.readBoolean();
    const sub = u256.fromU64(id);

    if (id >= getU64(PTR_COUNT, ROOT)) throw new Error("Market not found");
    if (Blockchain.blockNumber < getU64(PTR_ENDBLOCK, sub)) throw new Error("Not ended");
    if (getBool(PTR_RESOLVED, sub)) throw new Error('Already resolved');

    setBool(PTR_RESOLVED, sub, true);
    setBool(PTR_OUTCOME, sub, outcome);

    this.emitEvent(new ResolvedEvent(id, outcome));

    const w = new BytesWriter(1);
    w.writeBoolean(true);
    return w;
  }

  private claimWinnings(calldata: Calldata): BytesWriter {
    const id: u64 = calldata.readU64();
    const sub = u256.fromU64(id);

    if (!getBool(PTR_RESOLVED, sub)) throw new Error('Not resolved');

    const outcome = getBool(PTR_OUTCOME, sub);
    const usub = this.userSub(id);

    if (getBool(PTR_CLAIMED, usub)) throw new Error('Claimed');

    const betPtr = outcome ? PTR_BETYES : PTR_BETNO;
    const poolPtr = outcome ? PTR_YES : PTR_NO;

    const bet = getU256(betPtr, usub);
    if (u256.eq(bet, u256.Zero)) throw new Error('No winning bet');

    const pool = getU256(poolPtr, sub);
    if (u256.eq(pool, u256.Zero)) throw new Error("Empty pool");

    const total = getU256(PTR_TOTAL, sub);

    const gross = u256.div(u256.mul(bet, total), pool);
    const fee = u256.div(u256.mul(gross, getU256(PTR_FEE, ROOT)), u256.fromU64(10000));
    const payout = u256.sub(gross, fee);

    setBool(PTR_CLAIMED, usub, true);

    Blockchain.transfer(Blockchain.tx.sender, payout);

    this.emitEvent(new ClaimedEvent(id, payout));

    const w = new BytesWriter(32);
    w.writeU256(payout);
    return w;
  }

  private getMarket(calldata: Calldata): BytesWriter {
    const id: u64 = calldata.readU64();
    const sub = u256.fromU64(id);

    const w = new BytesWriter(300);
    w.writeStringWithLength(getStr(PTR_QUESTION, sub));
    w.writeU64(getU64(PTR_ENDBLOCK, sub));
    w.writeU256(getU256(PTR_YES, sub));
    w.writeU256(getU256(PTR_NO, sub));
    w.writeBoolean(getBool(PTR_RESOLVED, sub));
    w.writeBoolean(getBool(PTR_OUTCOME, sub));
    w.writeU256(getU256(PTR_TOTAL, sub));

    return w;
  }

  private getUserBet(calldata: Calldata): BytesWriter {
    const id: u64 = calldata.readU64();
    const usub = this.userSub(id);

    const w = new BytesWriter(65);
    w.writeU256(getU256(PTR_BETYES, usub));
    w.writeU256(getU256(PTR_BETNO, usub));
    w.writeBoolean(getBool(PTR_CLAIMED, usub));

    return w;
  }

  private getMarketCount(): BytesWriter {
    const w = new BytesWriter(8);
    w.writeU64(getU64(PTR_COUNT, ROOT));
    return w;
  }

  private userSub(id: u64): u256 {
    const w = new BytesWriter(64);
    w.writeAddress(Blockchain.tx.sender.p2tr(Blockchain.network));
    w.writeU64(id);
    return Blockchain.keccak256(w.getBuffer());
  }
}