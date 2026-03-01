import { OneBet } from "./contracts/OneBet";
import { Calldata } from "@btc-vision/btc-runtime/runtime";

let contract: OneBet | null = null;

/**
 * WAJIB ADA.
 * Dipanggil saat deploy oleh OP_NET runtime.
 */
export function start(): void {
  contract = new OneBet();
}

/**
 * Dipanggil setiap transaksi.
 */
export function execute(calldata: Calldata): void {
  if (!contract) {
    contract = new OneBet();
  }

  contract.execute(calldata);
}
