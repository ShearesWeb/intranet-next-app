// src\app\dashboard\home\page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { useRoleAuth } from "@/hooks/useRoleAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { AppLoading } from "@/components/layout/app-loading";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PointsRecapCard } from "@/components/dashboard/points-recap-card";
import { getCoreServiceFlags } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Users, Trophy, Activity, ClipboardList, ChevronRight } from "lucide-react";

export default function Dashboard() {
    const { user } = useAuth();
    const { isAuthorized, loading: roleLoading } = useRoleAuth();
    const featureFlags = getCoreServiceFlags();
    const [hasSeenRecap, setHasSeenRecap] = useState(false);

    const getRankCCAButtonText = () => 'CCA Ranking';
    const isSportsCultureAvailable = () => featureFlags.ccaApplications;

    useEffect(() => {
        setHasSeenRecap(localStorage.getItem("hasSeenPointsRecap") === "true");
    }, []);

    if (!user) {
        return <AppLoading />;
    }

    return (
        <AppLayout>
            <div className="space-y-4 p-4 md:space-y-6 md:p-6">
                {/* Welcome Section */}
                <Card className="border-none shadow-lg bg-gradient-to-r from-orange-50/50 to-white">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <h2 className="text-xl font-medium">
                                {(() => {
                                    const hour = new Date().getHours();
                                    if (hour < 12) return "Good Morning";
                                    if (hour < 18) return "Good Afternoon";
                                    return "Good Evening";
                                })()}
                            </h2>
                        </div>
                        <CardTitle className="text-3xl md:text-5xl font-[family-name:var(--font-fredoka)] tracking-wide">
                            <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                                {user.name || user.email}
                            </span>
                        </CardTitle>
                    </CardHeader>
                </Card>

                {/* Content Grid */}
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Points Display Card - Enhanced Party Celebration */}
                    <Card className="border-none shadow-lg flex flex-col overflow-hidden relative">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span>{hasSeenRecap ? "Your Final Hall Points" : "Your Points"}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent
                            className={cn(
                                "relative flex-1 min-h-[300px] md:min-h-[400px]",
                                hasSeenRecap
                                    ? "flex items-start justify-start p-4 md:p-6"
                                    : "flex items-center justify-center p-4 md:p-8"
                            )}
                        >
                            <PointsRecapCard user={user} onSeenStateChange={setHasSeenRecap} />
                        </CardContent>
                    </Card>

                    {/* Activity Section Card */}
                    <Card className="border-none shadow-lg">
                        <CardHeader>
                            <CardTitle>My Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6">
                            <div className="grid gap-4">
                                {/* My CCAs Button */}
                                <Link href="/dashboard/mycca" className="block">
                                    <motion.div
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        whileTap={{ scale: 0.98 }}
                                        transition={{ duration: 0.2 }}
                                        className="group relative overflow-hidden rounded-xl border border-orange-100 bg-white p-4 shadow-sm transition-all hover:border-orange-300 hover:shadow-md"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                                        <div className="relative flex items-center gap-4">
                                            <div className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                                                <Users className="h-5 w-5 md:h-6 md:w-6" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-gray-900 group-hover:text-orange-700 transition-colors">My CCAs</h3>
                                                <p className="text-sm text-gray-500 group-hover:text-orange-600/80 transition-colors">View your CCAs and Points</p>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-gray-300 transition-colors group-hover:text-orange-500" />
                                        </div>
                                    </motion.div>
                                </Link>

                                {/* Rank CCA Button */}
                                {featureFlags.ccaApplications && (
                                    <Link href="/dashboard/ccaAllocation/rank" className="block">
                                        <motion.div
                                            whileHover={{ scale: 1.02, y: -2 }}
                                            whileTap={{ scale: 0.98 }}
                                            transition={{ duration: 0.2 }}
                                            className="group relative overflow-hidden rounded-xl border border-orange-100 bg-white p-4 shadow-sm transition-all hover:border-orange-300 hover:shadow-md"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                                            <div className="relative flex items-center gap-4">
                                                <div className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                                                    <Trophy className="h-5 w-5 md:h-6 md:w-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-gray-900 group-hover:text-orange-700 transition-colors">{getRankCCAButtonText()}</h3>
                                                    <p className="text-sm text-gray-500 group-hover:text-orange-600/80 transition-colors">Rank your CCA preferences</p>
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-gray-300 transition-colors group-hover:text-orange-500" />
                                            </div>
                                        </motion.div>
                                    </Link>
                                )}

                                {/* Sports & Culture Button (conditional) */}
                                {isSportsCultureAvailable() && (
                                    <Link href="/dashboard/sportsCulture" className="block">
                                        <motion.div
                                            whileHover={{ scale: 1.02, y: -2 }}
                                            whileTap={{ scale: 0.98 }}
                                            transition={{ duration: 0.2 }}
                                            className="group relative overflow-hidden rounded-xl border border-orange-100 bg-white p-4 shadow-sm transition-all hover:border-orange-300 hover:shadow-md"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                                            <div className="relative flex items-center gap-4">
                                                <div className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                                                    <Activity className="h-5 w-5 md:h-6 md:w-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-gray-900 group-hover:text-orange-700 transition-colors">Apply Sports & Culture</h3>
                                                    <p className="text-sm text-gray-500 group-hover:text-orange-600/80 transition-colors">Apply to Sports & Culture CCAs</p>
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-gray-300 transition-colors group-hover:text-orange-500" />
                                            </div>
                                        </motion.div>
                                    </Link>
                                )}

                                {/* Rank Applicants Button (conditional for authorized users) */}
                                {featureFlags.ccaApplications && !roleLoading && isAuthorized && (
                                    <Link href="/dashboard/ccaAllocation/rankApplicants" className="block">
                                        <motion.div
                                            whileHover={{ scale: 1.02, y: -2 }}
                                            whileTap={{ scale: 0.98 }}
                                            transition={{ duration: 0.2 }}
                                            className="group relative overflow-hidden rounded-xl border border-orange-100 bg-white p-4 shadow-sm transition-all hover:border-orange-300 hover:shadow-md"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                                            <div className="relative flex items-center gap-4">
                                                <div className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                                                    <ClipboardList className="h-5 w-5 md:h-6 md:w-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-gray-900 group-hover:text-orange-700 transition-colors">Rank Applicants</h3>
                                                    <p className="text-sm text-gray-500 group-hover:text-orange-600/80 transition-colors">Rank applicants for your CCA</p>
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-gray-300 transition-colors group-hover:text-orange-500" />
                                            </div>
                                        </motion.div>
                                    </Link>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
