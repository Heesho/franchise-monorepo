import { NextRequest, NextResponse } from "next/server";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

const apiKey = process.env.NEYNAR_API_KEY;
const neynarClient = apiKey ? new NeynarAPIClient(apiKey) : null;

/**
 * Fetch users by FIDs with viewer context to show social connections
 *
 * GET /api/neynar/friends?fids=1,2,3&viewerFid=123
 *
 * This is useful for showing "3 friends also mined this token" by:
 * 1. Getting the list of miner FIDs from the subgraph
 * 2. Calling this API with those FIDs and the current user's FID
 * 3. Filtering for users the viewer follows or is followed by
 */
export async function GET(request: NextRequest) {
  if (!neynarClient) {
    return NextResponse.json(
      { error: "Neynar API key not configured." },
      { status: 503 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const fidsParam = searchParams.get("fids");
  const viewerFidParam = searchParams.get("viewerFid");

  if (!fidsParam) {
    return NextResponse.json(
      { error: "Missing fids parameter." },
      { status: 400 }
    );
  }

  try {
    const fids = fidsParam.split(",").map(f => parseInt(f.trim(), 10)).filter(f => !isNaN(f));

    if (fids.length === 0) {
      return NextResponse.json({ users: [], friends: [] });
    }

    const viewerFid = viewerFidParam ? parseInt(viewerFidParam, 10) : undefined;

    // SDK uses positional args: fetchBulkUsers(fids, options)
    const response = await neynarClient.fetchBulkUsers(fids, { viewerFid });

    const users = response.users.map((user: {
      fid: number;
      username?: string;
      display_name?: string;
      pfp_url?: string;
      follower_count?: number;
      following_count?: number;
      viewer_context?: { following: boolean; followed_by: boolean };
    }) => ({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
      followerCount: user.follower_count,
      followingCount: user.following_count,
      viewerContext: user.viewer_context
        ? {
            following: user.viewer_context.following,
            followedBy: user.viewer_context.followed_by,
          }
        : null,
    }));

    // Filter for users who are friends (mutuals or followed by viewer)
    const friends = viewerFid
      ? users.filter(
          (u: { viewerContext?: { following: boolean; followedBy: boolean } | null }) =>
            u.viewerContext?.following ||
            u.viewerContext?.followedBy
        )
      : [];

    return NextResponse.json({
      users,
      friends,
      totalUsers: users.length,
      totalFriends: friends.length,
    });
  } catch (error) {
    console.error("[neynar:friends] Error fetching users:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch users.",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch multiple users by their Ethereum addresses with viewer context
 *
 * POST /api/neynar/friends
 * Body: {
 *   addresses: string[] - Ethereum addresses to look up
 *   viewerFid: number (optional) - FID of the viewer for social context
 * }
 *
 * This is useful for showing friend activity based on wallet addresses from the blockchain
 */
export async function POST(request: NextRequest) {
  if (!neynarClient) {
    return NextResponse.json(
      { error: "Neynar API key not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { addresses, viewerFid } = body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid addresses array." },
        { status: 400 }
      );
    }

    // First, look up FIDs by addresses
    // SDK uses positional args: fetchBulkUsersByEthereumAddress(addresses, options)
    const addressLookup = await neynarClient.fetchBulkUsersByEthereumAddress(
      addresses.slice(0, 350) // API limit is 350
    );

    // Extract unique FIDs from the address lookup
    const fidsSet = new Set<number>();
    const addressToUser: Record<string, { fid: number; username?: string; displayName?: string; pfpUrl?: string }> = {};

    for (const [addr, users] of Object.entries(addressLookup)) {
      const userArray = users as Array<{
        fid: number;
        username?: string;
        display_name?: string;
        pfp_url?: string;
      }>;
      if (userArray && userArray.length > 0) {
        const user = userArray[0];
        fidsSet.add(user.fid);
        addressToUser[addr.toLowerCase()] = {
          fid: user.fid,
          username: user.username,
          displayName: user.display_name,
          pfpUrl: user.pfp_url,
        };
      }
    }

    const fids = Array.from(fidsSet);

    if (fids.length === 0) {
      return NextResponse.json({
        users: [],
        friends: [],
        addressToUser: {},
        totalUsers: 0,
        totalFriends: 0,
      });
    }

    // Fetch full user data with viewer context
    const usersResponse = await neynarClient.fetchBulkUsers(fids, { viewerFid });

    const users = usersResponse.users.map((user: {
      fid: number;
      username?: string;
      display_name?: string;
      pfp_url?: string;
      follower_count?: number;
      following_count?: number;
      viewer_context?: { following: boolean; followed_by: boolean };
    }) => ({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
      followerCount: user.follower_count,
      followingCount: user.following_count,
      viewerContext: user.viewer_context
        ? {
            following: user.viewer_context.following,
            followedBy: user.viewer_context.followed_by,
          }
        : null,
    }));

    // Filter for friends
    const friends = viewerFid
      ? users.filter(
          (u: { viewerContext?: { following: boolean; followedBy: boolean } | null }) =>
            u.viewerContext?.following ||
            u.viewerContext?.followedBy
        )
      : [];

    return NextResponse.json({
      users,
      friends,
      addressToUser,
      totalUsers: users.length,
      totalFriends: friends.length,
    });
  } catch (error) {
    console.error("[neynar:friends] Error fetching users by address:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch users.",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
