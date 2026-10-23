/* Shared UI glue for NeonRoboBNB: wallet connect (injected, chain 56),
   toasts, formatters. All chain data comes from chain.js — nothing here
   invents numbers. Shared core is the ptahsite glue (proven on live BSC). */
(function () {
  const C = CONFIG;
  const $ = (id) => document.getElementById(id);

  let addr = null;

  function toast(msg, isErr, ms) {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = isErr ? "err" : "";
    t.style.display = "block";
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.style.display = "none"; }, ms || 5200);
  }

  const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");

  /* USDT here has 18 decimals (proven from GAME's config: 1e18 == "1,00 USDT") */
  function usdt(bn, dp) {
    if (bn == null) return "—";
    const n = Number(bn) / 1e18;
    return n.toLocaleString("en-US", { maximumFractionDigits: dp == null ? 4 : dp });
  }
  function bnb(bn) {
    if (bn == null) return "—";
    return (Number(bn) / 1e18).toFixed(6);
  }
  function ago(unix) {
    const s = Math.max(0, Math.floor(Date.now() / 1000) - unix);
    if (s < 60) return s + "s";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    return Math.floor(s / 86400) + "d";
  }

  async function ensureWallet() {
    if (addr) {
      const p = Temple.browserProvider();
      const net = await p.getNetwork();
      if (Number(net.chainId) !== C.CHAIN_ID) {
        await Temple.connect(); // switches to 56 (adds it if missing)
      }
      return addr;
    }
    const r = await Temple.connect();
    addr = r.address;
    paintConnect();
    return addr;
  }

  function paintConnect() {
    const b = $("connect");
    if (b) b.textContent = addr ? short(addr) : "Connect wallet";
  }

  function errText(e) {
    const raw = String((e && (e.reason || e.shortMessage || e.message)) || e);
    if (raw.includes("WorkOverTarget")) return "Nonce belum memenuhi target PoW — lanjutkan mencari.";
    if (raw.includes("ProofAlreadyUsed")) return "Nonce ini sudah terpakai batch lain — cari nonce baru.";
    if (raw.includes("SupplyExhausted")) return "Supply sudah habis.";
    if (raw.includes("MiningClosed")) return "Mining sudah dihentikan deployer.";
    if (raw.includes("BatchTooLarge")) return "Jumlah per transaksi maksimal 100.";
    if (raw.includes("PaymentFailed")) return "USDT tidak cukup atau belum di-approve — cek saldo/allowance.";
    if (raw.includes("user rejected") || raw.includes("ACTION_REJECTED")) return "Dibatalkan di wallet.";
    if (raw.includes("insufficient funds")) return "Saldo tidak cukup (harga + gas).";
    if (raw === "no-wallet") return "Wallet injector tidak ditemukan — buka dari wallet browser (Binance/MetaMask).";
    if (raw.includes("underpriced") || raw.includes("replacement")) return "Gas terlalu rendah — coba lagi.";
    return raw.slice(0, 180);
  }

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  window.TempleUI = {
    $, toast, short, usdt, bnb, ago, ensureWallet, errText, onReady, paintConnect,
    get address() { return addr; },
    set address(v) { addr = v; paintConnect(); },
  };

  onReady(() => {
    const b = $("connect");
    if (b) b.addEventListener("click", async () => {
      try { await ensureWallet(); toast("Tertambat: " + short(addr)); }
      catch (e) { toast(errText(e), true); }
    });
    paintConnect();
    if (window.ethereum && window.ethereum.on) {
      window.ethereum.on("accountsChanged", (a) => { window.TempleUI.address = a && a[0] ? a[0] : null; });
      window.ethereum.on("chainChanged", () => location.reload());
    }
  });
})();
