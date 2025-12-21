import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const resetPasswordSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validationResult = resetPasswordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;
    const normalizedEmail = email.toLowerCase();

    // Check if OTP was verified for this email
    const redisKey = `otp_verified:${normalizedEmail}`;
    const isVerified = await redis.get(redisKey);

    if (!isVerified) {
      return NextResponse.json(
        { error: "OTP verification required before password reset" },
        { status: 400 }
      );
    }

    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update the user's password in the database
    const updatedUser = await prisma.authUser.update({
      where: { email: normalizedEmail },
      data: { password: hashedPassword },
    });

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Clean up Redis keys
    await redis.del(redisKey);
    const otpKey = `otp:${normalizedEmail}`;
    await redis.del(otpKey);

    return NextResponse.json(
      { message: "Password reset successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
