"use client";

import { Brain, Users, Activity, Heart, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { ALGORITHM_STEPS } from "@/lib/allocation/allocation-guide-content";

const STEP_ICONS = { Users, Activity, Heart } as const;

export function AllocationAlgorithmSteps() {
	return (
		<div className="flex flex-col gap-12">
			{/* Section header */}
			<FadeIn>
				<div className="flex flex-col gap-2">
					<h2 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight md:text-3xl">
						<Brain className="size-7 text-orange-600" />
						How the algorithm works
					</h2>
					<p className="text-muted-foreground">
						A simplified walkthrough of the Nobel Prize-winning matching algorithm.
					</p>
				</div>
			</FadeIn>

			{/* Vertical timeline */}
			<div className="relative pl-14 md:pl-20">
				{/* Gradient connecting line */}
				<div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-orange-400 to-amber-300 animate-[draw-line_1s_ease-out_both] [transform-origin:top] md:left-[35px]" />

				<div className="flex flex-col gap-10">
					{ALGORITHM_STEPS.map((step, i) => {
						const Icon = STEP_ICONS[step.icon];
						return (
							<FadeIn key={step.number} delay={0.1 + i * 0.1}>
								<div className="relative flex items-start gap-5">
									{/* Numbered circle */}
									<div className="absolute -left-14 flex size-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-orange-600 text-lg font-bold text-white shadow-lg md:-left-20">
										{step.number}
									</div>

									{/* Card content */}
									<Card className="flex-1 border-orange-100/40 transition-all duration-300 hover:shadow-lg">
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-lg">
												<Icon className="size-5 text-orange-500" />
												{step.title}
											</CardTitle>
										</CardHeader>
										<CardContent>
											<p className="leading-relaxed text-muted-foreground">{step.description}</p>
										</CardContent>
									</Card>
								</div>
							</FadeIn>
						);
					})}
				</div>
			</div>

			{/* Info cards grid */}
			<div className="grid gap-6 md:grid-cols-2">
				<FadeIn delay={0.1}>
					<Card className="h-full border-none bg-gradient-to-br from-emerald-50 to-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-emerald-700">
								<CheckCircle2 className="size-5" />
								Why it&apos;s fair
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="leading-relaxed text-muted-foreground">
								The result is a <strong>stable match</strong>: no two people can swap allocations
								and both be happier than they are now. The algorithm produces the same result every
								time, so you can&apos;t game it by changing the order or timing of your submission.
							</p>
						</CardContent>
					</Card>
				</FadeIn>

				<FadeIn delay={0.2}>
					<Card className="h-full border-slate-100 bg-gradient-to-br from-slate-50 to-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-slate-700">
								<XCircle className="size-5" />
								Common myth
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="leading-relaxed text-muted-foreground">
								&quot;If I list a popular CCA as my #1 preference, I have less chance than someone
								who lists it as #2.&quot;
								<br />
								<strong>False.</strong> The algorithm always tries your top preference first.
								Ranking something lower can only hurt your odds — always put what you really want at
								the top.
							</p>
						</CardContent>
					</Card>
				</FadeIn>
			</div>
		</div>
	);
}
