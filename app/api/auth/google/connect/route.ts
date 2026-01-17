import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkSubscriptionLimit } from "@/lib/subscriptionGuard";
import { getAuthUrl } from "@/lib/google-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is premium
    const subscriptionCheck = await checkSubscriptionLimit(session.id, "email_ingestion");
    if (!subscriptionCheck.allowed) {
      return NextResponse.json(
        { 
          error: "Premium subscription required", 
          upgradeRequired: true 
        }, 
        { status: 403 }
      );
    }

    // Generate auth URL
    // We can pass the userId in the state to verify on callback, 
    // but the session cookie will also be available.
    const authUrl = getAuthUrl(session.id.toString());

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error("Connect Gmail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
