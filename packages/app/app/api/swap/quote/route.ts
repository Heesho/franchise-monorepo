import { NextRequest, NextResponse } from "next/server";

const KYBER_ROUTES_URL = "https://aggregator-api.kyberswap.com/base/api/v1/routes";
const KYBER_BUILD_URL = "https://aggregator-api.kyberswap.com/base/api/v1/route/build";

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

  const response = await fetch(`${KYBER_ROUTES_URL}?${params.toString()}`, {
    headers: { "Accept": "application/json" },
  });

  return response.json();
}

async function buildKyberTx(routeSummary: any, sender: string, slippageTolerance: number) {
  const buildResponse = await fetch(KYBER_BUILD_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      routeSummary,
      sender,
      recipient: sender,
      slippageTolerance,
      skipSimulateTx: false,
      deadline: Math.floor(Date.now() / 1000) + 1200,
    }),
  });

  return buildResponse.json();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sellToken = searchParams.get("sellToken");
  const buyToken = searchParams.get("buyToken");
  const sellAmount = searchParams.get("sellAmount");
  const taker = searchParams.get("taker");
  const slippageBps = searchParams.get("slippageBps") || "50";

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
    const isSellingNativeEth = sellToken.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
    const isBuyingNativeEth = buyToken.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
    const chargeFeeBy = isSellingNativeEth ? "currency_in" : isBuyingNativeEth ? "currency_out" : "";
    const slippageTolerance = parseInt(slippageBps);

    // Try direct route first
    const directData = await fetchKyberRoute(sellToken, buyToken, sellAmount, chargeFeeBy);

    if (directData.code === 0 && directData.data?.routeSummary) {
      const routeSummary = directData.data.routeSummary;
      const buildData = await buildKyberTx(routeSummary, taker, slippageTolerance);

      if (buildData.code !== 0) {
        return NextResponse.json(
          { error: buildData.message || "Failed to build transaction", details: buildData },
          { status: 400 }
        );
      }

      const txData = buildData.data;
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
        issues: {
          allowance: {
            spender: txData.routerAddress,
          },
        },
        routeType: "direct",
      });
    }

    // If direct route fails and we're selling token for ETH, try two-hop through DONUT
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

      // Step 2: DONUT -> ETH
      const step2Data = await fetchKyberRoute(DONUT_ADDRESS, buyToken, donutAmount, "currency_out");

      if (step2Data.code !== 0 || !step2Data.data?.routeSummary) {
        return NextResponse.json(
          { error: "No route found for DONUT->ETH", details: { step1: step1Data, step2: step2Data } },
          { status: 404 }
        );
      }

      const step2Summary = step2Data.data.routeSummary;

      // Build transactions for both steps
      const build1Data = await buildKyberTx(step1Summary, taker, slippageTolerance);
      const build2Data = await buildKyberTx(step2Summary, taker, slippageTolerance);

      if (build1Data.code !== 0 || build2Data.code !== 0) {
        return NextResponse.json(
          { error: "Failed to build transaction", details: { build1: build1Data, build2: build2Data } },
          { status: 400 }
        );
      }

      const tx1Data = build1Data.data;
      const tx2Data = build2Data.data;
      const totalGas = (parseInt(step1Summary.gas || "0") + parseInt(step2Summary.gas || "0")).toString();

      return NextResponse.json({
        sellAmount: sellAmount,
        buyAmount: step2Summary.amountOut,
        price: (Number(step2Summary.amountOut) / Number(sellAmount)).toString(),
        estimatedGas: totalGas,
        fees: {
          integratorFee: {
            amount: step2Summary.extraFee?.feeAmount || "0",
            token: buyToken,
          },
        },
        // First transaction: Token -> DONUT
        transaction: {
          to: tx1Data.routerAddress,
          data: tx1Data.data,
          value: tx1Data.transactionValue || "0",
          gas: tx1Data.gas || step1Summary.gas || "0",
          gasPrice: tx1Data.gasPrice || "0",
        },
        // Second transaction: DONUT -> ETH
        transaction2: {
          to: tx2Data.routerAddress,
          data: tx2Data.data,
          value: tx2Data.transactionValue || "0",
          gas: tx2Data.gas || step2Summary.gas || "0",
          gasPrice: tx2Data.gasPrice || "0",
        },
        issues: {
          allowance: {
            spender: tx1Data.routerAddress,
          },
          // DONUT also needs approval for step 2
          allowance2: {
            spender: tx2Data.routerAddress,
            token: DONUT_ADDRESS,
          },
        },
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
      { error: "Failed to fetch quote from KyberSwap" },
      { status: 500 }
    );
  }
}
