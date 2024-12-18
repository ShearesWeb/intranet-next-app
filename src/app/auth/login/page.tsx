"use client";

import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider } from "../../../../lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { GoogleAuthProvider } from "firebase/auth/web-extension";
import { useState } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    signInWithPopup(auth, provider)
      .then(result => {
        GoogleAuthProvider.credentialFromResult(result);
      })
      .catch(error => {
        console.error("Sign-in error:", error);
        setError(error.message);
      });
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign-out error:", e);
    }
  };

  return (
    !loading && (
      <div
        className="flex flex-row items-stretch min-h-screen w-full"
        style={{
          fontFamily: "'Reem Kufi', sans-serif", 
          fontWeight: "600", 
        }}
      >
      
        <div
          style={{
            flex: 2,
            background: "linear-gradient(to bottom, #FFCD9D, #FC8B1A, #FF6F00)",
            color: "#FFFFFF",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "2rem",
            fontWeight: "600", 
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <img
              src="/lion_logo.png"
              alt="Lion Logo"
              style={{
                width: "90px",
                height: "90px",
                borderRadius: "50%",
                border: "none",
                marginRight: "20px",
                filter: "drop-shadow(0px 0px 15px rgba(255, 255, 255, 0.7))", 
              }}
            />
            Sheares Intranet
          </div>
        </div>

        <div
          style={{
            flex: 1,
            background: "#FFFFFF",
            color: "#FF8C00",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "2rem",
            fontWeight: "600", 
          }}
        >
          <h1
            style={{
              fontSize: "40px",
              fontWeight: "600",
              marginBottom: "2rem",
              fontFamily: "'Reem Kufi', sans-serif", 
            }}
          >
            <span style={{ display: "inline-block", marginLeft: "8px" }}>
              Welcome
            </span>
            <br />
            <span>Shearites!</span>
          </h1>

          <hr style={{ width: "80%", border: "0.5px solid black", marginBottom: "2rem" }} />

          {user && (
            <button
              className="bg-[#FF8C1A] text-white py-3 px-6 rounded-lg transition-colors hover:bg-[#FF6F00]"
              onClick={handleSignOut}
              style={{
                fontSize: "18px",
                fontFamily: "Inter, sans-serif",
                fontWeight: "500", 
                borderRadius: "8px",
              }}
            >
              Sign Out
            </button>
          )}
          {!user && (
            <>
              <button
                className="bg-[#FF8C1A] text-white rounded-md transition-colors hover:bg-[#FF8008] mt-4 flex items-center justify-center"
                onClick={handleSignIn}
                style={{
                  padding: "8.85px 21.23px 8.85px 16.81px", 
                  fontSize: "14px",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: "500",
                  borderRadius: "12px",
                  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
                  width: "280px",
                  height: "50px", 
                }}
              >
                <span style={{ marginRight: "5px" }}>→</span> Sign In with Google
              </button>
              <p
                style={{
                  paddingTop: "2rem",
                  fontSize: "14px", 
                  color: "#B7B7B7",
                  textAlign: "center", 
                  fontFamily: "'Barlow', sans-serif", 
                  fontWeight: "600", 
                  width: "100%",
                  margin: "0 auto",
                }}
              >
                The intranet is a place where shearites.<br />
                can rank and view their CCAs.
              </p>
            </>
          )}
          {user && (
            <p className="mt-4" style={{ fontWeight: "600", fontFamily: "'Reem Kufi', sans-serif" }}>
              User: {user?.displayName}
            </p>
          )}
          {error && (
            <p className="text-red-500 mt-2" style={{ fontWeight: "600", fontFamily: "'Reem Kufi', sans-serif" }}>
              Oops, turns out you are not registered with us: {error}
            </p>
          )}
        </div>
      </div>
    )
  );
}
