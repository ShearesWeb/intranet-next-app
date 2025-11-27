"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Image from "next/image";

interface LoadingSpinnerProps {
    message?: string;
    fullHeight?: boolean;
    className?: string;
    overlay?: boolean;
}

export function LoadingSpinner({
    message = "Loading...",
    fullHeight = true,
    className,
    overlay = false
}: LoadingSpinnerProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center w-full bg-background/50 backdrop-blur-sm z-50",
                overlay ? "fixed inset-0 h-screen w-screen z-[9999]" : (fullHeight ? "min-h-[60vh] h-full" : "py-12"),
                className
            )}
        >
            <div className="relative flex items-center justify-center mb-8">
                {/* Outer rotating ring */}
                <motion.div
                    className="absolute inset-0 rounded-full border-t-2 border-r-2 border-primary/30"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    style={{ width: '120px', height: '120px', margin: '-20px' }}
                />

                {/* Inner rotating ring (reverse) */}
                <motion.div
                    className="absolute inset-0 rounded-full border-b-2 border-l-2 border-primary/60"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    style={{ width: '100px', height: '100px', margin: '-10px' }}
                />

                {/* Pulsing Logo */}
                <motion.div
                    animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="relative z-10 bg-background rounded-full p-2 shadow-lg"
                >
                    <Image
                        src="/images/shweb-logo.png"
                        alt="Loading"
                        width={64}
                        height={64}
                        className="object-contain"
                        priority
                    />
                </motion.div>
            </div>

            {/* Loading Message */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center gap-2"
            >
                <h3 className="text-lg font-medium text-foreground tracking-tight">
                    {message}
                </h3>
                <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-primary"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: i * 0.2,
                                ease: "easeInOut"
                            }}
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
}

