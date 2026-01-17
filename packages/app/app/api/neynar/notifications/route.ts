import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_API_BASE = "https://api.neynar.com/v2/farcaster";

/**
 * Send notifications to Mini App users
 *
 * POST /api/neynar/notifications
 * Body: {
 *   targetFids: number[] - Specific FIDs to notify (empty array = all users with notifications enabled)
 *   title: string - Notification title
 *   body: string - Notification body text
 *   targetUrl: string - URL to open when notification is clicked
 * }
 */
export async function POST(request: NextRequest) {
  if (!NEYNAR_API_KEY) {
    return NextResponse.json(
      { error: "Neynar API key not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { targetFids, title, body: notificationBody, targetUrl } = body;

    if (!title || !notificationBody || !targetUrl) {
      return NextResponse.json(
        { error: "Missing required fields: title, body, targetUrl" },
        { status: 400 }
      );
    }

    const response = await fetch(`${NEYNAR_API_BASE}/frame/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        target_fids: targetFids || [],
        notification: {
          title,
          body: notificationBody,
          target_url: targetUrl,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      deliveries: data.notification_deliveries,
    });
  } catch (error) {
    console.error("[neynar:notifications] Error sending notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to send notification.",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Get notification tokens for users who have enabled notifications
 *
 * GET /api/neynar/notifications?fids=1,2,3 (optional)
 */
export async function GET(request: NextRequest) {
  if (!NEYNAR_API_KEY) {
    return NextResponse.json(
      { error: "Neynar API key not configured." },
      { status: 503 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const fidsParam = searchParams.get("fids");

    const params = new URLSearchParams();
    params.set("limit", "100");
    if (fidsParam) {
      params.set("fids", fidsParam);
    }

    const response = await fetch(
      `${NEYNAR_API_BASE}/frame/notification_tokens?${params.toString()}`,
      {
        headers: {
          "x-api-key": NEYNAR_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      tokens: data.notification_tokens,
      nextCursor: data.next?.cursor,
    });
  } catch (error) {
    console.error("[neynar:notifications] Error fetching tokens:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch notification tokens.",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
