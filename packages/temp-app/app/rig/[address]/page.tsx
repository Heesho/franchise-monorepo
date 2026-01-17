import type { Metadata } from "next";
import { getRig } from "@/lib/subgraph-launchpad";
import RigDetailPage from "./client-page";

const appDomain = "https://glazecorp-franchise.vercel.app";
const heroImageUrl = `${appDomain}/media/hero.png`;
const splashImageUrl = `${appDomain}/media/splash.png`;

type Props = {
  params: Promise<{ address: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const rigAddress = address.toLowerCase();

  // Fetch rig info from subgraph
  const rig = await getRig(rigAddress);

  const tokenName = rig?.tokenName || "Rig";
  const tokenSymbol = rig?.tokenSymbol || "TOKEN";
  const rigUrl = `${appDomain}/rig/${rigAddress}`;

  // Mini app embed with rig-specific URL
  const miniAppEmbed = {
    version: "1",
    imageUrl: heroImageUrl,
    button: {
      title: `Mine $${tokenSymbol}!`,
      action: {
        type: "launch_miniapp" as const,
        name: "Franchiser",
        url: rigUrl,
        splashImageUrl,
        splashBackgroundColor: "#000000",
      },
    },
  };

  return {
    title: `${tokenName} ($${tokenSymbol}) | Franchiser`,
    description: `Mine ${tokenName} ($${tokenSymbol}) on Franchiser. Start mining and earn tokens now!`,
    openGraph: {
      title: `${tokenName} ($${tokenSymbol}) | Franchiser`,
      description: `Mine ${tokenName} ($${tokenSymbol}) on Franchiser. Start mining and earn tokens now!`,
      url: rigUrl,
      images: [
        {
          url: heroImageUrl,
        },
      ],
    },
    other: {
      "fc:miniapp": JSON.stringify(miniAppEmbed),
    },
  };
}

export default function Page() {
  return <RigDetailPage />;
}
