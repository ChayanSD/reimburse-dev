import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forgetPasswordSchema } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { sendOTPEmail } from "@/lib/emailService";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validationResult = forgetPasswordSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { email } = validationResult.data;

    // Normalize email to lowercase for consistency
    const normalizedEmail = email.toLowerCase();

    // Check if user exists
    const user = await prisma.authUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // For security, don't reveal if email exists or not
      return NextResponse.json(
        {
          message:
            "If an account with this email exists, a password reset code has been sent.",
        },
        { status: 200 }
      );
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    // Store OTP in Redis with 5 minute expiry
    const redisKey = `otp:${normalizedEmail}`;
    await redis.set(redisKey, otp, { ex: 300 }); // 300 seconds = 5 minutes

  
    // Send OTP email
    const emailSent = await sendOTPEmail({ to: normalizedEmail, otp });

    if (!emailSent) {
      console.error("Failed to send OTP email");
      return NextResponse.json(
        { error: "Failed to send reset code. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Password reset code sent successfully. Check your email." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forget password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
