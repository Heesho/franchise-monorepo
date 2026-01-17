import "@/app/globals.css";
import type { Metadata } from "next";
import { Providers } from "@/components/providers";

const appDomain = "https://glazecorp-franchise.vercel.app";
const heroImageUrl = `${appDomain}/media/hero.png`;
const splashImageUrl = `${appDomain}/media/splash.png`;

const miniAppEmbed = {
  version: "1",
  imageUrl: heroImageUrl,
  button: {
    title: "Open a Franchise!",
    action: {
      type: "launch_miniapp" as const,
      name: "Franchiser",
      url: appDomain,
      splashImageUrl,
      splashBackgroundColor: "#000000",
    },
  },
};

export const metadata: Metadata = {
  title: "Franchiser",
  description: "Instantly deploy tokens as mining projects. Customize your settings and launch with the click of a button.",
  openGraph: {
    title: "Franchiser, by Glaze Corp",
    description: "Instantly Deploy Mining Tokens.",
    url: appDomain,
    images: [
      {
        url: heroImageUrl,
      },
    ],
  },
  other: {
    "fc:miniapp": JSON.stringify(miniAppEmbed),
    "base:app_id": "694db1f1c63ad876c9081363",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
