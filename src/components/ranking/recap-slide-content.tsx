"use client";

import type { RecapSlide } from "@/types/recap";

export function RecapSlideContent({
	slide,
	displayCount,
}: {
	slide: RecapSlide;
	displayCount: number;
}) {
	const emphasis = slide.kind === "reveal" ? String(displayCount) : slide.emphasis;

	return (
		<div className="pt-6 md:pt-8">
			<div className="space-y-4 pr-1 md:space-y-5">
				<h3 className="w-full text-3xl font-black leading-[0.95] text-white sm:text-4xl md:text-5xl">
					{slide.title}
				</h3>
				<p className="w-full text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
					{slide.description}
				</p>
				{slide.bulletItems?.length ? (
					<ul className="space-y-2 text-sm leading-6 text-white/80 sm:text-base sm:leading-7">
						{slide.bulletItems.map((item) => (
							<li key={item} className="flex gap-3">
								<span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/75" />
								<span>{item}</span>
							</li>
						))}
					</ul>
				) : null}
				{slide.kind !== "reveal" && slide.statLabel && slide.statValue ? (
					<div className="inline-flex w-full max-w-sm flex-col rounded-2xl border border-white/15 bg-black/10 px-4 py-3 backdrop-blur-sm">
						<span className="text-[10px] uppercase tracking-[0.3em] text-white/60">
							{slide.statLabel}
						</span>
						<span className="mt-2 text-3xl font-bold leading-none text-white sm:text-4xl">
							{displayCount}
						</span>
						{slide.statNote ? (
							<span className="mt-2 text-sm leading-6 text-white/72">{slide.statNote}</span>
						) : null}
					</div>
				) : null}
				{slide.supportingText ? (
					<p className="w-full text-sm leading-6 text-white/72 sm:text-base sm:leading-7">
						{slide.supportingText}
					</p>
				) : null}
				{slide.supportingBulletItems?.length ? (
					<ul className="space-y-2 text-sm leading-6 text-white/72 sm:text-base sm:leading-7">
						{slide.supportingBulletItems.map((item) => (
							<li key={item} className="flex gap-3">
								<span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
								<span>{item}</span>
							</li>
						))}
					</ul>
				) : null}
				{emphasis ? (
					<p
						className="pt-2 text-6xl font-bold leading-none text-white sm:text-7xl md:text-8xl animate-[slide-fade-in_0.2s_ease-out_both]"
						key={emphasis}
					>
						{emphasis}
					</p>
				) : null}
			</div>
		</div>
	);
}
