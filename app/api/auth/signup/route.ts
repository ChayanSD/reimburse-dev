import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { signupSchema } from "@/lib/auth";
import { initializeUserTrial } from "@/utils/userTrail";
import { sendVerificationEmail } from "@/lib/emailService";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validationResult = signupSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const {
      email,
      password,
      firstName,
      lastName,
      role = "USER",
    } = validationResult.data;

    const existingUser = await prisma.authUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Create user
    const user = await prisma.authUser.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        emailVerificationToken: verificationToken,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await initializeUserTrial(user.id);

    // Send verification email
    try {
      await sendVerificationEmail({
        to: email,
        firstName: firstName || "User",
        verificationToken,
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail the signup if email fails, but log it
    }

    return NextResponse.json(
      {
        message:
          "User created successfully. Please check your email to verify your account.",
        user: {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        requiresVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
