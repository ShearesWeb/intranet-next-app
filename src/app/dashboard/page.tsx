// src/app/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";

import { useRoleAuth } from "@/hooks/use-role-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PointsRecapCard } from "@/components/ranking/points-recap-card";
import { getCoreServiceFlags } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { type LucideIcon, Users, Trophy, ClipboardList, ChevronRight, Zap, CalendarDays } from "lucide-react";

interface ActionCardProps {
	href: string;
	icon: LucideIcon;
	title: string;
	description: string;
}

function ActionCard({ href, icon: Icon, title, description }: ActionCardProps) {
	return (
		<Link href={href} className="block">
			<div className="group relative overflow-hidden rounded-xl border border-orange-100 bg-card p-4 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] hover:border-orange-300 hover:shadow-md">
				<div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
				<div className="relative flex items-center gap-4">
					<div className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 transition-colors group-hover:bg-orange-500 group-hover:text-white">
						<Icon className="h-5 w-5 md:h-6 md:w-6" />
					</div>
					<div className="flex-1">
						<h3 className="font-bold text-foreground group-hover:text-orange-700 transition-colors">
							{title}
						</h3>
						<p className="text-sm text-muted-foreground group-hover:text-orange-600/80 transition-colors">
							{description}
						</p>
					</div>
					<ChevronRight className="h-5 w-5 text-muted-foreground/50 transition-colors group-hover:text-orange-500" />
				</div>
			</div>
		</Link>
	);
}

export default function Dashboard() {
	const { user } = useAuth();
	const { isAuthorized, loading: roleLoading } = useRoleAuth();
	const featureFlags = getCoreServiceFlags();
	const [hasSeenRecap, setHasSeenRecap] = useState(false);

	useEffect(() => {
		setHasSeenRecap(localStorage.getItem("hasSeenPointsRecap") === "true");
	}, []);

	if (!user) {
		return <LoadingSpinner message="Loading dashboard..." />;
	}

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			{/* Welcome Section */}
			<Card className="border-none shadow-lg bg-gradient-to-r from-orange-50/50 to-white">
				<CardHeader>
					<div className="flex items-center gap-2 text-muted-foreground mb-1">
						<CalendarDays className="h-5 w-5 text-orange-400" />
						<span className="text-sm font-medium tabular-nums">{new Date().getDate()}</span>
						<span className="text-muted-foreground/40">|</span>
						<h2 className="text-xl font-medium">
							{(() => {
								const hour = new Date().getHours();
								if (hour < 12) return "Good Morning";
								if (hour < 18) return "Good Afternoon";
								return "Good Evening";
							})()}
						</h2>
					</div>
					<CardTitle className="text-3xl md:text-5xl font-[family-name:var(--font-fredoka)] tracking-wide">
						<span className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
							{user.name || user.email}
						</span>
					</CardTitle>
					<p className="text-sm text-muted-foreground mt-1">Here&apos;s what&apos;s happening today</p>
				</CardHeader>
			</Card>

			{/* Content Grid */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* Points Display Card */}
				<Card className="border-none shadow-lg flex flex-col overflow-hidden relative animate-[fade-in-up_0.3s_ease-out_both]" style={{ animationDelay: "0.1s" }}>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<span>{hasSeenRecap ? "Your Final Hall Points" : "Your Points"}</span>
						</CardTitle>
					</CardHeader>
					<CardContent
						className={cn(
							"relative flex-1 min-h-[300px] md:min-h-[400px]",
							hasSeenRecap
								? "flex items-start justify-start p-4 md:p-6"
								: "flex items-center justify-center p-4 md:p-8",
						)}
					>
						<PointsRecapCard user={user} onSeenStateChange={setHasSeenRecap} />
					</CardContent>
				</Card>

				{/* Activity Section Card */}
				<Card className="border-none shadow-lg animate-[fade-in-up_0.3s_ease-out_both]" style={{ animationDelay: "0.15s" }}>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Zap className="h-5 w-5 text-orange-500" />
							My Actions
						</CardTitle>
					</CardHeader>
					<CardContent className="p-4 md:p-6">
						<div className="grid gap-4">
							<div className="animate-[fade-in-up_0.3s_ease-out_both]" style={{ animationDelay: "0.1s" }}>
								<ActionCard
									href="/dashboard/my-cca"
									icon={Users}
									title="My CCAs"
									description="View your CCAs and Points"
								/>
							</div>

							{featureFlags.ccaApplications && (
								<div className="animate-[fade-in-up_0.3s_ease-out_both]" style={{ animationDelay: "0.15s" }}>
									<ActionCard
										href="/dashboard/cca-allocation/rank"
										icon={Trophy}
										title="CCA Ranking"
										description="Rank your CCA preferences"
									/>
								</div>
							)}

							{featureFlags.ccaApplications && !roleLoading && isAuthorized && (
								<div className="animate-[fade-in-up_0.3s_ease-out_both]" style={{ animationDelay: "0.2s" }}>
									<ActionCard
										href="/dashboard/cca-allocation/rank-applicants"
										icon={ClipboardList}
										title="Chair Preferences"
										description="Rank applicants for your CCA positions"
									/>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
