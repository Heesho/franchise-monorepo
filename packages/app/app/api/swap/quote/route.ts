import { NextRequest, NextResponse } from "next/server";

const KYBER_ROUTES_URL = "https://aggregator-api.kyberswap.com/base/api/v1/routes";
const KYBER_BUILD_URL = "https://aggregator-api.kyberswap.com/base/api/v1/route/build";

// Native ETH address used by aggregators
const NATIVE_ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Fee recipient wallet address
const FEE_RECIPIENT = process.env.SWAP_FEE_RECIPIENT || "0x0000000000000000000000000000000000000000";
const FEE_BPS = 40; // 0.4% fee

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sellToken = searchParams.get("sellToken");
  const buyToken = searchParams.get("buyToken");
  const sellAmount = searchParams.get("sellAmount");
  const taker = searchParams.get("taker");
  const slippageBps = searchParams.get("slippageBps") || "50"; // Default 0.5%

  if (!sellToken || !buyToken || !sellAmount) {
    return NextResponse.json(
      { error: "Missing required parameters: sellToken, buyToken, sellAmount" },
      { status: 400 }
    );
  }

  if (!taker) {
    return NextResponse.json(
      { error: "Missing required parameter: taker (wallet address)" },
      { status: 400 }
    );
  }

  try {
    // Determine fee direction - always charge in ETH
    const isSellingNativeEth = sellToken.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
    const isBuyingNativeEth = buyToken.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
    // If selling ETH, charge fee on input (ETH). If buying ETH, charge fee on output (ETH).
    const chargeFeeBy = isSellingNativeEth ? "currency_in" : isBuyingNativeEth ? "currency_out" : "";

    // Step 1: Get route from KyberSwap
    const routeParams = new URLSearchParams({
      tokenIn: sellToken,
      tokenOut: buyToken,
      amountIn: sellAmount,
      saveGas: "true",
      gasInclude: "true",
    });

    // Only add fee params if one side is ETH
    if (chargeFeeBy) {
      routeParams.set("feeAmount", FEE_BPS.toString());
      routeParams.set("feeReceiver", FEE_RECIPIENT);
      routeParams.set("isInBps", "true");
      routeParams.set("chargeFeeBy", chargeFeeBy);
    }

    const routeResponse = await fetch(`${KYBER_ROUTES_URL}?${routeParams.toString()}`, {
      headers: {
        "Accept": "application/json",
      },
    });

    const routeData = await routeResponse.json();

    if (!routeResponse.ok || routeData.code !== 0) {
      return NextResponse.json(
        { error: routeData.message || "Failed to fetch route", details: routeData },
        { status: routeResponse.status }
      );
    }

    const routeSummary = routeData.data?.routeSummary;
    if (!routeSummary) {
      return NextResponse.json(
        { error: "No route found", details: routeData },
        { status: 404 }
      );
    }

    // Step 2: Build transaction with route data
    // Convert slippage from basis points to percentage (e.g., 50 bps = 0.5% = 50)
    const slippageTolerance = parseInt(slippageBps);

    const buildResponse = await fetch(KYBER_BUILD_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        routeSummary: routeSummary,
        sender: taker,
        recipient: taker,
        slippageTolerance: slippageTolerance,
        skipSimulateTx: false,
        deadline: Math.floor(Date.now() / 1000) + 1200, // 20 minutes from now
      }),
    });

    const buildData = await buildResponse.json();

    if (!buildResponse.ok || buildData.code !== 0) {
      return NextResponse.json(
        { error: buildData.message || "Failed to build transaction", details: buildData },
        { status: buildResponse.status }
      );
    }

    const txData = buildData.data;

    // Map response to match expected SwapQuote format
    return NextResponse.json({
      sellAmount: routeSummary.amountIn,
      buyAmount: routeSummary.amountOut,
      price: (Number(routeSummary.amountOut) / Number(routeSummary.amountIn)).toString(),
      estimatedGas: routeSummary.gas || txData.gas || "0",
      fees: {
        integratorFee: {
          amount: routeSummary.extraFee?.feeAmount || "0",
          token: buyToken,
        },
      },
      transaction: {
        to: txData.routerAddress,
        data: txData.data,
        value: txData.transactionValue || "0",
        gas: txData.gas || routeSummary.gas || "0",
        gasPrice: txData.gasPrice || "0",
      },
      // Include allowance info - KyberSwap router needs approval
      issues: {
        allowance: {
          spender: txData.routerAddress,
        },
      },
    });
  } catch (error) {
    console.error("KyberSwap API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote from KyberSwap" },
      { status: 500 }
    );
  }
}
