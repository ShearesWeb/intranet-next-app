// src\app\dashboard\home\page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { useRoleAuth } from "@/hooks/useRoleAuth";
import { usePhaseInfo } from "@/hooks/usePhaseInfo";
import { AppLayout } from "@/components/layout/app-layout";
import { AppLoading } from "@/components/layout/app-loading";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function Dashboard() {
    const { user } = useAuth();
    const { isAuthorized, loading: roleLoading } = useRoleAuth();
    const { phaseInfo } = usePhaseInfo();
    const [counter, setCounter] = useState(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            setCounter(prev => (prev < user.points ? prev + 1 : user.points));
        }, 20);

        return () => clearInterval(interval);
    }, [user]);

    const getRankCCAButtonText = () => {
        switch (phaseInfo.phase) {
            case 'maincomm_concurrent_ranking':
                return 'Rank Maincomm';
            case 'subcomm_concurrent_ranking':
                return 'Rank Subcomm';
            default:
                return 'CCA Ranking';
        }
    };

    const isSportsCultureAvailable = () => {
        return phaseInfo.phase === 'subcomm_concurrent_ranking';
    };

    if (!mounted || !user) {
        return <AppLoading />;
    }

    return (
        <AppLayout>
            <div className="space-y-6 p-6">
                {/* Welcome Section */}
                <Card className="border-none shadow-lg">
                    <CardHeader>
                        <h2 className="text-2xl font-semibold text-muted-foreground">
                            Welcome Back,
                        </h2>
                        <CardTitle className="text-4xl">
                            {user.name || user.email}
                        </CardTitle>
                    </CardHeader>
                </Card>

                {/* Content Grid */}
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Points Display Card */}
                    <Card className="border-none shadow-lg flex flex-col">
                        <CardHeader>
                            <CardTitle>Your Points</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex items-center justify-center p-8">
                            <div className="relative flex items-center justify-center">
                                {/* Animated Circles */}
                                <div className="absolute h-64 w-64 rounded-full bg-primary/5 animate-pulse" />
                                <div className="absolute h-48 w-48 rounded-full bg-primary/10 animate-pulse delay-75" />
                                <div className="absolute h-32 w-32 rounded-full bg-primary/20 animate-pulse delay-150" />

                                {/* Points Counter */}
                                <div className="relative z-10 flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 shadow-xl">
                                    <motion.span
                                        className="text-5xl font-bold text-primary-foreground"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                    >
                                        {user.points === undefined ? 0 : user.points}
                                    </motion.span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Activity Section Card */}
                    <Card className="border-none shadow-lg">
                        <CardHeader>
                            <CardTitle>My Activity</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* My CCAs Button */}
                            <div className="space-y-1">
                                <Link href="/dashboard/mycca">
                                    <Button
                                        className="w-full justify-start text-left h-auto py-3 cursor-pointer"
                                        variant="default"
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="font-semibold">My CCAs</span>
                                        </div>
                                    </Button>
                                </Link>
                                <p className="text-sm text-muted-foreground px-3">
                                    View your CCAs and Points
                                </p>
                            </div>

                            <Separator />

                            {/* Rank CCA Button */}
                            <div className="space-y-1">
                                <Link href="/dashboard/rank">
                                    <Button
                                        className="w-full justify-start text-left h-auto py-3 cursor-pointer"
                                        variant="default"
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="font-semibold">{getRankCCAButtonText()}</span>
                                        </div>
                                    </Button>
                                </Link>
                                <p className="text-sm text-muted-foreground px-3">
                                    Rank your CCA preferences
                                </p>
                            </div>

                            {/* Sports & Culture Button (conditional) */}
                            {isSportsCultureAvailable() && (
                                <>
                                    <Separator />
                                    <div className="space-y-1">
                                        <Link href="/dashboard/sportsCulture">
                                            <Button
                                                className="w-full justify-start text-left h-auto py-3 cursor-pointer"
                                                variant="default"
                                            >
                                                <div className="flex flex-col items-start">
                                                    <span className="font-semibold">Apply Sports & Culture</span>
                                                </div>
                                            </Button>
                                        </Link>
                                        <p className="text-sm text-muted-foreground px-3">
                                            Apply to Sports & Culture CCAs
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* Rank Applicants Button (conditional for authorized users) */}
                            {!roleLoading && isAuthorized && (
                                <>
                                    <Separator />
                                    <div className="space-y-1">
                                        <Link href="/dashboard/rankApplicants">
                                            <Button
                                                className="w-full justify-start text-left h-auto py-3 cursor-pointer"
                                                variant="default"
                                            >
                                                <div className="flex flex-col items-start">
                                                    <span className="font-semibold">Rank Applicants</span>
                                                </div>
                                            </Button>
                                        </Link>
                                        <p className="text-sm text-muted-foreground px-3">
                                            Rank applicants for your CCA
                                        </p>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}