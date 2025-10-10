"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { AuthError, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { User } from "@/types/User";
import { useRouter } from "next/navigation";

interface AuthContextType {
	user: User | null;
	session: Session | null;
	loading: boolean;
	error: AuthError | null;
	signIn: (code?: string) => Promise<void>;
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const supabase = createClient();
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<AuthError | null>(null);
	const fetchedRef = useRef<string | null>(null); // cache by session user id

	const fetchUserFromBackend = async (email: string): Promise<User | null> => {
		const { data, error } = await supabase
			.from("users")
			.select("*")
			.eq("email", email)
			.maybeSingle();

		if (error || !data) {
			const authError: AuthError = {
				name: "UserNotFoundError",
				message: "Please login with your Intranet gmail instead.",
				status: 401,
			} as AuthError;
			setError(authError);

			toast.error("Please login with your Intranet gmail instead.");
			router.push('/auth/auth-error')
			return null;
		}

		const publicUrl = data.profile_photo_path
			? supabase.storage.from("user-profile-pictures").getPublicUrl(data.profile_photo_path).data.publicUrl
			: null;
		console.log("Fetched user from backend:", {
			...data,
			profile_photo_url: publicUrl,
		})
		return { ...data, profile_photo_url: publicUrl };
	};

	const signIn = async (next?: string) => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : `?next=${encodeURIComponent('/dashboard/home')}`
					}`,
			},
		});
		if (error) throw error;
	};

	const signOut = async () => {
		await supabase.auth.signOut();
		setUser(null);
		setSession(null);
		toast.info("Successfully signed out.")
		router.push("/");
	};

	useEffect(() => {
		let isMounted = true;

		const fetchAndCacheUser = async (session: Session | null) => {
			if (!session?.user?.email) return;
			if (fetchedRef.current === session.user.id) return; // already fetched

			fetchedRef.current = session.user.id;
			const fetchedUser = await fetchUserFromBackend(session.user.email);
			if (isMounted) setUser(fetchedUser);
			if (isMounted) setSession(session);
		};

		// Fetch current session once
		supabase.auth.getSession().then(({ data: { session }, error }) => {
			if (error) setError(error);
			fetchAndCacheUser(session).finally(() => isMounted && setLoading(false));
		});

		// Listen to auth changes
		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
			fetchAndCacheUser(session);
		});

		return () => {
			isMounted = false;
			subscription.unsubscribe();
		};
	}, [supabase]);

	const value = useMemo(
		() => ({ user, session, loading, error, signIn, signOut }),
		[user, session, loading, error]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
