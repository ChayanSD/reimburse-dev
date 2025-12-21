import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "./session";
import type { SessionUser } from "./session";

export const signupSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["ADMIN", "USER"]).optional(),
});

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgetPasswordSchema = z.object({
  email: z.email("Invalid email address"),
});

export const verifyOtpSchema = z.object({
  email: z.email("Invalid email address"),
  otp: z.string().regex(/^\d{4}$/, "OTP must be 4 digits"),
});

export const resetPasswordSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgetPasswordInput = z.infer<typeof forgetPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Admin authentication utilities
export function requireAdmin(
  handler: (req: NextRequest, session: SessionUser) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const session = await getSession();

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    return handler(req, session);
  };
}

export function isAdmin(session: SessionUser | null): boolean {
  return session?.role === "ADMIN";
}
