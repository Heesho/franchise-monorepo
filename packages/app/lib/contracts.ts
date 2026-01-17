export const CONTRACT_ADDRESSES = {
  // Core launchpad contracts
  core: "0xA35588D152F45C95f5b152e099647f081BD9F5AB",
  multicall: "0x5D16A5EB8Ac507eF417A44b8d767104dC52EFa87",
  // Token addresses
  weth: "0x4200000000000000000000000000000000000006",
  donut: "0xae4a37d554c6d6f3e398546d8566b25052e0169c",
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  // Uniswap V2 on Base
  uniV2Router: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
  uniV2Factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
} as const;

// Native ETH placeholder address used by 0x API
export const NATIVE_ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Core contract ABI - for reading deployed rigs and their mappings
export const CORE_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "deployedRigs",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "deployedRigsLength",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "isDeployedRig",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "rigToLauncher",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "rigToUnit",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "rigToAuction",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "rigToLP",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "minDonutForLaunch",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "donutToken",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "protocolFeeAddress",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Multicall ABI - for batched operations and state queries
export const MULTICALL_ABI = [
  // Mine function - mine a rig using ETH (wraps to WETH)
  {
    inputs: [
      { internalType: "address", name: "rig", type: "address" },
      { internalType: "uint256", name: "epochId", type: "uint256" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "uint256", name: "maxPrice", type: "uint256" },
      { internalType: "string", name: "uri", type: "string" },
    ],
    name: "mine",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  // Buy function - buy from auction using LP tokens
  {
    inputs: [
      { internalType: "address", name: "rig", type: "address" },
      { internalType: "uint256", name: "epochId", type: "uint256" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "uint256", name: "maxPaymentTokenAmount", type: "uint256" },
    ],
    name: "buy",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Launch function - launch a new rig
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "launcher", type: "address" },
          { internalType: "string", name: "tokenName", type: "string" },
          { internalType: "string", name: "tokenSymbol", type: "string" },
          { internalType: "string", name: "uri", type: "string" },
          { internalType: "uint256", name: "donutAmount", type: "uint256" },
          { internalType: "uint256", name: "unitAmount", type: "uint256" },
          { internalType: "uint256", name: "initialUps", type: "uint256" },
          { internalType: "uint256", name: "tailUps", type: "uint256" },
          { internalType: "uint256", name: "halvingPeriod", type: "uint256" },
          { internalType: "uint256", name: "rigEpochPeriod", type: "uint256" },
          { internalType: "uint256", name: "rigPriceMultiplier", type: "uint256" },
          { internalType: "uint256", name: "rigMinInitPrice", type: "uint256" },
          { internalType: "uint256", name: "auctionInitPrice", type: "uint256" },
          { internalType: "uint256", name: "auctionEpochPeriod", type: "uint256" },
          { internalType: "uint256", name: "auctionPriceMultiplier", type: "uint256" },
          { internalType: "uint256", name: "auctionMinInitPrice", type: "uint256" },
        ],
        internalType: "struct ICore.LaunchParams",
        name: "params",
        type: "tuple",
      },
    ],
    name: "launch",
    outputs: [
      { internalType: "address", name: "unit", type: "address" },
      { internalType: "address", name: "rig", type: "address" },
      { internalType: "address", name: "auction", type: "address" },
      { internalType: "address", name: "lpToken", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  // getRig function - get aggregated rig state
  {
    inputs: [
      { internalType: "address", name: "rig", type: "address" },
      { internalType: "address", name: "account", type: "address" },
    ],
    name: "getRig",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "epochId", type: "uint256" },
          { internalType: "uint256", name: "initPrice", type: "uint256" },
          { internalType: "uint256", name: "epochStartTime", type: "uint256" },
          { internalType: "uint256", name: "glazed", type: "uint256" },
          { internalType: "uint256", name: "price", type: "uint256" },
          { internalType: "uint256", name: "ups", type: "uint256" },
          { internalType: "uint256", name: "nextUps", type: "uint256" },
          { internalType: "uint256", name: "unitPrice", type: "uint256" },
          { internalType: "address", name: "miner", type: "address" },
          { internalType: "string", name: "epochUri", type: "string" },
          { internalType: "string", name: "rigUri", type: "string" },
          { internalType: "uint256", name: "ethBalance", type: "uint256" },
          { internalType: "uint256", name: "wethBalance", type: "uint256" },
          { internalType: "uint256", name: "donutBalance", type: "uint256" },
          { internalType: "uint256", name: "unitBalance", type: "uint256" },
        ],
        internalType: "struct Multicall.RigState",
        name: "state",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // getAuction function - get aggregated auction state
  {
    inputs: [
      { internalType: "address", name: "rig", type: "address" },
      { internalType: "address", name: "account", type: "address" },
    ],
    name: "getAuction",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "epochId", type: "uint256" },
          { internalType: "uint256", name: "initPrice", type: "uint256" },
          { internalType: "uint256", name: "startTime", type: "uint256" },
          { internalType: "address", name: "paymentToken", type: "address" },
          { internalType: "uint256", name: "price", type: "uint256" },
          { internalType: "uint256", name: "paymentTokenPrice", type: "uint256" },
          { internalType: "uint256", name: "wethAccumulated", type: "uint256" },
          { internalType: "uint256", name: "wethBalance", type: "uint256" },
          { internalType: "uint256", name: "donutBalance", type: "uint256" },
          { internalType: "uint256", name: "paymentTokenBalance", type: "uint256" },
        ],
        internalType: "struct Multicall.AuctionState",
        name: "state",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // Core and token addresses
  {
    inputs: [],
    name: "core",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "weth",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "donut",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ERC20 ABI - for token interactions
export const ERC20_ABI = [
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Rig contract ABI - for direct rig reads if needed
export const RIG_ABI = [
  {
    inputs: [],
    name: "epochId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "initPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "epochStartTime",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getUps",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "ups",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "miner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "uri",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "unit",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "quote",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "treasury",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "team",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "startTime",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "initialUps",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "tailUps",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "halvingPeriod",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "epochPeriod",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "priceMultiplier",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "minInitPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Auction contract ABI
export const AUCTION_ABI = [
  {
    inputs: [],
    name: "epochId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "initPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "startTime",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "paymentToken",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "paymentReceiver",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "epochPeriod",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "priceMultiplier",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "minInitPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// TypeScript types for contract returns
export type RigState = {
  epochId: bigint;
  initPrice: bigint;
  epochStartTime: bigint;
  glazed: bigint;
  price: bigint;
  ups: bigint;
  nextUps: bigint;
  unitPrice: bigint;
  miner: `0x${string}`;
  epochUri: string;
  rigUri: string;
  ethBalance: bigint;
  wethBalance: bigint;
  donutBalance: bigint;
  unitBalance: bigint;
};

export type AuctionState = {
  epochId: bigint;
  initPrice: bigint;
  startTime: bigint;
  paymentToken: `0x${string}`;
  price: bigint;
  paymentTokenPrice: bigint;
  wethAccumulated: bigint;
  wethBalance: bigint;
  donutBalance: bigint;
  paymentTokenBalance: bigint;
};

export type LaunchParams = {
  launcher: `0x${string}`;
  tokenName: string;
  tokenSymbol: string;
  uri: string;
  donutAmount: bigint;
  unitAmount: bigint;
  initialUps: bigint;
  tailUps: bigint;
  halvingPeriod: bigint;
  rigEpochPeriod: bigint;
  rigPriceMultiplier: bigint;
  rigMinInitPrice: bigint;
  auctionInitPrice: bigint;
  auctionEpochPeriod: bigint;
  auctionPriceMultiplier: bigint;
  auctionMinInitPrice: bigint;
};

// Default launch parameters
export const LAUNCH_DEFAULTS = {
  uri: "", // metadata URI for the unit token (can be set later by team)
  unitAmount: BigInt("10000000000000000000000"), // 10000 tokens (10000e18)
  initialUps: BigInt("4000000000000000000"), // 4 tokens/sec
  tailUps: BigInt("10000000000000000"), // 0.01 tokens/sec
  halvingPeriod: BigInt(30 * 24 * 60 * 60), // 30 days
  rigEpochPeriod: BigInt(60 * 60), // 1 hour
  rigPriceMultiplier: BigInt("2000000000000000000"), // 2x (2e18)
  rigMinInitPrice: BigInt("100000000000000"), // 0.0001 ETH
  auctionInitPrice: BigInt("1000000000000000000000"), // 1000 LP tokens
  auctionEpochPeriod: BigInt(24 * 60 * 60), // 24 hours
  auctionPriceMultiplier: BigInt("1200000000000000000"), // 1.2x (1.2e18)
  auctionMinInitPrice: BigInt("1000000000000000000000"), // 1000 LP
} as const;

// Uniswap V2 Router ABI (only addLiquidity)
export const UNIV2_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
      { internalType: "uint256", name: "amountADesired", type: "uint256" },
      { internalType: "uint256", name: "amountBDesired", type: "uint256" },
      { internalType: "uint256", name: "amountAMin", type: "uint256" },
      { internalType: "uint256", name: "amountBMin", type: "uint256" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "addLiquidity",
    outputs: [
      { internalType: "uint256", name: "amountA", type: "uint256" },
      { internalType: "uint256", name: "amountB", type: "uint256" },
      { internalType: "uint256", name: "liquidity", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Uniswap V2 Pair ABI (for getReserves)
export const UNIV2_PAIR_ABI = [
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { internalType: "uint112", name: "reserve0", type: "uint112" },
      { internalType: "uint112", name: "reserve1", type: "uint112" },
      { internalType: "uint32", name: "blockTimestampLast", type: "uint32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
