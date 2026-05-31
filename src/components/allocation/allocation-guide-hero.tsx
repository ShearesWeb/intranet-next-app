"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/ui/fade-in";

export function AllocationGuideHero() {
	return (
		<div className="relative overflow-hidden bg-gradient-to-b from-orange-50 via-amber-50/30 to-transparent px-4 py-20 md:px-6 md:py-28">
			{/* Decorative blurred blobs */}
			<div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-orange-200/40 blur-3xl" />
			<div className="pointer-events-none absolute -bottom-32 -left-32 size-80 rounded-full bg-amber-200/30 blur-3xl" />
			<div className="pointer-events-none absolute right-1/3 top-1/2 size-64 rounded-full bg-orange-100/50 blur-3xl" />

			<div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
				<FadeIn delay={0}>
					<Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm">
						<Sparkles className="size-3.5 text-orange-600" />
						Nobel Prize-winning algorithm
					</Badge>
				</FadeIn>

				<FadeIn delay={0.1}>
					<h1 className="text-4xl font-bold tracking-tight md:text-5xl">
						How CCA allocation works
					</h1>
				</FadeIn>

				<FadeIn delay={0.2}>
					<p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
						Sheares Web uses the{" "}
						<span className="font-semibold text-foreground">Gale–Shapley algorithm</span> — the same
						Nobel Prize-winning method used to match medical students to residencies. It&apos;s
						fair, stable, and impossible to game.
					</p>
				</FadeIn>

				<FadeIn delay={0.3}>
					<div className="flex gap-3 pt-2">
						<Link href="/dashboard/cca-allocation/rank">
							<Button size="lg" className="group gap-2">
								Indicate your preferences
								<ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
							</Button>
						</Link>
					</div>
				</FadeIn>
			</div>
		</div>
	);
}
