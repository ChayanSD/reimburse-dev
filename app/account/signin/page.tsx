"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";

interface SignInFormData {
  email: string;
  password: string;
}

export default function SignInPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, user } = useAuth();

  const [formData, setFormData] = useState<SignInFormData>({
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect authenticated users to dashboard or admin panel
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (user?.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        // Redirect will be handled by useEffect after user state updates
      } else {
        setError(result.error || "Sign in failed. Please try again.");
      }
    } catch (err) {
      console.error("Sign in error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);

    try {
      const result = await authClient.signInWithGoogle();

      if (result.success) {
        // Redirect will be handled by useEffect after user state updates
      } else {
        setError(result.error || "Google sign in failed. Please try again.");
      }
    } catch (err) {
      console.error("Google sign in error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2E86DE] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // This component should not render if user is authenticated (redirect happens in useEffect)
  if (isAuthenticated) {
    return null;
  }

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
            ReimburseMe
          </h1>
          <p className="text-gray-600">Welcome back</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full bg-white hover:bg-gray-50 text-gray-900 font-semibold py-3 px-4 rounded-2xl border border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-[#4285F4] focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {googleLoading ? "Signing In..." : "Continue with Google"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Or continue with email
              </span>
            </div>
          </div>

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

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                required
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent transition-colors"
              />
            </div>
            <div className="text-right">
              <Link
                href="/account/forget-password"
                className="text-sm text-[#2E86DE] hover:text-[#2574C7] font-medium"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2E86DE] hover:bg-[#2574C7] text-white font-semibold py-3 px-4 rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>

          <div className="text-center text-sm text-gray-600">
            Don`t have an account?{" "}
            <Link
              href="/account/signup"
              className="text-[#2E86DE] hover:text-[#2574C7] font-medium"
            >
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
