"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReadContract } from "wagmi";
import { parseEther, formatEther, type Address, encodeFunctionData } from "viem";
import { Upload, X, Plus, Minus, Share2, PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NavBar } from "@/components/nav-bar";
import {
  CONTRACT_ADDRESSES,
  MULTICALL_ABI,
  CORE_ABI,
  ERC20_ABI,
  LAUNCH_DEFAULTS,
} from "@/lib/contracts";
import { getDonutPrice } from "@/lib/utils";
import { useFarcaster, shareLaunch } from "@/hooks/useFarcaster";
import { useBatchedTransaction, encodeApproveCall, type Call } from "@/hooks/useBatchedTransaction";
import { DEFAULT_CHAIN_ID, DEFAULT_DONUT_PRICE_USD, PRICE_REFETCH_INTERVAL_MS, STALE_TIME_SHORT_MS } from "@/lib/constants";

// Animated dots component for loading state
function LoadingDots() {
  return (
    <span className="inline-flex">
      <span className="animate-[bounce_1s_infinite_0ms]">.</span>
      <span className="animate-[bounce_1s_infinite_200ms]">.</span>
      <span className="animate-[bounce_1s_infinite_400ms]">.</span>
    </span>
  );
}

export default function LaunchPage() {
  const router = useRouter();

  // Form state
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");
  const [defaultMessage, setDefaultMessage] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [txStep, setTxStep] = useState<"idle" | "uploading" | "launching">("idle");

  // Fixed 1000 DONUT fee
  const donutAmountBigInt = parseEther("1000");
  const [donutUsdPrice, setDonutUsdPrice] = useState<number>(DEFAULT_DONUT_PRICE_USD);
  const [launchResult, setLaunchResult] = useState<
    "success" | "failure" | null
  >(null);
  const launchResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [launchedToken, setLaunchedToken] = useState<{ name: string; symbol: string } | null>(null);

  // Farcaster context and wallet connection
  const { address, isConnected, connect } = useFarcaster();

  // Batched transaction hook for approve + launch
  const {
    execute: executeBatch,
    state: batchState,
    reset: resetBatch,
  } = useBatchedTransaction();

  // Get DONUT token address from Core
  const { data: donutTokenAddress } = useReadContract({
    address: CONTRACT_ADDRESSES.core as `0x${string}`,
    abi: CORE_ABI,
    functionName: "donutToken",
    chainId: DEFAULT_CHAIN_ID,
  });

  // Get user's DONUT balance
  const { data: donutBalance } = useReadContract({
    address: donutTokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: {
      enabled: !!donutTokenAddress && !!address,
      refetchInterval: STALE_TIME_SHORT_MS,
    },
  });


  // Fetch DONUT price
  useEffect(() => {
    const fetchPrice = async () => {
      const price = await getDonutPrice();
      setDonutUsdPrice(price);
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, PRICE_REFETCH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (launchResultTimeoutRef.current) {
        clearTimeout(launchResultTimeoutRef.current);
      }
    };
  }, []);

  const resetLaunchResult = useCallback(() => {
    if (launchResultTimeoutRef.current) {
      clearTimeout(launchResultTimeoutRef.current);
      launchResultTimeoutRef.current = null;
    }
    setLaunchResult(null);
  }, []);

  const showLaunchResult = useCallback((result: "success" | "failure") => {
    if (launchResultTimeoutRef.current) {
      clearTimeout(launchResultTimeoutRef.current);
    }
    setLaunchResult(result);
    launchResultTimeoutRef.current = setTimeout(() => {
      setLaunchResult(null);
      launchResultTimeoutRef.current = null;
    }, 3000);
  }, []);

  // Handle batched transaction result
  useEffect(() => {
    if (batchState === "success") {
      showLaunchResult("success");
      setTxStep("idle");
      resetBatch();
      // Save launched token info and show success modal
      setLaunchedToken({ name: tokenName, symbol: tokenSymbol });
      setShowSuccessModal(true);
    } else if (batchState === "error") {
      showLaunchResult("failure");
      setTxStep("idle");
      resetBatch();
    }
  }, [batchState, showLaunchResult, resetBatch, tokenName, tokenSymbol]);

  // Handle logo selection (just preview, don't upload yet)
  const handleLogoSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be less than 5MB");
        return;
      }

      // Store file and show preview
      setLogoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);
    },
    []
  );

  // Upload logo to IPFS
  const uploadLogo = useCallback(async (): Promise<string | null> => {
    if (!logoFile) return null;

    try {
      const formData = new FormData();
      formData.append("file", logoFile);
      if (tokenSymbol.trim()) {
        formData.append("tokenSymbol", tokenSymbol.trim().toUpperCase());
      }

      const response = await fetch("/api/pinata/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      return data.ipfsUrl;
    } catch (error) {
      console.error("Logo upload failed:", error);
      return null;
    }
  }, [logoFile, tokenSymbol]);

  const removeLogo = useCallback(() => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const addLink = useCallback(() => {
    setLinks((prev) => [...prev, ""]);
  }, []);

  const removeLink = useCallback((index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateLink = useCallback((index: number, value: string) => {
    setLinks((prev) => prev.map((link, i) => (i === index ? value : link)));
  }, []);

  const userDonutBalance = donutBalance as bigint | undefined;

  const validationError = useMemo(() => {
    if (!tokenName.trim()) return "Token name is required";
    if (!tokenSymbol.trim()) return "Token symbol is required";
    if (tokenSymbol.length > 10) return "Symbol must be 10 characters or less";
    if (userDonutBalance !== undefined && donutAmountBigInt > userDonutBalance) {
      return "Insufficient DONUT balance (need 10 DONUT)";
    }
    return null;
  }, [tokenName, tokenSymbol, donutAmountBigInt, userDonutBalance]);

  // Upload metadata to IPFS
  const uploadMetadata = useCallback(async (imageUri: string): Promise<string | null> => {
    try {
      // Filter out empty links
      const validLinks = links.filter((link) => link.trim() !== "");

      const response = await fetch("/api/pinata/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tokenName.trim(),
          symbol: tokenSymbol.trim().toUpperCase(),
          image: imageUri,
          description: tokenDescription.trim(),
          defaultMessage: defaultMessage.trim() || "gm",
          links: validLinks,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload metadata");
      }

      const data = await response.json();
      return data.ipfsUrl;
    } catch (error) {
      console.error("Metadata upload failed:", error);
      return null;
    }
  }, [tokenName, tokenSymbol, tokenDescription, defaultMessage, links]);

  const handleLaunch = useCallback(async () => {
    resetLaunchResult();

    let targetAddress = address;
    if (!targetAddress) {
      try {
        targetAddress = await connect();
      } catch {
        showLaunchResult("failure");
        return;
      }
    }

    if (!donutTokenAddress) {
      showLaunchResult("failure");
      return;
    }

    setTxStep("uploading");

    // Upload image first (if any)
    let imageUri = "";
    if (logoFile) {
      const uploadedImageUri = await uploadLogo();
      if (!uploadedImageUri) {
        showLaunchResult("failure");
        setTxStep("idle");
        return;
      }
      imageUri = uploadedImageUri;
    }

    // Then upload metadata
    const uploadedMetadataUri = await uploadMetadata(imageUri);
    if (!uploadedMetadataUri) {
      showLaunchResult("failure");
      setTxStep("idle");
      return;
    }

    setTxStep("launching");

    // Create batched calls: approve + launch
    const approveCall = encodeApproveCall(
      donutTokenAddress as Address,
      CONTRACT_ADDRESSES.multicall as Address,
      donutAmountBigInt
    );

    // Encode launch call
    const launchParams = {
      ...LAUNCH_DEFAULTS,
      launcher: targetAddress,
      tokenName: tokenName.trim(),
      tokenSymbol: tokenSymbol.trim().toUpperCase(),
      uri: uploadedMetadataUri,
      donutAmount: donutAmountBigInt,
    };

    const launchCallData = encodeFunctionData({
      abi: MULTICALL_ABI,
      functionName: "launch",
      args: [launchParams],
    });

    const launchCall: Call = {
      to: CONTRACT_ADDRESSES.multicall as Address,
      data: launchCallData,
    };

    try {
      await executeBatch([approveCall, launchCall]);
    } catch (error) {
      console.error("Launch failed:", error);
      showLaunchResult("failure");
      setTxStep("idle");
      resetBatch();
    }
  }, [
    address,
    connect,
    donutTokenAddress,
    donutAmountBigInt,
    logoFile,
    tokenName,
    tokenSymbol,
    resetLaunchResult,
    showLaunchResult,
    uploadLogo,
    uploadMetadata,
    executeBatch,
    resetBatch,
  ]);

  const isLaunching = txStep !== "idle" || batchState === "pending" || batchState === "confirming";

  const isLaunchDisabled =
    !!validationError ||
    isLaunching ||
    launchResult !== null ||
    !isConnected;

  return (
    <main className="flex h-screen w-screen justify-center overflow-hidden bg-zinc-800 text-foreground">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col overflow-hidden bg-background px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
        }}
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="pb-2">
            <h1 className="text-2xl font-semibold tracking-tight mb-4">Launch</h1>
          </div>

          {/* Launch Form */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
              {/* Logo + Name/Symbol Row */}
              <div className="flex gap-3">
                {/* Token Logo Upload */}
                <div className="flex-shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                  {logoPreview ? (
                    <div className="relative w-[84px] h-[84px]">
                      <img
                        src={logoPreview}
                        alt="Token logo preview"
                        className="w-[84px] h-[84px] rounded-lg object-cover bg-secondary"
                      />
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="absolute top-1 right-1 w-5 h-5 bg-zinc-700/80 rounded-full flex items-center justify-center hover:bg-zinc-600 transition-colors"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-[84px] h-[84px] rounded-lg bg-secondary flex flex-col items-center justify-center gap-1 hover:bg-muted transition-colors border border-border border-dashed"
                    >
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-medium">Logo</span>
                    </button>
                  )}
                </div>

                {/* Name and Symbol */}
                <div className="flex-1 flex flex-col gap-2">
                  {/* Token Name */}
                  <input
                    type="text"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="Token Name"
                    maxLength={50}
                    className="w-full rounded-lg bg-secondary px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none border border-border"
                  />

                  {/* Token Symbol */}
                  <input
                    type="text"
                    value={tokenSymbol}
                    onChange={(e) =>
                      setTokenSymbol(e.target.value.toUpperCase())
                    }
                    placeholder="SYMBOL"
                    maxLength={10}
                    className="w-full rounded-lg bg-secondary px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none border border-border uppercase"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mt-3">
                <label className="text-[10px] text-muted-foreground mb-1 block">Description</label>
                <textarea
                  value={tokenDescription}
                  onChange={(e) => setTokenDescription(e.target.value)}
                  placeholder="Tell people about your token..."
                  maxLength={280}
                  rows={2}
                  className="w-full rounded-lg bg-secondary px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none border border-border resize-none"
                />
                <div className="text-[9px] text-muted-foreground text-right">{tokenDescription.length}/280</div>
              </div>

              {/* Default Message */}
              <div className="mt-2">
                <label className="text-[10px] text-muted-foreground mb-1 block">Default mine message</label>
                <input
                  type="text"
                  value={defaultMessage}
                  onChange={(e) => setDefaultMessage(e.target.value)}
                  placeholder="gm"
                  maxLength={100}
                  className="w-full rounded-lg bg-secondary px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none border border-border"
                />
              </div>

              {/* Links Section */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-muted-foreground">Links</label>
                  <button
                    type="button"
                    onClick={addLink}
                    className="w-5 h-5 rounded bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                  >
                    <Plus className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
                <div className="space-y-2">
                  {links.map((link, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => updateLink(index, e.target.value)}
                        placeholder="https://"
                        className="flex-1 rounded-lg bg-secondary px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => removeLink(index)}
                        className="w-5 h-5 rounded bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors flex-shrink-0"
                      >
                        <Minus className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
          </div>

          {/* Spacer for bottom bar */}
          <div className="h-24" />
        </div>

        {/* Fixed Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center bg-zinc-800" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)" }}>
          <div className="flex items-center justify-between w-full max-w-[520px] px-4 py-3 bg-background">
            <div className="flex items-center gap-6">
              {/* Launch Fee */}
              <div>
                <div className="text-muted-foreground text-[12px]">Launch fee</div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-black" />
                  </span>
                  <span className="font-semibold text-[17px] tabular-nums">1,000</span>
                </div>
              </div>
              {/* Balance */}
              <div>
                <div className="text-muted-foreground text-[12px]">Balance</div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-black" />
                  </span>
                  <span className="font-semibold text-[17px] tabular-nums">
                    {userDonutBalance
                      ? Number(formatEther(userDonutBalance)).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })
                      : "0"}
                  </span>
                </div>
              </div>
            </div>
            <Button
              className="w-32 h-10 text-[14px] font-semibold rounded-xl bg-white hover:bg-zinc-200 text-black transition-all disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleLaunch}
              disabled={isLaunchDisabled}
            >
              {launchResult === "success" ? (
                "SUCCESS!"
              ) : launchResult === "failure" ? (
                "FAILED"
              ) : txStep === "uploading" ? (
                <>UPLOADING<LoadingDots /></>
              ) : txStep === "launching" || batchState === "pending" || batchState === "confirming" ? (
                <>LAUNCHING<LoadingDots /></>
              ) : (
                "LAUNCH"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && launchedToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-secondary rounded-2xl p-6 mx-4 max-w-sm w-full text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <PartyPopper className="w-8 h-8 text-foreground" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2">Franchise Opened!</h2>
            <p className="text-muted-foreground mb-6">
              <span className="text-white font-semibold">${launchedToken.symbol}</span> ({launchedToken.name}) is now live!
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  await shareLaunch({
                    tokenSymbol: launchedToken.symbol,
                    tokenName: launchedToken.name,
                    appUrl: window.location.origin,
                  });
                }}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-black font-semibold hover:bg-primary/90 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share on Farcaster
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push("/explore");
                }}
                className="w-full py-3 rounded-xl bg-muted text-white font-semibold hover:bg-muted/80 transition-colors"
              >
                View Tokens
              </button>
            </div>
          </div>
        </div>
      )}

      <NavBar />
    </main>
  );
}
