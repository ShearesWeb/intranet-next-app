"use client";

import { ListChecks, ArrowDown, Clock, Repeat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";

const TIPS = [
	{
		icon: ListChecks,
		title: "List many preferences",
		body: "Tick every position you'd genuinely join, not just your top one or two. The algorithm needs fallbacks to match you — listing too few preferences is the #1 reason students end up with nothing.",
	},
	{
		icon: ArrowDown,
		title: "Order by what you actually want",
		body: "Put your real first choice first, even if it's competitive. Ranking a popular CCA lower never improves your odds — it only makes it harder to get in.",
	},
	{
		icon: Clock,
		title: "Submission timing doesn't matter",
		body: "Submitting early gives you no advantage. The algorithm runs once, after the deadline, using the final state of everyone's preferences.",
	},
	{
		icon: Repeat,
		title: "You can change your mind",
		body: "Edit, re-order, add, or remove preferences any time before the deadline. Only your final submitted preferences are used.",
	},
] as const;

export function AllocationTips() {
	return (
		<div className="flex flex-col gap-8">
			<FadeIn>
				<div className="flex flex-col gap-2">
					<h2 className="text-2xl font-bold tracking-tight md:text-3xl">
						Before you set your preferences
					</h2>
					<p className="text-muted-foreground">
						Four things that will make or break your allocation.
					</p>
				</div>
			</FadeIn>

			<div className="grid gap-4 md:grid-cols-2">
				{TIPS.map((tip, i) => {
					const Icon = tip.icon;
					return (
						<FadeIn key={tip.title} delay={0.05 + i * 0.05}>
							<Card className="h-full border-orange-100/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
								<CardContent className="flex gap-4 pt-6">
									<div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-600 text-lg font-bold text-white shadow-md">
										{i + 1}
									</div>
									<div className="flex flex-col gap-1.5">
										<div className="flex items-center gap-2">
											<Icon className="size-4 text-orange-600" />
											<h3 className="font-semibold">{tip.title}</h3>
										</div>
										<p className="text-sm leading-relaxed text-muted-foreground">{tip.body}</p>
									</div>
								</CardContent>
							</Card>
						</FadeIn>
					);
				})}
			</div>
		</div>
	);
}
