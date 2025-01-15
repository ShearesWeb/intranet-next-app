// 'use client';

// export default function HelloWorld() {
//   return (
//       <h1>Hello, World</h1>
//   );
// }

"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import "./Dashboard.css";
import { signOut } from "firebase/auth";
import { auth } from "../../../../lib/firebase";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function Dashboard() {
    const { user } = useAuth();
    const router = useRouter(); // Initialize the router

    const handleSignOut = async () => {
        try {
            await signOut(auth); // Sign the user out
            toast.success("Sign out successful!");
            router.push("/auth/login"); // Redirect to the login page
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
                <h2 className="welcome-text">Welcome back,</h2>
                <p className="username">{user?.displayName || "Shearite"}</p>
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
                            <span className="points-text">128</span>
                        </div>
                    </div>
                </div>

                {/* Activity Section */}
                <div className="activity-section">
                    <h3 className="activity-title">My Activity</h3>
                    <div className="buttons">
                        <div className="button-group">
                            <button className="activity-button">My CCAs</button>
                            <p className="button-description">
                                Tap to view your CCAs and their respective
                                points
                            </p>
                        </div>
                        <div className="button-group">
                            <button className="activity-button">
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
