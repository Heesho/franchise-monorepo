import { NextRequest, NextResponse } from "next/server";

const KYBER_API_URL = "https://aggregator-api.kyberswap.com/base/api/v1/routes";

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

  if (!sellToken || !buyToken || !sellAmount) {
    return NextResponse.json(
      { error: "Missing required parameters: sellToken, buyToken, sellAmount" },
      { status: 400 }
    );
  }

  try {
    // Determine fee direction - always charge in ETH
    const isSellingNativeEth = sellToken.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
    const isBuyingNativeEth = buyToken.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
    // If selling ETH, charge fee on input (ETH). If buying ETH, charge fee on output (ETH).
    const chargeFeeBy = isSellingNativeEth ? "currency_in" : isBuyingNativeEth ? "currency_out" : "";

    const params = new URLSearchParams({
      tokenIn: sellToken,
      tokenOut: buyToken,
      amountIn: sellAmount,
      saveGas: "true",
      gasInclude: "true",
    });

    // Only add fee params if one side is ETH
    if (chargeFeeBy) {
      params.set("feeAmount", FEE_BPS.toString());
      params.set("feeReceiver", FEE_RECIPIENT);
      params.set("isInBps", "true");
      params.set("chargeFeeBy", chargeFeeBy);
    }

    const response = await fetch(`${KYBER_API_URL}?${params.toString()}`, {
      headers: {
        "Accept": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || data.code !== 0) {
      return NextResponse.json(
        { error: data.message || "Failed to fetch price", details: data },
        { status: response.status }
      );
    }

    // Map KyberSwap response to match expected format
    const routeSummary = data.data?.routeSummary;
    if (!routeSummary) {
      return NextResponse.json(
        { error: "No route found", details: data },
        { status: 404 }
      );
    }

    // Calculate price (buyAmount / sellAmount as decimal)
    const price = routeSummary.amountOut && routeSummary.amountIn
      ? (BigInt(routeSummary.amountOut) * BigInt(10 ** 18) / BigInt(routeSummary.amountIn)).toString()
      : "0";

    return NextResponse.json({
      sellAmount: routeSummary.amountIn,
      buyAmount: routeSummary.amountOut,
      sellAmountUsd: routeSummary.amountInUsd || "0",
      buyAmountUsd: routeSummary.amountOutUsd || "0",
      price: (Number(routeSummary.amountOut) / Number(routeSummary.amountIn)).toString(),
      estimatedGas: routeSummary.gas || "0",
      fees: {
        integratorFee: {
          amount: routeSummary.extraFee?.feeAmount || "0",
          token: buyToken,
        },
      },
      // Store route data for building transaction later
      routeSummary: routeSummary,
    });
  } catch (error) {
    console.error("KyberSwap API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch price from KyberSwap" },
      { status: 500 }
    );
  }
}
