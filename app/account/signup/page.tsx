"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
  accept_terms: boolean;
}

interface FormErrors {
  first_name?: string;
  last_name?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  accept_terms?: string;
  submit?: string;
}

interface PasswordRules {
  length: RegExp;
  uppercase: RegExp;
  lowercase: RegExp;
  number: RegExp;
  symbol: RegExp;
}

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Pick up referral code from ?ref= param and set cookie so Google flow also works
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      document.cookie = `ref=${ref}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
    }
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const result = await authClient.signInWithGoogle();
      if (result.success) {
        router.push("/dashboard");
      } else {
        setGoogleError(result.error || "Google sign-in failed. Try again.");
        setGoogleLoading(false);
      }
    } catch {
      setGoogleError("Something went wrong. Please try again.");
      setGoogleLoading(false);
    }
  };


  const [formData, setFormData] = useState<FormData>({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
    accept_terms: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [isValidForm, setIsValidForm] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // Password validation rules
  const passwordRules: PasswordRules = {
    length: /.{8,72}/,
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /[0-9]/,
    symbol: /[!@#$%^&*]/,
  };

  // Validate individual fields
  const validateField = (
    name: keyof FormData,
    value: string | boolean,
    allData: FormData = formData
  ): FormErrors => {
    const newErrors: FormErrors = { ...errors };

    switch (name) {
      case "first_name":
      case "last_name":
        const strValue = value as string;
        if (!strValue.trim()) {
          newErrors[name] = `${name.replace("_", " ")} is required`;
        } else if (!/^[a-zA-Z\s\-']{1,60}$/.test(strValue)) {
          newErrors[name] =
            "Only letters, spaces, hyphens, and apostrophes (1-60 chars)";
        } else {
          delete newErrors[name];
        }
        break;

      case "email":
        const emailValue = value as string;
        if (!emailValue.trim()) {
          newErrors[name] = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
          newErrors[name] = "Please enter a valid email address";
        } else {
          delete newErrors[name];
        }
        break;

      case "password":
        const passwordValue = value as string;
        const failedRules = [];
        if (!passwordRules.length.test(passwordValue))
          failedRules.push("at least 8 characters");
        if (!passwordRules.uppercase.test(passwordValue))
          failedRules.push("1 uppercase letter");
        if (!passwordRules.lowercase.test(passwordValue))
          failedRules.push("1 lowercase letter");
        if (!passwordRules.number.test(passwordValue))
          failedRules.push("1 number");
        if (!passwordRules.symbol.test(passwordValue))
          failedRules.push("1 symbol (!@#$%^&*)");

        if (failedRules.length > 0) {
          newErrors[name] = `Password must contain ${failedRules.join(", ")}`;
        } else {
          delete newErrors[name];
        }

        // Also validate confirm password if it exists
        if (
          allData.confirm_password &&
          passwordValue !== allData.confirm_password
        ) {
          newErrors.confirm_password = "Passwords do not match";
        } else if (
          allData.confirm_password &&
          passwordValue === allData.confirm_password
        ) {
          delete newErrors.confirm_password;
        }
        break;

      case "confirm_password":
        const confirmValue = value as string;
        if (!confirmValue.trim()) {
          newErrors[name] = "Please confirm your password";
        } else if (confirmValue !== allData.password) {
          newErrors[name] = "Passwords do not match";
        } else {
          delete newErrors[name];
        }
        break;

      case "accept_terms":
        const boolValue = value as boolean;
        if (!boolValue) {
          newErrors[name] = "You must accept the terms and privacy policy";
        } else {
          delete newErrors[name];
        }
        break;
    }

    return newErrors;
  };

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const fieldName = name as keyof FormData;
    const newValue = type === "checkbox" ? checked : value;
    const newFormData = { ...formData, [fieldName]: newValue };

    setFormData(newFormData);

    // Real-time validation
    const newErrors = validateField(fieldName, newValue, newFormData);
    setErrors(newErrors);
  };

  // Check if form is valid
  useEffect(() => {
    const hasNoErrors = Object.keys(errors).length === 0;
    const allFieldsFilled = Object.entries(formData).every(([key, value]) => {
      if (key === "accept_terms") return value === true;
      return (value as string).trim() !== "";
    });

    setIsValidForm(hasNoErrors && allFieldsFilled);
  }, [formData, errors]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isValidForm) return;

    setLoading(true);

    try {
      const ref = searchParams.get("ref") || undefined;
      const result = await signup(
        formData.email,
        formData.password,
        formData.first_name,
        formData.last_name,
        ref,
      );

      if (result.success) {
        if (result.requiresVerification) {
          setEmailSent(true);
          setUserEmail(formData.email);
        } else {
          router.push("/dashboard");
        }
      } else {
        setErrors({ submit: result.error || "Signup failed" });
      }
    } catch (error) {
      console.error("Signup error:", error);
      setErrors({ submit: "An unexpected error occurred" });
    } finally {
      setLoading(false);
    }
  };

  // Show email verification message
  if (emailSent) {
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
              Check Your Email
            </h1>
            <p className="text-gray-600">We've sent you a verification link</p>
          </div>

          {/* Success Message */}
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
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
                  d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Account Created Successfully!
            </h2>

            <p className="text-gray-600 mb-6">
              We've sent a verification email to <strong>{userEmail}</strong>.
              Please check your inbox and click the verification link to
              activate your account.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-center mb-2">
                <svg
                  className="w-5 h-5 text-blue-600 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-blue-800 font-medium">Next Steps:</span>
              </div>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• Check your email inbox (and spam folder)</li>
                <li>• Click the verification link in the email</li>
                <li>• Return here to sign in to your account</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Link
                href="/account/signin"
                className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-2xl text-white bg-[#2E86DE] hover:bg-[#2574C7] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2E86DE] transition-colors"
              >
                Go to Sign In
              </Link>

              <button
                onClick={() => {
                  setEmailSent(false);
                  setFormData({
                    first_name: "",
                    last_name: "",
                    email: "",
                    password: "",
                    confirm_password: "",
                    accept_terms: false,
                  });
                  setErrors({});
                }}
                className="w-full inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-2xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2E86DE] transition-colors"
              >
                Create Another Account
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-6">
              Didn't receive the email? Check your spam folder or try signing up
              again.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
            Create Account
          </h1>
          <p className="text-gray-600">
            Join ReimburseMe and start managing your expenses
          </p>
        </div>

        {/* Google Sign-In */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-2xl hover:bg-gray-50 transition-colors font-medium text-gray-700 disabled:opacity-50"
          >
            {googleLoading ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            {googleLoading ? "Signing in..." : "Continue with Google"}
          </button>
          {googleError && (
            <p className="text-red-500 text-sm mt-2 text-center">{googleError}</p>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-sm text-gray-400">or sign up with email</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent transition-colors ${errors.first_name ? "border-red-500" : "border-gray-300"
                  }`}
                placeholder="First name"
                maxLength={60}
                required
              />
              {errors.first_name && (
                <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent transition-colors ${errors.last_name ? "border-red-500" : "border-gray-300"
                  }`}
                placeholder="Last name"
                maxLength={60}
                required
              />
              {errors.last_name && (
                <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent transition-colors ${errors.email ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="your@email.com"
              required
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent transition-colors ${errors.password ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="Create a strong password"
              maxLength={72}
              required
            />

            {/* Password Rules */}
            <div className="mt-3 p-4 bg-gray-50 rounded-2xl">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Password must contain:
              </p>
              <ul className="text-sm space-y-1">
                <li
                  className={`flex items-center ${passwordRules.length.test(formData.password)
                    ? "text-green-600"
                    : "text-gray-500"
                    }`}
                >
                  <span className="mr-2 text-lg">
                    {passwordRules.length.test(formData.password) ? "✓" : "○"}
                  </span>
                  At least 8 characters
                </li>
                <li
                  className={`flex items-center ${passwordRules.uppercase.test(formData.password)
                    ? "text-green-600"
                    : "text-gray-500"
                    }`}
                >
                  <span className="mr-2 text-lg">
                    {passwordRules.uppercase.test(formData.password)
                      ? "✓"
                      : "○"}
                  </span>
                  1 uppercase letter
                </li>
                <li
                  className={`flex items-center ${passwordRules.lowercase.test(formData.password)
                    ? "text-green-600"
                    : "text-gray-500"
                    }`}
                >
                  <span className="mr-2 text-lg">
                    {passwordRules.lowercase.test(formData.password)
                      ? "✓"
                      : "○"}
                  </span>
                  1 lowercase letter
                </li>
                <li
                  className={`flex items-center ${passwordRules.number.test(formData.password)
                    ? "text-green-600"
                    : "text-gray-500"
                    }`}
                >
                  <span className="mr-2 text-lg">
                    {passwordRules.number.test(formData.password) ? "✓" : "○"}
                  </span>
                  1 number
                </li>
                <li
                  className={`flex items-center ${passwordRules.symbol.test(formData.password)
                    ? "text-green-600"
                    : "text-gray-500"
                    }`}
                >
                  <span className="mr-2 text-lg">
                    {passwordRules.symbol.test(formData.password) ? "✓" : "○"}
                  </span>
                  1 symbol (!@#$%^&*)
                </li>
              </ul>
            </div>

            {errors.password && (
              <p className="text-red-500 text-sm mt-2">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent transition-colors ${errors.confirm_password ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="Confirm your password"
              maxLength={72}
              required
            />
            {errors.confirm_password && (
              <p className="text-red-500 text-sm mt-1">
                {errors.confirm_password}
              </p>
            )}
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start">
            <input
              type="checkbox"
              name="accept_terms"
              checked={formData.accept_terms}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-[#2E86DE] focus:ring-[#2E86DE] border-gray-300 rounded"
            />
            <label className="ml-3 text-sm text-gray-600">
              By continuing, you agree to the{" "}
              <Link href="/terms" className="text-[#2E86DE] hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-[#2E86DE] hover:underline">
                Privacy Policy
              </Link>
            </label>
          </div>
          {errors.accept_terms && (
            <p className="text-red-500 text-sm">{errors.accept_terms}</p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isValidForm || loading}
            className={`w-full py-3 px-4 rounded-2xl font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:ring-offset-2 ${isValidForm && !loading
              ? "bg-[#2E86DE] hover:bg-[#2574C7]"
              : "bg-gray-300 cursor-not-allowed"
              }`}
          >
            {loading ? "Creating Account..." : "Continue"}
          </button>

          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-600 text-center">
              {errors.submit}
            </div>
          )}
        </form>

        {/* Login Link */}
        <div className="mt-8 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            href="/account/signin"
            className="text-[#2E86DE] hover:text-[#2574C7] font-medium"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#2E86DE] border-t-transparent rounded-full animate-spin" /></div>}>
      <SignUpContent />
    </Suspense>
  );
}

