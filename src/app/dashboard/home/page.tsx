// C:\Ron\intranet-next-app\src\app\dashboard\home\page.tsx
"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import "./Dashboard.css";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { useRoleAuth } from "@/hooks/useRoleAuth";
import { usePhaseInfo } from "@/hooks/usePhaseInfo";
import { AppLayout } from "@/components/layout/app-layout";

export default function Dashboard() {
    const { user, signOut } = useAuth();
    const { isAuthorized, loading: roleLoading } = useRoleAuth();
    const { phaseInfo } = usePhaseInfo();
    const [points, setPoints] = useState<number>(0);
    const router = useRouter();
    const [counter, setCounter] = useState(0);


    // fetch user specific points
    useEffect(() => {
        if (!user?.email) return;

        fetch(`/api/user/getPoints/${user.email}`)
            .then(async (res) => {
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "Failed to fetch user points");
                }
                return res.json();
            })
            .then((data) => {
                setPoints(data.userPoints);
            })
            .catch((error) => {
                console.error("Error fetching points:", error.message);
                toast.error(error.message);
            });
    }, [user?.email]);


    useEffect(() => {
        const interval = setInterval(() => {
            setCounter((prev) => (prev < points ? prev + 1 : points));
        }, 20);

        return () => clearInterval(interval);
    }, [points]);

    const handleSignOut = async () => {
        try {
            await signOut();
            toast.success("Sign out successful!");
            router.push("/auth/login");
        } catch (e) {
            console.error("Sign-out error:", e);
            toast.error("Sign out failed!");
        }
    };

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

    return (
        <AppLayout>
            <div className="dashboard">
                {/* Header */}
                <div className="header">
                    <button className="logout-button" onClick={handleSignOut}>
                        Log Out
                    </button>
                </div>

                {/* Welcome Section */}
                <div className="welcome-section">
                    <h2 className="welcome-text">Welcome Back,</h2>
                    <p className="username">{user?.user_metadata?.full_name || user?.email}</p>
                </div>

                {/* Content Section */}
                <div className="content-section">
                    {/* Points Section */}
                    <div className="points-section">
                        <div className="points-wrapper">
                            <div className="circle circle-1"></div>
                            <div className="circle circle-2"></div>
                            <div className="circle circle-3"></div>
                            <div className="circle circle-4">
                                <span className="points-text">
                                    <motion.span
                                        className="points-text"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{
                                            duration: 1.5,
                                            ease: "easeInOut",
                                        }}
                                    >
                                        {counter}
                                    </motion.span>

                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Activity Section */}
                    <div className="activity-section">
                        <h3 className="activity-title">My Activity</h3>
                        <div className="buttons">
                            <div className="button-group">
                                <button className="activity-button" onClick={() => router.push("/dashboard/mycca")}>My CCAs</button>
                                <p className="button-description">
                                    View your CCAs and Points
                                </p>
                            </div>
                            <div className="button-group">
                                <button className="activity-button" onClick={() => router.push("/dashboard/rank")}>{getRankCCAButtonText()}</button>
                                <p className="button-description">
                                    Rank your CCA preferences
                                </p>
                            </div>
                            {isSportsCultureAvailable() && (
                                <div className="button-group">
                                    <button
                                        className="activity-button"
                                        onClick={() => router.push("/dashboard/sportsCulture")}
                                    >
                                        Apply Sports & Culture
                                    </button>
                                    <div className="button-description">Apply to Sports & Culture CCAs</div>
                                </div>
                            )}
                            {!roleLoading && isAuthorized && (
                                <div className="button-group">
                                    <button className="activity-button" onClick={() => router.push("/dashboard/rankApplicants")}>
                                        Rank Applicants
                                    </button>
                                    <p className="button-description">
                                        Rank applicants for your CCA
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>

    );
}
