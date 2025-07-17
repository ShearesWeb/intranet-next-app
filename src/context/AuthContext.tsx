"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
import { ReactNode } from 'react';

interface AuthContextType {
	user: User | null;
	loading: boolean;
	signIn: () => Promise<void>;
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
	user: null,
	loading: true,
	signIn: async () => { },
	signOut: async () => { },
});

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
	const supabase = createClientComponentClient();

	useEffect(() => {
		const getUser = async () => {
			const { data: { user } } = await supabase.auth.getUser();
			setUser(user);
			setLoading(false);
		};

		getUser();

		const { data: { subscription } } = supabase.auth.onAuthStateChange(
			async (event, session) => {
				setUser(session?.user ?? null);
				setLoading(false);
			}
		);

		return () => subscription.unsubscribe();
	}, [supabase]);

	const signIn = async () => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/auth/callback`,
			},
		});
		if (error) throw error;
	};

	const signOut = async () => {
		const { error } = await supabase.auth.signOut();
		if (error) throw error;
	};

	return (
		<AuthContext.Provider value={{ user, loading, signIn, signOut }}>
			{children}
		</AuthContext.Provider>
	);
};