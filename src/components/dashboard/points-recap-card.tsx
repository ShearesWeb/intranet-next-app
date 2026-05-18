"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, animate, motion, PanInfo } from "framer-motion";
import { Linkedin, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useRecapData } from "@/features/ranking/hooks/use-recap-data";
import type { RecapSlide } from "@/features/ranking/types/recap";
import { createRecapImageBlob } from "@/features/ranking/utils/create-recap-image-blob";
import { cn } from "@/lib/utils";
import { User } from "@/types/User";

const slideVariants = {
	enter: (direction: number) => ({
		opacity: 0,
		x: direction > 0 ? 60 : -60,
	}),
	center: {
		opacity: 1,
		x: 0,
	},
	exit: (direction: number) => ({
		opacity: 0,
		x: direction > 0 ? -60 : 60,
	}),
};

const swipeThreshold = 70;

function formatCount(count: number, singular: string, plural = `${singular}s`) {
	return `${count} ${count === 1 ? singular : plural}`;
}

export function PointsRecapCard({
	user,
	onSeenStateChange,
}: {
	user: User;
	onSeenStateChange?: (hasSeenRecap: boolean) => void;
}) {
	const [open, setOpen] = useState(false);
	const [direction, setDirection] = useState(1);
	const [currentSlide, setCurrentSlide] = useState(0);
	const [displayCount, setDisplayCount] = useState(0);
	const [imgGenerating, setImgGenerating] = useState(false);
	const displayCountRef = useRef(0);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const { ccas, hasSeenRecap, isMounted, loadingCcas, recap, setHasSeenRecap } = useRecapData(
		user,
		onSeenStateChange,
	);

	useEffect(() => {
		const audio = new Audio("/audio/sheares.mp3");
		audio.preload = "auto";
		audioRef.current = audio;

		return () => {
			audio.pause();
			audio.currentTime = 0;
			audioRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!open) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "ArrowRight") {
				setDirection(1);
				setCurrentSlide((prev) => Math.min(prev + 1, recap.slides.length - 1));
			}

			if (event.key === "ArrowLeft") {
				setDirection(-1);
				setCurrentSlide((prev) => Math.max(prev - 1, 0));
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, recap.slides.length]);

	useEffect(() => {
		if (!open) {
			setDisplayCount(0);
			displayCountRef.current = 0;
			return;
		}

		const activeSlide = recap.slides[currentSlide];
		const target = Number(activeSlide.statValue || 0);
		if (!Number.isFinite(target)) {
			setDisplayCount(0);
			return;
		}

		const from = displayCountRef.current;
		const delta = Math.abs(target - from);

		let controls: ReturnType<typeof animate>;

		if (activeSlide.id === "reveal") {
			const mid = from + (target - from) * 0.6;
			controls = animate(from, [mid, target], {
				times: [0, 0.7, 1],
				duration: 2.2,
				ease: [0.33, 1, 0.68, 1],
				delay: 0.12,
				onUpdate: (latest) => {
					displayCountRef.current = Number(latest);
					setDisplayCount(Math.round(Number(latest)));
				},
			});
		} else if (activeSlide.id === "intro") {
			controls = animate(from, target, {
				duration: 1.4,
				ease: [0.16, 1, 0.3, 1],
				delay: 0.08,
				onUpdate: (latest) => {
					displayCountRef.current = latest;
					setDisplayCount(Math.round(latest));
				},
			});
		} else {
			controls = animate(from, target, {
				duration: Math.min(1.3, Math.max(0.7, delta * 0.06)),
				ease: [0.22, 1, 0.36, 1],
				onUpdate: (latest) => {
					displayCountRef.current = latest;
					setDisplayCount(Math.round(latest));
				},
			});
		}

		return () => controls.stop();
	}, [currentSlide, open, recap.slides]);

	const shareText = useMemo(() => {
		const totalPoints = user.points || 0;
		const totalCcas = ccas.length;
		return `My Sheares Wrapped 25/26: ${totalPoints} points across ${totalCcas} CCAs. Relive your story too!`;
	}, [ccas.length, user.points]);

	const shareUrl =
		typeof window !== "undefined"
			? `${window.location.origin}/dashboard/mycca`
			: "https://sheares-dashboard.local";

	const slide: RecapSlide = recap.slides[currentSlide];
	const emphasis = slide.kind === "reveal" ? String(displayCount) : slide.emphasis;

	const paginate = (nextDirection: number) => {
		setDirection(nextDirection);
		setCurrentSlide((prev) => {
			const nextSlide = prev + nextDirection;
			if (nextSlide < 0 || nextSlide >= recap.slides.length) {
				return prev;
			}
			return nextSlide;
		});
	};

	const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
		if (info.offset.x <= -swipeThreshold) {
			paginate(1);
		}

		if (info.offset.x >= swipeThreshold) {
			paginate(-1);
		}
	};

	const playRecapAudio = () => {
		const audio = audioRef.current;
		if (!audio) return;

		audio.currentTime = 0;
		void audio.play().catch(() => {
			// Ignore playback failures caused by browser/device policies.
		});
	};

	const stopRecapAudio = () => {
		const audio = audioRef.current;
		if (!audio) return;

		audio.pause();
		audio.currentTime = 0;
	};

	const closeRecap = () => {
		setOpen(false);
		stopRecapAudio();
		setCurrentSlide(0);
		setDirection(1);
		setDisplayCount(0);
		displayCountRef.current = 0;
		setHasSeenRecap(true);
	};

	const _downloadRecapImage = async () => {
		if (imgGenerating) return;
		setImgGenerating(true);
		try {
			const blob = await createRecapImageBlob(user, ccas, recap);
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "sheares-wrapped.png";
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} finally {
			setImgGenerating(false);
		}
	};

	void _downloadRecapImage;

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

	return (
		<>
			<div className="relative flex min-h-[22rem] w-full flex-col justify-between overflow-hidden rounded-[32px] border border-orange-400/50 bg-gradient-to-br from-[#ff6a00] via-[#ff9500] to-[#ffb700] p-6 py-12 text-white shadow-lg shadow-orange-500/20 md:p-8 md:py-16">
				<motion.div
					className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/30 blur-3xl"
					animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.7, 0.4] }}
					transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
				/>
				<motion.div
					className="absolute -bottom-20 left-[-2rem] h-64 w-64 rounded-full bg-yellow-200/40 blur-3xl"
					animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.6, 0.3] }}
					transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
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
												? `${formatCount(recap.totals.totalCcas, "CCA")} joined.`
												: "No CCAs joined"}
									</p>
								</div>
								{hasSeenRecap ? (
									<motion.div
										className="pt-2"
										initial={{ y: 8, opacity: 0.85 }}
										animate={{ y: 0, opacity: 1 }}
									>
										<h3 className="text-7xl font-black leading-tight text-white md:text-8xl">
											{user.points || 0}
										</h3>
									</motion.div>
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
											<Link href="/dashboard/mycca">View breakdown</Link>
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
							<AnimatePresence initial={false} custom={direction} mode="wait">
								<motion.div
									key={slide.id}
									custom={direction}
									variants={slideVariants}
									initial="enter"
									animate="center"
									exit="exit"
									transition={{ duration: 0.3, ease: "easeOut" }}
									drag="x"
									dragConstraints={{ left: 0, right: 0 }}
									dragElastic={0.18}
									onDragEnd={handleDragEnd}
									className="relative"
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
															<span className="mt-2 text-sm leading-6 text-white/72">
																{slide.statNote}
															</span>
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
													<motion.p
														className="pt-2 text-6xl font-bold leading-none text-white sm:text-7xl md:text-8xl"
														key={emphasis}
														initial={{ y: 8, opacity: 0.85 }}
														animate={{ y: 0, opacity: 1 }}
														transition={{ duration: 0.2 }}
													>
														{emphasis}
													</motion.p>
												) : null}
											</div>

											<div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
												{slide.kind === "reveal" ? (
													<div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap">
														<Button
															asChild
															className="w-full rounded-full bg-white text-slate-950 hover:bg-orange-100 md:w-auto"
														>
															<Link href="/dashboard/mycca">Open full breakdown</Link>
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
								</motion.div>
							</AnimatePresence>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
