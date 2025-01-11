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
          GoogleAuthProvider.credentialFromResult(result)
        })
        .catch(error => {
          console.error("Sign-in error:", error);
          setError(error.message);
        })
    };
    
    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (e ) {
            console.error("Sign-out error:", e);
        }
    };
    return (
      !loading && (
        <div className="flex flex-col items-center justify-center min-h-screen bg-orange-500 space-y-4">
          <button
            className="bg-white text-orange-500 font-semibold text-lg py-3 px-6 rounded transition-colors hover:bg-gray-200"
            onClick={() => {}}
          >
            User: {user?.displayName}
          </button>
  
          <button
            className="bg-white text-orange-500 font-semibold text-lg py-3 px-6 rounded transition-colors hover:bg-gray-200"
            onClick={handleSignIn}
          >
            Sign in with Google
          </button>
  
          <button
            className="bg-white text-orange-500 font-semibold text-lg py-3 px-6 rounded transition-colors hover:bg-gray-200"
            onClick={handleSignOut}
          >
            Log Out with Google
          </button>
         {error && <p className="text-red-500">Oops, turns out you are not registered with us: {error}</p>}
        </div>
      )
    );
  }