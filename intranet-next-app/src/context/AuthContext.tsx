"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {auth} from '../../lib/firebase';
import { ReactNode } from 'react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
});

// useAuth is a hook that gets the value of the AuthContext that we are passing to the children
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === null) {
      throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
  };

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    //Firebase’s onAuthStateChanged function sets up a listener for authentication state changes.
    // The function we provide to onAuthStateChanged is a callback that will be invoked each time the authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    // NOTE: The call to onAuthStateChanged returns an unsubscribe function specific to that listener.
    // Calling unsubscribe() will disable that particular listener, meaning it will no longer listen for or respond to authentication state changes.
    return () => unsubscribe(); // cleanup function that will be called on UNMOUNT, to disable the listener
  }, []);

  return (
    // pass values to children to consume
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
