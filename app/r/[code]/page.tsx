"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Gift,
    ArrowRight,
    ShieldCheck,
    Zap,
    Star,
} from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function ReferralLandingPage() {
    const params = useParams();
    const router = useRouter();
    const code = params.code as string;
    const [redirecting, setRedirecting] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleError, setGoogleError] = useState<string | null>(null);

    // Set ref cookie as soon as the landing page loads so it's available
    // for both email signup AND Google sign-in flows.
    useEffect(() => {
        if (code) {
            document.cookie = `ref=${code}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
        }
    }, [code]);

    const handleJoin = () => {
        setRedirecting(true);
        router.push(`/account/signup?ref=${code}`);
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        setGoogleError(null);
        try {
            // The ref cookie is already set above; the /api/auth/google backend
            // will read it and attribute the referral automatically.
            const result = await authClient.signInWithGoogle();
            if (result.success) {
                router.push("/dashboard");
            } else {
                setGoogleError(result.error || "Google sign-in failed. Please try again.");
                setGoogleLoading(false);
            }
        } catch {
            setGoogleError("Something went wrong. Please try again.");
            setGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white selection:bg-violet-500/30">
            {/* Background Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative max-w-4xl mx-auto px-6 py-20 flex flex-col items-center text-center">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <Star className="w-4 h-4 text-violet-400 fill-violet-400" />
                    <span className="text-sm font-medium text-violet-300 tracking-wide uppercase italic">Exclusive Invitation</span>
                </div>

                {/* Hero Section */}
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-6 duration-1000">
                    You've been invited to <br />
                    <span className="text-violet-500">ReimburseMe</span>
                </h1>

                <p className="text-xl text-gray-400 max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    Simplify your expenses, automate your reports, and join a community of efficient professionals.
                    Use code <span className="text-white font-mono font-bold bg-gray-800 px-2 py-1 rounded">{code}</span> to unlock special rewards.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm animate-in fade-in slide-in-from-bottom-10 duration-1000">
                    {/* Google Sign-In */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={googleLoading || redirecting}
                        className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white text-gray-900 font-semibold text-base hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.08)] flex-1"
                    >
                        {googleLoading ? (
                            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                        ) : (
                            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                        )}
                        {googleLoading ? "Signing in..." : "Continue with Google"}
                    </button>

                    {/* Email Signup */}
                    <button
                        onClick={handleJoin}
                        disabled={redirecting || googleLoading}
                        className="group flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-base transition-all active:scale-95 disabled:opacity-50 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.4)] flex-1"
                    >
                        {redirecting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Sign up with Email
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </div>

                {/* Already have account link */}
                <p className="mt-5 text-sm text-gray-500 animate-in fade-in duration-1000">
                    Already have an account?{" "}
                    <Link href={`/account/signin`} className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">
                        Sign in here
                    </Link>
                </p>

                {googleError && (
                    <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl">
                        {googleError}
                    </p>
                )}

                {/* Feature Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 animate-in fade-in slide-in-from-bottom-12 duration-1000">
                    <div className="p-8 rounded-3xl bg-gray-900/50 border border-gray-800/50 backdrop-blur-sm group hover:border-violet-500/30 transition-colors">
                        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Gift className="w-6 h-6 text-violet-400" />
                        </div>
                        <h3 className="text-lg font-bold mb-3">Earn Points</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Unlock points for every action you take. Redeem them for real subscription credits.
                        </p>
                    </div>

                    <div className="p-8 rounded-3xl bg-gray-900/50 border border-gray-800/50 backdrop-blur-sm group hover:border-violet-500/30 transition-colors">
                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <ShieldCheck className="w-6 h-6 text-cyan-400" />
                        </div>
                        <h3 className="text-lg font-bold mb-3">Smart Expense Tracking</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            AI-powered OCR extracts data from any receipt instantly. No more manual entry.
                        </p>
                    </div>

                    <div className="p-8 rounded-3xl bg-gray-900/50 border border-gray-800/50 backdrop-blur-sm group hover:border-violet-500/30 transition-colors">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Zap className="w-6 h-6 text-amber-400" />
                        </div>
                        <h3 className="text-lg font-bold mb-3">One-Click Reports</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Generate PDF or CSV reports for reimbursement in seconds. Keep your accountant happy.
                        </p>
                    </div>
                </div>

                {/* Social Proof */}
                <div className="mt-32 pt-12 border-t border-gray-800/50 w-full animate-in fade-in duration-1000 delay-500">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-12">Trusted by teams at</p>
                    <div className="flex flex-wrap justify-center gap-x-16 gap-y-10 opacity-30 grayscale brightness-200">
                        <div className="text-2xl font-black italic tracking-tighter">FINANCE.IO</div>
                        <div className="text-2xl font-black italic tracking-tighter">CLOUDCORE</div>
                        <div className="text-2xl font-black italic tracking-tighter">PAYLIFT</div>
                        <div className="text-2xl font-black italic tracking-tighter">VELOCITY</div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="mt-32 flex flex-col items-center gap-6 text-gray-500 text-sm">
                    <p>© 2026 ReimburseMe. All rights reserved.</p>
                    <div className="flex gap-8">
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                        <Link href="/security" className="hover:text-white transition-colors">Security</Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}
