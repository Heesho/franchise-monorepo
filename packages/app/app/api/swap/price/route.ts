import { NextRequest, NextResponse } from "next/server";

const KYBER_API_URL = "https://aggregator-api.kyberswap.com/base/api/v1/routes";

// Native ETH address used by aggregators
const NATIVE_ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// DONUT token address - used as intermediate for routing
const DONUT_ADDRESS = "0xae4a37d554c6d6f3e398546d8566b25052e0169c";

// Fee recipient wallet address
const FEE_RECIPIENT = process.env.SWAP_FEE_RECIPIENT || "0x0000000000000000000000000000000000000000";
const FEE_BPS = 40; // 0.4% fee

async function fetchKyberRoute(tokenIn: string, tokenOut: string, amountIn: string, chargeFeeBy: string) {
  const params = new URLSearchParams({
    tokenIn,
    tokenOut,
    amountIn,
    saveGas: "true",
    gasInclude: "true",
  });

  if (chargeFeeBy) {
    params.set("feeAmount", FEE_BPS.toString());
    params.set("feeReceiver", FEE_RECIPIENT);
    params.set("isInBps", "true");
    params.set("chargeFeeBy", chargeFeeBy);
  }

  const response = await fetch(`${KYBER_API_URL}?${params.toString()}`, {
    headers: { "Accept": "application/json" },
  });

  return response.json();
}

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
    const isSellingNativeEth = sellToken.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
    const isBuyingNativeEth = buyToken.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
    const chargeFeeBy = isSellingNativeEth ? "currency_in" : isBuyingNativeEth ? "currency_out" : "";

    // Try direct route first
    const directData = await fetchKyberRoute(sellToken, buyToken, sellAmount, chargeFeeBy);

    if (directData.code === 0 && directData.data?.routeSummary) {
      const routeSummary = directData.data.routeSummary;
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
        routeSummary: routeSummary,
        routeType: "direct",
      });
    }

    // If direct route fails and we're selling token for ETH, try routing through DONUT
    if (isBuyingNativeEth && !isSellingNativeEth) {
      // Step 1: Token -> DONUT
      const step1Data = await fetchKyberRoute(sellToken, DONUT_ADDRESS, sellAmount, "");

      if (step1Data.code !== 0 || !step1Data.data?.routeSummary) {
        return NextResponse.json(
          { error: "No route found", details: { direct: directData, step1: step1Data } },
          { status: 404 }
        );
      }

      const step1Summary = step1Data.data.routeSummary;
      const donutAmount = step1Summary.amountOut;

      // Step 2: DONUT -> ETH (with fee on output since we're buying ETH)
      const step2Data = await fetchKyberRoute(DONUT_ADDRESS, buyToken, donutAmount, "currency_out");

      if (step2Data.code !== 0 || !step2Data.data?.routeSummary) {
        return NextResponse.json(
          { error: "No route found for DONUT->ETH", details: { step1: step1Data, step2: step2Data } },
          { status: 404 }
        );
      }

      const step2Summary = step2Data.data.routeSummary;

      // Combine the results
      const totalGas = (parseInt(step1Summary.gas || "0") + parseInt(step2Summary.gas || "0")).toString();

      return NextResponse.json({
        sellAmount: sellAmount,
        buyAmount: step2Summary.amountOut,
        sellAmountUsd: step1Summary.amountInUsd || "0",
        buyAmountUsd: step2Summary.amountOutUsd || "0",
        price: (Number(step2Summary.amountOut) / Number(sellAmount)).toString(),
        estimatedGas: totalGas,
        fees: {
          integratorFee: {
            amount: step2Summary.extraFee?.feeAmount || "0",
            token: buyToken,
          },
        },
        // Store both route summaries for building transaction later
        routeSummary: step1Summary,
        routeSummary2: step2Summary,
        intermediateAmount: donutAmount,
        routeType: "two-hop",
      });
    }

    // No route found
    return NextResponse.json(
      { error: directData.message || "No route found", details: directData },
      { status: 404 }
    );
  } catch (error) {
    console.error("KyberSwap API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch price from KyberSwap" },
      { status: 500 }
    );
  }
}
