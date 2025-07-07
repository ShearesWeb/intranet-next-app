"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import "./Dashboard.css";
import { signOut } from "firebase/auth";
import { auth } from "../../../../lib/firebase";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect } from "react";

export default function Dashboard() {
    const { user } = useAuth();
    const [points , setPoints] = useState<number>(0);
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
            toast.error(error.message); // Show a toast notification for the error
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
            await signOut(auth);
            toast.success("Sign out successful!");
            router.push("/auth/login");
        } catch (e) {
            console.error("Sign-out error:", e);
            toast.error("Sign out failed!");
        }
    };


    return (
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
                <p className="username">{user?.displayName}</p>
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
                                Tap to view your CCAs and their respective
                                points
                            </p>
                        </div>
                        <div className="button-group">
                            <button disabled className="activity-button">
                                Rank CCA
                            </button>
                            <p className="button-description">
                                Tap to rank your Committee CCA preference
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
