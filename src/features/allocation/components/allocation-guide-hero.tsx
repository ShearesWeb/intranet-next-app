"use client";

import React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AllocationGuideHero() {
	return (
		<div className="flex flex-col items-center gap-4 py-8 text-center">
			<div className="rounded-full bg-violet-100 p-3">
				<Sparkles className="h-8 w-8 text-violet-600" />
			</div>
			<h1 className="text-3xl font-bold tracking-tight md:text-4xl">How CCA allocation works</h1>
			<p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
				Sheares Web uses the{" "}
				<span className="font-semibold text-foreground">Gale–Shapley algorithm</span> — the same
				Nobel Prize-winning method used to match medical students to residencies. It&apos;s fair,
				stable, and impossible to game.
			</p>
			<div className="flex gap-3 pt-2">
				<Link href="/dashboard/ccaAllocation/rank">
					<Button size="lg">Start ranking →</Button>
				</Link>
			</div>
		</div>
	);
}
