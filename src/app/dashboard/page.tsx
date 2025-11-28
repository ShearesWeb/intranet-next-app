// src\app\dashboard\home\page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { Users, Trophy, Activity, ClipboardList, ChevronRight } from "lucide-react";

export default function Dashboard() {
    const { user } = useAuth();
    const { isAuthorized, loading: roleLoading } = useRoleAuth();
    const { phaseInfo } = usePhaseInfo();
    const [mounted, setMounted] = useState(false);
    const [celebrated, setCelebrated] = useState(false);
    const [counter, setCounter] = useState(0);

    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            setCounter(prev => (prev < (user.points || 0) ? prev + 1 : (user.points || 0)));
        }, 20);

        return () => clearInterval(interval);
    }, [user]);

    // Memoize particle data to prevent random movement on re-renders
    const leftPopperParticles = useMemo(() => {
        return Array.from({ length: 50 }).map((_, i) => {
            const angle = -120 + (Math.random() * 100 - 50);
            const distance = 150 + Math.random() * 200;
            const x = Math.cos((angle * Math.PI) / 180) * distance;
            const y = Math.sin((angle * Math.PI) / 180) * distance - 80;
            const delay = i * 0.02;
            const duration = 1 + Math.random() * 0.8;
            const rotation = Math.random() * 1440 - 720;
            const shapeType = i % 6;
            const colors = ['#ff6b35', '#f97316', '#fb923c', '#fdba74', '#fbbf24', '#fcd34d', '#ff8c42'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            return { x, y, delay, duration, rotation, shapeType, color };
        });
    }, []);

    const rightPopperParticles = useMemo(() => {
        return Array.from({ length: 50 }).map((_, i) => {
            const angle = -60 + (Math.random() * 100 - 50);
            const distance = 150 + Math.random() * 200;
            const x = Math.cos((angle * Math.PI) / 180) * distance;
            const y = Math.sin((angle * Math.PI) / 180) * distance - 80;
            const delay = i * 0.02;
            const duration = 1 + Math.random() * 0.8;
            const rotation = Math.random() * 1440 - 720;
            const shapeType = i % 6;
            const colors = ['#ff6b35', '#f97316', '#fb923c', '#fdba74', '#fbbf24', '#fcd34d', '#ff8c42'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            return { x, y, delay, duration, rotation, shapeType, color };
        });
    }, []);

    const topBurstParticles = useMemo(() => {
        return Array.from({ length: 50 }).map((_, i) => {
            const angle = -90 + (Math.random() * 120 - 60);
            const distance = 130 + Math.random() * 180;
            const x = Math.cos((angle * Math.PI) / 180) * distance;
            const y = Math.sin((angle * Math.PI) / 180) * distance;
            const delay = 0.4 + i * 0.015;
            const duration = 0.9 + Math.random() * 0.7;
            const rotation = Math.random() * 1080 - 540;
            const shapeType = i % 6;
            const colors = ['#ff6b35', '#f97316', '#fb923c', '#fbbf24', '#fcd34d', '#ff8c42', '#fdba74'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            return { x, y, delay, duration, rotation, shapeType, color };
        });
    }, []);

    const streamingCircles = useMemo(() => {
        const points = user?.points || 0;
        const baseParticles = 12;
        const maxParticlesAtCeiling = 120; // at 300 points
        const ceiling = 300;

        // Linear interpolation: 0 points -> 12 particles, 300 points -> 120 particles
        let particleCount = baseParticles + (points / ceiling) * (maxParticlesAtCeiling - baseParticles);

        // Cap it reasonably to prevent lag if points are huge
        particleCount = Math.min(particleCount, 200);

        return Array.from({ length: Math.floor(particleCount) }).map((_, i) => {
            const angle = Math.random() * 360;
            const distance = 120 + Math.random() * 180;
            const x = Math.cos((angle * Math.PI) / 180) * distance;
            const y = Math.sin((angle * Math.PI) / 180) * distance;

            // Spread delays evenly over ~2.5s to ensure consistent stream density
            const delay = i * (2.5 / particleCount);

            const duration = 2 + Math.random() * 1.5;
            const colors = ['#ff6b35', '#f97316', '#fb923c', '#fdba74', '#fbbf24', '#fcd34d', '#ff8c42'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = Math.random() > 0.5 ? '8px' : '12px';
            return { x, y, delay, duration, color, size };
        });
    }, [user?.points]);

    const ribbons = useMemo(() => {
        return Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 45);
            const distance = 150 + Math.random() * 50;
            const x = Math.cos((angle * Math.PI) / 180) * distance;
            const y = Math.sin((angle * Math.PI) / 180) * distance;
            const delay = i * 0.15;
            return { x, y, delay };
        });
    }, []);

    const centralSparkles = useMemo(() => {
        return Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 360) / 24;
            const distanceVariation = (i % 3) * 15;
            const distance = 70 + distanceVariation;
            const x = Math.cos((angle * Math.PI) / 180) * distance;
            const y = Math.sin((angle * Math.PI) / 180) * distance;
            const delay = i * 0.05;
            const colors = ['#ff6b35', '#f97316', '#fbbf24', '#fb923c'];
            const color = colors[i % colors.length];
            return { x, y, delay, color };
        });
    }, []);

    useEffect(() => {
        setMounted(true);
        // Trigger celebration burst, then settle after 4 seconds
        const timer = setTimeout(() => setCelebrated(true), 4000);
        return () => clearTimeout(timer);
    }, []);

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
                                <span>Your Points</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex items-center justify-center p-4 md:p-8 relative min-h-[300px] md:min-h-[400px]">
                            <div className="relative flex items-center justify-center w-full h-full">


                                {/* Multi-layer pulsing circles with varied timing - DIALED DOWN RADIUS */}
                                <motion.div
                                    className="absolute h-48 w-48 md:h-64 md:w-64 rounded-full bg-gradient-to-br from-orange-400/30 to-orange-500/20"
                                    animate={{
                                        scale: [1, 1.15, 1],
                                        opacity: [0.4, 0.8, 0.4],
                                        rotate: [0, 180, 360]
                                    }}
                                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                />
                                <motion.div
                                    className="absolute h-40 w-40 md:h-56 md:w-56 rounded-full bg-gradient-to-tl from-orange-500/35 to-orange-400/25"
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        opacity: [0.5, 0.9, 0.5],
                                        rotate: [360, 180, 0]
                                    }}
                                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                />
                                <motion.div
                                    className="absolute h-32 w-32 md:h-48 md:w-48 rounded-full bg-gradient-to-br from-yellow-400/25 to-orange-400/30"
                                    animate={{
                                        scale: [1, 1.1, 1],
                                        opacity: [0.6, 1, 0.6]
                                    }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                                />

                                {/* Left Popper - Initial Burst Only */}
                                {mounted && !celebrated && leftPopperParticles.map((p, i) => (
                                    <motion.div
                                        key={`confetti-left-${i}`}
                                        className="absolute pointer-events-none"
                                        style={{
                                            width: p.shapeType === 5 ? '24px' : p.shapeType === 0 ? '12px' : '10px',
                                            height: p.shapeType === 5 ? '24px' : p.shapeType === 3 ? '20px' : p.shapeType === 0 ? '12px' : '8px',
                                            backgroundColor: p.shapeType === 5 ? 'transparent' : p.color,
                                            borderRadius: p.shapeType === 0 ? '50%' : p.shapeType === 4 ? '2px' : '0px',
                                            opacity: 0.95,
                                            clipPath: p.shapeType === 2 ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none'
                                        }}
                                        initial={{ x: -120, y: -70, opacity: 0, scale: 0, rotate: 0 }}
                                        animate={{
                                            x: p.x,
                                            y: p.y + 150,
                                            opacity: [0, 1, 1, 0.8, 0],
                                            scale: [0, 1.5, 1.2, 1, 0.7],
                                            rotate: p.rotation
                                        }}
                                        transition={{
                                            duration: p.duration,
                                            delay: p.delay,
                                            ease: "easeOut"
                                        }}
                                    >
                                        {p.shapeType === 5 && (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill={p.color}>
                                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                                            </svg>
                                        )}
                                    </motion.div>
                                ))}

                                {/* Right Popper - Initial Burst Only */}
                                {mounted && !celebrated && rightPopperParticles.map((p, i) => (
                                    <motion.div
                                        key={`confetti-right-${i}`}
                                        className="absolute pointer-events-none"
                                        style={{
                                            width: p.shapeType === 5 ? '24px' : p.shapeType === 0 ? '12px' : '10px',
                                            height: p.shapeType === 5 ? '24px' : p.shapeType === 3 ? '20px' : p.shapeType === 0 ? '12px' : '8px',
                                            backgroundColor: p.shapeType === 5 ? 'transparent' : p.color,
                                            borderRadius: p.shapeType === 0 ? '50%' : p.shapeType === 4 ? '2px' : '0px',
                                            opacity: 0.95,
                                            clipPath: p.shapeType === 2 ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none'
                                        }}
                                        initial={{ x: 120, y: -70, opacity: 0, scale: 0, rotate: 0 }}
                                        animate={{
                                            x: p.x,
                                            y: p.y + 150,
                                            opacity: [0, 1, 1, 0.8, 0],
                                            scale: [0, 1.5, 1.2, 1, 0.7],
                                            rotate: p.rotation
                                        }}
                                        transition={{
                                            duration: p.duration,
                                            delay: p.delay,
                                            ease: "easeOut"
                                        }}
                                    >
                                        {p.shapeType === 5 && (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill={p.color}>
                                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                                            </svg>
                                        )}
                                    </motion.div>
                                ))}

                                {/* Top Burst - Initial Burst Only */}
                                {mounted && !celebrated && topBurstParticles.map((p, i) => (
                                    <motion.div
                                        key={`confetti-top-${i}`}
                                        className="absolute pointer-events-none"
                                        style={{
                                            width: p.shapeType === 5 ? '20px' : p.shapeType === 0 ? '11px' : '9px',
                                            height: p.shapeType === 5 ? '20px' : p.shapeType === 3 ? '18px' : p.shapeType === 0 ? '11px' : '9px',
                                            backgroundColor: p.shapeType === 5 ? 'transparent' : p.color,
                                            borderRadius: p.shapeType === 0 ? '50%' : '1px',
                                            opacity: 0.85,
                                            clipPath: p.shapeType === 2 ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none'
                                        }}
                                        initial={{ x: 0, y: -90, opacity: 0, scale: 0, rotate: 0 }}
                                        animate={{
                                            x: p.x,
                                            y: p.y + 140,
                                            opacity: [0, 1, 0.95, 0],
                                            scale: [0, 1.3, 1, 0.7],
                                            rotate: p.rotation
                                        }}
                                        transition={{
                                            duration: p.duration,
                                            delay: p.delay,
                                            ease: "easeOut"
                                        }}
                                    >
                                        {p.shapeType === 5 && (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill={p.color}>
                                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                                            </svg>
                                        )}
                                    </motion.div>
                                ))}

                                {/* Continuous Streaming Circles - Active when Celebrated */}
                                {mounted && celebrated && streamingCircles.map((p, i) => (
                                    <motion.div
                                        key={`streaming-circle-${i}`}
                                        className="absolute pointer-events-none rounded-full"
                                        style={{
                                            width: p.size,
                                            height: p.size,
                                            backgroundColor: p.color,
                                            opacity: 0.7
                                        }}
                                        initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                                        animate={{
                                            x: p.x,
                                            y: p.y,
                                            opacity: [0, 1, 0.8, 0],
                                            scale: [0, 1, 1, 0.5]
                                        }}
                                        transition={{
                                            duration: p.duration,
                                            delay: p.delay,
                                            repeat: Infinity,
                                            ease: "easeOut"
                                        }}
                                    />
                                ))}

                                {/* Elegant Ribbons - Initial Only */}
                                {mounted && !celebrated && ribbons.map((p, i) => (
                                    <motion.div
                                        key={`ribbon-${i}`}
                                        className="absolute pointer-events-none"
                                        initial={{ x: 0, y: 0, opacity: 0, scaleY: 0, rotate: 0 }}
                                        animate={{
                                            x: p.x,
                                            y: p.y,
                                            opacity: [0, 0.7, 0.7, 0],
                                            scaleY: [0, 1.2, 1, 0.5],
                                            rotate: [0, 180 + (i * 45), 360 + (i * 45)]
                                        }}
                                        transition={{
                                            duration: 2.5,
                                            delay: p.delay,
                                            ease: "easeOut"
                                        }}
                                    >
                                        <div
                                            className="w-1.5 h-16 rounded-full opacity-60"
                                            style={{
                                                background: i % 2 === 0
                                                    ? 'linear-gradient(to bottom, #f97316, transparent)'
                                                    : 'linear-gradient(to bottom, #fbbf24, transparent)'
                                            }}
                                        />
                                    </motion.div>
                                ))}

                                {/* Central radial burst sparkles - Initial Only */}
                                {mounted && !celebrated && centralSparkles.map((p, i) => (
                                    <motion.div
                                        key={`burst-${i}`}
                                        className="absolute w-2 h-2 rounded-full"
                                        style={{
                                            background: p.color,
                                            opacity: 0.5
                                        }}
                                        initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                                        animate={{
                                            x: p.x,
                                            y: p.y,
                                            opacity: [0, 0.9, 0.6, 0],
                                            scale: [0, 1.8, 1.2, 0]
                                        }}
                                        transition={{
                                            duration: 2,
                                            delay: p.delay,
                                            ease: "easeOut"
                                        }}
                                    />
                                ))}

                                {/* Main Points Display - NO OUTLINE */}
                                <motion.div
                                    className="relative z-10 flex h-32 w-32 md:h-48 md:w-48 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 shadow-2xl"
                                    style={{
                                        boxShadow: '0 0 40px rgba(249, 115, 22, 0.4), 0 0 80px rgba(249, 115, 22, 0.2), inset 0 2px 20px rgba(255, 255, 255, 0.2)'
                                    }}
                                    animate={{
                                        rotate: [0, 3, -3, 0],
                                        scale: [1, 1.03, 1]
                                    }}
                                    transition={{
                                        duration: 5,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                >
                                    {/* Points content */}
                                    <motion.div
                                        className="flex flex-col items-center"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.6, ease: "easeOut" }}
                                    >
                                        <motion.span
                                            className="text-4xl md:text-6xl font-extrabold text-white"
                                            style={{
                                                textShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 40px rgba(255,255,255,0.4)'
                                            }}
                                            animate={{
                                                scale: [1, 1.08, 1]
                                            }}
                                            transition={{
                                                duration: 3,
                                                repeat: Infinity,
                                                ease: "easeInOut"
                                            }}
                                        >
                                            {counter}
                                        </motion.span>
                                        <span className="text-sm font-semibold text-white/90 mt-1 tracking-wider uppercase">
                                            Points
                                        </span>
                                    </motion.div>
                                </motion.div>
                            </div>
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
                                <Link href="/dashboard/rank" className="block">
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
                                {!roleLoading && isAuthorized && (
                                    <Link href="/dashboard/rankApplicants" className="block">
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