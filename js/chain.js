/* Chain layer for NeonRoboBNB: reads via round-robin RPC with Multicall3
   batching, writes via the injected wallet. The provider/multicall/connect
   core is byte-for-byte the ptahsite layer that was probed against live BSC
   (multicall unwrap fix, getLogs chunking, USDT 18 decimals) — only the read
   functions below target this collection's contracts.
   Exported for node (module.exports) so reads can be exercised without a
   browser — see tools/probe-site.mjs. */
(function (root) {
  const E = typeof ethers !== "undefined" ? ethers : require("./vendor/ethers.umd.min.js");
  const C = typeof CONFIG !== "undefined" ? CONFIG : require("./config.js").CONFIG;

  let _provider = null;
  let _rpcIdx = 0;

  function provider() {
    if (_provider) return _provider;
    _provider = new E.JsonRpcProvider(C.RPCS[_rpcIdx], C.CHAIN_ID, { staticNetwork: true });
    return _provider;
  }
  function rotateRpc() {
    _rpcIdx = (_rpcIdx + 1) % C.RPCS.length;
    _provider = new E.JsonRpcProvider(C.RPCS[_rpcIdx], C.CHAIN_ID, { staticNetwork: true });
    return _provider;
  }
  async function withRpc(fn) {
    let last;
    for (let i = 0; i < C.RPCS.length; i++) {
      try { return await fn(provider()); }
      catch (e) { last = e; rotateRpc(); }
    }
    throw last;
  }

  function contract(addr, abi, runner) {
    return new E.Contract(addr, abi, runner || provider());
  }

  /* ---- Multicall3 helper: batch [(addr, fn, args)] -> decoded results ---- */
  async function multicall(calls) {
    const out = [];
    const CH = 80;
    for (let i = 0; i < calls.length; i += CH) {
      const part = calls.slice(i, i + CH);
      const mc = contract(C.MULTICALL3, C.ABI.MULTICALL3);
      const raw = await mc.aggregate3.staticCall(
        part.map((c) => ({
          target: c.addr,
          allowFailure: true,
          callData: c.iface.encodeFunctionData(c.fn, c.args || []),
        }))
      );
      for (let k = 0; k < part.length; k++) {
        const [ok, data] = raw[k];
        if (!ok) { out.push(null); continue; }
        const dec = part[k].iface.decodeFunctionResult(part[k].fn, data);
        out.push(dec.length === 1 ? dec[0] : dec);
      }
    }
    return out;
  }

  const ifaceN = () => new E.Interface(C.ABI.NNB);
  const ifaceA = () => new E.Interface(C.ABI.ART);
  const ifaceU = () => new E.Interface(C.ABI.USDT);

  /** Deployed yet? Every read funnels through this — no address, no numbers. */
  function deployed() {
    return typeof C.NNB === "string" && C.NNB.length === 42;
  }
  function artDeployed() {
    return typeof C.ART === "string" && C.ART.length === 42;
  }

  /** Sale state straight from saleFacts() + mining parameters, one batch. */
  async function readSaleState() {
    if (!deployed()) return { pending: true };
    return withRpc(async (p) => {
      const inN = ifaceN();
      const [facts, anchor, target, held, start] = await multicall([
        { addr: C.NNB, iface: inN, fn: "saleFacts" },
        { addr: C.NNB, iface: inN, fn: "launchAnchor" },
        { addr: C.NNB, iface: inN, fn: "targetDifficulty" },
        { addr: C.NNB, iface: inN, fn: "saleConfig" },
        { addr: C.NNB, iface: inN, fn: "MINING_START" },
      ]);
      return {
        pending: false,
        supply: Number(facts[0]),
        minted: Number(facts[1]),
        firstPrice: facts[2],
        listPrice: facts[3],
        paymentToken: facts[4],
        open: facts[5],
        miningEnd: Number(facts[6]),
        miningStart: Number(start),
        anchor,
        target,
        contractHeld: held[3],
      };
    });
  }

  /** The wallet's own quote + allowance + balance in one multicall.
      priceFor is the price authority — never a hardcoded number. */
  async function readQuote(address, count) {
    if (!deployed()) return { pending: true };
    return withRpc(async () => {
      const inN = ifaceN(), inU = ifaceU();
      const [price, spent, allowance, balance] = await multicall([
        { addr: C.NNB, iface: inN, fn: "priceFor", args: [address, count] },
        { addr: C.NNB, iface: inN, fn: "consumedFirstMint", args: [address] },
        { addr: C.USDT, iface: inU, fn: "allowance", args: [address, C.NNB] },
        { addr: C.USDT, iface: inU, fn: "balanceOf", args: [address] },
      ]);
      return { pending: false, price, firstTierSpent: spent, allowance, balance };
    });
  }

  /** Still open and how much room is left — read right before signing so
      the wallet never sends a doomed transaction. */
  async function preflight() {
    if (!deployed()) return { pending: true };
    return withRpc(async () => {
      const inN = ifaceN();
      const [open, facts] = await multicall([
        { addr: C.NNB, iface: inN, fn: "isOpen" },
        { addr: C.NNB, iface: inN, fn: "saleFacts" },
      ]);
      return { pending: false, open, minted: Number(facts[1]) };
    });
  }

  async function proofUsed(hash) {
    if (!deployed()) return false;
    return withRpc(async () => {
      const used = await contract(C.NNB, C.ABI.NNB).usedProof(hash);
      return used;
    });
  }

  /** Gallery: traits + the library's own SVG for any seed (preview before mint). */
  async function readPreview(seed) {
    if (!artDeployed()) return { pending: true };
    return withRpc(async () => {
      const a = contract(C.ART, C.ABI.ART);
      const [r, svg] = await Promise.all([a.traitsOf(seed), a.renderSVG(seed, 0)]);
      return { pending: false, parts: r[0], tier: Number(r[1]), svg };
    });
  }

  /** Owned token ids. The collection is NOT enumerable, so scan ownerOf in
      multicall chunks; progress callback keeps the UI honest about work. */
  async function readOwnedTokens(address, onProgress) {
    if (!deployed()) return { pending: true };
    return withRpc(async () => {
      const n = contract(C.NNB, C.ABI.NNB);
      const total = Number(await n.totalSupply());
      const ids = [];
      const inN = ifaceN();
      const CH = 80;
      for (let from = 1; from <= total; from += CH) {
        const to = Math.min(total, from + CH - 1);
        const calls = [];
        for (let id = from; id <= to; id++) {
          calls.push({ addr: C.NNB, iface: inN, fn: "ownerOf", args: [id] });
        }
        const res = await multicall(calls);
        for (let i = 0; i < res.length; i++) {
          if (res[i] && String(res[i]).toLowerCase() === address.toLowerCase()) {
            ids.push(from + i);
          }
        }
        if (onProgress) onProgress(Math.min(to, total), total);
      }
      return { pending: false, ids };
    });
  }

  /* ------------------------------ WRITES -------------------------------- */
  /* Browser-only: they need the injected signer. */

  function browserProvider() {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("no-wallet");
    }
    return new E.BrowserProvider(window.ethereum, "any");
  }

  async function connect() {
    const p = browserProvider();
    const net = await p.getNetwork();
    if (Number(net.chainId) !== C.CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }],
        });
      } catch (e) {
        if (e && e.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x38",
              chainName: C.CHAIN_NAME,
              nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
              rpcUrls: [C.RPCS[0]],
              blockExplorerUrls: ["https://bscscan.com"],
            }],
          });
        } else throw e;
      }
    }
    const sp = browserProvider();
    const accounts = await sp.send("eth_requestAccounts", []);
    const signer = await sp.getSigner();
    return { address: accounts[0], signer, provider: sp };
  }

  async function write(fn /* {addr, abi, method, args, value} */) {
    const { signer } = await connect();
    const c = new E.Contract(fn.addr, fn.abi, signer);
    const tx = await c[fn.method](...(fn.args || []), fn.value != null ? { value: fn.value } : {});
    const receipt = await tx.wait();
    if (Number(receipt.status) !== 1) throw new Error("tx-failed");
    return { hash: receipt.hash, receipt };
  }

  const api = {
    E, C, provider, multicall, contract,
    deployed, artDeployed,
    readSaleState, readQuote, preflight, proofUsed,
    readPreview, readOwnedTokens,
    connect, write, browserProvider,
  };
  if (typeof module !== "undefined") module.exports = api;
  root.Temple = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
