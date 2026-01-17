# Mineport Protocol Architecture

## Overview

Mineport is a decentralized mining launchpad where users can launch "Rigs" - Dutch auction-based mining contracts that mint custom Unit tokens.

## Contract Hierarchy

```
                                    +-------------+
                                    |    Core     |
                                    | (Launchpad) |
                                    +------+------+
                                           |
                    +----------------------+----------------------+
                    |                      |                      |
             +------v------+       +-------v-------+      +-------v-------+
             | UnitFactory |       |  RigFactory   |      | AuctionFactory|
             +------+------+       +-------+-------+      +-------+-------+
                    |                      |                      |
             +------v------+       +-------v-------+      +-------v-------+
             |    Unit     |       |      Rig      |      |    Auction    |
             |  (ERC20)    |       | (Dutch Auction|      | (Treasury     |
             |             |       |   Mining)     |      |  Auction)     |
             +-------------+       +---------------+      +---------------+
```

## Launch Flow

```
User calls Core.launch(params)
           |
           v
    +------+------+
    | 1. Transfer |
    |   DONUT     |
    +------+------+
           |
           v
    +------+------+
    | 2. Deploy   |
    |   Unit      |
    |   Token     |
    +------+------+
           |
           v
    +------+------+
    | 3. Mint     |
    |   Initial   |
    |   Units     |
    +------+------+
           |
           v
    +------+------+
    | 4. Create   |
    |  Unit/DONUT |
    |   LP Pool   |
    +------+------+
           |
           v
    +------+------+
    | 5. Burn LP  |
    |   (to dead) |
    +------+------+
           |
           v
    +------+------+
    | 6. Deploy   |
    |   Auction   |
    +------+------+
           |
           v
    +------+------+
    | 7. Deploy   |
    |     Rig     |
    +------+------+
           |
           v
    +------+------+
    | 8. Transfer |
    |   Unit mint |
    |   rights    |
    +------+------+
           |
           v
    +------+------+
    | 9. Transfer |
    |  Ownership  |
    |  to launcher|
    +-------------+
```

## Mining Flow (Rig)

```
                     +------------------+
                     |   User calls     |
                     |   mine(slot)     |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     |  Dutch Auction   |
                     |  Price Check     |
                     | (decays to 0     |
                     |  over epoch)     |
                     +--------+---------+
                              |
                              v
              +---------------+---------------+
              |               |               |
       +------v------+ +------v------+ +------v------+
       | Protocol 1% | | Treasury 15%| |  Team 4%   |
       +-------------+ +-------------+ +------+------+
                                              |
                                       (if team set)
                                              |
                              +---------------+
                              |
                       +------v------+
                       | Prev Miner  |
                       |    80%      |
                       +-------------+

                              |
                              v
                     +--------+---------+
                     | Mint Units to    |
                     | Previous Miner   |
                     | (time * UPS *    |
                     |  multiplier)     |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Update Slot      |
                     | - New miner      |
                     | - New epoch      |
                     | - New UPS        |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Request Entropy  |
                     | (if enabled)     |
                     +------------------+
```

## Fee Distribution

```
Mining Fee (100%)
       |
       +---> Protocol (1%)  --> protocolFeeAddress
       |
       +---> Treasury (15%) --> Auction contract
       |
       +---> Team (4%)      --> team address (or treasury if not set)
       |
       +---> Miner (80%)    --> previous slot miner
```

## UPS Halving Schedule

```
Units Per Second (UPS) decreases as more tokens are minted:

totalMinted     |  UPS (example with initialUps=100, halvingAmount=1000)
----------------|----------------------------------------------------------
0 - 999         |  100 (full rate)
1000 - 1499     |  50  (1st halving)
1500 - 1749     |  25  (2nd halving)
1750 - 1874     |  12  (3rd halving)
...             |  ... (continues halving)
> threshold     |  tailUps (minimum floor)

Halving Thresholds (geometric series):
  T[0] = H
  T[1] = H + H/2
  T[2] = H + H/2 + H/4
  T[n] = H * (2 - 1/2^n) --> approaches 2*H
```

## Treasury Auction Flow

```
    +------------------+
    | USDC accumulates |
    | in Auction from  |
    | treasury fees    |
    +--------+---------+
             |
             v
    +--------+---------+
    |  Dutch Auction   |
    |  (price decays)  |
    +--------+---------+
             |
             v
    +--------+---------+
    |  Buyer pays LP   |
    |  tokens to buy   |
    |  accumulated     |
    |  USDC            |
    +--------+---------+
             |
             v
    +--------+---------+
    |  LP tokens sent  |
    |  to dead address |
    |  (burned)        |
    +------------------+
```

## Entropy (Randomness) Flow

```
    +------------------+
    | Miner calls      |
    | mine() with ETH  |
    +--------+---------+
             |
             v
    +--------+---------+
    | Request random   |
    | from Pyth        |
    | Entropy          |
    +--------+---------+
             |
             | (async callback)
             v
    +--------+---------+
    | entropyCallback  |
    | receives random  |
    +--------+---------+
             |
             v
    +--------+---------+
    | Draw UPS         |
    | multiplier       |
    | (1x - 10x)       |
    +------------------+
```

## Key Invariants

1. **Unit minting**: Only the Rig can mint Unit tokens (after `setRig`)
2. **Ownership**: Two-step transfer via Ownable2Step
3. **Capacity**: Can only increase, never decrease
4. **UPS floor**: Never drops below `tailUps`
5. **Price bounds**: Dutch auction prices bounded by `minInitPrice` and `ABS_MAX_INIT_PRICE`

## Contract Addresses (Deployed)

| Contract | Address | Network |
|----------|---------|---------|
| Core | TBD | Base |
| RigFactory | TBD | Base |
| AuctionFactory | TBD | Base |
| UnitFactory | TBD | Base |
| Multicall | TBD | Base |
