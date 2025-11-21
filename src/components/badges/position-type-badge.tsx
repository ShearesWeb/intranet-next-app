'use client';

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StyleMeta = { bg: string; label?: string; text?: string };

const positionStyles: Record<string, StyleMeta> = {
    lead: { bg: "bg-red-600", text: "text-white" },
    leadership: { bg: "bg-red-600", text: "text-white", label: "Lead" },
    vice: { bg: "bg-orange-500", text: "text-white" },
    maincomm: { bg: "bg-amber-500", text: "text-white" },
    subcomm: { bg: "bg-green-600", text: "text-white" },
    subcommittee: { bg: "bg-green-600", text: "text-white", label: "Subcomm" },
    blockcomm: { bg: "bg-blue-600", text: "text-white" },
    "team manager": { bg: "bg-cyan-600", text: "text-white" },
    crew: { bg: "bg-purple-600", text: "text-white" },
    member: { bg: "bg-slate-600", text: "text-white" },
};

const fallbackStyle: StyleMeta = { bg: "bg-slate-500", text: "text-white" };

const humanize = (value: string) =>
    value
        ? value
              .replace(/[_-]+/g, " ")
              .split(" ")
              .filter(Boolean)
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(" ")
        : "Unknown";

type BadgeProps = {
    value: string;
    className?: string;
};

export function PositionTypeBadge({ value, className }: BadgeProps) {
    const key = value?.toLowerCase().trim();
    const style = (key && positionStyles[key]) || fallbackStyle;
    return (
        <Badge variant="secondary" className={cn(style.bg, style.text ?? "text-white", className)}>
            {style.label ?? humanize(value)}
        </Badge>
    );
}
