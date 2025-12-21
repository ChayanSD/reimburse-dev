"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface VerificationState {
  status: "loading" | "success" | "error";
  message: string;
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verificationState, setVerificationState] = useState<VerificationState>(
    {
      status: "loading",
      message: "Verifying your email...",
    }
  );

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setVerificationState({
          status: "error",
          message:
            "Invalid verification link. Please check your email for the correct link.",
        });
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (response.ok) {
          setVerificationState({
            status: "success",
            message:
              "Your email has been verified successfully! You can now sign in to your account.",
          });

          // Redirect to sign in page after 3 seconds
          setTimeout(() => {
            router.push("/account/signin");
          }, 3000);
        } else {
          setVerificationState({
            status: "error",
            message:
              data.error || "Email verification failed. Please try again.",
          });
        }
      } catch (error) {
        console.error("Verification error:", error);
        setVerificationState({
          status: "error",
          message: "An error occurred during verification. Please try again.",
        });
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <div
      className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg p-8">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
            <Image
              src="https://ucarecdn.com/6b43f5cf-10b4-4838-b2ba-397c0a896734/-/format/auto/"
              alt="ReimburseMe Logo"
              className="w-16 h-16"
              width={40}
              height={40}
            />
          </div>
          <h1
            className="text-3xl font-bold text-gray-900 mb-2"
            style={{ fontFamily: "Poppins, system-ui, sans-serif" }}
          >
            Email Verification
          </h1>
        </div>

        {/* Status Content */}
        <div className="text-center">
          {verificationState.status === "loading" && (
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2E86DE]"></div>
              <p className="text-gray-600">{verificationState.message}</p>
            </div>
          )}

          {verificationState.status === "success" && (
            <div className="flex flex-col items-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Email Verified!
                </h2>
                <p className="text-gray-600 mb-4">
                  {verificationState.message}
                </p>
                <p className="text-sm text-gray-500">
                  Redirecting you to sign in page...
                </p>
              </div>
              <Link
                href="/account/signin"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-2xl text-white bg-[#2E86DE] hover:bg-[#2574C7] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2E86DE] transition-colors"
              >
                Continue to Sign In
              </Link>
            </div>
          )}

          {verificationState.status === "error" && (
            <div className="flex flex-col items-center space-y-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Verification Failed
                </h2>
                <p className="text-gray-600 mb-4">
                  {verificationState.message}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/account/signup"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-2xl text-white bg-[#2E86DE] hover:bg-[#2574C7] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2E86DE] transition-colors"
                >
                  Sign Up Again
                </Link>
                <Link
                  href="/account/signin"
                  className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-2xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2E86DE] transition-colors"
                >
                  Go to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4"
          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        >
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2E86DE] mx-auto mb-4"></div>
              <p className="text-gray-600">Loading verification page...</p>
            </div>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
