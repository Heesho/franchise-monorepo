# Trail of Bits Security Audit Report
## Mineport Protocol

**Audit Date:** January 14, 2026
**Auditor:** Claude Code (using Trail of Bits methodologies)
**Solidity Version:** 0.8.19

---

## Executive Summary

This comprehensive security audit applies Trail of Bits security assessment methodologies to the Mineport Protocol, a decentralized mining launchpad system. The protocol consists of 8 main contracts implementing Dutch auctions for slot acquisition, token minting based on mining duration, and LP token management.

### Risk Summary (Post-Remediation)

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 1 | **FIXED** |
| High | 3 | 1 Downgraded, 2 Accepted |
| Medium | 5 | Acknowledged |
| Low | 6 | Acknowledged |
| Informational | 4 | Acknowledged |

---

## 1. Critical Findings

### CRITICAL-01: ETH Refund Failure Can Lock User Funds [FIXED]

**Location:** `Rig.sol:312-331`, `Multicall.sol:138-143, 198-203`

**Description:** The `mine()` function used low-level `.call{value: ...}("")` for ETH refunds. If the recipient is a contract that rejects ETH or runs out of gas, the refund fails and reverts the entire transaction.

**Impact:** A contract wallet without ETH receiving capability would be blocked from mining.

**Resolution:** Removed all ETH refund logic. Contracts now require exact ETH amounts:
- `Rig.sol`: Added `Rig__NoEntropyRequired()` error, reverts if ETH sent when not needed
- `Multicall.sol`: Added `Multicall__ExcessETH()` error, reverts if excess ETH sent

**Status:** ✅ FIXED

---

## 2. High Severity Findings

### HIGH-01: Entropy Callback Manipulation [DOWNGRADED TO INFORMATIONAL]

**Location:** `Rig.sol:337-353`

**Original Concern:** Miners could re-mine slots before entropy callback arrives to avoid unfavorable multipliers.

**Analysis:** Upon review, this is not exploitable because:
- UPS multipliers are bounded between 1x and 10x (bonuses only)
- Default multiplier is 1x
- Avoiding the callback means **missing potential bonuses**, not avoiding penalties
- Re-mining requires paying mining costs again

**Status:** ⚪ DOWNGRADED - Not a vulnerability

---

### HIGH-02: Fee Rounding to Zero at Low Prices [ACCEPTED]

**Location:** `Rig.sol:256-259`

**Description:** When `price < 7` (0.000007 USDC), all fees round to 0 and the previous miner receives 100%.

**Analysis:** This only occurs at:
- The very end of Dutch auction epochs
- Price values representing fractions of a cent
- Economically insignificant amounts

**Status:** ⚪ ACCEPTED - Economic impact negligible

---

### HIGH-03: UPS Dilution on Capacity Increase [ACCEPTED - BY DESIGN]

**Location:** `Rig.sol:299, 432-437`

**Description:** When capacity increases, existing slots retain their old (higher) UPS while new slots get diluted UPS.

**Analysis:** This is intentional behavior:
- Early miners lock in their UPS rate as a first-mover advantage
- Recalculating existing miners' UPS would "rug" them by reducing earned rewards
- Owner can only increase capacity (not decrease), preventing manipulation

**Status:** ⚪ ACCEPTED - Intended design

---

## 3. Medium Severity Findings

### MEDIUM-01: Unchecked External Calls to Pyth Entropy

**Location:** `Rig.sol:314-319`

**Description:** External calls to `IEntropyV2(entropy)` could fail if Pyth becomes unavailable.

**Recommendation:** Consider adding try-catch or fallback to deterministic behavior.

**Status:** ⚪ ACKNOWLEDGED

---

### MEDIUM-02: LP Token Burn to Dead Address

**Location:** `Core.sol:243`

**Description:** LP tokens burned by sending to `0x...dEaD` still exist in total supply.

**Status:** ⚪ ACKNOWLEDGED - Common pattern

---

### MEDIUM-03: Slot URI Not Validated

**Location:** `Rig.sol:300`

**Description:** URI parameter stored without length limits.

**Recommendation:** Consider adding maximum length.

**Status:** ⚪ ACKNOWLEDGED

---

### MEDIUM-04: Empty Auction Buy Possible

**Location:** `Auction.sol:137-139`

**Description:** Buyers can purchase auctions with zero-balance assets.

**Status:** ⚪ ACKNOWLEDGED

---

### MEDIUM-05: Multicall Price Race Condition

**Location:** `Multicall.sol:128-138`

**Description:** Price read before transfer could differ from actual price at mine time. Contract refunds unused USDC.

**Status:** ⚪ ACKNOWLEDGED - Mitigated by refund mechanism

---

## 4. Low Severity Findings

| ID | Description | Status |
|----|-------------|--------|
| LOW-01 | Centralization risk in Rig ownership | Acknowledged |
| LOW-02 | Protocol fee address can be set to zero | Acknowledged |
| LOW-03 | Single-step ownership transfer (no Ownable2Step) | Acknowledged |
| LOW-04 | Missing event for inline UPS multiplier reset | Acknowledged |
| LOW-05 | Inconsistent error naming convention | Acknowledged |
| LOW-06 | Unused return values in Core.launch() | Acknowledged |

---

## 5. Informational Findings

| ID | Description |
|----|-------------|
| INFO-01 | Gas optimization opportunities in loops |
| INFO-02 | Documentation improvements needed for halving formula |
| INFO-03 | Consider OpenZeppelin 5.x upgrade |
| INFO-04 | Architecture diagrams recommended |

---

## 6. Positive Security Observations

1. ✅ Proper use of `ReentrancyGuard` on all state-changing functions
2. ✅ `SafeERC20` used throughout for token transfers
3. ✅ Appropriate use of `immutable` for deployment-time constants
4. ✅ Comprehensive parameter validation in constructors
5. ✅ Good separation of concerns between contracts
6. ✅ CEI pattern followed in most places
7. ✅ Solidity 0.8.19 with native overflow protection

---

## 7. Conclusion

After remediation, the Mineport Protocol demonstrates solid security practices. The critical ETH refund vulnerability has been fixed by removing refund logic entirely and requiring exact ETH amounts.

The high-severity findings were either:
- Downgraded upon deeper analysis (entropy callback)
- Accepted as economically insignificant (fee rounding)
- Confirmed as intended design (UPS dilution)

**Final Risk Assessment:** LOW-MEDIUM

The protocol is suitable for deployment with the understanding that the acknowledged findings represent acceptable trade-offs rather than vulnerabilities.

---

## Appendix: Changes Made

| File | Change |
|------|--------|
| `Rig.sol:122` | Replaced `Rig__RefundFailed` with `Rig__NoEntropyRequired` |
| `Rig.sol:312-323` | Removed ETH refund, added revert for unnecessary ETH |
| `Multicall.sol:27` | Added `Multicall__ExcessETH` error |
| `Multicall.sol:137` | Added excess ETH check in `mine()` |
| `Multicall.sol:172` | Added excess ETH check in `mineMultiple()` |
| `Multicall.sol:193-203` | Removed refund block |

---

*This audit was performed using Trail of Bits security methodologies including static analysis, entry point analysis, variant analysis for known vulnerabilities, and property-based testing recommendations.*
