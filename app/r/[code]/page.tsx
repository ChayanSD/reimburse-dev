"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Gift,
    CheckCircle2,
    ArrowRight,
    ShieldCheck,
    Zap,
    Star,
    Receipt,
    FileText,
    Users
} from "lucide-react";
import Link from "next/link";

export default function ReferralLandingPage() {
    const params = useParams();
    const router = useRouter();
    const code = params.code as string;
    const [redirecting, setRedirecting] = useState(false);

    const handleJoin = () => {
        setRedirecting(true);
        router.push(`/account/signup?ref=${code}`);
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

                {/* CTA Button */}
                <button
                    onClick={handleJoin}
                    disabled={redirecting}
                    className="group relative flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white text-black font-bold text-lg hover:bg-violet-50 transition-all active:scale-95 disabled:opacity-50 animate-in fade-in slide-in-from-bottom-10 duration-1000 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(139,92,246,0.3)]"
                >
                    {redirecting ? (
                        <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                        <>
                            Accept Invitation
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>

                {/* Reward Highlights */}
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

                {/* Social Proof / Trust */}
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
