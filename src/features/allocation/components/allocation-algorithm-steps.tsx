"use client";

import React from "react";
import { Brain, Users, Activity, Heart, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ALGORITHM_STEPS } from "@/features/allocation/utils/allocation-guide-content";

const STEP_ICONS = { Users, Activity, Heart } as const;

export function AllocationAlgorithmSteps() {
	return (
		<>
			<Card className="overflow-hidden border-none shadow-lg">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-2xl">
						<Brain className="h-6 w-6 text-violet-600" />
						How the algorithm works
					</CardTitle>
					<CardDescription>
						A simplified walkthrough of the Nobel Prize-winning matching algorithm.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-8 pt-6 md:grid-cols-3">
					{ALGORITHM_STEPS.map((step) => {
						const Icon = STEP_ICONS[step.icon];
						return (
							<div
								key={step.number}
								className="relative rounded-xl border border-slate-100 bg-slate-50 p-6"
							>
								<div className="absolute -left-4 -top-4 flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-lg font-bold text-white shadow-lg">
									{step.number}
								</div>
								<h3 className="mb-2 flex items-center gap-2 text-lg font-bold">
									<Icon className="h-4 w-4 text-violet-500" />
									{step.title}
								</h3>
								<p className="text-sm text-muted-foreground">{step.description}</p>
							</div>
						);
					})}
				</CardContent>
			</Card>

			<div className="grid gap-6 md:grid-cols-2">
				<Card className="border-none bg-gradient-to-br from-emerald-50 to-white shadow-md">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-emerald-700">
							<CheckCircle2 className="h-5 w-5" />
							Why it&apos;s fair
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground">
							The result is a <strong>stable match</strong>: no two people can swap allocations and
							both be happier than they are now. The algorithm produces the same result every time,
							so you can&apos;t game it by changing the order or timing of your submission.
						</p>
					</CardContent>
				</Card>

				<Card className="border-slate-100 bg-gradient-to-br from-slate-50 to-white">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-slate-700">
							<XCircle className="h-5 w-5" />
							Common myth
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground">
							&quot;If I rank a popular CCA #1, I have less chance than someone who ranks it
							#2.&quot;
							<br />
							<strong>False.</strong> The algorithm always tries your top pick first. Ranking
							something lower can only hurt your odds — always rank what you really want at the top.
						</p>
					</CardContent>
				</Card>
			</div>
		</>
	);
}
