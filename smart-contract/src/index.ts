import { OneBet } from "./contracts/OneBet";
import { Calldata } from "@btc-vision/btc-runtime/runtime";

let contract: OneBet | null = null;

export function execute(calldata: Calldata): void {
  if (contract === null) {
    contract = new OneBet();
  }
}