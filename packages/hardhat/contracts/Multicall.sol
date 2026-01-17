// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRig} from "./interfaces/IRig.sol";
import {IAuction} from "./interfaces/IAuction.sol";
import {ICore} from "./interfaces/ICore.sol";

/**
 * @title Multicall
 * @author heesho
 * @notice Helper contract for batched operations and aggregated view functions.
 * @dev Provides multi-slot mining with entropy fee handling,
 *      and comprehensive state queries for Rigs and Auctions.
 *      Quote token is read from each rig - users must approve this contract for the rig's quote token.
 *      ETH is only needed for entropy fees when randomness is enabled.
 */
contract Multicall {
    using SafeERC20 for IERC20;

    /*----------  ERRORS  -----------------------------------------------*/

    error Multicall__ZeroAddress();
    error Multicall__InvalidRig();
    error Multicall__ArrayLengthMismatch();
    error Multicall__InsufficientETH();
    error Multicall__ExcessETH();

    /*----------  IMMUTABLES  -------------------------------------------*/

    address public immutable core;  // Core contract reference
    address public immutable donut; // DONUT token address

    /*----------  STRUCTS  ----------------------------------------------*/

    /**
     * @notice Aggregated state for a Rig slot.
     */
    struct RigState {
        // Slot-specific state
        uint256 epochId;           // current epoch
        uint256 initPrice;         // epoch starting price
        uint256 epochStartTime;    // epoch start timestamp
        uint256 glazed;            // tokens earned so far this epoch
        uint256 price;             // current Dutch auction price
        uint256 ups;               // stored units per second for this slot
        uint256 upsMultiplier;     // multiplier for this slot
        address miner;             // current miner
        string slotUri;            // metadata URI for this slot
        bool needsEntropy;         // whether this slot needs entropy update
        uint256 entropyFee;        // current entropy fee if randomness enabled
        // Global rig state
        uint256 nextUps;           // calculated current ups (global)
        uint256 unitPrice;         // Unit token price in DONUT
        string rigUri;             // metadata URI for the rig (global)
        uint256 capacity;          // total number of slots
        // User balances
        uint256 accountQuoteBalance;   // user's quote token balance
        uint256 accountDonutBalance;   // user's DONUT balance
        uint256 accountUnitBalance;    // user's Unit balance
        uint256 accountClaimable;      // user's claimable miner fees
    }

    /**
     * @notice Aggregated state for an Auction contract.
     */
    struct AuctionState {
        // Auction state
        uint256 epochId;                    // current epoch
        uint256 initPrice;                  // epoch starting price
        uint256 startTime;                  // epoch start timestamp
        address paymentToken;               // LP token used for payment (Unit-DONUT LP)
        uint256 price;                      // current Dutch auction price (in LP tokens)
        uint256 paymentTokenPrice;          // LP token price in DONUT
        uint256 quoteAccumulated;           // Quote token held by auction (from treasury fees)
        // User balances
        uint256 accountQuoteBalance;        // user's quote token balance
        uint256 accountPaymentTokenBalance; // user's LP balance
    }

    /**
     * @notice Parameters for a single slot mining operation.
     */
    struct MineParams {
        uint256 index;      // Slot index to mine
        uint256 epochId;    // Expected epoch ID
        uint256 maxPrice;   // Maximum price willing to pay
        string slotUri;     // Metadata URI for this mining action
    }

    /*----------  CONSTRUCTOR  ------------------------------------------*/

    /**
     * @notice Deploy the Multicall helper contract.
     * @param _core Core contract address
     * @param _donut DONUT token address
     */
    constructor(address _core, address _donut) {
        if (_core == address(0) || _donut == address(0)) revert Multicall__ZeroAddress();
        core = _core;
        donut = _donut;
    }

    /*----------  EXTERNAL FUNCTIONS  -----------------------------------*/

    /**
     * @notice Mine a single rig slot using the rig's quote token.
     * @dev User must approve the rig's quote token to this contract. ETH only needed for entropy fee.
     *      Sends ETH for entropy if randomness enabled and multiplier duration expired.
     *      Auto-claims for the previous miner (best effort - won't revert if claim fails).
     * @param rig Rig contract address
     * @param index Slot index to mine (0 for single-slot rigs)
     * @param epochId Expected epoch ID
     * @param deadline Transaction deadline
     * @param maxPrice Maximum quote token price willing to pay
     * @param slotUri Metadata URI for this mining action
     */
    function mine(
        address rig,
        uint256 index,
        uint256 epochId,
        uint256 deadline,
        uint256 maxPrice,
        string calldata slotUri
    ) external payable {
        if (!ICore(core).isDeployedRig(rig)) revert Multicall__InvalidRig();

        // Calculate entropy fee if needed
        uint256 entropyFee = _calculateEntropyFee(rig, index);
        if (msg.value < entropyFee) revert Multicall__InsufficientETH();

        // Get previous miner for auto-claim after mining
        address prevMiner = IRig(rig).getSlot(index).miner;

        // Get quote token and current price
        address quoteToken = IRig(rig).quote();
        uint256 price = IRig(rig).getPrice(index);
        if (price > 0) {
            IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), price);
            IERC20(quoteToken).safeApprove(rig, 0);
            IERC20(quoteToken).safeApprove(rig, price);
        }

        // Mine with entropy fee forwarded
        if (msg.value > entropyFee) revert Multicall__ExcessETH();
        IRig(rig).mine{value: entropyFee}(msg.sender, index, epochId, deadline, maxPrice, slotUri);

        // Auto-claim for previous miner (if they have claimable funds)
        if (prevMiner != address(0) && IRig(rig).accountToClaimable(prevMiner) > 0) {
            IRig(rig).claim(prevMiner);
        }

        // Refund any unused quote tokens (in case price changed)
        uint256 quoteBalance = IERC20(quoteToken).balanceOf(address(this));
        if (quoteBalance > 0) {
            IERC20(quoteToken).safeTransfer(msg.sender, quoteBalance);
        }
    }

    /**
     * @notice Mine multiple rig slots in a single transaction.
     * @dev All slots must be on the same rig. User must approve total quote token needed.
     *      ETH only needed for entropy fees on slots that need randomness update.
     *      Auto-claims for previous miners (best effort - won't revert if claims fail).
     * @param rig Rig contract address
     * @param params Array of mining parameters for each slot
     * @param deadline Transaction deadline (applies to all)
     */
    function mineMultiple(
        address rig,
        MineParams[] calldata params,
        uint256 deadline
    ) external payable {
        if (!ICore(core).isDeployedRig(rig)) revert Multicall__InvalidRig();
        uint256 length = params.length;
        if (length == 0) revert Multicall__ArrayLengthMismatch();

        // Get quote token from rig
        address quoteToken = IRig(rig).quote();

        // Collect previous miners and calculate totals
        address[] memory prevMiners = new address[](length);
        uint256 totalEntropyFee = 0;
        uint256 totalQuoteNeeded = 0;
        for (uint256 i = 0; i < length;) {
            prevMiners[i] = IRig(rig).getSlot(params[i].index).miner;
            totalEntropyFee += _calculateEntropyFee(rig, params[i].index);
            totalQuoteNeeded += IRig(rig).getPrice(params[i].index);
            unchecked { ++i; }
        }

        if (msg.value < totalEntropyFee) revert Multicall__InsufficientETH();
        if (msg.value > totalEntropyFee) revert Multicall__ExcessETH();

        // Transfer total quote tokens from user upfront
        if (totalQuoteNeeded > 0) {
            IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), totalQuoteNeeded);
            IERC20(quoteToken).safeApprove(rig, 0);
            IERC20(quoteToken).safeApprove(rig, totalQuoteNeeded);
        }

        // Mine each slot
        for (uint256 i = 0; i < length;) {
            uint256 slotEntropyFee = _calculateEntropyFee(rig, params[i].index);
            IRig(rig).mine{value: slotEntropyFee}(
                msg.sender,
                params[i].index,
                params[i].epochId,
                deadline,
                params[i].maxPrice,
                params[i].slotUri
            );
            unchecked { ++i; }
        }

        // Auto-claim for previous miners (if they have claimable funds)
        for (uint256 i = 0; i < length;) {
            if (prevMiners[i] != address(0) && IRig(rig).accountToClaimable(prevMiners[i]) > 0) {
                IRig(rig).claim(prevMiners[i]);
            }
            unchecked { ++i; }
        }

        // Refund any unused quote tokens (in case prices changed)
        uint256 quoteBalance = IERC20(quoteToken).balanceOf(address(this));
        if (quoteBalance > 0) {
            IERC20(quoteToken).safeTransfer(msg.sender, quoteBalance);
        }
    }

    /**
     * @notice Buy from an auction using LP tokens.
     * @dev Transfers LP tokens from caller, approves auction, and executes buy.
     * @param rig Rig contract address (used to look up auction)
     * @param epochId Expected epoch ID
     * @param deadline Transaction deadline
     * @param maxPaymentTokenAmount Maximum LP tokens willing to pay
     */
    function buy(address rig, uint256 epochId, uint256 deadline, uint256 maxPaymentTokenAmount) external {
        if (!ICore(core).isDeployedRig(rig)) revert Multicall__InvalidRig();
        address auction = ICore(core).rigToAuction(rig);
        address paymentToken = IAuction(auction).paymentToken();
        uint256 price = IAuction(auction).getPrice();
        address[] memory assets = new address[](1);
        assets[0] = IRig(rig).quote();

        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), price);
        IERC20(paymentToken).safeApprove(auction, 0);
        IERC20(paymentToken).safeApprove(auction, price);
        IAuction(auction).buy(assets, msg.sender, epochId, deadline, maxPaymentTokenAmount);
    }

    /**
     * @notice Launch a new rig via Core.
     * @dev Transfers DONUT from caller, approves Core, and calls launch with caller as launcher.
     * @param params Launch parameters (launcher field is overwritten with msg.sender)
     * @return unit Address of deployed Unit token
     * @return rig Address of deployed Rig contract
     * @return auction Address of deployed Auction contract
     * @return lpToken Address of Unit/DONUT LP token
     */
    function launch(ICore.LaunchParams calldata params)
        external
        returns (address unit, address rig, address auction, address lpToken)
    {
        // Transfer DONUT from user
        IERC20(donut).safeTransferFrom(msg.sender, address(this), params.donutAmount);
        IERC20(donut).safeApprove(core, 0);
        IERC20(donut).safeApprove(core, params.donutAmount);

        // Build params with msg.sender as launcher
        ICore.LaunchParams memory launchParams = ICore.LaunchParams({
            launcher: msg.sender,
            quoteToken: params.quoteToken,
            tokenName: params.tokenName,
            tokenSymbol: params.tokenSymbol,
            uri: params.uri,
            donutAmount: params.donutAmount,
            unitAmount: params.unitAmount,
            initialUps: params.initialUps,
            tailUps: params.tailUps,
            halvingAmount: params.halvingAmount,
            rigEpochPeriod: params.rigEpochPeriod,
            rigPriceMultiplier: params.rigPriceMultiplier,
            rigMinInitPrice: params.rigMinInitPrice,
            auctionInitPrice: params.auctionInitPrice,
            auctionEpochPeriod: params.auctionEpochPeriod,
            auctionPriceMultiplier: params.auctionPriceMultiplier,
            auctionMinInitPrice: params.auctionMinInitPrice
        });

        return ICore(core).launch(launchParams);
    }

    /*----------  INTERNAL FUNCTIONS  -----------------------------------*/

    /**
     * @notice Calculate entropy fee for a slot if randomness is enabled and multiplier needs update.
     * @param rig Rig contract address
     * @param index Slot index
     * @return fee Entropy fee to send (0 if not needed)
     */
    function _calculateEntropyFee(address rig, uint256 index) internal view returns (uint256 fee) {
        if (!IRig(rig).isRandomnessEnabled()) {
            return 0;
        }

        IRig.Slot memory slot = IRig(rig).getSlot(index);
        uint256 duration = IRig(rig).upsMultiplierDuration();
        bool needsUpdate = block.timestamp - slot.lastUpsMultiplierTime > duration;

        if (needsUpdate) {
            return IRig(rig).getEntropyFee();
        }

        return 0;
    }

    /*----------  VIEW FUNCTIONS  ---------------------------------------*/

    /**
     * @notice Get aggregated state for a Rig slot and user balances.
     * @param rig Rig contract address
     * @param index Slot index to query (0 for single-slot rigs)
     * @param account User address (or address(0) to skip balance queries)
     * @return state Aggregated rig state
     */
    function getRig(address rig, uint256 index, address account) external view returns (RigState memory state) {
        IRig.Slot memory slot = IRig(rig).getSlot(index);

        state.epochId = slot.epochId;
        state.initPrice = slot.initPrice;
        state.epochStartTime = slot.startTime;
        state.ups = slot.ups;
        state.upsMultiplier = slot.upsMultiplier;
        state.glazed = slot.ups * slot.upsMultiplier * (block.timestamp - slot.startTime) / 1e18;
        state.price = IRig(rig).getPrice(index);
        state.nextUps = IRig(rig).getUps();
        state.miner = slot.miner;
        state.slotUri = slot.uri;
        state.rigUri = IRig(rig).uri();
        state.capacity = IRig(rig).capacity();

        // Entropy state
        if (IRig(rig).isRandomnessEnabled()) {
            uint256 duration = IRig(rig).upsMultiplierDuration();
            state.needsEntropy = block.timestamp - slot.lastUpsMultiplierTime > duration;
            state.entropyFee = state.needsEntropy ? IRig(rig).getEntropyFee() : 0;
        }

        address unitToken = IRig(rig).unit();
        address auction = ICore(core).rigToAuction(rig);

        // Calculate Unit price in DONUT from LP reserves
        if (auction != address(0)) {
            address lpToken = IAuction(auction).paymentToken();
            uint256 donutInLP = IERC20(donut).balanceOf(lpToken);
            uint256 unitInLP = IERC20(unitToken).balanceOf(lpToken);
            state.unitPrice = unitInLP == 0 ? 0 : donutInLP * 1e18 / unitInLP;
        }

        // User balances
        address quoteToken = IRig(rig).quote();
        state.accountQuoteBalance = account == address(0) ? 0 : IERC20(quoteToken).balanceOf(account);
        state.accountDonutBalance = account == address(0) ? 0 : IERC20(donut).balanceOf(account);
        state.accountUnitBalance = account == address(0) ? 0 : IERC20(unitToken).balanceOf(account);
        state.accountClaimable = account == address(0) ? 0 : IRig(rig).accountToClaimable(account);

        return state;
    }

    /**
     * @notice Get multiple slots' state in a single call.
     * @param rig Rig contract address
     * @param indices Array of slot indices to query
     * @param account User address (or address(0) to skip balance queries)
     * @return states Array of aggregated rig states
     */
    function getRigMultiple(
        address rig,
        uint256[] calldata indices,
        address account
    ) external view returns (RigState[] memory states) {
        uint256 length = indices.length;
        states = new RigState[](length);
        for (uint256 i = 0; i < length;) {
            states[i] = this.getRig(rig, indices[i], account);
            unchecked { ++i; }
        }
        return states;
    }

    /**
     * @notice Get aggregated state for an Auction and user balances.
     * @param rig Rig contract address (used to look up auction)
     * @param account User address (or address(0) to skip balance queries)
     * @return state Aggregated auction state
     */
    function getAuction(address rig, address account) external view returns (AuctionState memory state) {
        address auction = ICore(core).rigToAuction(rig);

        state.epochId = IAuction(auction).epochId();
        state.initPrice = IAuction(auction).initPrice();
        state.startTime = IAuction(auction).startTime();
        state.paymentToken = IAuction(auction).paymentToken();
        state.price = IAuction(auction).getPrice();

        // LP price in DONUT = (DONUT in LP * 2) / LP total supply
        uint256 lpTotalSupply = IERC20(state.paymentToken).totalSupply();
        state.paymentTokenPrice =
            lpTotalSupply == 0 ? 0 : IERC20(donut).balanceOf(state.paymentToken) * 2e18 / lpTotalSupply;

        address quoteToken = IRig(rig).quote();
        state.quoteAccumulated = IERC20(quoteToken).balanceOf(auction);
        state.accountQuoteBalance = account == address(0) ? 0 : IERC20(quoteToken).balanceOf(account);
        state.accountPaymentTokenBalance = account == address(0) ? 0 : IERC20(state.paymentToken).balanceOf(account);

        return state;
    }

    /**
     * @notice Calculate total costs to mine multiple slots.
     * @dev Includes entropy fees for slots that need randomness update.
     * @param rig Rig contract address
     * @param indices Array of slot indices
     * @return totalEntropyFee Total ETH needed for entropy fees
     * @return totalQuoteNeeded Total quote token needed for slot prices
     */
    function estimateMineMultipleCost(
        address rig,
        uint256[] calldata indices
    ) external view returns (uint256 totalEntropyFee, uint256 totalQuoteNeeded) {
        uint256 length = indices.length;
        for (uint256 i = 0; i < length;) {
            totalEntropyFee += _calculateEntropyFee(rig, indices[i]);
            totalQuoteNeeded += IRig(rig).getPrice(indices[i]);
            unchecked { ++i; }
        }
        return (totalEntropyFee, totalQuoteNeeded);
    }
}
