"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, animate, motion, PanInfo } from "framer-motion";
import { Linkedin, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isResidentPositionType } from "@/lib/cca-ranking-metrics";
import { CCAData } from "@/types/dashboard";
import { User } from "@/types/User";

type RecapSlide = {
    id: string;
    eyebrow: string;
    title: string;
    description: string;
    statLabel?: string;
    statValue?: string;
    statNote?: string;
    bulletItems?: string[];
    supportingText?: string;
    supportingBulletItems?: string[];
    emphasis?: string;
    accent: string;
    kind?: "copy" | "reveal";
};

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

const leadershipPositionTypes = new Set(["lead", "vice", "maincomm", "subcomm"]);
const ihgTeamStatuses = new Set(["ihg-team", "ivp-ihg-team"]);
const swipeThreshold = 70;

function formatCount(count: number, singular: string, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}

function isLeadershipRole(cca: Pick<CCAData, "position_type" | "role">) {
    const positionType = String(cca.position_type || "").trim().toLowerCase();
    const role = String(cca.role || "").trim().toLowerCase();
    return leadershipPositionTypes.has(positionType) || role.includes("lead") || role.includes("vice");
}

function truncateList(values: string[], maxVisible = 3) {
    const filtered = values.filter(Boolean);
    if (filtered.length <= maxVisible) return filtered;

    const visible = filtered.slice(0, maxVisible);
    const remaining = filtered.length - maxVisible;
    return [...visible, `${remaining} more`];
}

function isBlockCcaName(value?: string | null) {
    return String(value || "").trim().toLowerCase().startsWith("block");
}

function isResidentBlockPosition(positionType?: string | null, role?: string | null) {
    return isResidentPositionType(positionType) || String(role || "").trim().toLowerCase() === "resident";
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
    const displayCountRef = useRef(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [loadingCcas, setLoadingCcas] = useState(Boolean(user.appointments?.length));
    const [ccas, setCcas] = useState<CCAData[]>([]);
    const [hasSeenRecap, setHasSeenRecap] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const seen = localStorage.getItem("hasSeenPointsRecap");
        if (seen === "true") {
            setHasSeenRecap(true);
        }
    }, []);

    useEffect(() => {
        onSeenStateChange?.(hasSeenRecap);
    }, [hasSeenRecap, onSeenStateChange]);

    useEffect(() => {
        let isActive = true;

        if (!user.appointments?.length) {
            setCcas([]);
            setLoadingCcas(false);
            return () => {
                isActive = false;
            };
        }

        const fallbackCcas: CCAData[] = user.appointments.map((appointment) => ({
            id: appointment.cca_id,
            name: appointment.cca_name,
            role: appointment.position_name,
            position_type: appointment.position_type,
            cca_type: "unknown",
            description: "",
            points: appointment.points || 0,
            cut_status: null,
        }));

        setLoadingCcas(true);

        fetch("/api/user/getCCAs")
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error("Failed to fetch CCA recap data");
                }
                return res.json();
            })
            .then((data) => {
                if (!isActive) return;
                setCcas(Array.isArray(data.data) ? data.data : []);
            })
            .catch(() => {
                if (!isActive) return;
                setCcas(fallbackCcas);
            })
            .finally(() => {
                if (!isActive) return;
                setLoadingCcas(false);
            });

        return () => {
            isActive = false;
        };
    }, [user]);

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

    const recap = useMemo(() => {
        const totalPoints = user.points || 0;
        const totalCcas = ccas.length;
        const blockResidentAppointments = (user.appointments || []).filter((appointment) =>
            isBlockCcaName(appointment.cca_name) &&
            isResidentBlockPosition(appointment.position_type, appointment.position_name)
        );
        const ccasBeforeTopContributor = ccas;
        const committeeCcas = ccas.filter((cca) => {
            if (cca.cca_type !== "committee") return false;
            const posType = String(cca.position_type || "").trim().toLowerCase();
            return posType !== "member" && posType !== "resident";
        });
        const cultureCcas = ccas.filter((cca) => cca.cca_type === "culture");
        const sportsCcas = ccas.filter((cca) => cca.cca_type === "sports");
        const supplementaryCcas = ccas.filter((cca) => cca.cca_type === "supplementary");
        const adhocCcas = ccas.filter((cca) => cca.cca_type === "adhoc");
        const leadershipCcas = committeeCcas.filter(isLeadershipRole);
        const committeePoints = ccasBeforeTopContributor
            .filter((cca) => {
                if (cca.cca_type !== "committee") return false;
                const posType = String(cca.position_type || "").trim().toLowerCase();
                return posType !== "member" && posType !== "resident";
            })
            .reduce((sum, cca) => sum + (cca.points || 0), 0);
        const culturePoints = ccasBeforeTopContributor
            .filter((cca) => cca.cca_type === "culture")
            .reduce((sum, cca) => sum + (cca.points || 0), 0);
        const sportsPoints = ccasBeforeTopContributor
            .filter((cca) => cca.cca_type === "sports")
            .reduce((sum, cca) => sum + (cca.points || 0), 0);
        const supplementaryPoints = ccasBeforeTopContributor
            .filter((cca) => cca.cca_type === "supplementary")
            .reduce((sum, cca) => sum + (cca.points || 0), 0);
        const adhocPoints = ccasBeforeTopContributor
            .filter((cca) => cca.cca_type === "adhoc")
            .reduce((sum, cca) => sum + (cca.points || 0), 0);
        const blockPoints = blockResidentAppointments
            .reduce((sum, appointment) => sum + (appointment.points || 0), 0);
        const cumulativeAfterCulture = culturePoints;
        const cumulativeAfterSports = culturePoints + sportsPoints;
        const cumulativeAfterCommittees = culturePoints + sportsPoints + committeePoints;
        const cumulativeAfterBlock = cumulativeAfterCommittees + blockPoints;
        const cumulativeAfterSupplementary = cumulativeAfterBlock + supplementaryPoints;
        const cumulativeAfterAdhoc = cumulativeAfterSupplementary + adhocPoints;
        const sportsIhgTeamCount = sportsCcas.filter((cca) =>
            ihgTeamStatuses.has(String(cca.cut_status || "").trim().toLowerCase())
        ).length;

        const committeeNames = truncateList(committeeCcas.map((cca) => cca.name));
        const sportsNames = truncateList(sportsCcas.map((cca) => cca.name));
        const cultureNames = truncateList(cultureCcas.map((cca) => cca.name));
        const supplementaryNames = truncateList(
            supplementaryCcas.map((cca) => cca.name)
        );
        const adhocNames = truncateList(
            adhocCcas.map((cca) => cca.name)
        );
        const blockResidentNames = truncateList(
            blockResidentAppointments.map((appointment) => appointment.cca_name)
        );
        const leadershipDescriptions = truncateList(
            leadershipCcas.map((cca) => `${cca.role} in ${cca.name}`),
            2
        );

        const slides: RecapSlide[] = [
            {
                id: "intro",
                eyebrow: "Points Recap",
                title: "How did you earn points?",
                description: `Before the final reveal, let’s trace how your AY25/26 took shape.`,
                statLabel: "Points so far",
                statValue: "0",
                statNote: `You were in ${formatCount(totalCcas, "CCA")} this year`,
                supportingText: "Watch this number climb as each cca adds to your final points.",
                accent: "from-[#2a1458] via-[#7b2ff7] to-[#ff5ea8]",
            },
            {
                id: "culture",
                eyebrow: "Culture",
                title: "How cultural were you this year?",
                description:
                    cultureCcas.length > 0
                        ? `You joined ${formatCount(cultureCcas.length, "culture CCA")}.`
                        : "This part of your year stayed in the background.",
                statLabel: "Points so far",
                statValue: String(cumulativeAfterCulture),
                statNote:
                    culturePoints > 0
                        ? `${culturePoints} point${culturePoints === 1 ? "" : "s"} came from the cultures.`
                        : cultureCcas.length > 0
                            ? "The colour was there, even if the scoreboard stayed quiet :("
                            : undefined,
                bulletItems: cultureCcas.length > 0 ? cultureNames : undefined,
                supportingText: "All your trainings, concerts, practices led to this.",
                accent: "from-[#2b124c] via-[#ff4d8d] to-[#ff9f43]",
            },
            {
                id: "sports",
                eyebrow: "Activity",
                title: "How physically active were you in Sheares?",
                description:
                    sportsCcas.length > 0
                        ? `You joined ${formatCount(sportsCcas.length, "sport CCA")}.`
                        : "Perhaps your energy showed up somewhere else this year?",
                statLabel: "Points so far",
                statValue: String(cumulativeAfterSports),
                statNote:
                    sportsIhgTeamCount > 0
                        ? `You represented Sheares Hall in IHG in ${sportsIhgTeamCount} sports.`
                        : sportsCcas.length > 0
                            ? `${sportsPoints} point${sportsPoints === 1 ? "" : "s"} came from sports.`
                            : undefined,
                bulletItems: sportsCcas.length > 0 ? sportsNames : undefined,
                supportingText: "Sheares Hall Sports Hall??",
                accent: "from-[#10203f] via-[#1e90ff] to-[#00c6ff]",
            },
            {
                id: "committees",
                eyebrow: "Committees",
                title: "So.. do you like to plan events?",
                description:
                    committeeCcas.length > 0
                        ? `You joined ${formatCount(committeeCcas.length, "committee", "committees")} in total.`
                        : "You stayed fairly quiet this year.",
                statLabel: "Points so far",
                statValue: String(cumulativeAfterCommittees),
                statNote:
                    committeePoints > 0
                        ? `${committeePoints} point${committeePoints === 1 ? "" : "s"} came from the work of building and shaping hall life.`
                        : committeeCcas.length > 0
                            ? "The effort was there even if the points have not landed yet."
                            : undefined,
                bulletItems: committeeCcas.length > 0 ? committeeNames : undefined,
                supportingText:
                    leadershipDescriptions.length > 0
                        ? `You also took on ${formatCount(leadershipCcas.length, "leadership position")}.`
                        : committeeCcas.length > 0
                            ? "No leadership roles here, but you still did the work."
                            : undefined,
                supportingBulletItems: leadershipDescriptions.length > 0 ? leadershipDescriptions : undefined,
                accent: "from-[#35155d] via-[#c94b4b] to-[#f2994a]",
            },
            {
                id: "block",
                eyebrow: "Block",
                title: "Are you active in your block?",
                description:
                    blockResidentAppointments.length > 0
                        ? "Block points also contributed to your total."
                        : "No block points showed up here.",
                statLabel: "Points so far",
                statValue: String(cumulativeAfterBlock),
                statNote:
                    blockPoints > 0
                        ? `${blockPoints} block point${blockPoints === 1 ? "" : "s"} came in here.`
                        : undefined,
                bulletItems: blockResidentNames.length > 0 ? blockResidentNames : undefined,
                supportingText: blockPoints > 0 ? "Home ground matters too." : undefined,
                accent: "from-[#0f172a] via-[#1e3a8a] to-[#3b82f6]", // Darker blue
            },
            {
                id: "supplementary",
                eyebrow: "Supplementary",
                title: "You also participated in some events!",
                description:
                    supplementaryCcas.length > 0
                        ? "Some extra points quietly slipped into your pocket too."
                        : "No supplementary points showed up this time.",
                statLabel: "Points so far",
                statValue: String(cumulativeAfterSupplementary),
                statNote:
                    supplementaryPoints > 0
                        ? `${supplementaryPoints} supplementary point${supplementaryPoints === 1 ? "" : "s"} came in here.`
                        : undefined,
                bulletItems: supplementaryNames.length > 0 ? supplementaryNames : undefined,
                supportingText:
                    supplementaryPoints > 0
                        ? "Small additions still make the total feel very different."
                        : undefined,
                accent: "from-[#064e3b] via-[#166534] to-[#10b981]", // Vibrant green
            },
            {
                id: "adhoc",
                eyebrow: "Adhoc Events",
                title: "There were some adhoc events too",
                description:
                    adhocCcas.length > 0
                        ? "You joined them and snagged some extra points."
                        : "Did you join them?",
                statLabel: "Points so far",
                statValue: String(cumulativeAfterAdhoc),
                statNote:
                    adhocPoints > 0
                        ? `${adhocPoints} adhoc point${adhocPoints === 1 ? "" : "s"} came in here.`
                        : undefined,
                bulletItems: adhocNames.length > 0 ? adhocNames : undefined,
                supportingText: adhocPoints > 0 ? "Every little event counts." : undefined,
                accent: "from-[#4c1d95] via-[#7e22ce] to-[#c084fc]", // Vibrant purple tone
            },
            {
                id: "reveal",
                eyebrow: "Final Score",
                title: "Your Final Hall Points",
                description: `This is where your hall points stand at.`,
                statLabel: "Total points",
                statValue: String(totalPoints),
                statNote: "Did you beat your friends? Share your statistics on LinkedIn.",
                emphasis: String(totalPoints),
                supportingText: totalCcas > 0 ? `${formatCount(totalCcas, "CCA")} joined.` : "No CCAs joined yet.",
                accent: "from-[#ff6a00] via-[#ff9500] to-[#ffb700]",
                kind: "reveal",
            },
        ];

        return {
            slides,
            totals: {
                totalPoints,
                totalCcas,
                culturePoints,
                sportsPoints,
                committeePoints,
                supplementaryPoints,
                adhocPoints,
                blockPoints,
            },
        };
    }, [ccas, user.appointments, user.points]);

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

    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/dashboard/mycca` : "https://sheares-dashboard.local";

    const slide = recap.slides[currentSlide];
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
        localStorage.setItem("hasSeenPointsRecap", "true");
    };

    const [imgGenerating, setImgGenerating] = useState(false);
    const createRecapImageBlob = async () => {
        const width = 1080;
        const height = 1350;
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("ctx");
        ctx.scale(scale, scale);

        const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        };

        // Certificate Background
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, "#ff6a00");
        grad.addColorStop(0.5, "#ff9500");
        grad.addColorStop(1, "#ffb700");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        const vignette = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
        vignette.addColorStop(0, "rgba(255,255,255,0.05)");
        vignette.addColorStop(1, "rgba(150, 40, 0, 0.45)"); // Burnt orange vignette for contrast
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);

        // Certificate Borders
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 3;
        roundedRect(40, 40, width - 80, height - 80, 24);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        roundedRect(54, 54, width - 108, height - 108, 16);
        ctx.stroke();

        // Header Text
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;

        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 64px system-ui, -apple-system, sans-serif";
        ctx.fillText("SHEARES WRAPPED", width / 2, 160);

        ctx.font = "700 32px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fillText("25/26 HALL POINTS RECAP", width / 2, 220);

        ctx.font = "italic 600 40px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#ffffff";
        const userName = (user.name || "Resident").toUpperCase();
        ctx.fillText(userName, width / 2, 280);

        ctx.shadowColor = "transparent";

        const formatName = (c: Pick<CCAData, "name" | "role" | "position_type">) =>
            (isLeadershipRole(c) && c.role) ? `${c.role} in ${c.name}` : c.name;

        // Filter valid categories
        const catDefs = [
            { label: "Culture", items: (ccas || []).filter(c => c.cca_type === "culture").map(c => ({ name: formatName(c), points: c.points || 0 })), total: (recap.totals.culturePoints || 0) },
            { label: "Sports", items: (ccas || []).filter(c => c.cca_type === "sports").map(c => ({ name: formatName(c), points: c.points || 0 })), total: (recap.totals.sportsPoints || 0) },
            {
                label: "Committees", items: (ccas || []).filter(c => {
                    if (c.cca_type !== "committee") return false;
                    const posType = String(c.position_type || "").trim().toLowerCase();
                    return posType !== "member" && posType !== "resident";
                }).map(c => ({ name: formatName(c), points: c.points || 0 })), total: (recap.totals.committeePoints || 0)
            },
            {
                label: "Block",
                items: (user.appointments || [])
                    .filter((appointment) => isBlockCcaName(appointment.cca_name) && isResidentBlockPosition(appointment.position_type, appointment.position_name))
                    .map((appointment) => ({ name: appointment.cca_name, points: appointment.points || 0 })),
                total: (recap.totals.blockPoints || 0)
            },
            { label: "Supplementary", items: (ccas || []).filter(c => c.cca_type === "supplementary").map(c => ({ name: formatName(c), points: c.points || 0 })), total: (recap.totals.supplementaryPoints || 0) },
            { label: "Adhoc", items: (ccas || []).filter(c => c.cca_type === "adhoc").map(c => ({ name: formatName(c), points: c.points || 0 })), total: (recap.totals.adhocPoints || 0) },
        ].filter(cat => cat.items.length > 0 || cat.total > 0);

        // Semi-transparent container for CCAs
        ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
        roundedRect(80, 330, width - 160, 710, 24);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Layout calculation for columns
        let totalLines = catDefs.length * 2;
        catDefs.forEach(c => {
            totalLines += c.items.length;
        });

        const useTwoCols = totalLines > 11;
        const col1X = 120;
        const col1Width = useTwoCols ? (width - 290) / 2 : width - 240;
        const col2X = useTwoCols ? col1X + col1Width + 50 : col1X;

        let currentX = col1X;
        const currentWidth = col1Width;
        let y = 400;
        const maxY = 1000;

        const drawText = (text: string, x: number, yy: number, font: string, align: CanvasTextAlign, color = "#ffffff") => {
            ctx.font = font;
            ctx.fillStyle = color;
            ctx.textAlign = align;
            ctx.fillText(text, x, yy);
        };

        const wrapText = (text: string, maxW: number, font: string): string[] => {
            ctx.font = font;
            const words = text.split(' ');
            const lines: string[] = [];
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
                if (width < maxW) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            return lines;
        };

        for (const cat of catDefs) {
            // Check if we need to move to the second column to avoid orphans
            const spaceNeeded = 70 + cat.items.length * 40;
            if (useTwoCols && currentX === col1X && y + spaceNeeded > maxY && y > 450) {
                currentX = col2X;
                y = 400;
            }

            ctx.font = "800 28px system-ui, -apple-system, sans-serif";
            drawText(cat.label, currentX, y, "800 28px system-ui, -apple-system, sans-serif", "left", "#ffffff");
            drawText(`${cat.total} pts`, currentX + currentWidth, y, "800 28px system-ui, -apple-system, sans-serif", "right", "#ffffff");

            // Subtle line under category
            ctx.beginPath();
            ctx.moveTo(currentX, y + 15);
            ctx.lineTo(currentX + currentWidth, y + 15);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
            ctx.stroke();

            y += 50;

            for (const item of cat.items) {
                const ptsText = `${item.points} pts`;
                ctx.font = "700 24px system-ui, -apple-system, sans-serif";
                const ptsWidth = ctx.measureText(ptsText).width;

                const nameFont = "500 24px system-ui, -apple-system, sans-serif";
                const nameMaxW = currentWidth - ptsWidth - 25; // buffer between name and points

                const nameLines = wrapText(`• ${item.name}`, nameMaxW, nameFont);
                const itemHeight = Math.max(nameLines.length * 30, 36);

                if (useTwoCols && currentX === col1X && y + itemHeight > maxY - 20) {
                    currentX = col2X;
                    y = 400;
                }

                drawText(ptsText, currentX + currentWidth, y, "700 24px system-ui, -apple-system, sans-serif", "right", "rgba(255, 255, 255, 0.95)");

                for (let i = 0; i < nameLines.length; i++) {
                    const lineX = currentX + 10 + (i > 0 ? 15 : 0);
                    drawText(nameLines[i], lineX, y + (i * 30), nameFont, "left", "rgba(255, 255, 255, 0.95)");
                }

                y += itemHeight + 6;
            }
            y += 24; // space before next category
        }

        // Bottom Total section
        ctx.textAlign = "center";

        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.font = "800 32px system-ui, -apple-system, sans-serif";
        ctx.fillText("TOTAL SCORE", width / 2, 1120);

        ctx.fillStyle = "#ffffff";
        ctx.font = "900 150px system-ui, -apple-system, sans-serif";
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;
        ctx.fillText(String(recap.totals.totalPoints), width / 2, 1260);
        ctx.shadowColor = "transparent";

        return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), "image/png", 0.92));
    };

    // TODO(Phase-4): Reconnect or remove -- currently unused.
    const _downloadRecapImage = async () => {
        if (imgGenerating) return;
        setImgGenerating(true);
        try {
            const blob = await createRecapImageBlob();
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
            const blob = await createRecapImageBlob();
            const file = new File([blob], "sheares-wrapped.png", { type: "image/png" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: "Sheares Wrapped" });
                return;
            }
            navigator.clipboard?.writeText?.(`${shareText} ${shareUrl}`).catch(() => { });
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
                                            : recap.totals.totalCcas > 0 ? `${formatCount(recap.totals.totalCcas, "CCA")} joined.`
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
                    <DialogDescription className="sr-only">
                        View your Sheares points recap.
                    </DialogDescription>

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
                                                                index === currentSlide ? "bg-white" : "bg-white/30 group-hover:bg-white/50"
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
