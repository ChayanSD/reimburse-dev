"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

interface FormData {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
}

export default function ForgetPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [formData, setFormData] = useState<FormData>({
    email: "",
    otp: "",
    password: "",
    confirmPassword: "",
  });
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  // Reset OTP digits when entering OTP step
  useEffect(() => {
    if (step === "otp") {
      setOtpDigits(["", "", "", ""]);
      setFormData((prev) => ({ ...prev, otp: "" }));
    }
  }, [step]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // For OTP input, only allow numeric characters and limit to 4 digits
    if (name === "otp") {
      const numericValue = value.replace(/[^0-9]/g, "").slice(0, 4);
      setFormData((prev) => ({
        ...prev,
        [name]: numericValue,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    if (error) setError(null);
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    // Only allow numeric characters
    const numericValue = value.replace(/[^0-9]/g, "").slice(0, 1);

    const newDigits = [...otpDigits];
    newDigits[index] = numericValue;
    setOtpDigits(newDigits);

    // Update the combined OTP value
    const combinedOtp = newDigits.join("");
    setFormData((prev) => ({
      ...prev,
      otp: combinedOtp,
    }));

    // Auto-focus to next input if current input is filled
    if (numericValue && index < 3) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) {
        nextInput.focus();
      }
    }

    // Auto-focus to previous input if current input is empty and user is deleting
    if (!numericValue && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) {
        prevInput.focus();
      }
    }

    if (error) setError(null);
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    // Handle backspace navigation
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) {
        prevInput.focus();
        handleOtpDigitChange(index - 1, "");
      }
    }

    // Handle paste event for the entire OTP
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      // Let the default paste behavior happen
      return;
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedData = e.clipboardData.getData("text");
    const numericPastedData = pastedData.replace(/[^0-9]/g, "").slice(0, 4);

    if (numericPastedData.length > 0) {
      const newDigits = ["", "", "", ""];
      for (let i = 0; i < Math.min(numericPastedData.length, 4); i++) {
        newDigits[i] = numericPastedData[i];
      }
      setOtpDigits(newDigits);
      setFormData((prev) => ({
        ...prev,
        otp: numericPastedData,
      }));

      // Focus the next empty input or the last input
      const nextIndex = Math.min(numericPastedData.length, 3);
      const nextInput = document.getElementById(`otp-input-${nextIndex}`);
      if (nextInput) {
        nextInput.focus();
      }
    }

    e.preventDefault();
  };

  const forgetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await axios.post("/api/auth/forget-password", {
        email: email.toLowerCase(),
      });
      return response.data;
    },
    onSuccess: () => {
      setStep("otp");
      setTimeLeft(300);
      setError(null);
    },
    onError: (err: any) => {
      setError(
        err.response?.data?.error ||
          "Failed to send reset code. Please try again."
      );
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, otp }: { email: string; otp: string }) => {
      const response = await axios.post("/api/auth/verify-otp", {
        email: email.toLowerCase(),
        otp,
      });
      return response.data;
    },
    onSuccess: () => {
      // On success, move to password setting step
      setStep("password");
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || "Invalid OTP. Please try again.");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const response = await axios.post("/api/auth/reset-password", {
        email: email.toLowerCase(),
        password,
      });
      return response.data;
    },
    onSuccess: () => {
      // On success, redirect to signin with success message
      router.push(
        "/account/signin?message=Password reset successful. Please sign in with your new password."
      );
    },
    onError: (err: any) => {
      setError(
        err.response?.data?.error ||
          "Failed to reset password. Please try again."
      );
    },
  });

  const onEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!formData.email) {
      setError("Please enter your email address");
      return;
    }

    forgetPasswordMutation.mutate(formData.email.toLowerCase());
  };

  const onOtpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!formData.otp) {
      setError("Please enter the OTP");
      return;
    }

    if (formData.otp.length !== 4) {
      setError("OTP must be exactly 4 digits");
      return;
    }

    if (!/^\d{4}$/.test(formData.otp)) {
      setError("OTP must contain only numeric digits");
      return;
    }

    console.log("Submitting OTP verification:", {
      email: formData.email.toLowerCase(),
      otp: formData.otp,
      otpLength: formData.otp.length,
      otpType: typeof formData.otp,
    });

    verifyOtpMutation.mutate({
      email: formData.email.toLowerCase(),
      otp: formData.otp,
    });
  };

  const onPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!formData.password) {
      setError("Please enter your new password");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (!formData.confirmPassword) {
      setError("Please confirm your password");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    resetPasswordMutation.mutate({
      email: formData.email.toLowerCase(),
      password: formData.password,
    });
  };

  const isLoading =
    forgetPasswordMutation.isPending ||
    verifyOtpMutation.isPending ||
    resetPasswordMutation.isPending;

  return (
    <div
      className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8">
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
            Reset Password
          </h1>
          <p className="text-gray-600">
            {step === "email"
              ? "Enter your email to receive a reset code"
              : step === "otp"
              ? "Enter the 4-digit code sent to your email"
              : "Set your new password"}
          </p>
        </div>

        {step === "email" && (
          <form onSubmit={onEmailSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="relative">
                <input
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#2E86DE] hover:bg-[#2574C7] text-white font-semibold py-3 px-4 rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? "Sending..." : "Send Reset Code"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={onOtpSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                OTP Code
              </label>
              <div className="flex justify-center space-x-3">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-input-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) =>
                      handleOtpDigitChange(index, e.target.value)
                    }
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    className={`w-16 h-16 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none focus:ring-3 focus:ring-[#2E86DE]/20 focus:border-[#2E86DE] transition-all duration-200 bg-white shadow-sm ${
                      digit
                        ? "border-[#2E86DE] bg-[#2E86DE]/5 text-[#2E86DE] shadow-md"
                        : "border-gray-300 hover:border-gray-400 hover:shadow-md"
                    }`}
                    style={{
                      fontFamily: "Inter, system-ui, sans-serif",
                    }}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || timeLeft <= 0}
              className="w-full bg-[#2E86DE] hover:bg-[#2574C7] text-white font-semibold py-3 px-4 rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading
                ? "Verifying..."
                : timeLeft <= 0
                ? "Code Expired"
                : "Verify Code"}
            </button>

            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full text-[#2E86DE] hover:text-[#2574C7] font-medium py-2 px-4 rounded-2xl transition-colors"
            >
              Back to Email
            </button>

            {timeLeft > 0 && (
              <p className="text-sm text-gray-500 text-center">
                Code expires in {Math.floor(timeLeft / 60)}:
                {(timeLeft % 60).toString().padStart(2, "0")}
              </p>
            )}

            <button
              type="button"
              onClick={() =>
                forgetPasswordMutation.mutate(formData.email.toLowerCase())
              }
              disabled={isLoading}
              className="w-full text-[#2E86DE] hover:text-[#2574C7] font-medium py-2 px-4 rounded-2xl transition-colors disabled:opacity-50"
            >
              Resend Code
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={onPasswordSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <div className="relative">
                <input
                  required
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your new password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  required
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your new password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#2E86DE] hover:bg-[#2574C7] text-white font-semibold py-3 px-4 rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? "Setting Password..." : "Set New Password"}
            </button>

            <button
              type="button"
              onClick={() => setStep("otp")}
              className="w-full text-[#2E86DE] hover:text-[#2574C7] font-medium py-2 px-4 rounded-2xl transition-colors"
            >
              Back to OTP
            </button>
          </form>
        )}

        <div className="text-center text-sm text-gray-600 mt-6 space-y-2">
          <div>
            Remember your password?{" "}
            <Link
              href="/account/signin"
              className="text-[#2E86DE] hover:text-[#2574C7] font-medium"
            >
              Sign in
            </Link>
          </div>
          <div>
            Don't have an account?{" "}
            <Link
              href="/account/signup"
              className="text-[#2E86DE] hover:text-[#2574C7] font-medium"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
