import {
  Address,
  Blockchain,
  BytesWriter,
  Calldata,
  encodeSelector,
  Selector,
  StoredU256,
  StoredBoolean,
  StoredU64,
  StoredAddress,
  OP_NET,
  NetEvent,
  Revert,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

/* ───────────────── STORAGE ───────────────── */

const PTR_OWNER: u16     = 1;
const PTR_COUNT: u16     = 2;
const PTR_FEE: u16       = 3;

const PTR_ENDBLOCK: u16  = 10;
const PTR_YES: u16       = 11;
const PTR_NO: u16        = 12;
const PTR_RESOLVED: u16  = 13;
const PTR_OUTCOME: u16   = 14;
const PTR_TOTAL: u16     = 15;

const PTR_BETYES: u16    = 20;
const PTR_BETNO: u16     = 21;
const PTR_CLAIMED: u16   = 22;
const PTR_CLAIMABLE: u16 = 23;

/* ───────────────── EVENTS ───────────────── */

class MarketCreatedEvent extends NetEvent {
  constructor(id: u64, endBlock: u64) {
    const w = new BytesWriter(16);
    w.writeU64(id);
    w.writeU64(endBlock);
    super("MarketCreated", w);
  }
}

class BetPlacedEvent extends NetEvent {
  constructor(id: u64, side: bool, amount: u256) {
    const w = new BytesWriter(64);
    w.writeU64(id);
    w.writeBoolean(side);
    w.writeU256(amount);
    super("BetPlaced", w);
  }
}

class ResolvedEvent extends NetEvent {
  constructor(id: u64, outcome: bool) {
    const w = new BytesWriter(16);
    w.writeU64(id);
    w.writeBoolean(outcome);
    super("MarketResolved", w);
  }
}

class ClaimedEvent extends NetEvent {
  constructor(id: u64, amount: u256) {
    const w = new BytesWriter(40);
    w.writeU64(id);
    w.writeU256(amount);
    super("Claimed", w);
  }
}

/* ───────────────── CONTRACT ───────────────── */

@final
export class OneBet extends OP_NET {

  public constructor() { super(); }

  public override onDeployment(_calldata: Calldata): void {
    new StoredAddress(PTR_OWNER).value = Blockchain.tx.sender;
    new StoredU256(PTR_FEE, u256.Zero).value = u256.fromU64(200); // 2%
    new StoredU64(PTR_COUNT, 0).value = 0;
  }

  public override execute(method: Selector, calldata: Calldata): BytesWriter {
    switch (method) {
      case encodeSelector("createMarket(u64)"): return this.createMarket(calldata);
      case encodeSelector("placeBet(u64,bool)"): return this.placeBet(calldata);
      case encodeSelector("resolveMarket(u64,bool)"): return this.resolveMarket(calldata);
      case encodeSelector("claimWinnings(u64)"): return this.claimWinnings(calldata);
      case encodeSelector("withdraw()"): return this.withdraw();
      default: throw new Revert("Unknown method");
    }
  }

  /* ───────── CREATE MARKET ───────── */

  private createMarket(calldata: Calldata): BytesWriter {
    const duration = calldata.readU64();
    const id = new StoredU64(PTR_COUNT, 0).value;
    const end = Blockchain.blockNumber + duration;

    const sub = u256.fromU64(id);

    new StoredU64(PTR_ENDBLOCK, 0).setWithSub(sub, end);
    new StoredU256(PTR_YES, u256.Zero).setWithSub(sub, u256.Zero);
    new StoredU256(PTR_NO, u256.Zero).setWithSub(sub, u256.Zero);
    new StoredBoolean(PTR_RESOLVED, false).setWithSub(sub, false);
    new StoredU256(PTR_TOTAL, u256.Zero).setWithSub(sub, u256.Zero);

    new StoredU64(PTR_COUNT, 0).value = id + 1;

    this.emitEvent(new MarketCreatedEvent(id, end));

    const w = new BytesWriter(8);
    w.writeU64(id);
    return w;
  }

  /* ───────── PLACE BET ───────── */

  private placeBet(calldata: Calldata): BytesWriter {
    const id = calldata.readU64();
    const side = calldata.readBoolean();
    const amount = Blockchain.tx.callValue;

    if (u256.eq(amount, u256.Zero))
      throw new Revert("Send BTC");

    const sub = u256.fromU64(id);
    const end = new StoredU64(PTR_ENDBLOCK, 0).getWithSub(sub);

    if (Blockchain.blockNumber >= end)
      throw new Revert("Closed");

    const userKey = this.userKey(id);

    if (side) {
      this.addToPool(PTR_YES, sub, amount);
      this.addToPool(PTR_BETYES, userKey, amount);
    } else {
      this.addToPool(PTR_NO, sub, amount);
      this.addToPool(PTR_BETNO, userKey, amount);
    }

    this.addToPool(PTR_TOTAL, sub, amount);

    this.emitEvent(new BetPlacedEvent(id, side, amount));

    const w = new BytesWriter(1);
    w.writeBoolean(true);
    return w;
  }

  /* ───────── RESOLVE ───────── */

  private resolveMarket(calldata: Calldata): BytesWriter {
    const owner = new StoredAddress(PTR_OWNER).value;
    if (Blockchain.tx.sender != owner)
      throw new Revert("Not owner");

    const id = calldata.readU64();
    const outcome = calldata.readBoolean();
    const sub = u256.fromU64(id);

    new StoredBoolean(PTR_RESOLVED, false).setWithSub(sub, true);
    new StoredBoolean(PTR_OUTCOME, false).setWithSub(sub, outcome);

    this.emitEvent(new ResolvedEvent(id, outcome));

    const w = new BytesWriter(1);
    w.writeBoolean(true);
    return w;
  }

  /* ───────── CLAIM ───────── */

  private claimWinnings(calldata: Calldata): BytesWriter {
    const id = calldata.readU64();
    const sub = u256.fromU64(id);

    if (!new StoredBoolean(PTR_RESOLVED, false).getWithSub(sub))
      throw new Revert("Not resolved");

    const outcome = new StoredBoolean(PTR_OUTCOME, false).getWithSub(sub);
    const userKey = this.userKey(id);

    if (new StoredBoolean(PTR_CLAIMED, false).getWithSub(userKey))
      throw new Revert("Already claimed");

    const betPtr = outcome ? PTR_BETYES : PTR_BETNO;
    const poolPtr = outcome ? PTR_YES : PTR_NO;

    const bet = new StoredU256(betPtr, u256.Zero).getWithSub(userKey);
    const pool = new StoredU256(poolPtr, u256.Zero).getWithSub(sub);
    const total = new StoredU256(PTR_TOTAL, u256.Zero).getWithSub(sub);

    if (u256.eq(bet, u256.Zero))
      throw new Revert("No winning bet");

    const gross = u256.div(u256.mul(bet, total), pool);
    const feeRate = new StoredU256(PTR_FEE, u256.Zero).value;
    const fee = u256.div(u256.mul(gross, feeRate), u256.fromU64(10000));
    const payout = u256.sub(gross, fee);

    new StoredBoolean(PTR_CLAIMED, false).setWithSub(userKey, true);
    new StoredU256(PTR_CLAIMABLE, u256.Zero)
      .setWithSub(userKey,
        u256.add(
          new StoredU256(PTR_CLAIMABLE, u256.Zero).getWithSub(userKey),
          payout
        )
      );

    this.emitEvent(new ClaimedEvent(id, payout));

    const w = new BytesWriter(32);
    w.writeU256(payout);
    return w;
  }

  /* ───────── WITHDRAW ───────── */

  private withdraw(): BytesWriter {
    const user = Blockchain.tx.sender.toU256();
    const amount = new StoredU256(PTR_CLAIMABLE, u256.Zero).getWithSub(user);

    if (u256.eq(amount, u256.Zero))
      throw new Revert("Nothing to withdraw");

    new StoredU256(PTR_CLAIMABLE, u256.Zero).setWithSub(user, u256.Zero);

    const w = new BytesWriter(32);
    w.writeU256(amount);
    return w;
  }

  /* ───────── HELPERS ───────── */

  private userKey(id: u64): u256 {
    return u256.add(
      Blockchain.tx.sender.toU256(),
      u256.fromU64(id)
    );
  }

  private addToPool(ptr: u16, sub: u256, amt: u256): void {
    const s = new StoredU256(ptr, u256.Zero);
    s.setWithSub(sub, u256.add(s.getWithSub(sub), amt));
  }
      }
