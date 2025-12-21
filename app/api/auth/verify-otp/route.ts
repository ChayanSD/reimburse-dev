import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { verifyOtpSchema } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validationResult = verifyOtpSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { email, otp } = validationResult.data;

    // Normalize email to lowercase (same as in forget-password route)
    const normalizedEmail = email.toLowerCase();

    // Check OTP in Redis - try normalized email first
    const redisKey = `otp:${normalizedEmail}`;
    let storedOtp = await redis.get(redisKey);
    let redisKeyUsed = redisKey;

    // If not found, try with original email case
    if (!storedOtp) {
      const redisKeyOriginal = `otp:${email}`;
      storedOtp = await redis.get(redisKeyOriginal);
      if (storedOtp) {
        redisKeyUsed = redisKeyOriginal;
      }
    }

    if (!storedOtp) {
      return NextResponse.json(
        { error: "OTP expired or invalid" },
        { status: 400 }
      );
    }

    // Trim any whitespace and ensure both are strings
    const cleanedStoredOtp = String(storedOtp).trim();
    const cleanedInputOtp = String(otp).trim();

    if (cleanedStoredOtp !== cleanedInputOtp) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    // OTP is valid, delete it from Redis
    await redis.del(redisKeyUsed);

    // Set a flag to indicate OTP was verified for password reset
    await redis.setex(`otp_verified:${normalizedEmail}`, 1800, "true"); // 30 minutes expiry

    return NextResponse.json(
      { message: "OTP verified successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("OTP verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
