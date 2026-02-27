"use client";

import { Award, TrendingUp, Shield, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AmbassadorCallout() {
    return (
        <section className="py-20 px-6 bg-[#2E86DE]" id="ambassador">
            <div className="max-w-[1200px] mx-auto text-white">
                <div className="flex flex-col lg:flex-row items-center gap-12">
                    {/* Text Content */}
                    <div className="flex-1 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full mb-6">
                            <Award size={16} className="text-white" />
                            <span className="text-xs font-bold uppercase tracking-wider">Ambassador Program</span>
                        </div>

                        <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight" style={{ fontFamily: "Poppins, sans-serif" }}>
                            Help us grow, <br />
                            <span className="text-blue-100">get rewarded for life.</span>
                        </h2>

                        <p className="text-xl text-blue-50 mb-10 max-w-xl opacity-90 leading-relaxed">
                            Join our exclusive Ambassador Program and earn
                            <span className="font-bold text-white"> 10% recurring commission</span> on
                            every user you refer, plus a permanent
                            <span className="font-bold text-white"> 15% discount</span> on your own plan.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                            <Link
                                href="/account/signup"
                                className="w-full sm:w-auto px-8 py-4 bg-white text-[#2E86DE] font-bold rounded-2xl hover:bg-blue-50 transition-all flex items-center justify-center gap-2 group"
                            >
                                Start Earning
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link
                                href="/account/signin"
                                className="w-full sm:w-auto px-8 py-4 bg-[#2E86DE] border border-white/30 text-white font-bold rounded-2xl hover:bg-white/10 transition-all text-center"
                            >
                                Log In to Referral Dashboard
                            </Link>
                        </div>
                    </div>

                    {/* Benefit Cards Overlay */}
                    <div className="flex-1 w-full max-w-lg lg:max-w-md mt-8 lg:mt-0">
                        <div className="relative pt-8 pb-12 sm:pb-16 lg:py-0">
                            {/* Card 1 */}
                            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative z-10 transform sm:-rotate-2 hover:rotate-0 transition-transform duration-500 max-w-[90%] sm:max-w-full">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                                    <TrendingUp size={24} className="text-[#2E86DE]" />
                                </div>
                                <h4 className="text-gray-900 text-lg sm:text-xl font-bold mb-2">Passive Income</h4>
                                <p className="text-gray-600 text-sm sm:text-base">Earn monthly commissions for every active user you bring to ReimburseMe.</p>
                            </div>

                            {/* Card 2 */}
                            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl absolute bottom-0 right-0 z-20 transform rotate-3 hover:rotate-0 transition-transform duration-500 hidden sm:block">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-4">
                                    <Shield size={24} className="text-green-600" />
                                </div>
                                <h4 className="text-gray-900 text-lg sm:text-xl font-bold mb-2">Lifetime Perks</h4>
                                <p className="text-gray-600 text-sm sm:text-base">Unlock a permanent discount once you reach Level 6.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
