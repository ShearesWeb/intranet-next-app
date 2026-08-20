// src/app/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";

import { useRoleAuth } from "@/hooks/use-role-auth";
import { DashboardCardsSkeleton } from "@/components/layout/dashboard-skeletons";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PointsRecapCard } from "@/components/ranking/points-recap-card";
import { getCoreServiceFlags, isCoreServiceEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
	type LucideIcon,
	Trophy,
	ClipboardList,
	ChevronRight,
	ArrowRight,
	Mail,
	Zap,
	CalendarDays,
} from "lucide-react";

/**
 * Secondary action cards are tinted with the palette of the screen they open,
 * so the dashboard previews where you are about to land. The only gradient in
 * use is CUPID's, on the two allocation cards.
 */
type ActionAccent = "cupid";

interface AccentTheme {
	/** Gradient behind the icon chip. */
	chip: string;
	/** Wash that fades in across the card on hover. */
	wash: string;
	card: string;
	title: string;
	description: string;
	chevron: string;
}

const ACCENT_THEMES: Record<ActionAccent, AccentTheme> = {
	cupid: {
		chip: "linear-gradient(96deg,#FF8FB1,#FF3D82 48%,#A97BFF)",
		wash: "linear-gradient(90deg,rgba(255,61,130,.12),rgba(169,123,255,.06) 60%,transparent)",
		card: "border-rose-100 hover:border-rose-300",
		title: "group-hover:text-rose-600",
		description: "group-hover:text-rose-500/80",
		chevron: "group-hover:text-rose-500",
	},
};

interface ActionCardProps {
	href: string;
	icon: LucideIcon;
	title: string;
	description: string;
	accent: ActionAccent;
}

function ActionCard({ href, icon: Icon, title, description, accent }: ActionCardProps) {
	const theme = ACCENT_THEMES[accent];

	return (
		<Link href={href} className="block">
			<div
				className={cn(
					"group relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] hover:shadow-md",
					theme.card,
				)}
			>
				<div
					className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
					style={{ background: theme.wash }}
				/>
				<div className="relative flex items-center gap-4">
					<div
						className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-transform duration-200 group-hover:scale-105"
						style={{ background: theme.chip }}
					>
						<Icon className="h-5 w-5 md:h-6 md:w-6" />
					</div>
					<div className="flex-1">
						<h3 className={cn("font-bold text-foreground transition-colors", theme.title)}>
							{title}
						</h3>
						<p className={cn("text-sm text-muted-foreground transition-colors", theme.description)}>
							{description}
						</p>
					</div>
					<ChevronRight
						className={cn(
							"h-5 w-5 text-muted-foreground/50 transition-colors transition-transform group-hover:translate-x-1",
							theme.chevron,
						)}
					/>
				</div>
			</div>
		</Link>
	);
}

const EMBER_GRADIENT = "linear-gradient(120deg,#ff6a00,#ff9500 55%,#ffb700)";
/** Hotter and deeper, so hover is a colour change rather than a brightness nudge. */
const EMBER_GRADIENT_HOVER = "linear-gradient(120deg,#d63e02,#ff6a00 45%,#ffd166)";

/**
 * The one card that should pull the eye: My CCAs, where the allocation reveal
 * waits. It is filled with the reveal's own orange, sized well above the other
 * cards, and runs a slow lift-and-sheen loop that stops on hover — hover is the
 * card's own answer to the pointer, and two motions at once just fight.
 *
 * Only ever one of these. A page of hero cards pulls the eye nowhere.
 */
function HeroActionCard({ revealReady }: { revealReady: boolean }) {
	return (
		<Link href="/dashboard/my-cca" className="group relative block">
			<span
				aria-hidden
				className="pointer-events-none absolute -inset-2 rounded-[28px] blur-xl animate-[action-glow_2.6s_ease-in-out_infinite]"
				style={{ background: "rgba(249,115,22,.55)" }}
			/>
			<div
				className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg shadow-orange-500/30 transition-all duration-200 animate-[action-pop_2.6s_ease-in-out_infinite] hover:[animation-name:none] hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-500/40 active:scale-[0.99] md:p-6"
				style={{ background: EMBER_GRADIENT }}
			>
				<span
					aria-hidden
					className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[action-sheen_2.6s_ease-in-out_infinite] group-hover:[animation-name:none]"
				/>
				{/* The hover gradient rides on top and fades in — a background-image
				    cannot be transitioned, so the colour change needs its own layer. */}
				<div
					className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
					style={{ background: EMBER_GRADIENT_HOVER }}
				/>
				<div className="relative flex items-start gap-4 md:gap-5">
					<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-white shadow-sm backdrop-blur-sm transition-colors duration-300 group-hover:bg-white group-hover:text-orange-600 animate-[action-ring_2.6s_ease-in-out_infinite] group-hover:[animation-name:none] md:h-16 md:w-16">
						<Mail className="h-7 w-7 md:h-8 md:w-8" />
					</div>
					<div className="flex flex-1 flex-col gap-1">
						{revealReady && (
							<span className="mb-1 inline-flex w-fit items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur-sm transition-colors duration-300 group-hover:bg-white/35">
								<span className="h-1.5 w-1.5 rounded-full bg-white animate-[action-dot_1.6s_ease-in-out_infinite]" />
								Results ready
							</span>
						)}
						<h3 className="font-[family-name:var(--font-fredoka)] text-2xl leading-tight md:text-3xl">
							My CCAs
						</h3>
						<p className="text-sm text-white/85 md:text-base">
							{revealReady
								? "Open your envelope to see what you got."
								: "View your CCAs and Points"}
						</p>
						<span className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-orange-600 shadow-sm transition-colors duration-300 group-hover:bg-[#3b1400] group-hover:text-white">
							{revealReady ? "Open my results" : "View my CCAs"}
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
						</span>
					</div>
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
	// A resident who watched last year's recap still has the flag in
	// localStorage, so the layout follows the live flag, not that leftover.
	const recapWatched = isCoreServiceEnabled("pointsRecap") && hasSeenRecap;

	useEffect(() => {
		setHasSeenRecap(localStorage.getItem("hasSeenPointsRecap") === "true");
	}, []);

	if (!user) {
		return <DashboardCardsSkeleton count={2} columns={2} />;
	}

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			{/* Welcome Section */}
			<Card className="group border-none shadow-lg bg-gradient-to-r from-orange-50/50 to-white">
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
						<span className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient transition-colors group-hover:text-orange-600">
							{user.name || user.email}
						</span>
					</CardTitle>
					<p className="text-sm text-muted-foreground mt-1">
						Here&apos;s what&apos;s happening today
					</p>
				</CardHeader>
			</Card>

			{/* Content Grid */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* Points Display Card */}
				<Card
					className="border-none shadow-lg flex flex-col overflow-hidden relative animate-[fade-in-up_0.3s_ease-out_both]"
					style={{ animationDelay: "0.1s" }}
				>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<span>{recapWatched ? "Your Final Hall Points" : "Your Points"}</span>
						</CardTitle>
					</CardHeader>
					<CardContent
						className={cn(
							"relative flex-1 min-h-[300px] md:min-h-[400px]",
							recapWatched
								? "flex items-start justify-start p-4 md:p-6"
								: "flex items-center justify-center p-4 md:p-8",
						)}
					>
						<PointsRecapCard user={user} onSeenStateChange={setHasSeenRecap} />
					</CardContent>
				</Card>

				{/* Activity Section Card */}
				<Card
					className="border-none shadow-lg animate-[fade-in-up_0.3s_ease-out_both]"
					style={{ animationDelay: "0.15s" }}
				>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Zap className="h-5 w-5 text-orange-500" />
							My Actions
						</CardTitle>
					</CardHeader>
					<CardContent className="p-4 md:p-6">
						<div className="grid gap-4">
							<div
								className="animate-[fade-in-up_0.3s_ease-out_both]"
								style={{ animationDelay: "0.1s" }}
							>
								<HeroActionCard revealReady={isCoreServiceEnabled("allocationReveal")} />
							</div>

							{featureFlags.ccaApplications && (
								<div
									className="animate-[fade-in-up_0.3s_ease-out_both]"
									style={{ animationDelay: "0.15s" }}
								>
									<ActionCard
										href="/dashboard/cca-allocation/rank"
										icon={Trophy}
										title="CCA Ranking"
										description="Rank your CCA preferences"
										accent="cupid"
									/>
								</div>
							)}

							{featureFlags.ccaApplications && !roleLoading && isAuthorized && (
								<div
									className="animate-[fade-in-up_0.3s_ease-out_both]"
									style={{ animationDelay: "0.2s" }}
								>
									<ActionCard
										href="/dashboard/cca-allocation/rank-applicants"
										icon={ClipboardList}
										title="Chair Preferences"
										description="Rank applicants for your CCA positions"
										accent="cupid"
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
