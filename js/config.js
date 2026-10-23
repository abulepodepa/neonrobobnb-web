/* NeonRoboBNB — BNB Chain (56).
   NNB/ART addresses stay EMPTY until the deploy step fills them; every read
   guards on that, and the UI shows an honest "belum terpasang" state instead
   of inventing numbers. USDT + Multicall3 verified live with `cast`
   (18 decimals; aggregate3 round-trip OK) during the ptahsite probe. */
const CONFIG = {
  CHAIN_ID: 56,
  CHAIN_NAME: "BNB Smart Chain",
  RPCS: [
    "https://bsc-dataseed.binance.org",
    "https://bsc-rpc.publicnode.com",
    "https://bsc-dataseed1.defibit.io",
  ],
  MULTICALL3: "0xcA11bde05977b3631167028862bE2a173976CA11",

  /* filled by the deploy step */
  NNB: "",   /* NeonroboBNB collection */
  ART: "",   /* NeonroboBNBArt library (linked first; preview calls go here) */
  MARKET: null, /* order book contract — not part of this deploy yet */

  USDT: "0x55d398326f99059fF775485246999027B3197955",
  /* BSC-USD has 18 decimals on this chain — verified by cast: decimals() == 18,
     so 0.5 USDT == 500000000000000000, exactly the contract's FIRST_PRICE. */
  USDT_DECIMALS: 18,

  ABI: {
    NNB: [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function totalSupply() view returns (uint256)",
      "function minedCount() view returns (uint256)",
      "function MAX_SUPPLY() view returns (uint256)",
      "function CONTRACT_CEILING() view returns (uint256)",
      "function FIRST_PRICE() view returns (uint256)",
      "function LIST_PRICE() view returns (uint256)",
      "function PAYMENT_TOKEN() view returns (address)",
      "function isOpen() view returns (bool)",
      "function launchAnchor() view returns (bytes32)",
      "function targetDifficulty() view returns (uint256)",
      "function usedProof(bytes32 hash) view returns (bool)",
      "function priceFor(address wallet, uint256 count) view returns (uint256)",
      "function consumedFirstMint(address wallet) view returns (bool)",
      "function saleFacts() view returns (uint256 supply, uint256 maxSupply, uint256 contractCeiling, uint256 minted, uint256 firstPrice, uint256 listPrice, address paymentToken, bool open)",
      "function saleConfig() view returns (address paymentToken, uint256 firstPrice, uint256 listPrice, uint256 contractHeld)",
      "function computeHash(address miner, uint256 nonce, bytes32 anchor) pure returns (bytes32)",
      "function mine(uint256 nonce, uint256 count)",
      "function traitsOf(uint256 tokenId) view returns (string[9] parts, uint8 tier)",
      "function gridOf(uint256 tokenId) view returns (bytes)",
      "function renderSVG(uint256 tokenId) view returns (string)",
      "function tokenURI(uint256 tokenId) view returns (string)",
      "function tierName(uint8 tier) pure returns (string)",
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function balanceOf(address holder) view returns (uint256)",
      "event NeonMined(address indexed miner, uint256 indexed tokenId, uint256 seed, uint256 paid, uint8 depth, bytes32 workHash)",
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
      /* every custom error must sit in the interface or ethers cannot name it */
      "error BatchTooLarge()",
      "error WorkOverTarget()",
      "error SupplyExhausted()",
      "error MiningClosed()",
      "error ProofAlreadyUsed()",
      "error PaymentFailed()",
      "error NotOwner()",
      "error NotTokenOwner()",
      "error InvalidTarget()",
      "error InvalidConstructor()",
      "error ZeroAddress()",
      "error UnsafeRecipient()",
    ],
    ART: [
      "function traitsOf(uint256 seed) pure returns (string[9] parts, uint8 tier)",
      "function rollCombo(uint256 seed) pure returns (tuple(uint8 body, uint8 hat, uint8 eyes, uint8 beard, uint8 chest, uint8 arm, uint8 leg, uint8 item, uint8 stamp))",
      "function tierName(uint8 tier) pure returns (string)",
      "function renderSVG(uint256 seed, uint256 tokenId) pure returns (string)",
      "function zoneColor(uint256 seed, uint8 zone) pure returns (string)",
      "function auraColor(uint256 seed) pure returns (string)",
    ],
    USDT: [
      "function balanceOf(address owner) view returns (uint256)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event Approval(address indexed owner, address indexed spender, uint256 value)",
    ],
    MULTICALL3: [
      "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
    ],
  },
};

if (typeof module !== "undefined") module.exports = { CONFIG };
