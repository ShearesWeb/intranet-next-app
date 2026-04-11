"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { User } from "@/types/User";
import { useRouter } from "next/navigation";

interface AuthContextType {
	user: User | null;
	session: Session | null;
	loading: boolean;
	signIn: (next?: string) => Promise<void>;
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [supabase] = useState(() => createClient());
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);

        const fetchUserFromBackend = async (): Promise<User | null> => {
                try {
                        const res = await fetch("/api/user", { cache: "no-store" });
                        if (!res.ok) {
                                console.warn("Failed to fetch user from API:", await res.text());
                                return null;
                        }
                        const data = await res.json();
                        return data as User;
                } catch (err) {
                        console.error("Error calling /api/user:", err);
                        return null;
                }
        };

	const signIn = async (next?: string) => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : `?next=${encodeURIComponent('/dashboard')}`
						}`,
                                queryParams: {
                                        prompt: "select_account",
                                },
			},
		});
		if (error) throw error;
	};

        const signOut = async () => {
                await supabase.auth.signOut();
                await fetch("/api/user", { method: "DELETE" }).catch(() => undefined);
                setUser(null);
                setSession(null);
                toast.info("Successfully signed out.")
                router.push("/");
        };

	useEffect(() => {
		let isMounted = true;

                const fetchUser = async (session: Session | null, shouldClear = false) => {
                        if (!session) {
                                if (shouldClear) {
                                        setUser(null);
                                        setSession(null);
                                }
                                return;
                        }

                        const sessionEmail = session.user.email;
                        const fetchedUser = await fetchUserFromBackend();

                        if (!sessionEmail || !fetchedUser || fetchedUser.email !== sessionEmail) {
                                if (isMounted) {
                                        setUser(null);
                                        setSession(null);
                                }
                                toast.error("Please login with your Intranet gmail instead.");
				router.push("/auth/login?reason=user_not_found");
				return;
			}
			if (isMounted) {
				setUser(fetchedUser);
				setSession(session);
			}
		};

		// Fetch current session once
		supabase.auth.getSession().then(({ data: { session } }) => {
                        fetchUser(session).finally(() => isMounted && setLoading(false));
                });

                // Listen to auth changes
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                        fetchUser(session, event === "SIGNED_OUT");
                });

		return () => {
			isMounted = false;
			subscription.unsubscribe();
		};
	}, [router, supabase]);

	const value: AuthContextType = { user, session, loading, signIn, signOut };

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
