import { ListChecks, ArrowDown, Clock, Repeat } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
		<Card className="border-violet-100 bg-gradient-to-br from-violet-50/50 to-white">
			<CardHeader>
				<CardTitle className="text-2xl">Before you set your preferences</CardTitle>
				<CardDescription>Four things that will make or break your allocation.</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5 md:grid-cols-2">
				{TIPS.map((tip) => {
					const Icon = tip.icon;
					return (
						<div key={tip.title} className="flex gap-3">
							<div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-600/10 text-violet-700">
								<Icon className="h-5 w-5" />
							</div>
							<div>
								<h3 className="font-semibold">{tip.title}</h3>
								<p className="text-sm text-muted-foreground">{tip.body}</p>
							</div>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
