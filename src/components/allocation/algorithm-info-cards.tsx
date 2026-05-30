"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";

export function AlgorithmInfoCards() {
	return (
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
							The result is a <strong>stable match</strong>: no two people can swap
							allocations and both be happier than they are now. The algorithm produces
							the same result every time, so you can&apos;t game it by changing the order
							or timing of your submission.
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
							&quot;If I list a popular CCA as my #1 preference, I have less chance than
							someone who lists it as #2.&quot;
							<br />
							<strong>False.</strong> The algorithm always tries your top preference first.
							Ranking something lower can only hurt your odds — always put what you really
							want at the top.
						</p>
					</CardContent>
				</Card>
			</FadeIn>
		</div>
	);
}
