'use client';

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StyleMeta = { bg: string; label?: string; text?: string };

const ccaStyles: Record<string, StyleMeta> = {
    sports: { bg: "bg-emerald-600", text: "text-white" },
    committee: { bg: "bg-sky-600", text: "text-white" },
    culture: { bg: "bg-rose-600", text: "text-white" },
    jcrc: { bg: "bg-amber-600", text: "text-white" },
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

export function CcaTypeBadge({ value, className }: BadgeProps) {
    const key = value?.toLowerCase().trim();
    const style = (key && ccaStyles[key]) || fallbackStyle;
    return (
        <Badge variant="secondary" className={cn(style.bg, style.text ?? "text-white", className)}>
            {style.label ?? humanize(value)}
        </Badge>
    );
}
