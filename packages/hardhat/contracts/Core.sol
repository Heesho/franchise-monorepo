// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IRig} from "./interfaces/IRig.sol";
import {IUnit} from "./interfaces/IUnit.sol";
import {IUnitFactory} from "./interfaces/IUnitFactory.sol";
import {IRigFactory} from "./interfaces/IRigFactory.sol";
import {IAuctionFactory} from "./interfaces/IAuctionFactory.sol";
import {IUniswapV2Factory, IUniswapV2Router} from "./interfaces/IUniswapV2.sol";

/**
 * @title Core
 * @author heesho
 * @notice The main launchpad contract for deploying new Rig and Auction pairs.
 *         Users provide DONUT tokens to launch a new mining rig. The Core contract:
 *         1. Deploys a new Unit token via UnitFactory
 *         2. Mints initial Unit tokens for liquidity
 *         3. Creates a Unit/DONUT liquidity pool on Uniswap V2
 *         4. Burns the initial LP tokens
 *         5. Deploys an Auction contract to collect and auction treasury fees
 *         6. Deploys a new Rig contract via RigFactory
 *         7. Transfers Unit minting rights to the Rig (permanently locked)
 *         8. Transfers ownership of the Rig to the launcher
 */
contract Core is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*----------  CONSTANTS  --------------------------------------------*/

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Rig parameter bounds (mirrored from Rig.sol for early validation)
    uint256 public constant RIG_MIN_EPOCH_PERIOD = 10 minutes;
    uint256 public constant RIG_MAX_EPOCH_PERIOD = 365 days;
    uint256 public constant RIG_MIN_PRICE_MULTIPLIER = 1.1e18;
    uint256 public constant RIG_MAX_PRICE_MULTIPLIER = 3e18;
    uint256 public constant RIG_ABS_MIN_INIT_PRICE = 1e6;
    uint256 public constant RIG_ABS_MAX_INIT_PRICE = type(uint192).max;
    uint256 public constant RIG_MAX_INITIAL_UPS = 1e24;
    uint256 public constant RIG_MIN_HALVING_AMOUNT = 1000 ether;

    // Auction parameter bounds (mirrored from Auction.sol for early validation)
    uint256 public constant AUCTION_MIN_EPOCH_PERIOD = 1 hours;
    uint256 public constant AUCTION_MAX_EPOCH_PERIOD = 365 days;
    uint256 public constant AUCTION_MIN_PRICE_MULTIPLIER = 1.1e18;
    uint256 public constant AUCTION_MAX_PRICE_MULTIPLIER = 3e18;
    uint256 public constant AUCTION_ABS_MIN_INIT_PRICE = 1e6;
    uint256 public constant AUCTION_ABS_MAX_INIT_PRICE = type(uint192).max;

    /*----------  IMMUTABLES  -------------------------------------------*/

    address public immutable donutToken; // token required to launch
    address public immutable uniswapV2Factory; // Uniswap V2 factory
    address public immutable uniswapV2Router; // Uniswap V2 router
    address public immutable unitFactory; // factory for deploying Unit tokens
    address public immutable rigFactory; // factory for deploying Rigs
    address public immutable auctionFactory; // factory for deploying Auctions
    address public immutable entropy; // Pyth Entropy contract for randomness

    /*----------  STATE  ------------------------------------------------*/

    address public protocolFeeAddress; // receives protocol fees from rigs
    uint256 public minDonutForLaunch; // minimum DONUT required to launch

    address[] public deployedRigs; // array of all deployed rigs
    mapping(address => bool) public isDeployedRig; // rig => is valid
    mapping(address => address) public rigToLauncher; // rig => launcher address
    mapping(address => address) public rigToUnit; // rig => Unit token
    mapping(address => address) public rigToAuction; // rig => Auction contract
    mapping(address => address) public rigToLP; // rig => LP token
    mapping(address => address) public rigToQuote; // rig => quote token (payment token)

    /*----------  STRUCTS  ----------------------------------------------*/

    /**
     * @notice Parameters for launching a new Rig.
     * @dev quoteToken must be a standard ERC20 (no rebasing or fee-on-transfer tokens)
     */
    struct LaunchParams {
        address launcher; // address to receive Rig ownership, team fees, and initial miner
        address quoteToken; // ERC20 payment token for mining (e.g., USDC, WETH)
        string tokenName; // Unit token name
        string tokenSymbol; // Unit token symbol
        string uri; // metadata URI for the unit token
        uint256 donutAmount; // DONUT to provide for LP
        uint256 unitAmount; // Unit tokens minted for initial LP
        uint256 initialUps; // starting units per second
        uint256 tailUps; // minimum units per second
        uint256 halvingAmount; // token supply threshold for halving
        uint256 rigEpochPeriod; // rig auction epoch duration
        uint256 rigPriceMultiplier; // rig price multiplier
        uint256 rigMinInitPrice; // rig minimum starting price
        uint256 auctionInitPrice; // auction starting price
        uint256 auctionEpochPeriod; // auction epoch duration
        uint256 auctionPriceMultiplier; // auction price multiplier
        uint256 auctionMinInitPrice; // auction minimum starting price
    }

    /*----------  ERRORS  -----------------------------------------------*/

    error Core__InsufficientDonut();
    error Core__ZeroLauncher();
    error Core__ZeroQuoteToken();
    error Core__EmptyTokenName();
    error Core__EmptyTokenSymbol();
    error Core__ZeroUnitAmount();
    error Core__ZeroAddress();
    // Rig parameter errors
    error Core__RigEpochPeriodOutOfRange();
    error Core__RigPriceMultiplierOutOfRange();
    error Core__RigMinInitPriceOutOfRange();
    error Core__RigInitialUpsOutOfRange();
    error Core__RigTailUpsOutOfRange();
    error Core__RigHalvingAmountOutOfRange();
    // Auction parameter errors
    error Core__AuctionEpochPeriodOutOfRange();
    error Core__AuctionPriceMultiplierOutOfRange();
    error Core__AuctionInitPriceOutOfRange();
    error Core__AuctionMinInitPriceOutOfRange();

    /*----------  EVENTS  -----------------------------------------------*/

    event Core__Launched(
        address launcher,
        address quoteToken,
        address unit,
        address rig,
        address auction,
        address lpToken,
        string tokenName,
        string tokenSymbol,
        string uri,
        uint256 donutAmount,
        uint256 unitAmount,
        uint256 initialUps,
        uint256 tailUps,
        uint256 halvingAmount,
        uint256 rigEpochPeriod,
        uint256 rigPriceMultiplier,
        uint256 rigMinInitPrice,
        uint256 auctionInitPrice,
        uint256 auctionEpochPeriod,
        uint256 auctionPriceMultiplier,
        uint256 auctionMinInitPrice
    );
    event Core__ProtocolFeeAddressSet(address protocolFeeAddress);
    event Core__MinDonutForLaunchSet(uint256 minDonutForLaunch);

    /*----------  CONSTRUCTOR  ------------------------------------------*/

    /**
     * @notice Deploy the Core launchpad contract.
     * @param _donutToken DONUT token address
     * @param _uniswapV2Factory Uniswap V2 factory address
     * @param _uniswapV2Router Uniswap V2 router address
     * @param _unitFactory UnitFactory contract address
     * @param _rigFactory RigFactory contract address
     * @param _auctionFactory AuctionFactory contract address
     * @param _entropy Pyth Entropy contract address
     * @param _protocolFeeAddress Address to receive protocol fees
     * @param _minDonutForLaunch Minimum DONUT required to launch
     */
    constructor(
        address _donutToken,
        address _uniswapV2Factory,
        address _uniswapV2Router,
        address _unitFactory,
        address _rigFactory,
        address _auctionFactory,
        address _entropy,
        address _protocolFeeAddress,
        uint256 _minDonutForLaunch
    ) {
        if (
            _donutToken == address(0) || _uniswapV2Factory == address(0)
                || _uniswapV2Router == address(0) || _unitFactory == address(0) || _rigFactory == address(0)
                || _auctionFactory == address(0) || _entropy == address(0)
        ) {
            revert Core__ZeroAddress();
        }

        donutToken = _donutToken;
        uniswapV2Factory = _uniswapV2Factory;
        uniswapV2Router = _uniswapV2Router;
        unitFactory = _unitFactory;
        rigFactory = _rigFactory;
        auctionFactory = _auctionFactory;
        entropy = _entropy;
        protocolFeeAddress = _protocolFeeAddress;
        minDonutForLaunch = _minDonutForLaunch;
    }

    /*----------  EXTERNAL FUNCTIONS  -----------------------------------*/

    /**
     * @notice Launch a new Rig with associated Unit token, LP, and Auction.
     * @dev Caller must approve DONUT tokens before calling.
     * @param params Launch parameters struct
     * @return unit Address of deployed Unit token
     * @return rig Address of deployed Rig contract
     * @return auction Address of deployed Auction contract
     * @return lpToken Address of Unit/DONUT LP token
     */
    function launch(LaunchParams calldata params)
        external
        nonReentrant
        returns (address unit, address rig, address auction, address lpToken)
    {
        // Validate ALL inputs upfront (fail fast before any state changes)
        _validateLaunchParams(params);

        // Transfer DONUT from launcher
        IERC20(donutToken).safeTransferFrom(msg.sender, address(this), params.donutAmount);

        // Deploy Unit token via factory (Core becomes initial rig/minter)
        unit = IUnitFactory(unitFactory).deploy(params.tokenName, params.tokenSymbol);

        // Mint initial Unit tokens for LP seeding
        IUnit(unit).mint(address(this), params.unitAmount);

        // Create Unit/DONUT LP via Uniswap V2
        IERC20(unit).safeApprove(uniswapV2Router, 0);
        IERC20(unit).safeApprove(uniswapV2Router, params.unitAmount);
        IERC20(donutToken).safeApprove(uniswapV2Router, 0);
        IERC20(donutToken).safeApprove(uniswapV2Router, params.donutAmount);

        (,, uint256 liquidity) = IUniswapV2Router(uniswapV2Router).addLiquidity(
            unit,
            donutToken,
            params.unitAmount,
            params.donutAmount,
            params.unitAmount,
            params.donutAmount,
            address(this),
            block.timestamp + 20 minutes
        );

        // Get LP token address and burn initial liquidity
        lpToken = IUniswapV2Factory(uniswapV2Factory).getPair(unit, donutToken);
        IERC20(lpToken).safeTransfer(DEAD_ADDRESS, liquidity);

        // Deploy Auction with LP as payment token
        auction = IAuctionFactory(auctionFactory).deploy(
            params.auctionInitPrice,
            lpToken,
            DEAD_ADDRESS,
            params.auctionEpochPeriod,
            params.auctionPriceMultiplier,
            params.auctionMinInitPrice
        );

        // Deploy Rig via factory
        // Treasury is the Auction contract (receives 15% of mining fees)
        rig = IRigFactory(rigFactory).deploy(
            unit,
            params.quoteToken,
            entropy,
            protocolFeeAddress,
            auction,
            params.rigEpochPeriod,
            params.rigPriceMultiplier,
            params.rigMinInitPrice,
            params.initialUps,
            params.halvingAmount,
            params.tailUps
        );

        // Transfer Unit minting rights to Rig (permanently locked since Rig has no setRig function)
        IUnit(unit).setRig(rig);

        // Set initial URI for the rig (logo, description, links, etc.)
        if (bytes(params.uri).length > 0) {
            IRig(rig).setUri(params.uri);
        }

        // Transfer Rig ownership to launcher
        IRig(rig).transferOwnership(params.launcher);

        // Update registry
        deployedRigs.push(rig);
        isDeployedRig[rig] = true;
        rigToLauncher[rig] = params.launcher;
        rigToUnit[rig] = unit;
        rigToAuction[rig] = auction;
        rigToLP[rig] = lpToken;
        rigToQuote[rig] = params.quoteToken;

        emit Core__Launched(
            params.launcher,
            params.quoteToken,
            unit,
            rig,
            auction,
            lpToken,
            params.tokenName,
            params.tokenSymbol,
            params.uri,
            params.donutAmount,
            params.unitAmount,
            params.initialUps,
            params.tailUps,
            params.halvingAmount,
            params.rigEpochPeriod,
            params.rigPriceMultiplier,
            params.rigMinInitPrice,
            params.auctionInitPrice,
            params.auctionEpochPeriod,
            params.auctionPriceMultiplier,
            params.auctionMinInitPrice
        );

        return (unit, rig, auction, lpToken);
    }

    /*----------  RESTRICTED FUNCTIONS  ---------------------------------*/

    /**
     * @notice Update the protocol fee recipient address.
     * @dev Can be set to address(0) to disable protocol fees.
     * @param _protocolFeeAddress New protocol fee address
     */
    function setProtocolFeeAddress(address _protocolFeeAddress) external onlyOwner {
        protocolFeeAddress = _protocolFeeAddress;
        emit Core__ProtocolFeeAddressSet(_protocolFeeAddress);
    }

    /**
     * @notice Update the minimum DONUT required to launch.
     * @param _minDonutForLaunch New minimum amount
     */
    function setMinDonutForLaunch(uint256 _minDonutForLaunch) external onlyOwner {
        minDonutForLaunch = _minDonutForLaunch;
        emit Core__MinDonutForLaunchSet(_minDonutForLaunch);
    }

    /*----------  INTERNAL FUNCTIONS  -----------------------------------*/

    /**
     * @notice Validate all launch parameters upfront to fail fast.
     * @dev Mirrors validation from Rig and Auction constructors for early revert.
     * @param params Launch parameters to validate
     */
    function _validateLaunchParams(LaunchParams calldata params) internal view {
        // Basic validations
        if (params.launcher == address(0)) revert Core__ZeroLauncher();
        if (params.quoteToken == address(0)) revert Core__ZeroQuoteToken();
        if (params.donutAmount < minDonutForLaunch) revert Core__InsufficientDonut();
        if (bytes(params.tokenName).length == 0) revert Core__EmptyTokenName();
        if (bytes(params.tokenSymbol).length == 0) revert Core__EmptyTokenSymbol();
        if (params.unitAmount == 0) revert Core__ZeroUnitAmount();

        // Rig parameter validations
        if (params.rigEpochPeriod < RIG_MIN_EPOCH_PERIOD || params.rigEpochPeriod > RIG_MAX_EPOCH_PERIOD) {
            revert Core__RigEpochPeriodOutOfRange();
        }
        if (params.rigPriceMultiplier < RIG_MIN_PRICE_MULTIPLIER || params.rigPriceMultiplier > RIG_MAX_PRICE_MULTIPLIER) {
            revert Core__RigPriceMultiplierOutOfRange();
        }
        if (params.rigMinInitPrice < RIG_ABS_MIN_INIT_PRICE || params.rigMinInitPrice > RIG_ABS_MAX_INIT_PRICE) {
            revert Core__RigMinInitPriceOutOfRange();
        }
        if (params.initialUps == 0 || params.initialUps > RIG_MAX_INITIAL_UPS) {
            revert Core__RigInitialUpsOutOfRange();
        }
        if (params.tailUps == 0 || params.tailUps > params.initialUps) {
            revert Core__RigTailUpsOutOfRange();
        }
        if (params.halvingAmount == 0 || params.halvingAmount < RIG_MIN_HALVING_AMOUNT) {
            revert Core__RigHalvingAmountOutOfRange();
        }

        // Auction parameter validations
        if (params.auctionEpochPeriod < AUCTION_MIN_EPOCH_PERIOD || params.auctionEpochPeriod > AUCTION_MAX_EPOCH_PERIOD) {
            revert Core__AuctionEpochPeriodOutOfRange();
        }
        if (params.auctionPriceMultiplier < AUCTION_MIN_PRICE_MULTIPLIER || params.auctionPriceMultiplier > AUCTION_MAX_PRICE_MULTIPLIER) {
            revert Core__AuctionPriceMultiplierOutOfRange();
        }
        if (params.auctionMinInitPrice < AUCTION_ABS_MIN_INIT_PRICE || params.auctionMinInitPrice > AUCTION_ABS_MAX_INIT_PRICE) {
            revert Core__AuctionMinInitPriceOutOfRange();
        }
        if (params.auctionInitPrice < params.auctionMinInitPrice || params.auctionInitPrice > AUCTION_ABS_MAX_INIT_PRICE) {
            revert Core__AuctionInitPriceOutOfRange();
        }
    }

    /*----------  VIEW FUNCTIONS  ---------------------------------------*/

    /**
     * @notice Get the total number of deployed rigs.
     * @return Number of rigs launched
     */
    function deployedRigsLength() external view returns (uint256) {
        return deployedRigs.length;
    }
}
