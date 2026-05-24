"use client";

import { FileCheck, CheckCircle, Users, Calculator } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { GUIDE_PHASES } from "@/lib/holiday-subsidy/holiday-subsidy-guide-content";

const PHASE_ICONS = [FileCheck, CheckCircle, Users, Calculator];

function DesktopTimeline() {
	return (
		<div className="hidden md:block relative">
			{/* Connector line behind the circles */}
			<div className="absolute top-7 left-7 right-7 h-0.5 bg-gradient-to-r from-primary/40 via-primary/30 to-primary/20 rounded-full" />

			{/* Phase circles and labels */}
			<div className="relative flex items-start justify-between">
				{GUIDE_PHASES.map(({ phase, label }, i) => {
					const Icon = PHASE_ICONS[i];
					return (
						<FadeIn key={phase} delay={i * 0.12} direction="scale">
							<div className="flex flex-col items-center gap-3">
								<div className="size-14 rounded-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg shadow-primary/20 ring-4 ring-background">
									<Icon className="size-6 text-white" />
								</div>
								<div className="flex flex-col items-center gap-0.5 text-center">
									<span className="text-sm font-bold tracking-tight">{phase}</span>
									<span className="text-xs text-muted-foreground leading-snug max-w-24">{label}</span>
								</div>
							</div>
						</FadeIn>
					);
				})}
			</div>
		</div>
	);
}

function MobileTimeline() {
	return (
		<div className="flex flex-col md:hidden">
			{GUIDE_PHASES.map(({ phase, label }, i) => {
				const Icon = PHASE_ICONS[i];
				const isLast = i === GUIDE_PHASES.length - 1;
				return (
					<FadeIn key={phase} delay={i * 0.1} direction="left">
						<div className="flex items-stretch gap-4">
							<div className="flex flex-col items-center">
								<div className="size-12 rounded-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
									<Icon className="size-5 text-white" />
								</div>
								{!isLast && (
									<div className="w-0.5 flex-1 bg-gradient-to-b from-primary/40 to-primary/10 my-1" />
								)}
							</div>
							<div className="flex flex-col gap-0.5 pb-6">
								<span className="text-sm font-bold tracking-tight">{phase}</span>
								<span className="text-xs text-muted-foreground">{label}</span>
							</div>
						</div>
					</FadeIn>
				);
			})}
		</div>
	);
}

export function GuideProcessOverview() {
	return (
		<Card className="bg-card/40 overflow-hidden">
			<CardContent className="pt-8 pb-8 px-6 md:px-10">
				<DesktopTimeline />
				<MobileTimeline />
			</CardContent>
		</Card>
	);
}
