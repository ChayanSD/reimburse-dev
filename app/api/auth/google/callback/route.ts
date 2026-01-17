import { NextRequest, NextResponse } from "next/server";
import { getTokens } from "@/lib/google-auth";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // This is the userId

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=missing_code`);
  }

  try {
    const session = await getSession();
    if (!session || session.id.toString() !== state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=unauthorized`);
    }

    const tokens = await getTokens(code);
    console.log(`[OAuth] Granted scopes: ${tokens.scope}`);

    // Update user with tokens
    await prisma.authUser.update({
      where: { id: session.id },
      data: {
        gmailAccessToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token, // This is only sent the first time or with prompt=consent
        gmailTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        emailConnected: true,
        gmailConnectedAt: new Date(),
      },
    });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=email_connected`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=token_exchange_failed`);
  }
}
