/* PoW worker for NeonRoboBNB: search nonces until
   keccak256(abi.encodePacked(miner, nonce, anchor)) <= targetDifficulty —
   byte-identical to the contract's computeHash/targetDifficulty, so a find
   here is a valid proof there. Runs off the main thread (classic worker).
   Import path is relative to THIS file (js/miner.js -> js/vendor/...). */
importScripts("vendor/ethers.umd.min.js");

let running = false;

self.onmessage = (e) => {
  const d = e.data;
  if (d.cmd === "start") {
    running = true;
    search(String(d.addr), String(d.anchor), BigInt(d.target), BigInt(d.start || 0));
  } else if (d.cmd === "stop") {
    running = false;
  }
};

function search(addr, anchor, target, nonce) {
  const BATCH = 40000;
  while (running) {
    for (let i = 0; i < BATCH; i++) {
      const h = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32"],
        [addr, nonce, anchor]
      );
      if (BigInt(h) <= target) {
        running = false;
        self.postMessage({ found: true, nonce: nonce.toString(), hash: h });
        return;
      }
      nonce++;
    }
    self.postMessage({ progress: nonce.toString(), hashes: BATCH });
  }
  self.postMessage({ stopped: true, nonce: nonce.toString() });
}
