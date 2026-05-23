"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Linkedin, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useRecapData } from "@/features/ranking/hooks/use-recap-data";
import { useRecapNavigation } from "@/features/ranking/hooks/use-recap-navigation";
import { useRecapAudio } from "@/features/ranking/hooks/use-recap-audio";
import { RecapSlideContent } from "@/features/ranking/components/recap-slide-content";
import { createRecapImageBlob } from "@/features/ranking/utils/create-recap-image-blob";
import { cn } from "@/lib/utils";
import type { AuthenticatedUser } from "@/types/user";

export function PointsRecapCard({
	user,
	onSeenStateChange,
}: {
	user: AuthenticatedUser;
	onSeenStateChange?: (hasSeenRecap: boolean) => void;
}) {
	const [open, setOpen] = useState(false);
	const [imgGenerating, setImgGenerating] = useState(false);
	const { ccas, hasSeenRecap, isMounted, loadingCcas, recap, setHasSeenRecap } = useRecapData(
		user,
		onSeenStateChange,
	);
	const {
		currentSlide,
		setCurrentSlide,
		direction,
		setDirection,
		displayCount,
		paginate,
	} = useRecapNavigation(recap.slides, open);
	const { playRecapAudio, stopRecapAudio } = useRecapAudio();

	// Touch swipe handling for slide navigation
	const touchStartX = useRef<number | null>(null);
	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		touchStartX.current = e.touches[0].clientX;
	}, []);
	const handleTouchEnd = useCallback(
		(e: React.TouchEvent) => {
			if (touchStartX.current === null) return;
			const delta = e.changedTouches[0].clientX - touchStartX.current;
			touchStartX.current = null;
			if (delta < -70) paginate(1);
			if (delta > 70) paginate(-1);
		},
		[paginate],
	);

	const shareText = useMemo(
		() =>
			`My Sheares Wrapped 25/26: ${user.points || 0} points across ${ccas.length} CCAs. Relive your story too!`,
		[ccas.length, user.points],
	);
	const shareUrl =
		typeof window !== "undefined"
			? `${window.location.origin}/dashboard/my-cca`
			: "https://sheares-dashboard.local";

	const shareRecapImageToLinkedIn = async () => {
		if (imgGenerating) return;
		setImgGenerating(true);
		try {
			const blob = await createRecapImageBlob(user, ccas, recap);
			const file = new File([blob], "sheares-wrapped.png", { type: "image/png" });
			if (navigator.canShare && navigator.canShare({ files: [file] })) {
				await navigator.share({ files: [file], title: "Sheares Wrapped" });
				return;
			}
			navigator.clipboard?.writeText?.(`${shareText} ${shareUrl}`).catch(() => {});
			alert("Image downloaded or available — upload it in LinkedIn. Caption copied.");
			window.open("https://www.linkedin.com/feed/", "_blank", "noopener,noreferrer");
		} finally {
			setImgGenerating(false);
		}
	};

	const closeRecap = () => {
		setOpen(false);
		stopRecapAudio();
		setCurrentSlide(0);
		setDirection(1);
		setHasSeenRecap(true);
	};
	const slide = recap.slides[currentSlide];

	return (
		<>
			<div className="relative flex min-h-[22rem] w-full flex-col justify-between overflow-hidden rounded-[32px] border border-orange-400/50 bg-gradient-to-br from-[#ff6a00] via-[#ff9500] to-[#ffb700] p-6 py-12 text-white shadow-lg shadow-orange-500/20 md:p-8 md:py-16">
				<div
					className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/30 blur-3xl animate-[pulse-blob_6s_ease-in-out_infinite]"
				/>
				<div
					className="absolute -bottom-20 left-[-2rem] h-64 w-64 rounded-full bg-yellow-200/40 blur-3xl animate-[pulse-blob-alt_7s_ease-in-out_1s_infinite]"
				/>
				<div className="relative z-10 flex h-full flex-col justify-between gap-8">
					{!isMounted ? (
						<div className="animate-pulse space-y-5">
							<div className="h-12 w-3/4 rounded-lg bg-white/20" />
							<div className="h-6 w-1/2 rounded-lg bg-white/20" />
						</div>
					) : (
						<>
							<div className="space-y-5">
								<div className="max-w-xl space-y-3">
									<h3 className="text-4xl font-bold leading-tight text-white md:text-5xl">
										{hasSeenRecap ? "Final Hall Points" : "Your points are ready!"}
									</h3>
									<p className="max-w-lg text-base font-medium leading-7 text-white/90">
										{!hasSeenRecap
											? "View your points recap?"
											: recap.totals.totalCcas > 0
												? `${recap.totals.totalCcas === 1 ? "1 CCA" : `${recap.totals.totalCcas} CCAs`} joined.`
												: "No CCAs joined"}
									</p>
								</div>
								{hasSeenRecap ? (
									<div
										className="pt-2 animate-[slide-fade-in_0.3s_ease-out_both]"
									>
										<h3 className="text-7xl font-black leading-tight text-white md:text-8xl">
											{user.points || 0}
										</h3>
									</div>
								) : null}
							</div>
							<div className="relative z-10 flex flex-col gap-3">
								{hasSeenRecap ? (
									<>
										<Button
											asChild
											size="lg"
											className="w-fit rounded-full bg-white px-6 font-semibold text-orange-600 hover:bg-orange-50 hover:text-orange-700 shadow-sm"
										>
											<Link href="/dashboard/my-cca">View breakdown</Link>
										</Button>
										<div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
											<Button
												type="button"
												size="lg"
												onClick={shareRecapImageToLinkedIn}
												disabled={imgGenerating}
												className="w-fit rounded-full border border-white/20 bg-white/20 px-6 font-semibold text-white shadow-sm backdrop-blur-sm hover:bg-white/30"
											>
												Share your certificate!
											</Button>
											<Button
												type="button"
												size="lg"
												variant="ghost"
												onClick={() => {
													setCurrentSlide(0);
													setDirection(1);
													playRecapAudio();
													setOpen(true);
												}}
												className="w-fit rounded-full text-white hover:bg-white/20 hover:text-white"
											>
												<Sparkles className="h-4 w-4 mr-2" />
												Replay recap
											</Button>
										</div>
									</>
								) : (
									<Button
										type="button"
										size="lg"
										onClick={() => {
											setCurrentSlide(0);
											setDirection(1);
											playRecapAudio();
											setOpen(true);
										}}
										disabled={loadingCcas}
										className="w-fit rounded-full bg-white px-6 font-semibold text-orange-600 hover:bg-orange-50 hover:text-orange-700 shadow-sm"
									>
										<Sparkles className="h-4 w-4 mr-1" />
										{loadingCcas ? "Loading..." : "View points recap"}
									</Button>
								)}
							</div>
						</>
					)}
				</div>
			</div>
			<Dialog
				open={open}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) {
						closeRecap();
						return;
					}
					setOpen(true);
				}}
			>
				<DialogContent className="w-[calc(100vw-1rem)] max-h-[92dvh] overflow-hidden border-none bg-transparent p-0 text-white shadow-none sm:w-full sm:max-w-3xl [&>button]:hidden">
					<DialogTitle className="sr-only">Sheares points recap</DialogTitle>
					<DialogDescription className="sr-only">View your Sheares points recap.</DialogDescription>
					<div className="mx-auto w-full max-w-3xl">
						<div className="relative max-h-[88dvh] overflow-hidden rounded-[28px] shadow-none sm:rounded-[34px]">
							<div
								key={`${slide.id}-${currentSlide}`}
								className="relative animate-[slide-fade-in_0.3s_ease-out_both]"
								onTouchStart={handleTouchStart}
								onTouchEnd={handleTouchEnd}
							>
								<div className={cn("absolute inset-0 bg-gradient-to-br", slide.accent)} />
								<div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(0,0,0,0.2),_transparent_36%)]" />
								<div className="relative z-10 max-h-[88dvh] overflow-y-auto p-5 sm:p-6 md:p-8">
									<div className="space-y-5">
										<div className="flex items-center gap-2">
											{recap.slides.map((item, index) => (
												<button
													key={item.id}
													type="button"
													onClick={() => {
														setDirection(index > currentSlide ? 1 : -1);
														setCurrentSlide(index);
													}}
													className="group flex-1"
													aria-label={`Go to slide ${index + 1}`}
												>
													<span
														className={cn(
															"block h-1.5 rounded-full transition-all",
															index === currentSlide
																? "bg-white"
																: "bg-white/30 group-hover:bg-white/50",
														)}
													/>
												</button>
											))}
										</div>
										<div className="flex items-start justify-between gap-4">
											<div>
												<p className="text-xs uppercase tracking-[0.35em] text-white/65 sm:text-sm">
													{slide.eyebrow}
												</p>
												<p className="mt-2 text-sm text-white/75">
													{currentSlide + 1} / {recap.slides.length}
												</p>
											</div>
											<button
												type="button"
												onClick={closeRecap}
												className="rounded-full bg-white/12 p-2.5 text-white transition hover:bg-white/20"
												aria-label="Close recap"
											>
												<X className="h-5 w-5" />
											</button>
										</div>
									</div>
									<RecapSlideContent slide={slide} displayCount={displayCount} />
									<div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
										{slide.kind === "reveal" ? (
											<div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap">
												<Button
													asChild
													className="w-full rounded-full bg-white text-slate-950 hover:bg-orange-100 md:w-auto"
												>
													<Link href="/dashboard/my-cca">Open full breakdown</Link>
												</Button>
												<Button
													type="button"
													onClick={shareRecapImageToLinkedIn}
													disabled={imgGenerating}
													className="w-full rounded-full bg-white/90 text-slate-950 hover:bg-white md:w-auto"
												>
													Share your certificate!
												</Button>
												<Button
													type="button"
													onClick={shareRecapImageToLinkedIn}
													disabled={imgGenerating}
													className="w-full rounded-full bg-[#0A66C2] text-white hover:bg-[#004182] md:w-auto"
												>
													<Linkedin className="h-4 w-4 mr-2" />
													Share to LinkedIn
												</Button>
											</div>
										) : (
											<div className="hidden md:block" />
										)}
										<div className="flex w-full gap-3 md:w-auto">
											<Button
												type="button"
												variant="secondary"
												onClick={() => paginate(-1)}
												disabled={currentSlide === 0}
												className="flex-1 rounded-full bg-white/14 text-white hover:bg-white/20 md:flex-none"
											>
												Back
											</Button>
											<Button
												type="button"
												onClick={() => {
													if (currentSlide === recap.slides.length - 1) {
														closeRecap();
														return;
													}
													paginate(1);
												}}
												className="flex-1 rounded-full bg-white text-slate-950 hover:bg-orange-100 md:flex-none"
											>
												{currentSlide === recap.slides.length - 1 ? "Close" : "Next"}
											</Button>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
